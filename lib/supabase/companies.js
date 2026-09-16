// ============================================================================
// Company (tutoring company) data access.
// ----------------------------------------------------------------------------
// The ONLY path to company data, exactly as lib/supabase/tutors.js is for
// tutors and lib/blog.js is for articles. Every read takes a supabase client as
// its first argument so the caller decides whose RLS applies.
//
// Reads return a camelCase object; the DB stays snake_case. Visibility is NOT
// re-checked in JS: the 0063 policies already hide a hidden company and a
// company whose owner is disabled, and an unclaimed company is deliberately
// visible (that is the whole invite model).
// ============================================================================

import { normaliseCredentials, extractAtarFromCredentials } from "./tutors";

const COMPANY_SELECT = `
  id, slug, name, website_url, bio, bio_long, suburb, city,
  service_lat, service_lng, logo_url, banner_url, avatar_bg, banner_bg,
  initials, visibility, owner_id, rating, review_count,
  packages:partner_packages ( label, price, position )
`;

function companyRowToDetail(row) {
  if (!row) return null;
  const packages = [...(row.packages ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((p) => ({ label: p.label, price: p.price }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    websiteUrl: row.website_url ?? null,
    bio: row.bio ?? "",
    bioLong: row.bio_long ?? "",
    suburb: row.suburb ?? "",
    city: row.city ?? "",
    serviceLat: row.service_lat ?? null,
    serviceLng: row.service_lng ?? null,
    logoImg: row.logo_url ?? null,
    bannerImg: row.banner_url ?? null,
    avatarBg: row.avatar_bg ?? null,
    bannerBg: row.banner_bg ?? null,
    initial: row.initials ?? (row.name ? row.name.charAt(0).toUpperCase() : "?"),
    visibility: row.visibility ?? "public",
    ownerId: row.owner_id ?? null,
    // Trigger-derived from approved reviews (0067), never written by the
    // editor: companies_guard_derived pins both columns against a client write.
    rating: row.rating != null ? Number(row.rating) : null,
    reviewCount: row.review_count ?? 0,
    // The company's one rate card. Every tutor listed under it renders these
    // prices rather than a rate of their own (0064).
    packages,
    // Cheapest package, which is what the browse rate filter mirrors in 0064.
    // A plain value, not a getter: these objects cross the server/client
    // boundary and accessors do not survive serialization.
    fromPrice: packages.length ? Math.min(...packages.map((p) => p.price)) : null,
  };
}

/** Public company page. Returns null when there's no visible match. */
export async function getCompanyBySlug(supabase, slug) {
  if (!slug) return null;
  const { data, error } = await supabase
    .from("partners")
    .select(COMPANY_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return companyRowToDetail(data);
}

/**
 * The company the signed-in user owns, or null. This is both the "take me to my
 * own page" resolver for /company and the owner short-circuit on
 * /companies/[slug], so it deliberately ignores visibility — an owner must be
 * able to reach a hidden page in order to unhide it.
 */
export async function getMyCompany(supabase, userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("partners")
    .select(COMPANY_SELECT)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return companyRowToDetail(data);
}

/**
 * Persist the editor's draft. Mirrors saveTutorProfile's contract exactly:
 * returns { ok: true } or { ok: false, error } and NEVER throws, so a caller
 * can branch on the result instead of wrapping every save in try/catch.
 *
 * Two steps, only the second transactional — the same split saveTutorProfile
 * has, and for the same reason: the slug rename is a separate race-safe RPC.
 */
export async function saveCompanyProfile(supabase, company, prevName = null) {
  const name = (company.name ?? "").trim();
  if (!name) return { ok: false, error: { message: "Your company needs a name." } };

  // Rename first, and only on an actual rename — `prevName` is the committed
  // name the editor still holds. Calling it unconditionally would re-derive the
  // slug on every save, which quietly churns the public URL of any company whose
  // slug carries a collision suffix. assign_partner_slug resolves the target
  // through owner_id, so it can only ever rewrite the caller's own.
  let slug = company.slug;
  if (prevName != null && name !== prevName.trim()) {
    const { data, error } = await supabase.rpc("assign_partner_slug", { p_name: name });
    if (error) return { ok: false, error };
    if (data) slug = data;
  }

  const payload = {
    profile: {
      name,
      website_url: company.websiteUrl ?? null,
      bio: company.bio ?? null,
      bio_long: company.bioLong ?? null,
      suburb: company.suburb ?? null,
      city: company.city ?? null,
      service_lat: company.serviceLat ?? null,
      service_lng: company.serviceLng ?? null,
      logo_url: company.logoImg ?? null,
      banner_url: company.bannerImg ?? null,
      avatar_bg: company.avatarBg ?? null,
      banner_bg: company.bannerBg ?? null,
      initials: company.initial ?? null,
      visibility: company.visibility ?? "public",
    },
    packages: (company.packages ?? [])
      .filter((p) => (p.label ?? "").trim() !== "" && p.price !== "" && p.price != null)
      .map((p) => ({ label: p.label.trim(), price: Number(p.price) })),
  };

  const { error } = await supabase.rpc("save_partner_profile", { p_payload: payload });
  if (error) return { ok: false, error };
  return { ok: true, slug };
}

// How many of a company's tutors the feed card shows before it defers to the
// company's own page. Three is enough to show a real roster without one company
// filling the feed: a compact TutorCard is about 190px tall.
const PREVIEW_TUTOR_LIMIT = 3;

/**
 * The `/companies` directory. A deliberately coarser filter set than /browse:
 * a company has no ATAR, no year range and no per-tutor rate, so only state,
 * subject and free text apply.
 *
 * Subjects are derived from the company's TUTORS rather than stored on the
 * company. That is not a shortcut: a company teaches exactly what its tutors
 * teach, so a `company_subjects` table would be a second copy of that fact,
 * free to drift the moment a tutor's subjects changed.
 *
 * Follows getTutorsForBrowse's "resolve ids first, then one .in()" shape for
 * the same reason: the subject relation is two joins away, so filtering it
 * inline would break the count.
 *
 * Tutors come back in two passes. The embed stays DELIBERATELY light and
 * unlimited, because it is what `tutorCount` and the tutor-first sort are
 * counted from; a PostgREST referenced-table limit applies per parent row, so
 * capping it there would cap the count itself. The handful of tutors the card
 * actually renders are then read in one second query, at full card width.
 */
export async function listCompanies(supabase, { q = "", states = [], subjectSlugs = [] } = {}) {
  let filteredIds = null;

  if (subjectSlugs.length > 0) {
    const { data: subjectRows } = await supabase
      .from("subjects")
      .select("id")
      .in("slug", subjectSlugs);
    const subjectIds = (subjectRows ?? []).map((r) => r.id);
    if (subjectIds.length === 0) return [];

    const { data: links } = await supabase
      .from("tutor_subjects")
      .select("tutor_id")
      .in("subject_id", subjectIds);
    const tutorIds = [...new Set((links ?? []).map((r) => r.tutor_id))];
    if (tutorIds.length === 0) return [];

    const { data: owners } = await supabase
      .from("tutor_profiles")
      .select("partner_id")
      .in("id", tutorIds)
      .not("partner_id", "is", null);
    filteredIds = [...new Set((owners ?? []).map((r) => r.partner_id))];
    if (filteredIds.length === 0) return [];
  }

  let query = supabase
    .from("partners")
    .select(`${COMPANY_SELECT}, tutors:tutor_profiles ( id, visibility, created_at )`)
    .eq("visibility", "public")
    // Oldest first, so a company shows the same three tutors on every render and
    // every visit. Ordering an embed does not cap it, unlike a referenced limit.
    .order("created_at", { foreignTable: "tutors", ascending: true });

  if (filteredIds) query = query.in("id", filteredIds);
  if (states.length > 0) query = query.in("city", states);
  if (q.trim()) {
    const like = `%${q.trim()}%`;
    query = query.or(`name.ilike.${like},bio.ilike.${like},suburb.ilike.${like}`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const companies = data.map((row) => {
    // Hidden tutors are filtered HERE rather than in the query because 0065
    // lets a company's owner read their own hidden rows, and an owner browsing
    // the public directory must not see them on a public card.
    const visibleTutors = (row.tutors ?? []).filter((t) => t.visibility === "public");
    return {
      ...companyRowToDetail(row),
      tutorCount: visibleTutors.length,
      previewIds: visibleTutors.slice(0, PREVIEW_TUTOR_LIMIT).map((t) => t.id),
    };
  });

  // Second pass: the full card shape, for only the rows a card will render.
  // Bounded at PREVIEW_TUTOR_LIMIT per company however large the rosters are,
  // which is the whole reason this isn't one wider embed.
  const previewIds = companies.flatMap((p) => p.previewIds);
  const cards = await getCompanyTutorCardsByIds(supabase, previewIds);
  const byId = new Map(cards.map((c) => [c.id, c]));

  return companies
    .map(({ previewIds: ids, ...company }) => ({
      ...company,
      // Mapped through the id list rather than taking the query's own order, so
      // the cards stay in the company's oldest-first order.
      previewTutors: ids.map((id) => byId.get(id)).filter(Boolean),
    }))
    // Companies with tutors listed are the useful result, so they lead; within
    // each group, alphabetical. Sorted here rather than in SQL because
    // tutorCount is computed from an embedded relation.
    .sort((a, b) => b.tutorCount - a.tutorCount || a.name.localeCompare(b.name));
}

// ── Company tutors ──────────────────────────────────────────────────────────
// A company tutor is an ordinary `tutor_profiles` row with `partner_id` set, so
// these helpers read that table rather than a parallel one. That is the whole
// reason /browse, the cards and /tutor/[slug] need no company-specific query.

// Shaped to match BROWSE_SELECT (lib/supabase/tutors.js) closely enough that
// `companyTutorRowToCard` can feed the real <TutorCard>, which is what the
// company page lists its tutors with. `rate` / `city` / `suburb` are the 0066
// mirrors, so they carry the company's own figures rather than nulls.
const COMPANY_TUTOR_SELECT = `
  id, slug, bio, bio_long, avatar_url, avatar_bg, banner_url, banner_bg,
  initials, visibility, city, suburb, rate, credentials, year_min, year_max,
  profile:profiles!inner ( full_name ),
  subjects:tutor_subjects ( position, subject:subjects ( name, slug, exam_code ) )
`;

function companyTutorRowToCard(row) {
  const subjects = [...(row.subjects ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s) => s.subject)
    .filter(Boolean)
    .map((s) => ({ name: s.name, slug: s.slug, exam: s.exam_code }));

  const name = row.profile?.full_name ?? "";
  return {
    id: row.id,
    slug: row.slug,
    name,
    bio: row.bio ?? "",
    bioLong: row.bio_long ?? "",
    avatarImg: row.avatar_url ?? null,
    avatarBg: row.avatar_bg ?? null,
    bannerImg: row.banner_url ?? null,
    bannerBg: row.banner_bg ?? null,
    initial: row.initials ?? (name ? name.charAt(0).toUpperCase() : "?"),
    visibility: row.visibility ?? "public",
    city: row.city ?? "",
    suburb: row.suburb ?? "",
    rate: row.rate ?? 0,
    credentials: (row.credentials ?? []).filter((c) => c?.label),
    // Defaulted to the COLUMN defaults (0011/0019: K to Year 12), NOT to
    // YearLevelsSection's own 7-to-12 fallback. The editor seeds its draft from
    // this, so a wrong default here gets written back on the next save and
    // quietly drops the tutor out of every K to Year 6 browse filter.
    yearMin: row.year_min ?? 0,
    yearMax: row.year_max ?? 12,
    subjects,
  };
}

/**
 * The tutors a company lists. Used by the public company page and by the owner
 * editor, which is why it does NOT filter on visibility: the company has to see
 * a hidden tutor in order to manage it, and the public page only ever asks for
 * a company it could already read.
 */
export async function listCompanyTutors(supabase, companyId) {
  if (!companyId) return [];
  const { data, error } = await supabase
    .from("tutor_profiles")
    .select(COMPANY_TUTOR_SELECT)
    .eq("partner_id", companyId)
    .order("position", { foreignTable: "tutor_subjects", ascending: true });
  if (error || !data) return [];
  return data.map(companyTutorRowToCard);
}

/**
 * The same card shape as listCompanyTutors, for an explicit set of tutors
 * rather than a whole company. It exists for the /companies feed, which needs a
 * few tutors from EVERY company on the page and would otherwise run one query
 * per company.
 *
 * Visibility is the caller's business here, not this helper's: the feed has
 * already filtered on it (see listCompanies), and the owner editor deliberately
 * wants hidden rows, exactly as listCompanyTutors leaves that decision out.
 */
export async function getCompanyTutorCardsByIds(supabase, ids) {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("tutor_profiles")
    .select(COMPANY_TUTOR_SELECT)
    .in("id", ids)
    .order("position", { foreignTable: "tutor_subjects", ascending: true });
  if (error || !data) return [];
  return data.map(companyTutorRowToCard);
}

/**
 * Persist one company tutor. Same never-throws contract as saveCompanyProfile.
 * Goes through `save_partner_tutor_profile`, which is scoped by company
 * ownership rather than `auth.uid() = id` — the tutor's own save path
 * (`save_tutor_profile`) is untouched by any of this.
 *
 * TWO WRITES, not one, and deliberately so. That RPC's UPDATE has a fixed
 * column list which does not include `credentials`, so the credentials and the
 * `atar` mirror go through a second, plain update. That is allowed without any
 * new SQL because 0065's "tutor_profiles company write" policy is `for all`
 * over the company's own tutors with no column restriction, the same way
 * markOnboarded writes `onboarded` directly.
 *
 * The cost of two writes is that the save is NOT atomic, so the second failing
 * after the first succeeded is reported as a failure naming what did not save,
 * never as success.
 */
export async function saveCompanyTutor(supabase, tutorId, tutor) {
  const name = (tutor.name ?? "").trim();
  if (!name) return { ok: false, error: { message: "This tutor needs a name." } };

  const credentials = normaliseCredentials(tutor.credentials);
  // At most one ATAR credential. The scalar `atar` below mirrors whichever one
  // it is, so a second would make the mirror ambiguous (0036). CredentialsSection
  // already hides the option once one is taken, but the editor is not a
  // boundary, so the rule is enforced here on the way to the database.
  if (credentials.filter((c) => c.icon === "atar").length > 1) {
    return { ok: false, error: { message: "Only one ATAR credential is allowed." } };
  }

  const payload = {
    name,
    profile: {
      bio: tutor.bio ?? null,
      bio_long: tutor.bioLong ?? null,
      avatar_url: tutor.avatarImg ?? null,
      avatar_bg: tutor.avatarBg ?? null,
      initials: tutor.initial ?? null,
      // Sent explicitly rather than omitted. The RPC coalesces an absent key to
      // the stored value, so leaving them out was safe but meant a company could
      // never set a year range at all.
      year_min: Number.isFinite(tutor.yearMin) ? tutor.yearMin : 0,
      year_max: Number.isFinite(tutor.yearMax) ? tutor.yearMax : 12,
    },
    subjects: (tutor.subjects ?? []).map((s) => (typeof s === "string" ? s : s.slug)),
  };

  const { data, error } = await supabase.rpc("save_partner_tutor_profile", {
    p_tutor_id: tutorId,
    p_payload: payload,
  });
  if (error) return { ok: false, error };

  // Second write: the columns the RPC does not touch. `atar` is derived from the
  // array being written in the same statement, so the two cannot disagree — and
  // it matters, because /browse's Minimum-ATAR filter reads that indexed column
  // and company tutors are ordinary rows in that feed (0065).
  const { error: credError } = await supabase
    .from("tutor_profiles")
    .update({ credentials, atar: extractAtarFromCredentials(credentials) })
    .eq("id", tutorId);
  if (credError) {
    return {
      ok: false,
      error: { message: "Saved, but their credentials could not be updated. Try again." },
    };
  }

  return { ok: true, droppedSubjects: data?.dropped_subjects ?? [] };
}

/**
 * Name + claim state for the invite landing page, read through the SERVICE-ROLE
 * client. It has to bypass RLS: the visitor is typically logged out or brand
 * new, and a `hidden` company still needs its claim page to work.
 */
export async function getCompanyForClaim(admin, companyId) {
  if (!admin || !companyId) return null;
  const { data, error } = await admin
    .from("partners")
    .select("id, slug, name, owner_id")
    .eq("id", companyId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    claimed: data.owner_id != null,
  };
}
