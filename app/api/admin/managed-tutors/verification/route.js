import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { managedVerificationEmail } from "@/lib/email/send";
import {
  requireAdminRequest,
  readJson,
  cleanReason,
  adminRpcErrorResponse,
  lastAdminAction,
  originOf,
  revalidateIndexable,
} from "@/lib/admin/route";
import { isUuid } from "../shared";

export const runtime = "nodejs";

// POST { tutorId, verified: boolean, reason? } (0076). Admins set a managed
// tutor's verification directly (verified <-> none), no request needed.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  if (!isUuid(body?.tutorId) || typeof body?.verified !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const reason = cleanReason(body.reason);

  const { data: result, error } = await supabase.rpc("admin_set_tutor_verification", {
    p_tutor_id: body.tutorId,
    p_verified: body.verified,
    p_reason: reason,
  });
  if (error) return adminRpcErrorResponse(error, "Could not change verification, please try again.");

  if (!result?.applied) {
    const decided = await lastAdminAction(supabase, "tutor", body.tutorId, "verification_");
    return NextResponse.json({ ok: true, alreadyDecided: true, status: result?.status ?? null, decided });
  }

  revalidateIndexable(revalidatePath);
  const admin = createSupabaseAdminClient();
  const { data: row } = admin
    ? await admin.from("tutor_profiles").select("slug").eq("id", body.tutorId).maybeSingle()
    : { data: null };
  const origin = originOf(request);
  await notifyUser(admin, body.tutorId, {
    type: "managed_verification_set",
    title: body.verified ? "You're verified ✓" : "Your verification was removed",
    body: reason || (body.verified ? "Your profile now shows the verified badge." : "Your profile no longer shows the verified badge."),
    email: {
      subject: body.verified ? "You're verified on MatchTutor ✓" : "Your MatchTutor verification was removed",
      html: managedVerificationEmail({
        name: result.name,
        verified: body.verified,
        reason,
        profileUrl: row?.slug ? `${origin}/tutor/${row.slug}` : `${origin}/profile`,
      }),
    },
  });
  return NextResponse.json({ ok: true, status: result.status });
}
