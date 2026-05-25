import { AVAILABILITY_HOURS, AVAILABILITY_DAYS } from "@/lib/availability";

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
          subject:subjects ( id, name, slug, exam_code )
        ),
        packages:tutor_packages   ( id, label, duration, price, save_text, position ),
        experience:tutor_experience ( id, role, org, period, note, position ),
        education:tutor_education ( id, school, detail, position )
      `
    )
    .eq("id", id)
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

  // Parse out the convenient "save_text" -> save percent (best-effort; if the
  // string isn't a percent we just default to 0).
  const parseSave = (s) => {
    if (!s) return 0;
    const m = /(\d+(?:\.\d+)?)/.exec(s);
    return m ? Number(m[1]) : 0;
  };

  return {
    id: profileRow.id,
    name: fullName,
    suburb: profileRow.suburb ?? "",
    city: profileRow.city ?? "",
    initial: profileRow.initials ?? (fullName?.[0]?.toUpperCase() ?? ""),
    avatarBg: profileRow.avatar_bg ?? "oklch(0.92 0.04 80)",
    avatarImg: profileRow.avatar_url ?? null,
    bannerImg: profileRow.banner_url ?? null,
    verified: !!profileRow.verified,
    deliversInPerson: profileRow.delivers_in_person ?? true,
    deliversOnline: profileRow.delivers_online ?? true,
    responsiveText: profileRow.responsive ?? "Usually responds in <1 hr",
    languages: profileRow.languages ?? [],
    yearsTutoring: profileRow.years_tutoring ?? 0,
    yearMin: profileRow.year_min ?? 7,
    yearMax: profileRow.year_max ?? 12,
    credentials: Array.isArray(profileRow.credentials) ? profileRow.credentials : [],
    bio: profileRow.bio ?? "",
    bioLong: profileRow.bio_long ?? "",
    atar: profileRow.atar ? Number(profileRow.atar) : 0,
    rank: profileRow.rank ?? "",
    rankSubject: profileRow.rank_subject ?? "",
    rating: profileRow.rating ? Number(profileRow.rating) : null,
    reviews: profileRow.review_count ?? 0,
    rate: profileRow.rate ?? 0,
    packages: (profileRow.packages ?? []).map((p) => ({
      label: p.label ?? "",
      duration: p.duration ?? "",
      save: parseSave(p.save_text),
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
      detail: e.detail ?? "",
    })),
    // Slug identity — the editor's SubjectPicker works in slugs (names are
    // ambiguous now that subjects are exam-scoped).
    subjects: (profileRow.subjects ?? []).map((s) => s.slug).filter(Boolean),
    serviceArea: profileRow.service_area ?? { suburb: profileRow.suburb ?? "", radiusKm: 5 },
    availability: profileRow.availability ?? buildEmptyAvailability(),
    verifications: Array.isArray(profileRow.verifications) ? profileRow.verifications : [],
    visibility: profileRow.visibility ?? "public",
  };
}

function buildEmptyAvailability() {
  return Array.from({ length: 8 }, () => Array(7).fill(0));
}

/**
 * Persist a tutor profile from the settings editor.
 *
 * Performs writes in this order (each awaited):
 *   1. update `profiles.full_name`
 *   2. update `tutor_profiles` scalar columns
 *   3. replace-all rows in `tutor_packages`
 *   4. replace-all rows in `tutor_experience`
 *   5. replace-all rows in `tutor_education`
 *   6. replace-all rows in `tutor_subjects` (resolved against the seeded
 *      `subjects` table by slug; unknown slugs are surfaced via the
 *      `droppedSubjects` return value so the UI can warn).
 *
 * NOT transactional — if step 3 succeeds and step 4 fails, partial state will
 * remain. A future improvement is to wrap this in an RPC. For the current
 * slice (single tutor editing their own row) the failure surface is small.
 *
 * Returns { ok: true, droppedSubjects: string[] } on success,
 * or { ok: false, error: <Error|string> } if any step fails.
 */
export async function saveTutorProfile(supabase, id, tutor) {
  try {
    // 1. profiles.full_name
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ full_name: tutor.name || null })
      .eq("id", id);
    if (pErr) throw pErr;

    // 2. tutor_profiles scalar columns
    const { error: tErr } = await supabase
      .from("tutor_profiles")
      .update({
        suburb: tutor.suburb || null,
        city: tutor.city || null,
        initials: tutor.initial || null,
        avatar_bg: tutor.avatarBg || null,
        avatar_url: tutor.avatarImg || null,
        banner_url: tutor.bannerImg || null,
        verified: !!tutor.verified,
        delivers_in_person: !!tutor.deliversInPerson,
        delivers_online: !!tutor.deliversOnline,
        responsive: tutor.responsiveText || null,
        languages: tutor.languages ?? [],
        years_tutoring: Number.isFinite(tutor.yearsTutoring) ? tutor.yearsTutoring : 0,
        year_min: Number.isFinite(tutor.yearMin) ? tutor.yearMin : 7,
        year_max: Number.isFinite(tutor.yearMax) ? tutor.yearMax : 12,
        credentials: (tutor.credentials ?? []).filter((c) => c?.label),
        bio: tutor.bio || null,
        bio_long: tutor.bioLong || null,
        atar: tutor.atar ? Number(tutor.atar) : null,
        rank: tutor.rank || null,
        rank_subject: tutor.rankSubject || null,
        rate: Number.isFinite(tutor.rate) ? tutor.rate : 0,
        service_area: tutor.serviceArea ?? null,
        // Denormalised copies of service_area so /browse can filter by distance
        // in SQL (see migration 0008 + getTutorsForBrowse). Kept in sync here.
        service_lat: Number.isFinite(tutor.serviceArea?.lat) ? tutor.serviceArea.lat : null,
        service_lng: Number.isFinite(tutor.serviceArea?.lng) ? tutor.serviceArea.lng : null,
        service_radius_km: Number.isFinite(tutor.serviceArea?.radiusKm) ? tutor.serviceArea.radiusKm : null,
        availability: tutor.availability ?? [],
        verifications: tutor.verifications ?? [],
        visibility: tutor.visibility || "public",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (tErr) throw tErr;

    // 3-5. Replace-all child tables.
    await replaceAll(supabase, "tutor_packages", id,
      (tutor.packages ?? [])
        .filter((p) => p.label || p.price)
        .map((p, i) => ({
          tutor_id: id,
          label: p.label || "",
          duration: p.duration || null,
          price: Number.isFinite(p.price) ? p.price : 0,
          save_text: p.save ? `${p.save}%` : null,
          position: i,
        })));

    await replaceAll(supabase, "tutor_experience", id,
      (tutor.experience ?? [])
        .filter((e) => e.role || e.org || e.note)
        .map((e, i) => ({
          tutor_id: id,
          role: e.role || null,
          org: e.org || null,
          period: e.period || null,
          note: e.note || null,
          position: i,
        })));

    await replaceAll(supabase, "tutor_education", id,
      (tutor.education ?? [])
        .filter((e) => e.school || e.detail)
        .map((e, i) => ({
          tutor_id: id,
          school: e.school || null,
          detail: e.detail || null,
          position: i,
        })));

    // 6. Subjects — resolve slugs → subject_ids against the seeded reference
    //    table. Any slug with no match is dropped and reported.
    const { data: subjectRows, error: sErr } = await supabase
      .from("subjects")
      .select("id, slug");
    if (sErr) throw sErr;

    const bySlug = new Map((subjectRows ?? []).map((r) => [r.slug, r.id]));
    const droppedSubjects = [];
    const subjectRowsToInsert = [];
    for (const slug of tutor.subjects ?? []) {
      const sid = bySlug.get(slug);
      if (sid) subjectRowsToInsert.push({ tutor_id: id, subject_id: sid });
      else if (slug) droppedSubjects.push(slug);
    }

    const { error: dSubErr } = await supabase
      .from("tutor_subjects")
      .delete()
      .eq("tutor_id", id);
    if (dSubErr) throw dSubErr;

    if (subjectRowsToInsert.length > 0) {
      const { error: iSubErr } = await supabase
        .from("tutor_subjects")
        .insert(subjectRowsToInsert);
      if (iSubErr) throw iSubErr;
    }

    return { ok: true, droppedSubjects };
  } catch (error) {
    return { ok: false, error };
  }
}

async function replaceAll(supabase, table, tutorId, rows) {
  const { error: delErr } = await supabase.from(table).delete().eq("tutor_id", tutorId);
  if (delErr) throw delErr;
  if (rows.length === 0) return;
  const { error: insErr } = await supabase.from(table).insert(rows);
  if (insErr) throw insErr;
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
  avatar_url,
  banner_url,
  initials,
  verified,
  bio,
  atar,
  rating,
  review_count,
  rate,
  profile:profiles!inner ( full_name ),
  subjects:tutor_subjects ( subject:subjects ( name, slug, exam_code ) )
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
  return {
    id: row.id,
    slug: row.slug,
    name,
    city: row.city ?? "",
    suburb: row.suburb ?? "",
    avatarBg: row.avatar_bg ?? "oklch(0.92 0.04 80)",
    avatarImg: row.avatar_url ?? null,
    bannerImg: row.banner_url ?? null,
    initial: row.initials || deriveInitials(name),
    verified: !!row.verified,
    bio: row.bio ?? "",
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
    lat,
    lng,
    atarMin,
    rateMax,
    yearLevels = [],
    modes = [],
    sort = "relevance",
    page = 1,
    pageSize = 24,
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
    .select(BROWSE_SELECT, { count: "exact" })
    .eq("visibility", "public")
    // Only list tutors who've confirmed their email (see 0007 migration —
    // email_confirmed_at mirrors auth.users). Unconfirmed signups stay hidden.
    .not("email_confirmed_at", "is", null);

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

  switch (sort) {
    case "rating":
      query = query.order("rating", { ascending: false, nullsFirst: false });
      break;
    case "rate-asc":
      query = query.order("rate", { ascending: true, nullsFirst: false });
      break;
    case "newest":
      query = query.order("review_count", { ascending: false });
      break;
    case "relevance":
    default:
      query = query
        .order("rating", { ascending: false, nullsFirst: false })
        .order("review_count", { ascending: false });
      break;
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error || !data) return { tutors: [], total: 0 };

  return {
    tutors: data.map(tutorRowToCard),
    total: count ?? 0,
  };
}

/**
 * Top-N tutors for the home page's "Browse our Tutors" grid and for the
 * "Similar tutors" sidebar on the detail page. `excludeId` lets the detail
 * page skip the tutor whose profile is currently open.
 */
export async function getFeaturedTutors(supabase, limit = 9, excludeId = null) {
  let query = supabase
    .from("tutor_profiles")
    .select(BROWSE_SELECT)
    .eq("visibility", "public")
    .not("email_confirmed_at", "is", null) // confirmed emails only — see 0007
    .order("rating", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false })
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
          subject:subjects ( id, name, slug, exam_code )
        ),
        packages:tutor_packages   ( id, label, duration, price, save_text, position ),
        experience:tutor_experience ( id, role, org, period, note, position ),
        education:tutor_education ( id, school, detail, position )
      `,
    )
    .eq("slug", slug)
    .eq("visibility", "public")
    .not("email_confirmed_at", "is", null) // confirmed emails only — see 0007
    .order("position", { foreignTable: "tutor_packages",   ascending: true })
    .order("position", { foreignTable: "tutor_experience", ascending: true })
    .order("position", { foreignTable: "tutor_education",  ascending: true })
    .single();

  if (error || !data) return null;

  return tutorRowToDetail(data);
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
    avatarBg: row.avatar_bg ?? "oklch(0.92 0.04 80)",
    avatarImg: row.avatar_url ?? null,
    bannerImg: row.banner_url ?? null,
    initial: row.initials || deriveInitials(name),
    verified: !!row.verified,
    deliversInPerson: row.delivers_in_person ?? true,
    deliversOnline: row.delivers_online ?? true,
    responsive: row.responsive ?? "",
    suburb: row.suburb ?? "",
    city: row.city ?? "",
    rating: row.rating != null ? Number(row.rating) : null,
    reviews: row.review_count ?? 0,
    yearsTutoring: row.years_tutoring ?? null,
    yearMin: row.year_min ?? 7,
    yearMax: row.year_max ?? 12,
    languages: Array.isArray(row.languages) ? row.languages : [],
    bio: row.bio ?? "",
    bioLong: row.bio_long ?? "",
    atar: row.atar != null ? Number(row.atar) : 0,
    rate: row.rate ?? 0,
    credentials: Array.isArray(row.credentials) ? row.credentials : [],
    rank: row.rank ?? null,
    rankSubject: row.rank_subject ?? null,
    subjects: (row.subjects ?? [])
      .map((s) => {
        const sub = s?.subject ?? s;
        return sub?.name && { name: sub.name, slug: sub.slug, exam: sub.exam_code };
      })
      .filter(Boolean),
    packages: (row.packages ?? []).map((p) => ({
      label: p.label ?? "",
      duration: p.duration ?? "",
      price: p.price ?? 0,
      save: p.save_text ?? "",
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
    })),
    verifications: Array.isArray(row.verifications) ? row.verifications : [],
    serviceArea: row.service_area ?? null,
    availability: normalizeAvailability(row.availability),
  };
}
