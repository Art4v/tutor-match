import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireAdminRequest,
  readJson,
  cleanReason,
  adminRpcErrorResponse,
  lastAdminAction,
  originOf,
} from "@/lib/admin/route";
import { isUuid, notifySetupReady } from "../shared";

export const runtime = "nodejs";

// POST { tutorId, reason? } (0081). An admin has finished setting up a managed
// tutor's profile and sends it to them for approval. `reason` is DecisionPanel's
// note field, used here as the optional message shown to the tutor. Applies
// only from `setup` / `changes_requested`; the tutor is then emailed.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  if (!isUuid(body?.tutorId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const message = cleanReason(body.reason);

  const { data: result, error } = await supabase.rpc("admin_send_managed_setup", {
    p_tutor_id: body.tutorId,
    p_message: message,
  });
  if (error) return adminRpcErrorResponse(error, "Could not send the profile, please try again.");

  if (!result?.applied) {
    const decided = await lastAdminAction(supabase, "tutor", body.tutorId, "managed_setup_");
    return NextResponse.json({ ok: true, alreadyDecided: true, status: result?.status ?? null, decided });
  }

  await notifySetupReady(createSupabaseAdminClient(), body.tutorId, {
    name: result.name,
    message: result.message,
    origin: originOf(request),
  });
  return NextResponse.json({ ok: true, status: result.status });
}
