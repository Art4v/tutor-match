import { AVAILABILITY_HOURS, AVAILABILITY_DAYS, buildEmptyGrid } from "@/lib/availability";
import { rankTutors } from "@/lib/ranking";

// ============================================================================
// Tutor profile query helpers.
// ----------------------------------------------------------------------------
// Reads/writes the schema set up in supabase/migrations/0002_tutor_profile.sql
// and 0003_tutor_dashboard.sql.
//
// Pass in a Supabase client — use createSupabaseBrowserClient() from
// `lib/supabase/client.js` in client components, or createSupabaseServerClient()
// from `lib/supabase/server.js` in server components / route handlers.
// ============================================================================

/**
 * Fetch a full tutor profile (with all child rows joined) by tutor id.
 *
 * `id` is the uuid from `public.profiles.id` (same as `auth.users.id`).
 *
 * Returns the profile object on success, or `null` if it doesn't exist or
 * the user can't read it. Child arrays come back in `position` order.
 */
export async function getTutorProfile(supabase, id) {
  const { data, error } = await supabase
    .from("tutor_profiles")
    .select(
      `
        *,
        subjects:tutor_subjects (
          position,
          subject:subjects ( id, name, slug, exam_code )
        ),
        packages:tutor_packages   ( id, label, price, position ),
        experience:tutor_experience ( id, role, org, period, note, position ),
        education:tutor_education ( id, school, detail, level, position, listed_school:schools ( slug ) )
      `
    )
    .eq("id", id)
    .order("position", { foreignTable: "tutor_subjects",   ascending: true })
    .order("position", { foreignTable: "tutor_packages",   ascending: true })
    .order("position", { foreignTable: "tutor_experience", ascending: true })
    .order("position", { foreignTable: "tutor_education",  ascending: true })
    .single();

  if (error || !data) return null;

  return {
    ...data,
    subjects: (data.subjects ?? []).map((row) => row.subject).filter(Boolean),
  };
}

// ----------------------------------------------------------------------------
// Editor-shaped helpers (used by /settings).
// ----------------------------------------------------------------------------
//
// The settings editor's in-memory state uses camelCase keys that match the
// design's `INITIAL_TUTOR` shape (see app/settings/sections.js). These two
// helpers translate between that shape and the snake_case DB schema.

/**
 * Fetch a tutor profile in the shape the settings editor expects. Also joins
 * `profiles.full_name` since that lives on the parent `profiles` table.
 * Returns `null` if the tutor row doesn't exist.
 */
export async function getTutorProfileForEditor(supabase, id) {
  const profileRow = await getTutorProfile(supabase, id);
  if (!profileRow) return null;

  const { data: parent } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", id)
    .single();

  const fullName = parent?.full_name ?? "";

  return {
    id: profileRow.id,
    slug: profileRow.slug ?? "",
    name: fullName,
    suburb: profileRow.suburb ?? "",
    city: profileRow.city ?? "",
    initial: profileRow.initials ?? (fullName?.[0]?.toUpperCase() ?? ""),
    avatarBg: profileRow.avatar_bg ?? "oklch(0.9 0.05 220)",
    bannerBg: profileRow.banner_bg ?? null,
    avatarImg: profileRow.avatar_url ?? null,
    bannerImg: profileRow.banner_url ?? null,
    // `verified` is derived from verification_status (0028 dropped the bool). The
    // status is the single source of truth; server-controlled (saveTutorProfile
    // never writes it), flipped to 'verified' only by the approve route.
    verified: profileRow.verification_status === "verified",
    // Request lifecycle ('none' | 'pending' | 'verified' | 'rejected') — drives
    // the RequestVerification card.
    verificationStatus: profileRow.verification_status ?? "none",
    deliversInPerson: profileRow.delivers_in_person ?? true,
    deliversOnline: profileRow.delivers_online ?? true,
    responsiveText: profileRow.responsive ?? "Usually responds in <1 hr",
    languages: profileRow.languages ?? [],
    yearsTutoring: profileRow.years_tutoring ?? 0,
    yearMin: profileRow.year_min ?? 0,
    yearMax: profileRow.year_max ?? 12,
    credentials: (profileRow.credentials ?? []).filter((c) => c?.label),
    bio: profileRow.bio ?? "",
    bioLong: profileRow.bio_long ?? "",
    atar: profileRow.atar ? Number(profileRow.atar) : 0,
    rating: profileRow.rating ? Number(profileRow.rating) : null,
    reviews: profileRow.review_count ?? 0,
    rate: profileRow.rate ?? 0,
    packages: (profileRow.packages ?? []).map((p) => ({
      label: p.label ?? "",
      price: p.price ?? 0,
    })),
    experience: (profileRow.experience ?? []).map((e) => ({
      role: e.role ?? "",
      org: e.org ?? "",
      period: e.period ?? "",
      note: e.note ?? "",
    })),
    education: (profileRow.education ?? []).map((e) => ({
      school: e.school ?? "",
      // Slug of the matched listed school (null = free-text / custom). Only
      // high-school rows ever carry one; the SchoolCombobox works in slugs and
      // saveTutorProfile resolves it back to the school_id FK.
      schoolSlug: e.listed_school?.slug ?? null,
      detail: e.detail ?? "",
      level: e.level ?? "high_school",
    })),
    // Slug identity — the editor's SubjectPicker works in slugs (names are
    // ambiguous now that subjects are exam-scoped).
    subjects: (profileRow.subjects ?? []).map((s) => s.slug).filter(Boolean),
    serviceArea: profileRow.service_area ?? { suburb: profileRow.suburb ?? "", radiusKm: 5 },
    availability: profileRow.availability ?? buildEmptyAvailability(),
    visibility: profileRow.visibility ?? "public",
    onboarded: !!profileRow.onboarded,
  };
}

