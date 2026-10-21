import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { revisionRejectedEmail } from "@/lib/email/send";
import {
  requireAdminRequest,
  readJson,
  cleanReason,
  adminRpcErrorResponse,
  lastAdminAction,
  originOf,
} from "@/lib/admin/route";

export const runtime = "nodejs";

// Reject a verified tutor's submitted profile changes from
// /admin/profile-changes. POST { revisionId, reason? }. The tutor stays
// verified; the content comes back as a draft (0072). The optional reason goes
// into the notification and the email.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  if (!body?.revisionId) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const reason = cleanReason(body.reason);

  const { data: result, error } = await supabase.rpc("admin_reject_profile_revision", {
    p_revision_id: body.revisionId,
    p_reason: reason,
  });
  if (error) return adminRpcErrorResponse(error, "Could not reject the changes. Please try again.");
  if (!result?.rejected) {
    const decided = await lastAdminAction(supabase, "revision", body.revisionId);
    return NextResponse.json({ ok: true, alreadyDecided: true, status: result?.status ?? null, decided });
  }

  const admin = createSupabaseAdminClient();
  const tutorId = result.tutor_id;
  const { data: tutor } = admin
    ? await admin.from("tutor_profiles").select("slug, profile:profiles!inner ( full_name )").eq("id", tutorId).maybeSingle()
    : { data: null };
  const origin = originOf(request);
  const profileUrl = tutor?.slug ? `${origin}/tutor/${tutor.slug}` : `${origin}/profile`;

  await notifyUser(admin, tutorId, {
    type: "profile_revision_rejected",
    title: "Profile changes not approved",
    body: reason
      ? `Reviewer's note: "${reason}". Your changes are saved as a draft so you can update and resubmit them.`
      : "Our team couldn't approve your profile changes. They're saved as a draft so you can update and resubmit them.",
    email: {
      subject: "Your profile changes weren't approved",
      html: revisionRejectedEmail({ name: tutor?.profile?.full_name, reason, profileUrl }),
    },
  });

  return NextResponse.json({ ok: true });
}
