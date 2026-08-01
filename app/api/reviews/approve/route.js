import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { reviewApprovedEmail, newReviewEmail } from "@/lib/email/send";
import { verifyReviewToken } from "@/lib/reviewToken";
import { getReviewForModeration } from "@/lib/supabase/reviews";

export const runtime = "nodejs";

// Approve a student's review. NO user session — the admin clicks a link from
// their email, so a signed token (not auth) is the authorization. Publishes the
// review via the service-role client, then notifies BOTH parties: the student
// who wrote it and the tutor it's about. Driven by the Approve button on
// /admin/review (which POSTs here).
//
// The aggregate needs no work: tutor_profiles.rating / review_count are
// recomputed by the 0057 trigger on the status change (0058 made that aggregate
// exactly the set of reviews the profile renders).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { reviewId, error: tokenError } = verifyReviewToken(body?.token);
  if (tokenError) {
    return NextResponse.json({ error: "This review link is invalid or has expired." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured for reviews." }, { status: 500 });
  }

  const found = await getReviewForModeration(admin, reviewId);
  if (!found) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  const { review, tutorSlug, tutorName, studentName } = found;

  // Already approved: no-op success so a double-click doesn't error.
  if (review.status === "approved") {
    return NextResponse.json({ ok: true, alreadyDecided: true });
  }

  // 'removed' is terminal. A review taken down by a report must not be revivable
  // by an older approve link still sitting in an inbox.
  if (review.status === "removed") {
    return NextResponse.json({ ok: true, alreadyDecided: true, removed: true });
  }

  // The status predicate is the real guard, not the reads above: only a review
  // that is STILL pending can be published. Without it, a remove_review landing
  // between the read and this write would be overwritten — the service-role
  // client bypasses the 0057 RLS ladder, so nothing else enforces terminality.
  const { data: updated, error: updateErr } = await admin
    .from("reviews")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", review.id)
    .eq("status", "pending")
    .select("id");
  if (updateErr) {
    console.error("[reviews/approve] update failed:", updateErr);
    return NextResponse.json({ error: "Could not approve, please try again." }, { status: 500 });
  }
  // Zero rows: the status changed since the read. Report the current state
  // instead of pretending the review was published, and skip the notifications.
  if (!updated || updated.length === 0) {
    const { data: current } = await admin
      .from("reviews")
      .select("status")
      .eq("id", review.id)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      alreadyDecided: true,
      ...(current?.status === "removed" ? { removed: true } : {}),
    });
  }

  const origin = new URL(request.url).origin;
  const profileUrl = tutorSlug ? `${origin}/tutor/${tutorSlug}` : null;

  // The student who wrote it.
  await notifyUser(admin, review.student_id, {
    type: "review_approved",
    title: "Your review is live",
    body: `Your review of ${tutorName} has been approved and now appears on their profile.`,
    email: {
      subject: "Your review is now live",
      html: reviewApprovedEmail({ name: studentName, tutorName, profileUrl }),
    },
  });

  // The tutor it's about.
  await notifyUser(admin, review.tutor_id, {
    type: "review_published",
    title: "You have a new review",
    body: `A student left you a ${review.rating}-star review.`,
    email: {
      subject: "You have a new review",
      html: newReviewEmail({ name: tutorName, rating: review.rating, profileUrl }),
    },
  });

  return NextResponse.json({ ok: true });
}