/**
 * Mark a tutor as having completed (or skipped) the /onboarding questionnaire,
 * so the first-login wizard never reappears. Scoped by id; the self-write RLS
 * policy on `tutor_profiles` (migration 0002) restricts this to the owner.
 * Returns { ok, error }.
 */
export async function markOnboarded(supabase, id) {
  const { error } = await supabase
    .from("tutor_profiles")
    .update({ onboarded: true })
    .eq("id", id);
  return { ok: !error, error };
}

function buildEmptyAvailability() {
  return buildEmptyGrid();
}

// The ATAR is a genuine `credentials` entry (icon="atar") — the single source of
// truth for both its value and its order, so tutors control which credential leads
// (0036). The scalar `atar` column is only a write-derived mirror for the /browse
// Minimum-ATAR filter; extractAtarFromCredentials recomputes it on every save.
function extractAtarFromCredentials(credentials) {
  const atarEntry = (credentials ?? []).find((c) => c?.icon === "atar" && c.label);
  if (!atarEntry) return null;
  const n = Number(atarEntry.label);
  return Number.isFinite(n) ? n : null;
}

/**
 * Persist a tutor profile from the settings editor.
 *
 * Two steps:
 *   1. update `profiles.full_name` (+ regenerate the slug on a name change).
 *   2. call the `save_tutor_profile` RPC (migration 0029), which ATOMICALLY
 *      updates the `tutor_profiles` scalar columns and replace-alls the four
 *      child tables (packages / experience / education / subjects) in one
 *      transaction. Subject + school slugs are resolved server-side; unknown
 *      subject slugs come back in `dropped_subjects` so the UI can warn.
 *
 * Only step 1 lives outside the transaction (it's a different table and the
 * slug RPC is idempotent/race-safe). The bulk of the write is all-or-nothing,
 * so a mid-save failure can no longer leave a half-written profile.
 *
 * Returns { ok: true, droppedSubjects: string[] } on success,
 * or { ok: false, error: <Error|string> } if any step fails.
 */
