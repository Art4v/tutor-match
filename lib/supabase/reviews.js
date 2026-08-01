// ============================================================================
// Reviews query helpers.
// ----------------------------------------------------------------------------
// Reads public.reviews (supabase/migrations/0057_reviews.sql).
//
// Pass in a Supabase client — createSupabaseBrowserClient() in client
// components, createSupabaseServerClient() in server components / routes.
//
// NOTE the public read goes through the get_tutor_reviews() RPC, not the table.
// A public page can't join the reviewer's name/avatar: 0055 narrowed the public
// `profiles` read policy to tutor rows, and `student_profiles` has been
// self-only since 0001. The RPC is SECURITY DEFINER and returns just the two
// author display fields, and it also drops reviews whose author is disabled
// (0052) — so "disable the reviewer" hides their reviews everywhere.
// ============================================================================

/** Shape returned to the UI. `authorAvatarUrl` is null when they have no photo. */
function reviewRowToCard(row) {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorName: row.author_name ?? null,
    authorAvatarUrl: row.author_avatar_url ?? null,
  };
}

/**
 * Every APPROVED review for one tutor, newest first, with author name + avatar.
 * Returns [] on error or when the tutor has none.
 */
export async function getTutorReviews(supabase, tutorId) {
  if (!tutorId) return [];
  const { data, error } = await supabase.rpc("get_tutor_reviews", { p_tutor_id: tutorId });
  if (error) return [];
  return (data ?? []).map(reviewRowToCard);
}

/**
 * One review plus the two display names the moderation surfaces need, read with
 * the SERVICE-ROLE client. Shared by /admin/review and the approve + reject
 * routes so the three can't drift.
 *
 * Service-role because the admin has no session at all: the signed token in the
 * link is the authorization, and RLS would show an anonymous caller nothing.
 *
 * Deliberately three small reads rather than one nested embed — `reviews`
 * reaches `profiles` only via `student_profiles` / `tutor_profiles`, so the
 * PostgREST embed for it is two levels deep on both sides and easy to break.
 *
 * Returns null when the review no longer exists.
 */
export async function getReviewForModeration(admin, reviewId) {
  if (!admin || !reviewId) return null;

  const { data: review } = await admin
    .from("reviews")
    .select("id, tutor_id, student_id, rating, body, status, created_at")
    .eq("id", reviewId)
    .maybeSingle();
  if (!review) return null;

  const [{ data: tutor }, { data: author }] = await Promise.all([
    admin
      .from("tutor_profiles")
      .select("slug, profile:profiles!inner ( full_name )")
      .eq("id", review.tutor_id)
      .maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", review.student_id).maybeSingle(),
  ]);

  return {
    review,
    tutorSlug: tutor?.slug ?? null,
    tutorName: tutor?.profile?.full_name || "a tutor",
    studentName: author?.full_name || "A student",
  };
}

/**
 * The signed-in student's own review of one tutor, in ANY status, so the UI can
 * show a pending or rejected review back to the person who wrote it (the public
 * list only carries approved ones).
 *
 * `student_id` is filtered explicitly rather than left to RLS: the public SELECT
 * policy exposes every approved review, so without it this would match other
 * students' rows too.
 *
 * Returns null when they haven't reviewed this tutor.
 */
export async function getMyReviewForTutor(supabase, studentId, tutorId) {
  if (!studentId || !tutorId) return null;
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body, status, created_at, updated_at")
    .eq("student_id", studentId)
    .eq("tutor_id", tutorId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    rating: data.rating,
    body: data.body ?? null,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
