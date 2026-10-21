import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { reviewApprovedEmail, reviewRejectedEmail, newReviewEmail } from "@/lib/email/send";
import { getReviewForModeration } from "@/lib/supabase/reviews";
import {
  requireAdminRequest,
  readJson,
  cleanReason,
  adminRpcErrorResponse,
  lastAdminAction,
  originOf,
} from "@/lib/admin/route";

export const runtime = "nodejs";

// Publish or reject a student's review from /admin/reviews.
// POST { reviewId, decision: "approve" | "reject", reason? }.
// admin_decide_review (0074) only acts on a pending review, so a review a
// report removed can't be revived. The rating aggregate updates itself via the
// 0057/0067 trigger.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  const decision = body?.decision;
  if (!body?.reviewId || !["approve", "reject"].includes(decision)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const reason = cleanReason(body.reason);

  const { data: result, error } = await supabase.rpc("admin_decide_review", {
    p_review_id: body.reviewId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) return adminRpcErrorResponse(error, "Could not save the decision, please try again.");

  if (!result?.applied) {
    const decided = await lastAdminAction(supabase, "review", body.reviewId);
    return NextResponse.json({ ok: true, alreadyDecided: true, status: result?.status ?? null, decided });
  }

  const admin = createSupabaseAdminClient();
  const found = admin ? await getReviewForModeration(admin, body.reviewId) : null;
  if (!found) return NextResponse.json({ ok: true, status: result.status });

  const { review, subjectName, subjectHref, notifyUserId, studentName } = found;
  const origin = originOf(request);
  const profileUrl = subjectHref ? `${origin}${subjectHref}` : null;

  if (decision === "approve") {
    await notifyUser(admin, review.student_id, {
      type: "review_approved",
      title: "Your review is live",
      body: `Your review of ${subjectName} has been approved and now appears on their page.`,
      email: {
        subject: "Your review is now live",
        html: reviewApprovedEmail({ name: studentName, tutorName: subjectName, profileUrl }),
      },
    });
    // The tutor, or a company's owner. Null for an unclaimed company.
    if (notifyUserId) {
      await notifyUser(admin, notifyUserId, {
        type: "review_published",
        title: "You have a new review",
        body: `A student left a ${review.rating}-star review.`,
        email: {
          subject: "You have a new review",
          html: newReviewEmail({ name: subjectName, rating: review.rating, profileUrl }),
        },
      });
    }
  } else {
    await notifyUser(admin, review.student_id, {
      type: "review_rejected",
      title: "Your review wasn't published",
      body: reason
        ? `We couldn't publish your review of ${subjectName}. Reviewer's note: "${reason}". You can edit it to send it back for another look.`
        : `We couldn't publish your review of ${subjectName}. You can edit it to send it back for another look.`,
      email: {
        subject: "Your review wasn't published",
        html: reviewRejectedEmail({ name: studentName, tutorName: subjectName, reason, profileUrl }),
      },
    });
  }

  return NextResponse.json({ ok: true, status: result.status });
}
