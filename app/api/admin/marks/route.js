import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  requireAdminRequest,
  readJson,
  cleanReason,
  adminRpcErrorResponse,
  lastAdminAction,
  originOf,
  revalidateIndexable,
} from "@/lib/admin/route";
import { afterMarksDecision } from "./shared";

export const runtime = "nodejs";

// Grant or decline a tutor's request for the "marks verified" seal, from
// /admin/verification. POST { tutorId, decision: "grant" | "decline", reason? }.
// The decision is admin_decide_marks (0083), which re-checks the caller is an
// admin, only acts while the request is still pending, and writes History.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  const decision = body?.decision;
  if (!body?.tutorId || !["grant", "decline"].includes(decision)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: result, error } = await supabase.rpc("admin_decide_marks", {
    p_tutor_id: body.tutorId,
    p_decision: decision,
    p_reason: cleanReason(body.reason),
  });
  if (error) return adminRpcErrorResponse(error, "Could not save the decision, please try again.");

  if (!result?.applied) {
    const decided = await lastAdminAction(supabase, "tutor", body.tutorId, "marks_");
    return NextResponse.json({ ok: true, alreadyDecided: true, status: result?.status ?? null, decided });
  }

  const { purgeFailed } = await afterMarksDecision(createSupabaseAdminClient(), {
    tutorId: body.tutorId,
    outcome: decision === "grant" ? "granted" : "declined",
    result,
    origin: originOf(request),
  });

  // The seal reorders the hourly-cached /tutors landing pages.
  if (decision === "grant") revalidateIndexable(revalidatePath);

  return NextResponse.json({ ok: true, status: result.status, purgeFailed });
}