export async function saveTutorProfile(supabase, id, tutor) {
  try {
    // A real display name is required: it's the public profile heading and the
    // source of the /tutor/<slug> URL. Reject blank/whitespace here (the UI also
    // guards, and 0017 adds a DB CHECK as the final backstop).
    const cleanName = (tutor.name ?? "").trim();
    if (!cleanName) throw new Error("Your full name is required.");

    // 1. profiles.full_name — and regenerate the slug if the display name
    //    actually changed (the public /tutor/<slug> URL is name-derived). The
    //    assign_tutor_slug RPC is race-safe and scopes to auth.uid(), so it only
    //    ever touches the caller's own row (see migration 0013).
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", id)
      .single();
    const norm = (s) => (s ?? "").trim();
    const nameChanged = norm(existingProfile?.full_name) !== cleanName;

    const { error: pErr } = await supabase
      .from("profiles")
      .update({ full_name: cleanName })
      .eq("id", id);
    if (pErr) throw pErr;

    if (nameChanged) {
      const { error: slugErr } = await supabase.rpc("assign_tutor_slug", {
        p_name: cleanName,
      });
      if (slugErr) throw slugErr;
    }

    // 2. Everything else, atomically (see save_tutor_profile, migration 0029).
    const { data, error: saveErr } = await supabase.rpc("save_tutor_profile", {
      p_payload: buildSaveProfilePayload(tutor),
    });
    if (saveErr) throw saveErr;

    const droppedSubjects = Array.isArray(data?.dropped_subjects) ? data.dropped_subjects : [];
    return { ok: true, droppedSubjects };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Build the jsonb payload for the save_tutor_profile RPC from the editor's
 * camelCase `tutor` object. Does the app-shape coercion the RPC doesn't:
 * bridges the ATAR credential back out into the `atar` scalar, drops empty
 * child rows, and maps camelCase keys to the snake_case the RPC reads. Row
 * `position` and subject/school slug resolution are handled inside the RPC.
 */
function buildSaveProfilePayload(tutor) {
  // The ATAR stays IN the credentials jsonb (source of truth for value + order),
  // with its label normalised to 2 decimals for consistent display; the scalar
  // `atar` mirror is derived from the same array for the /browse filter (0036).
  const credentials = (tutor.credentials ?? [])
    .filter((c) => c?.label)
    .map((c) =>
      c.icon === "atar" && Number.isFinite(Number(c.label))
        ? { ...c, label: Number(c.label).toFixed(2) }
        : c
    );
  return {
    profile: {
      suburb: tutor.suburb || null,
      city: tutor.city || null,
      initials: tutor.initial || null,
      avatar_bg: tutor.avatarBg || null,
      banner_bg: tutor.bannerBg || null,
      avatar_url: tutor.avatarImg || null,
      banner_url: tutor.bannerImg || null,
      delivers_in_person: !!tutor.deliversInPerson,
      delivers_online: !!tutor.deliversOnline,
      responsive: tutor.responsiveText || null,
      languages: tutor.languages ?? [],
      years_tutoring: Number.isFinite(tutor.yearsTutoring) ? tutor.yearsTutoring : 0,
      year_min: Number.isFinite(tutor.yearMin) ? tutor.yearMin : 0,
      year_max: Number.isFinite(tutor.yearMax) ? tutor.yearMax : 12,
      credentials,
      // Derived mirror of the ATAR credential, for the /browse Minimum-ATAR filter.
      atar: extractAtarFromCredentials(credentials),
      bio: tutor.bio || null,
      bio_long: tutor.bioLong || null,
      rate: Number.isFinite(tutor.rate) ? tutor.rate : 0,
      // The RPC derives service_lat/lng/radius_km from this jsonb (0008 denorm).
      service_area: tutor.serviceArea ?? null,
      availability: tutor.availability ?? [],
      visibility: tutor.visibility || "public",
    },
    packages: (tutor.packages ?? [])
      .filter((p) => p.label || p.price)
      .map((p) => ({
        label: p.label || "",
        price: Number.isFinite(p.price) ? p.price : 0,
      })),
    experience: (tutor.experience ?? [])
      .filter((e) => e.role || e.org || e.note)
      .map((e) => ({
        role: e.role || null,
        org: e.org || null,
        period: e.period || null,
        note: e.note || null,
      })),
    education: (tutor.education ?? [])
      .filter((e) => e.school || e.detail)
      .map((e) => ({
        school: e.school || null,
        // Only high-school rows carry a listed-school slug; the RPC resolves it
        // to school_id and clears it for University rows.
        school_slug: e.schoolSlug || null,
        detail: e.detail || null,
        level: e.level || "high_school",
      })),
    // Already in the tutor's chosen drag order; the RPC preserves it as position.
    subjects: (tutor.subjects ?? []).filter(Boolean),
  };
}

/**
 * The full exam-scoped subject catalog — feeds the SubjectPicker on /settings,
 * /browse and the home hero. Returns a flat array sorted by exam position then
 * subject position, so the UI can group it (see `groupByExam` in lib/subjects.js)
 * while keeping group order stable.
 *
 * Each row: { name, slug, exam, examName, position }.
 * `slug` is the canonical id (exam-prefixed, e.g. 'vce-biology'); `exam` is the
 * exam code (e.g. 'VCE', or 'TEST' for the admissions/aptitude tests group).
 */
export async function getSubjects(supabase) {
  const { data, error } = await supabase
    .from("subjects")
    .select("name, slug, position, exam:exams ( code, name, position )")
    .order("position", { ascending: true });
  if (error || !data) return [];
  return data
    .map((r) => ({
      name: r.name,
      slug: r.slug,
      position: r.position ?? 0,
      exam: r.exam?.code ?? null,
      examName: r.exam?.name ?? r.exam?.code ?? "",
      examPosition: r.exam?.position ?? 0,
    }))
    .sort((a, b) =>
      a.examPosition - b.examPosition || a.position - b.position
    );
}

/**
 * The seeded school catalog — feeds the SchoolPicker on /browse and the
 * SchoolCombobox in the education editor. Flat, ordered by `position` (HSC rank).
 * Each row: { name, slug }. `slug` is the canonical id (matches the `?school=`
 * URL contract on /browse).
 */
export async function getSchools(supabase) {
  const { data, error } = await supabase
    .from("schools")
    .select("name, slug, position")
    .order("position", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({ name: r.name, slug: r.slug }));
}

// ============================================================================
// Public browse helpers.
// ----------------------------------------------------------------------------
// All of these return tutor data in the camelCase shape the UI components
// (TutorCard, /browse, /tutor/[slug]) consume. The mapping happens in
// `tutorRowToCard` below.
// ============================================================================

const BROWSE_SELECT = `
  id,
  slug,
  city,
  suburb,
  avatar_bg,
  banner_bg,
  avatar_url,
  banner_url,
  initials,
  verification_status,
  bio,
  bio_long,
  atar,
  rating,
  review_count,
  rate,
  credentials,
  languages,
  year_min,
  year_max,
  service_area,
  availability,
  profile:profiles!inner ( full_name ),
  education:tutor_education ( school, level, position ),
  packages:tutor_packages ( price ),
  experience:tutor_experience ( role ),
  subjects:tutor_subjects ( position, subject:subjects ( name, slug, exam_code ) )
`;

function deriveInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function tutorRowToCard(row) {
  const name = row.profile?.full_name ?? "";
  // Surface one high school + one university (in tutor-chosen order) so the card
  // can stack them, high school on top. Default any untyped row to high school.
  const sortedEdu = (row.education ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const highSchool = sortedEdu.find((e) => (e.level ?? "high_school") === "high_school")?.school ?? "";
  const university = sortedEdu.find((e) => e.level === "university")?.school ?? "";
  return {
    id: row.id,
    slug: row.slug,
    name,
    city: row.city ?? "",
    suburb: row.suburb ?? "",
    avatarBg: row.avatar_bg ?? "oklch(0.9 0.05 220)",
    bannerBg: row.banner_bg ?? null,
    avatarImg: row.avatar_url ?? null,
    bannerImg: row.banner_url ?? null,
    initial: row.initials || deriveInitials(name),
    verified: row.verification_status === "verified",
    bio: row.bio ?? "",
    bioLong: row.bio_long ?? "",
    subjects: (row.subjects ?? [])
      .map((r) => r.subject && {
        name: r.subject.name,
        slug: r.subject.slug,
        exam: r.subject.exam_code,
      })
      .filter(Boolean),
    atar: row.atar != null ? Number(row.atar) : 0,
    rating: row.rating != null ? Number(row.rating) : null,
    reviews: row.review_count ?? 0,
    rate: row.rate ?? 0,
    highSchool,
    university,
    credentials: (row.credentials ?? []).filter((c) => c?.label),
    // Normalized, editor-shaped snapshot of the fields the ranking algorithm
    // scores (see lib/ranking.js). Pure field-mapping — no scoring lives here.
    completion: rowToCompletion(row, name),
  };
}

/**
 * Reshape a browse/featured DB row into the editor-shaped object the ranking
 * criteria (lib/ranking.js) and the /settings completion meter both read from.
 * Mirrors the keys `calcCompletion` expects so one definition of "complete"
 * drives both the meter and the ordering.
 */
function rowToCompletion(row, name) {
  return {
    avatarImg: row.avatar_url ?? null,
    bannerImg: row.banner_url ?? null,
    // Drives the verified ranking boost in rankingScore() (lib/ranking.js).
    verified: row.verification_status === "verified",
    name,
    bio: row.bio ?? "",
    suburb: row.suburb ?? "",
    city: row.city ?? "",
    languages: row.languages ?? [],
    // Bridge the ATAR column in exactly as the editor does, so the "Credentials"
    // check counts it the same way.
    credentials: (row.credentials ?? []).filter((c) => c?.label),
    bioLong: row.bio_long ?? "",
    subjects: row.subjects ?? [],
    yearMin: row.year_min,
    yearMax: row.year_max,
    rate: row.rate ?? 0,
    packages: row.packages ?? [],
    experience: row.experience ?? [],
    education: row.education ?? [],
    availability: row.availability ?? null,
    serviceArea: row.service_area ?? null,
  };
}

/**
 * Paginated browse query. Returns `{ tutors, total }`.
 *
 * params: {
 *   q?:            text search across name / tagline / city / suburb
 *   name?:         string    filter on the tutor's full_name only
 *   subjectSlugs?: string[]  filter to tutors with ANY of these subject slugs
 *   lat?, lng?:    number    location point — keep tutors whose travel radius
 *                            covers it (in-person proximity; online OR-ed in
 *                            only when both modes are selected)
 *   atarMin?:      number    minimum ATAR
 *   rateMax?:      number    maximum hourly rate
 *   yearLevels?:   number[]  K=0…Year 12=12 — keep tutors whose [year_min,
 *                            year_max] range covers ANY of these (multi-select)
 *   modes?:        string[]  any of 'online' | 'inperson' (multi-select)
 *   verifiedOnly?: boolean   keep only admin-verified tutors (default true)
 *   sort?:         'relevance' | 'rating' | 'rate-asc' | 'newest'
 *   page?:         1-indexed page number
 *   pageSize?:     default 24
 * }
 *
 * Only rows with `visibility = 'public'` are returned.
 */
export async function getTutorsForBrowse(supabase, params = {}) {
  const {
    q,
    name,
    subjectSlugs = [],
    schoolSlugs = [],
    lat,
    lng,
    atarMin,
    rateMax,
    yearLevels = [],
    modes = [],
    verifiedOnly = true,
    // When the "Saved" filter is active, the caller resolves the signed-in
    // student's saved tutor ids and passes them here. `null`/`undefined` = the
    // filter is off; an array (even empty) = on, and the results are restricted
    // to it (empty ⇒ no results).
    savedIds = null,
    page = 1,
    pageSize = 24,
    seed,
  } = params;

  const onlineSelected = modes.includes("online");
  const inpersonSelected = modes.includes("inperson");
  // Online tutors serve everywhere, so when ONLY online is selected a location
  // is irrelevant and the geo filter is skipped entirely.
  const onlineOnly = onlineSelected && !inpersonSelected;

  // Both subject and location filters resolve to a set of tutor ids first, then
  // get applied with a single `.in("id", ...)`. Two round-trips is fine at our
  // scale and keeps the main query (with its exact count + pagination) simple.
  // `filteredIds === null` means "no id-based filter active".
  let filteredIds = null;

  // 1. Subject filter — tutors with ANY of the requested subjects.
  if (subjectSlugs.length > 0) {
    const { data: subjectRows, error: sErr } = await supabase
      .from("subjects")
      .select("id")
      .in("slug", subjectSlugs);
    if (sErr) return { tutors: [], total: 0 };

    const subjectIds = (subjectRows ?? []).map((r) => r.id);
    if (subjectIds.length === 0) return { tutors: [], total: 0 };

    const { data: links, error: lErr } = await supabase
      .from("tutor_subjects")
      .select("tutor_id")
      .in("subject_id", subjectIds);
    if (lErr) return { tutors: [], total: 0 };

    const subjectFilteredIds = Array.from(new Set((links ?? []).map((r) => r.tutor_id)));
    if (subjectFilteredIds.length === 0) return { tutors: [], total: 0 };
    filteredIds = subjectFilteredIds;
  }

  // 1b. School filter — tutors whose (high-school) education references ANY of
  //     the requested schools. Same slug → id → tutor ids resolution as subjects;
  //     school_id is only ever set on high-school rows, so this is implicitly
  //     scoped to high schools.
  if (schoolSlugs.length > 0) {
    const { data: schoolRows, error: scErr } = await supabase
      .from("schools")
      .select("id")
      .in("slug", schoolSlugs);
    if (scErr) return { tutors: [], total: 0 };

    const schoolIds = (schoolRows ?? []).map((r) => r.id);
    if (schoolIds.length === 0) return { tutors: [], total: 0 };

    const { data: links, error: lErr } = await supabase
      .from("tutor_education")
      .select("tutor_id")
      .in("school_id", schoolIds);
    if (lErr) return { tutors: [], total: 0 };

    const schoolFilteredIds = Array.from(new Set((links ?? []).map((r) => r.tutor_id)));
    if (schoolFilteredIds.length === 0) return { tutors: [], total: 0 };

    if (filteredIds) {
      const schoolSet = new Set(schoolFilteredIds);
      filteredIds = filteredIds.filter((id) => schoolSet.has(id));
      if (filteredIds.length === 0) return { tutors: [], total: 0 };
    } else {
      filteredIds = schoolFilteredIds;
    }
  }

  // 2. Location filter — tutors whose in-person travel radius covers the point.
  //    Picking a location means physical proximity, so online tutors are NOT
  //    pulled in here (online serves everywhere — that's the 'Online' mode
  //    toggle's job). When the student explicitly asks for online, location is
  //    irrelevant, so we skip the geo filter entirely.
  if (Number.isFinite(lat) && Number.isFinite(lng) && !onlineOnly) {
    // When both modes are selected we OR-in online tutors (they serve the point
    // remotely); otherwise (in-person selected, or no mode preference) location
    // means in-person proximity only.
    const { data: nearRows, error: nErr } = await supabase.rpc(
      "tutors_within_service_radius",
      { p_lat: lat, p_lng: lng, p_include_online: onlineSelected },
    );
    if (nErr) return { tutors: [], total: 0 };

    const nearIds = (nearRows ?? []).map((r) => r.tutor_id);
    if (nearIds.length === 0) return { tutors: [], total: 0 };

    // Intersect with the subject set if one is already active.
    if (filteredIds) {
      const nearSet = new Set(nearIds);
      filteredIds = filteredIds.filter((id) => nearSet.has(id));
      if (filteredIds.length === 0) return { tutors: [], total: 0 };
    } else {
      filteredIds = nearIds;
    }
  }

  // 3. Name filter — full_name lives on the joined `profiles` table, which
  //    PostgREST can't filter inside a top-level `.or`, so we resolve matching
  //    tutor ids here and intersect (same pattern as subject/location above).
  if (name) {
    const { data: nameRows, error: nmErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "tutor")
      .ilike("full_name", `%${name}%`);
    if (nmErr) return { tutors: [], total: 0 };

    const nameIds = (nameRows ?? []).map((r) => r.id);
    if (nameIds.length === 0) return { tutors: [], total: 0 };

    if (filteredIds) {
      const nameSet = new Set(nameIds);
      filteredIds = filteredIds.filter((id) => nameSet.has(id));
      if (filteredIds.length === 0) return { tutors: [], total: 0 };
    } else {
      filteredIds = nameIds;
    }
  }

  // 4. Saved filter — the caller passes the student's saved tutor ids. Same
  //    intersect-into-filteredIds pattern; an empty list means "saved only" is
  //    on but nothing is saved, so no tutor can match.
  if (savedIds != null) {
    if (savedIds.length === 0) return { tutors: [], total: 0 };
    if (filteredIds) {
      const savedSet = new Set(savedIds);
      filteredIds = filteredIds.filter((id) => savedSet.has(id));
      if (filteredIds.length === 0) return { tutors: [], total: 0 };
    } else {
      filteredIds = savedIds;
    }
  }

  // The free-text `q` search spans the tutor's name too, but full_name lives on
  // the joined `profiles` table (un-filterable inside a top-level `.or`). So we
  // resolve the name-matching ids up front and OR them into the q filter below
  // via an `id.in.(...)` term, alongside the tutor_profiles text columns.
  let qNameIds = [];
  if (q) {
    const { data: qNameRows } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "tutor")
      .ilike("full_name", `%${q}%`);
    qNameIds = (qNameRows ?? []).map((r) => r.id);
  }

  let query = supabase
    .from("tutor_profiles")
    .select(BROWSE_SELECT)
    .eq("visibility", "public")
    // Only list tutors who've confirmed their email (see 0007 migration —
    // email_confirmed_at mirrors auth.users). Unconfirmed signups stay hidden.
    .not("email_confirmed_at", "is", null)
    // Hide disabled accounts (0052). The inner join means a disabled profile
    // drops the tutor from results entirely.
    .eq("profile.status", "enabled")
    // Surface each tutor's subjects in their custom order (see 0014).
    .order("position", { foreignTable: "tutor_subjects", ascending: true });

  if (filteredIds) {
    query = query.in("id", filteredIds);
  }

  if (q) {
    const like = `%${q}%`;
    // bio/city/suburb live on tutor_profiles; name matches are folded in
    // as an `id.in.(...)` term from the profiles lookup above.
    const terms = [`bio.ilike.${like}`, `city.ilike.${like}`, `suburb.ilike.${like}`];
    if (qNameIds.length > 0) terms.push(`id.in.(${qNameIds.join(",")})`);
    query = query.or(terms.join(","));
  }

  if (Number.isFinite(atarMin)) query = query.gte("atar", atarMin);
  if (Number.isFinite(rateMax)) query = query.lte("rate", rateMax);

  // Verified-only is the default browse experience; the sidebar toggle can
  // opt out (?verified=0) to also surface unverified tutors.
  if (verifiedOnly) query = query.eq("verification_status", "verified");

  // Year level is multi-select: a tutor matches if their [year_min, year_max]
  // range covers ANY of the requested years. Each selected year becomes an
  // and(...) group; PostgREST ORs the groups (and ANDs this `.or()` with the
  // other top-level filters above).
  if (Array.isArray(yearLevels) && yearLevels.length > 0) {
    const terms = yearLevels
      .filter((y) => Number.isFinite(y))
      .map((y) => `and(year_min.lte.${y},year_max.gte.${y})`);
    if (terms.length > 0) query = query.or(terms.join(","));
  }

  // Mode is multi-select: online, in-person, both, or none.
  if (onlineSelected && inpersonSelected) {
    query = query.or("delivers_online.eq.true,delivers_in_person.eq.true");
  } else if (onlineSelected) {
    query = query.eq("delivers_online", true);
  } else if (inpersonSelected) {
    query = query.eq("delivers_in_person", true);
  }

  // Ordering is by profile completeness (lib/ranking.js), computed in JS, so we
  // fetch the FULL filtered set and rank + paginate here rather than ordering +
  // ranging in SQL. At a directory's scale this is well under PostgREST's
  // default 1000-row cap; if the dataset ever outgrows that, move completeness
  // scoring into SQL. The `tutor_subjects` order above is preserved per card.
  const { data, error } = await query;
  if (error || !data) return { tutors: [], total: 0 };

  // Seeded ordering so the same browse session ranks identically across pages
  // (the seed is one-per-page-load, supplied by the client — see BrowseSeed).
  const ranked = rankTutors(data.map(tutorRowToCard), seed);
  const start = (page - 1) * pageSize;
  return {
    tutors: ranked.slice(start, start + pageSize),
    total: ranked.length,
  };
}

/**
 * Top-N tutors for the home page's featured marquee and for the "Similar
 * tutors" sidebar on the detail page. `excludeId` lets the detail page skip the
 * tutor whose profile is currently open.
 *
 * `verifiedOnly` narrows to verified tutors in the QUERY rather than leaving the
 * caller to filter afterwards. That distinction matters: filtering a
 * rating-ordered top-N after the fact samples only the verified tutors that
 * happen to sit inside that N, which is both a much smaller pool than the site
 * has and biased toward high ratings.
 */
export async function getFeaturedTutors(supabase, limit = 9, excludeId = null, { verifiedOnly = false } = {}) {
  let query = supabase
    .from("tutor_profiles")
    .select(BROWSE_SELECT)
    .eq("visibility", "public")
    .not("email_confirmed_at", "is", null) // confirmed emails only — see 0007
    .eq("profile.status", "enabled"); // hide disabled accounts — see 0052

  if (verifiedOnly) query = query.eq("verification_status", "verified"); // 0028: status is the sole source of truth

  query = query
    .order("rating", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false })
    .order("position", { foreignTable: "tutor_subjects", ascending: true }) // custom subject order — see 0014
    .limit(limit + (excludeId ? 1 : 0));

  const { data, error } = await query;
  if (error || !data) return [];

  const mapped = data.map(tutorRowToCard);
  return excludeId
    ? mapped.filter((t) => t.id !== excludeId).slice(0, limit)
    : mapped.slice(0, limit);
}

/**
 * Fetch a single tutor by slug for the public profile page. Returns the
 * camelCase shape the page consumes (mapped from snake_case DB columns),
 * or `null` if no such slug exists / the row failed to load.
 */
export async function getTutorBySlug(supabase, slug) {
  if (!slug) return null;

  const { data, error } = await supabase
    .from("tutor_profiles")
    .select(
      `
        *,
        profile:profiles!inner ( full_name ),
        subjects:tutor_subjects (
          position,
          subject:subjects ( id, name, slug, exam_code )
        ),
        packages:tutor_packages   ( id, label, price, position ),
        experience:tutor_experience ( id, role, org, period, note, position ),
        education:tutor_education ( id, school, detail, level, position )
      `,
    )
    .eq("slug", slug)
    .eq("visibility", "public")
    .not("email_confirmed_at", "is", null) // confirmed emails only — see 0007
    .eq("profile.status", "enabled") // hide disabled accounts — see 0052
    .order("position", { foreignTable: "tutor_subjects",   ascending: true })
    .order("position", { foreignTable: "tutor_packages",   ascending: true })
    .order("position", { foreignTable: "tutor_experience", ascending: true })
    .order("position", { foreignTable: "tutor_education",  ascending: true })
    .single();

  if (error || !data) return null;

  return tutorRowToDetail(data);
}

/**
 * Total number of publicly listed tutors (same predicates as the browse and
 * featured queries: visibility = public AND email confirmed). Used by the
 * landing page's "See all tutors" link to show a live count.
 */
export async function getPublicTutorCount(supabase) {
  const { count, error } = await supabase
    .from("tutor_profiles")
    .select("id, profile:profiles!inner(id)", { count: "exact", head: true })
    .eq("visibility", "public")
    .not("email_confirmed_at", "is", null)
    .eq("profile.status", "enabled"); // hide disabled accounts — see 0052
  if (error) return 0;
  return count ?? 0;
}

/**
 * Number of publicly listed tutors that are admin-verified (same public
 * predicates plus verified = true). Used by the landing page's "Browse all N
 * verified tutors" link.
 */
export async function getVerifiedTutorCount(supabase) {
  const { count, error } = await supabase
    .from("tutor_profiles")
    .select("id, profile:profiles!inner(id)", { count: "exact", head: true })
    .eq("visibility", "public")
    .eq("verification_status", "verified")
    .not("email_confirmed_at", "is", null)
    .eq("profile.status", "enabled"); // hide disabled accounts — see 0052
  if (error) return 0;
  return count ?? 0;
}

function normalizeAvailability(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    // 2D grid; pair with the canonical labels the settings editor uses
    // (lib/availability.js) so the rows line up with what the tutor set.
    return {
      hours: AVAILABILITY_HOURS.slice(0, raw.length),
      days:  AVAILABILITY_DAYS.slice(0, raw[0]?.length ?? 7),
      grid:  raw,
    };
  }
  if (raw.grid && raw.hours && raw.days) return raw;
  return null;
}

