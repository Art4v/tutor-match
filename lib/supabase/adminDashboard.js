// ============================================================================
// Reads for the /admin dashboard (SERVER-ONLY).
// ----------------------------------------------------------------------------
// The only path to dashboard data, the way lib/supabase/tutors.js is for tutor
// data. Queue reads take the SERVICE-ROLE client and are only ever called
// after app/admin/guard.js has confirmed the caller is an admin: the rows they
// return (pending tutors, private reports, any account's email) are not
// readable under RLS. Every WRITE is an admin RPC called by an /api/admin
// route, never from here.
//
// History is the exception: admin_actions has an admin-only SELECT policy
// (0074), so it is read through the caller's own client.
// ============================================================================

const QUEUE_LIMIT = 100;
export const HISTORY_PAGE_SIZE = 50;

/** { verifications, reviews, reports, revisions } via the admin-checked RPC. */
export async function getPendingCounts(supabase) {
  const { data } = await supabase.rpc("admin_pending_counts");
  return {
    verifications: data?.verifications ?? 0,
    reviews: data?.reviews ?? 0,
    reports: data?.reports ?? 0,
    revisions: data?.revisions ?? 0,
  };
}

export async function listVerificationQueue(admin) {
  const { data } = await admin
    .from("tutor_profiles")
    .select("id, slug, suburb, city, verification_requested_at, profile:profiles!inner ( full_name )")
    .eq("verification_status", "pending")
    .order("verification_requested_at", { ascending: true, nullsFirst: false })
    .limit(QUEUE_LIMIT);
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.profile?.full_name || "Unnamed tutor",
    location: [t.suburb, t.city].filter(Boolean).join(", "),
    slug: t.slug,
    at: t.verification_requested_at,
  }));
}

export async function listReviewQueue(admin) {
  const { data: rows } = await admin
    .from("reviews")
    .select("id, tutor_id, partner_id, student_id, rating, body, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(QUEUE_LIMIT);
  const reviews = rows ?? [];
  const names = await profileNames(admin, reviews.flatMap((r) => [r.student_id, r.tutor_id]));
  const companies = await companyNames(admin, reviews.map((r) => r.partner_id));
  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    at: r.created_at,
    studentName: names.get(r.student_id) || "A student",
    subjectName: r.partner_id ? companies.get(r.partner_id) || "a company" : names.get(r.tutor_id) || "a tutor",
  }));
}

