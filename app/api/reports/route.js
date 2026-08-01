import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { sendEmail, adminReportEmail, reportReceivedEmail } from "@/lib/email/send";
import { signReportToken } from "@/lib/reportToken";
import { isAccountEnabled } from "@/lib/supabase/account";

export const runtime = "nodejs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "matchtutoraustralia@gmail.com";
// Keep in sync with the 0059 CHECK + ReportModal + the two label maps.
const CATEGORIES = ["harassment", "spam", "inappropriate", "scam", "other", "inappropriate_review"];
const MAX_DETAILS = 2000;

// Two kinds of report share this route, told apart by the body shape:
//
//   { conversationId, … }  the original "report and block" against the other
//                          party in a conversation. Blocking is a server-owned
//                          invariant here.
//   { reviewId, … }        a report about a published review (0059). Reporting
//                          does NOT block: you may be reporting a stranger's
//                          review of a third party, and a tutor auto-blocking a
//                          critic would read as retaliation.
//
// Auth-gated either way. Records the report, emails the admin a one-click review
// link, and confirms to the reporter. Idempotent: while a matching report is
// still pending, re-filing is a silent no-op (no second row, no second email).
export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // middleware exempts /api, so enforce "not disabled" here (0052).
  if (!(await isAccountEnabled(supabase, user.id))) {
    return NextResponse.json({ error: "Your account is disabled." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const conversationId = body?.conversationId;
  const reviewId = body?.reviewId;
  const isReviewReport = !!reviewId;
  const category = body?.category;
  const details = typeof body?.details === "string" ? body.details.trim().slice(0, MAX_DETAILS) : null;

  if ((!conversationId && !reviewId) || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Something to report and a valid reason are required." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured for reports." }, { status: 500 });
  }

  // Derive who is being reported, per kind.
  let reportedId;
  if (isReviewReport) {
    // The reported party is the review's author. Service-role read so this works
    // regardless of the review's status (a viewer may be reporting something
    // that is public to them but invisible under the caller's own RLS).
    const { data: review } = await admin
      .from("reviews")
      .select("id, student_id")
      .eq("id", reviewId)
      .maybeSingle();
    if (!review) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    if (review.student_id === user.id) {
      // The 0053 `reporter_id <> reported_id` CHECK would reject this anyway;
      // fail cleanly rather than on a constraint.
      return NextResponse.json({ error: "You can't report your own review." }, { status: 400 });
    }
    reportedId = review.student_id;
  } else {
    // Resolve the conversation and confirm the caller participates; the reported
    // user is the OTHER participant. Service-role read (RLS would also allow the
    // participant, but we need this even-handed for the derivation).
    const { data: conv } = await admin
      .from("conversations")
      .select("id, student_id, tutor_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conv || (conv.student_id !== user.id && conv.tutor_id !== user.id)) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    reportedId = conv.student_id === user.id ? conv.tutor_id : conv.student_id;

    // Report => block is a server-owned invariant FOR CONVERSATION REPORTS ONLY:
    // ensure the block row exists here, so the "we've blocked this person"
    // confirmation below is always true rather than relying on a separate
    // client-side call that may fail. Idempotent (DO NOTHING via
    // ignoreDuplicates). Placed BEFORE the report insert so the block still lands
    // on the already-pending duplicate path (which returns early at the 23505
    // handler). Review reports deliberately skip this entirely.
    await admin
      .from("blocked_users")
      .upsert(
        { blocker_id: user.id, blocked_id: reportedId },
        { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }
      );
  }

  // Insert the report. The partial unique indexes (0059, split by kind) make a
  // re-file while a prior report of the SAME kind is still pending raise 23505 —
  // treat that as idempotent success and skip the admin email so we don't spam.
  const { data: inserted, error: insertErr } = await admin
    .from("reports")
    .insert({
      reporter_id: user.id,
      reported_id: reportedId,
      conversation_id: isReviewReport ? null : conversationId,
      review_id: isReviewReport ? reviewId : null,
      category,
      details,
    })
    .select("id")
    .maybeSingle();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ status: "pending" });
    }
    console.error("[reports] insert failed:", insertErr);
    return NextResponse.json({ error: "Could not submit your report." }, { status: 500 });
  }

  // Side effects only on a genuinely new report. Signing the review token throws
  // when REPORT_REVIEW_SECRET is unset; if that (or any side effect) fails, delete
  // the just-inserted row so the report is not stranded — otherwise the 0053 partial
  // unique index would make every retry a silent "pending" no-op, hiding it from
  // admins forever. The block above is left in place (it's the protective action).
  try {
    const origin = new URL(request.url).origin;
    const reviewUrl = `${origin}/admin/report?token=${encodeURIComponent(signReportToken(inserted.id))}`;

    // Resolve display names for the admin email.
    const { data: names } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", [user.id, reportedId]);
    const nameOf = (id) => names?.find((n) => n.id === id)?.full_name || null;
    const reporterName = nameOf(user.id) || "A user";
    const reportedName = nameOf(reportedId) || "another user";

    // Admin: the review link.
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: isReviewReport
        ? `Review reported: ${reporterName} reported ${reportedName}`
        : `Report: ${reporterName} reported ${reportedName}`,
      html: adminReportEmail({ reporterName, reportedName, category, details, reviewUrl, kind: isReviewReport ? "review" : "conversation" }),
    });

    // Reporter: "we've got your report" (in-app notification + email). The copy
    // branches because only the conversation path blocks anyone — telling a
    // review reporter we'd blocked someone would simply be false.
    await notifyUser(admin, user.id, {
      type: "report_received",
      title: "Report received",
      body: isReviewReport
        ? "Thanks for reporting. Our team will take a look at that review."
        : "Thanks for reporting. We've blocked this person and our team will review the conversation.",
      email: {
        subject: "We've received your report",
        html: reportReceivedEmail({ name: reporterName, kind: isReviewReport ? "review" : "conversation" }),
      },
    });
  } catch (err) {
    console.error("[reports] side effects failed, rolling back the report row:", err);
    await admin.from("reports").delete().eq("id", inserted.id);
    return NextResponse.json({ error: "Could not submit your report. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ status: "filed" });
}
