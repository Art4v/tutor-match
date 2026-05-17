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
          subject:subjects ( id, name, slug )
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
// Editor-shaped helpers (used by /dashboard).
// ----------------------------------------------------------------------------
//
// The dashboard editor's in-memory state uses camelCase keys that match the
// design's `INITIAL_TUTOR` shape (see app/dashboard/sections.js). These two
// helpers translate between that shape and the snake_case DB schema.

/**
 * Fetch a tutor profile in the shape the dashboard editor expects. Also joins
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
    role: profileRow.headline ?? "",
    suburb: profileRow.suburb ?? "",
    city: profileRow.city ?? "",
    locationOverride: profileRow.location_display ?? "",
    initial: profileRow.initials ?? (fullName?.[0]?.toUpperCase() ?? ""),
    avatarBg: profileRow.avatar_bg ?? "oklch(0.92 0.04 80)",
    avatarImg: null, // Storage wiring is a follow-up slice.
    verified: !!profileRow.verified,
    online: !!profileRow.online,
    deliversInPerson: profileRow.delivers_in_person ?? true,
    deliversOnline: profileRow.delivers_online ?? true,
    responsiveText: profileRow.responsive ?? "Usually responds in <1 hr",
    languages: profileRow.languages ?? [],
    yearsTutoring: profileRow.years_tutoring ?? 0,
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
    subjects: (profileRow.subjects ?? []).map((s) => s.name),
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
 * Persist a tutor profile from the dashboard editor.
 *
 * Performs writes in this order (each awaited):
 *   1. update `profiles.full_name`
 *   2. update `tutor_profiles` scalar columns
 *   3. replace-all rows in `tutor_packages`
 *   4. replace-all rows in `tutor_experience`
 *   5. replace-all rows in `tutor_education`
 *   6. replace-all rows in `tutor_subjects` (resolved against the seeded
 *      `subjects` table, case-insensitive name lookup; unknown names are
 *      surfaced via the `droppedSubjects` return value so the UI can warn).
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
        headline: tutor.role || null,
        suburb: tutor.suburb || null,
        city: tutor.city || null,
        location_display: tutor.locationOverride || null,
        initials: tutor.initial || null,
        avatar_bg: tutor.avatarBg || null,
        verified: !!tutor.verified,
        online: !!tutor.online,
        delivers_in_person: !!tutor.deliversInPerson,
        delivers_online: !!tutor.deliversOnline,
        responsive: tutor.responsiveText || null,
        languages: tutor.languages ?? [],
        years_tutoring: Number.isFinite(tutor.yearsTutoring) ? tutor.yearsTutoring : 0,
        credentials: (tutor.credentials ?? []).filter((c) => c?.label),
        bio: tutor.bio || null,
        bio_long: tutor.bioLong || null,
        atar: tutor.atar ? Number(tutor.atar) : null,
        rank: tutor.rank || null,
        rank_subject: tutor.rankSubject || null,
        rate: Number.isFinite(tutor.rate) ? tutor.rate : 0,
        service_area: tutor.serviceArea ?? null,
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

    // 6. Subjects — resolve names → subject_ids against the seeded reference
    //    table. Any name with no match is dropped and reported.
    const { data: subjectRows, error: sErr } = await supabase
      .from("subjects")
      .select("id, name");
    if (sErr) throw sErr;

    const byLower = new Map((subjectRows ?? []).map((r) => [r.name.toLowerCase(), r.id]));
    const droppedSubjects = [];
    const subjectRowsToInsert = [];
    for (const name of tutor.subjects ?? []) {
      const sid = byLower.get((name || "").toLowerCase());
      if (sid) subjectRowsToInsert.push({ tutor_id: id, subject_id: sid });
      else if (name) droppedSubjects.push(name);
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
 * Cheap helper used by the dashboard to populate the Subjects field's
 * suggestion list with the canonical seeded names.
 */
export async function getSubjectNames(supabase) {
  const { data, error } = await supabase
    .from("subjects")
    .select("name")
    .order("position", { ascending: true });
  if (error || !data) return [];
  return data.map((r) => r.name);
}
