import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { reviewRejectedEmail } from "@/lib/email/send";
import { verifyReviewToken } from "@/lib/reviewToken";
import { getReviewForModeration } from "@/lib/supabase/reviews";

export const runtime = "nodejs";

// Reject a student's review. NO user session — like the approve route, the admin
// clicks a link from their email, so the signed token is the authorization.
// Sets the review to 'rejected' via the service-role client and tells the
// student. Driven by the Reject button on /admin/review.
//
// There is no resubmit endpoint and none is needed: the 0057 RLS update policy
// forces any edit by the author back to 'pending', so editing a rejected review
// re-queues it automatically.
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

  // Already rejected: no-op success so a double-click doesn't error.
  if (review.status === "rejected") {
    return NextResponse.json({ ok: true, alreadyDecided: true });
  }

  // 'removed' is terminal — a reported-and-removed review stays removed.
  if (review.status === "removed") {
    return NextResponse.json({ ok: true, alreadyDecided: true, removed: true });
  }

  // Pending-only, like approve: a remove_review landing between the read and
  // this write must not be flipped to 'rejected' (the author could then edit a
  // removed review back into the queue). The service-role client bypasses the
  // 0057 RLS ladder, so this predicate is the only enforcement.
  const { data: updated, error: updateErr } = await admin
    .from("reviews")
    .update({ status: "rejected", approved_at: null })
    .eq("id", review.id)
    .eq("status", "pending")
    .select("id");
  if (updateErr) {
    console.error("[reviews/reject] update failed:", updateErr);
    return NextResponse.json({ error: "Could not reject, please try again." }, { status: 500 });
  }
  // Zero rows: the status changed since the read. Say so and skip the email.
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

  await notifyUser(admin, review.student_id, {
    type: "review_rejected",
    title: "Your review wasn't published",
    body: `We couldn't publish your review of ${tutorName}. You can edit it to send it back for another look.`,
    email: {
      subject: "Your review wasn't published",
      html: reviewRejectedEmail({ name: studentName, tutorName, profileUrl }),
    },
  });

  return NextResponse.json({ ok: true });
}