export async function listReportQueue(admin) {
  const { data: rows } = await admin
    .from("reports")
    .select("id, reporter_id, reported_id, review_id, category, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(QUEUE_LIMIT);
  const reports = rows ?? [];
  const names = await profileNames(admin, reports.flatMap((r) => [r.reporter_id, r.reported_id]));
  return reports.map((r) => ({
    id: r.id,
    category: r.category,
    aboutAReview: !!r.review_id || r.category === "inappropriate_review",
    at: r.created_at,
    reporterName: names.get(r.reporter_id) || "A user",
    reportedName: names.get(r.reported_id) || "another user",
  }));
}

export async function listRevisionQueue(admin) {
  const { data: rows } = await admin
    .from("tutor_profile_revisions")
    .select("id, tutor_id, submitted_at")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(QUEUE_LIMIT);
  const revisions = rows ?? [];
  const names = await profileNames(admin, revisions.map((r) => r.tutor_id));
  return revisions.map((r) => ({
    id: r.id,
    tutorName: names.get(r.tutor_id) || "A tutor",
    at: r.submitted_at,
  }));
}

/** Every company, hidden and claimed included, newest first. */
export async function listCompaniesForAdmin(supabase) {
  // list_partners_for_inviter (0068) re-checks the caller is an admin (0074).
  const { data, error } = await supabase.rpc("list_partners_for_inviter");
  return { companies: data ?? [], failed: Boolean(error) };
}

/**
 * Account search for /admin/users: by name (profiles.full_name) or exact
 * email. Email lookup goes through the auth admin API because profiles has no
 * email column. Returns at most 50 rows.
 */
export async function searchUsers(admin, q) {
  const term = (q ?? "").trim();
  let ids = [];

  if (term.includes("@")) {
    const id = await userIdByEmail(admin, term);
    if (id) ids = [id];
  }

  let query = admin
    .from("profiles")
    .select("id, full_name, role, status, is_admin, can_author_articles, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (ids.length) {
    query = query.in("id", ids);
  } else if (term) {
    query = query.ilike("full_name", `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  }
  const { data } = await query;
  return data ?? [];
}

/** One account for /admin/users/[id], or null. */
export async function getUserForAdmin(admin, userId) {
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, role, status, is_admin, can_author_articles, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  const [{ data: auth }, { data: tutor }, { data: company }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin
      .from("tutor_profiles")
      .select("slug, verification_status, visibility, partner_id")
      .eq("id", userId)
      .maybeSingle(),
    admin.from("partners").select("name, slug").eq("owner_id", userId).maybeSingle(),
  ]);

  return {
    ...profile,
    email: auth?.user?.email ?? null,
    lastSignInAt: auth?.user?.last_sign_in_at ?? null,
    tutor: tutor ?? null,
    company: company ?? null,
  };
}

/** Admins, for the History filter (name + id). */
export async function listAdmins(admin) {
  const { data } = await admin.from("profiles").select("id, full_name").eq("is_admin", true).order("full_name");
  return data ?? [];
}

/**
 * History rows, newest first, through the caller's client (admin-only RLS).
 * filters: { adminId, action, from, to, targetType, targetId, page }.
 * `from` / `to` are YYYY-MM-DD dates in Sydney time, `to` inclusive.
 */
export async function listHistory(supabase, filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const size = filters.pageSize ?? HISTORY_PAGE_SIZE;
  let query = supabase
    .from("admin_actions")
    .select("id, admin_id, admin_name, action, target_type, target_id, target_label, reason, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);

  if (filters.adminId) query = query.eq("admin_id", filters.adminId);
  if (filters.action) query = query.like("action", `${filters.action}%`);
  if (filters.targetType) query = query.eq("target_type", filters.targetType);
  if (filters.targetId) query = query.eq("target_id", filters.targetId);
  if (isDate(filters.from)) query = query.gte("created_at", sydneyMidnight(filters.from));
  if (isDate(filters.to)) query = query.lt("created_at", sydneyMidnight(filters.to, 1));

  const { data, count } = await query;
  return { rows: data ?? [], total: count ?? 0, page, pageSize: size };
}

/** The latest History row for one target (the "decided by" line). */
export async function lastActionFor(supabase, targetType, targetId) {
  const { rows } = await listHistory(supabase, { targetType, targetId, pageSize: 1 });
  return rows[0] ?? null;
}

// ── internals ────────────────────────────────────────────────────────────────

async function profileNames(admin, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await admin.from("profiles").select("id, full_name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}

async function companyNames(admin, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await admin.from("partners").select("id, name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.name]));
}

// auth.admin has no lookup by email, so page through users. Fine at this
// site's size; revisit if accounts reach the tens of thousands.
async function userIdByEmail(admin, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const hit = data?.users?.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (!data?.users || data.users.length < 1000) return null;
  }
  return null;
}

function isDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Midnight in Sydney on `ymd` (+ `addDays`), as an ISO instant. The offset is
// read from Intl so daylight saving is right on either side of the change.
function sydneyMidnight(ymd, addDays = 0) {
  const [y, m, d] = ymd.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d + addDays));
  const offset = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", timeZoneName: "longOffset" })
    .formatToParts(utcGuess)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT+10:00"
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset ?? "");
  const minutes = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
  return new Date(utcGuess.getTime() - minutes * 60000).toISOString();
}