function tutorRowToDetail(row) {
  const name = row.profile?.full_name ?? "";
  return {
    id: row.id,
    slug: row.slug,
    name,
    avatarBg: row.avatar_bg ?? "oklch(0.9 0.05 220)",
    bannerBg: row.banner_bg ?? null,
    avatarImg: row.avatar_url ?? null,
    bannerImg: row.banner_url ?? null,
    initial: row.initials || deriveInitials(name),
    verified: row.verification_status === "verified",
    deliversInPerson: row.delivers_in_person ?? true,
    deliversOnline: row.delivers_online ?? true,
    responsive: row.responsive ?? "",
    suburb: row.suburb ?? "",
    city: row.city ?? "",
    rating: row.rating != null ? Number(row.rating) : null,
    reviews: row.review_count ?? 0,
    yearsTutoring: row.years_tutoring ?? null,
    yearMin: row.year_min ?? 0,
    yearMax: row.year_max ?? 12,
    languages: Array.isArray(row.languages) ? row.languages : [],
    bio: row.bio ?? "",
    bioLong: row.bio_long ?? "",
    atar: row.atar != null ? Number(row.atar) : 0,
    rate: row.rate ?? 0,
    credentials: (row.credentials ?? []).filter((c) => c?.label),
    subjects: (row.subjects ?? [])
      .map((s) => {
        const sub = s?.subject ?? s;
        return sub?.name && { name: sub.name, slug: sub.slug, exam: sub.exam_code };
      })
      .filter(Boolean),
    packages: (row.packages ?? []).map((p) => ({
      label: p.label ?? "",
      price: p.price ?? 0,
    })),
    experience: (row.experience ?? []).map((e) => ({
      role: e.role ?? "",
      org: e.org ?? "",
      period: e.period ?? "",
      note: e.note ?? "",
    })),
    education: (row.education ?? []).map((e) => ({
      school: e.school ?? "",
      detail: e.detail ?? "",
      level: e.level ?? "high_school",
    })),
    serviceArea: row.service_area ?? null,
    availability: normalizeAvailability(row.availability),
  };
}
