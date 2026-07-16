import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyReportToken } from "@/lib/reportToken";

export const runtime = "nodejs";

// Maps a decision action to (which account to disable, resolution to record).
const ACTIONS = {
  disable_reported: { disable: "reported_id", resolution: "disabled_reported" },
  disable_reporter: { disable: "reporter_id", resolution: "disabled_reporter" },
  dismiss: { disable: null, resolution: "dismissed" },
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
    .select("id, reporter_id, reported_id, status")
    .eq("id", reportId)
    .maybeSingle();
  if (readErr || !report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  if (report.status === "resolved") {
    return NextResponse.json({ ok: true, alreadyResolved: true });
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
