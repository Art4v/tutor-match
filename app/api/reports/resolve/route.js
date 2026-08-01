import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyReportToken } from "@/lib/reportToken";

export const runtime = "nodejs";

// Maps a decision action to (which account to disable, whether to take the
// reported review down, resolution to record).
const ACTIONS = {
  disable_reported: { disable: "reported_id", resolution: "disabled_reported" },
  disable_reporter: { disable: "reporter_id", resolution: "disabled_reporter" },
  dismiss: { disable: null, resolution: "dismissed" },
  // Review reports only (0059): takes the review down without touching either
  // account, the proportionate response to one bad review.
  remove_review: { disable: null, resolution: "removed_review", removeReview: true },
};

// Resolve a report. NO user session — the admin clicks a link from their email,
// so a signed token (not auth) is the authorization. Validates the token, then
// via the service-role client optionally disables an account and marks the
// report resolved. Driven by the buttons on /admin/report. Already-resolved is a
// no-op success so a double-click / reopened link doesn't error.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { reportId, error: tokenError } = verifyReportToken(body?.token);
  if (tokenError) {
    return NextResponse.json({ error: "This review link is invalid or has expired." }, { status: 400 });
  }

  const action = ACTIONS[body?.action];
  if (!action) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured for reports." }, { status: 500 });
  }

  const { data: report, error: readErr } = await admin
    .from("reports")
    .select("id, reporter_id, reported_id, review_id, status")
    .eq("id", reportId)
    .maybeSingle();
  if (readErr || !report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  if (report.status === "resolved") {
    return NextResponse.json({ ok: true, alreadyResolved: true });
  }

  if (action.removeReview && !report.review_id) {
    // Either this isn't a review report, or the author deleted the review first
    // (review_id is ON DELETE SET NULL). Nothing to remove.
    return NextResponse.json({ error: "There is no review to remove." }, { status: 400 });
  }

  // Take the review down. 'removed' is terminal: the 0057 RLS update policy's
  // `status <> 'removed'` USING clause stops the author editing it back into
  // circulation, and the approve route refuses to revive it. The 0057 trigger
  // drops it from the tutor's average, since recalc_tutor_rating() aggregates
  // over get_tutor_reviews(), which is approved-only.
  if (action.removeReview) {
    const { error: removeErr } = await admin
      .from("reviews")
      .update({ status: "removed", approved_at: null })
      .eq("id", report.review_id);
    if (removeErr) {
      console.error("[reports] review removal failed:", removeErr);
      return NextResponse.json({ error: "Could not remove the review, please try again." }, { status: 500 });
    }
  }

  // Disable the chosen account (if any).
  if (action.disable) {
    const targetId = report[action.disable];
    const { error: disableErr } = await admin
      .from("profiles")
      .update({ status: "disabled" })
      .eq("id", targetId);
    if (disableErr) {
      console.error("[reports] disable failed:", disableErr);
      return NextResponse.json({ error: "Could not disable the account, please try again." }, { status: 500 });
    }
  }

  // Mark the report resolved. resolved_at is server-set here (not passed in).
  const { error: resolveErr } = await admin
    .from("reports")
    .update({ status: "resolved", resolution: action.resolution, resolved_at: new Date().toISOString() })
    .eq("id", reportId);
  if (resolveErr) {
    console.error("[reports] resolve update failed:", resolveErr);
    return NextResponse.json({ error: "Could not save the decision, please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resolution: action.resolution });
}
