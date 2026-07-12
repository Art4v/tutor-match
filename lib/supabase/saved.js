// ============================================================================
// Saved-tutors (student bookmarks) query helpers.
// ----------------------------------------------------------------------------
// Reads/writes public.saved_tutors (supabase/migrations/0042_saved_tutors.sql).
// RLS is self-only on student_id, so every call is implicitly scoped to the
// signed-in student — `studentId` here is always the caller's own auth.uid().
//
// Pass in a Supabase client — createSupabaseBrowserClient() in client
// components, createSupabaseServerClient() in server components / routes.
// ============================================================================

/**
 * Ids of every tutor the given student has saved, newest-saved first.
 * Returns [] on error or when the student has none.
 */
export async function getSavedTutorIds(supabase, studentId) {
  if (!studentId) return [];
  const { data, error } = await supabase
    .from("saved_tutors")
    .select("tutor_id")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => r.tutor_id);
}

/**
 * Bookmark a tutor. Idempotent — the (student_id, tutor_id) PK means a repeat
 * save is a no-op rather than a duplicate row (ignoreDuplicates upsert).
 */
export async function saveTutor(supabase, studentId, tutorId) {
  const { error } = await supabase
    .from("saved_tutors")
    .upsert({ student_id: studentId, tutor_id: tutorId }, { onConflict: "student_id,tutor_id", ignoreDuplicates: true });
  if (error) return { ok: false, error };
  return { ok: true };
}

/** Remove a bookmark. No-op if it wasn't saved. */
export async function unsaveTutor(supabase, studentId, tutorId) {
  const { error } = await supabase
    .from("saved_tutors")
    .delete()
    .eq("student_id", studentId)
    .eq("tutor_id", tutorId);
  if (error) return { ok: false, error };
  return { ok: true };
}
