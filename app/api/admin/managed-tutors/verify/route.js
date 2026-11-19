import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { managedTutorVerifiedEmail } from "@/lib/email/send";
import { purgeVerificationDocs } from "@/lib/admin/verificationDocs";
import { sweepInviteMaterials } from "@/lib/supabase/storage";
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

// POST { tutorId, reason? } (0081). Verify tutor: the end of managed setup.
// admin_verify_managed_tutor applies only once the tutor has approved, and in
// one transaction makes them verified, public and no longer managed. What SQL
// cannot do follows: the private signup files and any verification documents
// are removed from Storage, the indexable pages are refreshed, and the tutor
// is told.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  if (!isUuid(body?.tutorId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const reason = cleanReason(body.reason);

  const { data: result, error } = await supabase.rpc("admin_verify_managed_tutor", {
    p_tutor_id: body.tutorId,
    p_reason: reason,
  });
  if (error) return adminRpcErrorResponse(error, "Could not verify this tutor, please try again.");

  if (!result?.applied) {
    const decided = await lastAdminAction(supabase, "tutor", body.tutorId, "managed_");
    return NextResponse.json({ ok: true, alreadyDecided: true, status: result?.status ?? null, decided });
  }

  revalidateIndexable(revalidatePath);
  const admin = createSupabaseAdminClient();
  let purgeFailed = false;
  if (admin) {
    // The whole folder, not only the registered rows (see the opt-out route).
    await sweepInviteMaterials(admin, body.tutorId, { extra: Array.isArray(result.materials) ? result.materials : [] });
    // Reaching verified flagged the tutor's private verification files (0079).
    purgeFailed = !(await purgeVerificationDocs(admin, body.tutorId)).ok;
  }

  const origin = originOf(request);
  await notifyUser(admin, body.tutorId, {
    type: "managed_tutor_verified",
    title: "You're verified and live ✓",
    body: reason || "Your profile is public and shows the verified badge. It is yours to manage from here.",
    email: {
      subject: "You're verified and live on MatchTutor ✓",
      html: managedTutorVerifiedEmail({
        name: result.name,
        reason,
        profileUrl: result.slug ? `${origin}/tutor/${result.slug}` : `${origin}/profile`,
      }),
    },
  });
  return NextResponse.json({ ok: true, status: result.status, purgeFailed });
}
