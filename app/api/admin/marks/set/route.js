import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminRequest, readJson, cleanReason, adminRpcErrorResponse, originOf, revalidateIndexable } from "@/lib/admin/route";
import { afterMarksDecision } from "../shared";

export const runtime = "nodejs";

// Grant or remove the "marks verified" seal directly, from /admin/users/[id],
// with or without a request from the tutor. POST { tutorId, granted, reason? }.
// admin_set_marks (0083) requires a verified tutor who is not a centre's tutor
// and returns { applied: false } when the seal is already in that state. The
// tutor is notified and emailed both ways, with the admin's note.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;

  const body = await readJson(request);
  if (!body?.tutorId || typeof body?.granted !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: result, error } = await gate.supabase.rpc("admin_set_marks", {
    p_tutor_id: body.tutorId,
    p_granted: body.granted,
    p_reason: cleanReason(body.reason),
  });
  if (error) return adminRpcErrorResponse(error, "Could not change the seal, please try again.");

  if (!result?.applied) {
    return NextResponse.json({ ok: true, applied: false, status: result?.status ?? null });
  }

  const { purgeFailed } = await afterMarksDecision(createSupabaseAdminClient(), {
    tutorId: body.tutorId,
    outcome: body.granted ? "granted" : "revoked",
    result,
    origin: originOf(request),
  });

  // The seal reorders the hourly-cached /tutors landing pages.
  revalidateIndexable(revalidatePath);

  return NextResponse.json({ ok: true, applied: true, status: result.status, purgeFailed });
}
