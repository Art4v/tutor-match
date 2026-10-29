import { NextResponse } from "next/server";
import { requireAdminRequest, readJson, cleanReason, adminRpcErrorResponse, lastAdminAction } from "@/lib/admin/route";
import { isUuid } from "../shared";

export const runtime = "nodejs";

// POST { tutorId, reason? } (0076): take a managed tutor out of the new-tutor
// queue. The optional note is logged to History with the action.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  if (!isUuid(body?.tutorId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("admin_mark_managed_setup_done", {
    p_tutor_id: body.tutorId,
    p_reason: cleanReason(body.reason) || null,
  });
  if (error) return adminRpcErrorResponse(error, "Could not update the tutor, please try again.");
  if (!data?.applied) {
    const decided = await lastAdminAction(supabase, "tutor", body.tutorId, "managed_setup_done");
    return NextResponse.json({ ok: true, alreadyDecided: true, status: "done", decided });
  }
  return NextResponse.json({ ok: true, status: "done" });
}
