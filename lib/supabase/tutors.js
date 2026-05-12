// ============================================================================
// Tutor profile query helpers.
// ----------------------------------------------------------------------------
// Reads from the schema set up in supabase/migrations/0002_tutor_profile.sql.
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

  // Flatten the subjects join so callers get `subjects: [{ id, name, slug }, ...]`
  // instead of `subjects: [{ subject: { ... } }, ...]`.
  return {
    ...data,
    subjects: (data.subjects ?? []).map((row) => row.subject).filter(Boolean),
  };
}
