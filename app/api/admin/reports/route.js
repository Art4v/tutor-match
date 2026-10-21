import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  requireAdminRequest,
  readJson,
  cleanReason,
  adminRpcErrorResponse,
  lastAdminAction,
  revalidateIndexable,
} from "@/lib/admin/route";

export const runtime = "nodejs";

const ACTIONS = ["disable_reported", "disable_reporter", "dismiss", "remove_review"];

// Resolve a report from /admin/reports.
// POST { reportId, action, reason? }. admin_resolve_report (0074) does every
// write in one transaction and only while the report is still pending, which
// the old token route did not guarantee. It refuses to disable an admin.
// No one is notified, as before: neither party is told how a report ended.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  if (!body?.reportId || !ACTIONS.includes(body?.action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: result, error } = await supabase.rpc("admin_resolve_report", {
    p_report_id: body.reportId,
    p_action: body.action,
    p_reason: cleanReason(body.reason),
  });
  if (error) return adminRpcErrorResponse(error, "Could not save the decision, please try again.");

  if (!result?.applied) {
    const decided = await lastAdminAction(supabase, "report", body.reportId);
    return NextResponse.json({ ok: true, alreadyDecided: true, resolution: result?.resolution ?? null, decided });
  }

  // A disabled tutor drops out of the indexable set.
  if (result.disabled_user_id) revalidateIndexable(revalidatePath);

  return NextResponse.json({ ok: true, resolution: result.resolution });
}
