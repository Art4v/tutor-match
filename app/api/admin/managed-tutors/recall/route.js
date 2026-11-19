import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { managedSetupRecalledEmail } from "@/lib/email/send";
import {
  requireAdminRequest,
  readJson,
  cleanReason,
  adminRpcErrorResponse,
  lastAdminAction,
  originOf,
} from "@/lib/admin/route";
import { isUuid } from "../shared";

export const runtime = "nodejs";

// POST { tutorId, reason? } (0081). Take a profile back from the tutor so an
// admin can edit it again. Applies from `sent` and from `approved`, where it
// cancels the approval. The tutor is notified and emailed (by decision).
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  if (!isUuid(body?.tutorId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const reason = cleanReason(body.reason);

  const { data: result, error } = await supabase.rpc("admin_recall_managed_setup", {
    p_tutor_id: body.tutorId,
    p_reason: reason,
  });
  if (error) return adminRpcErrorResponse(error, "Could not recall the profile, please try again.");

  if (!result?.applied) {
    const decided = await lastAdminAction(supabase, "tutor", body.tutorId, "managed_setup_");
    return NextResponse.json({ ok: true, alreadyDecided: true, status: result?.status ?? null, decided });
  }

  await notifyUser(createSupabaseAdminClient(), body.tutorId, {
    type: "managed_setup_recalled",
    title: "We're making more changes to your profile",
    body: reason || "There is nothing for you to approve right now. We'll email you when it is ready.",
    email: {
      subject: "We're making more changes to your MatchTutor profile",
      html: managedSetupRecalledEmail({ name: result.name, reason, profileUrl: `${originOf(request)}/profile` }),
    },
  });
  return NextResponse.json({ ok: true, status: result.status });
}
