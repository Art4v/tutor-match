import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { revisionRejectedEmail } from "@/lib/email/send";
import { verifyRevisionToken } from "@/lib/revisionToken";

export const runtime = "nodejs";

const MAX_REASON = 500; // must match the 0072 CHECK

// Reject a verified tutor's submitted profile changes. Same tokenless gate as
// approve. The tutor stays verified; reject_profile_revision reopens the
// content as a draft so they can fix and resubmit, or discard it. The optional
// reason goes into the notification and the email.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { revisionId, error: tokenError } = verifyRevisionToken(body?.token);
  if (tokenError) {
    return NextResponse.json({ error: "This review link is invalid or has expired." }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, MAX_REASON) : "";

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured for reviews." }, { status: 500 });
  }

  const { data: result, error } = await admin.rpc("reject_profile_revision", {
    p_revision_id: revisionId,
    p_reason: reason,
  });
  if (error) {
    console.error("[revisions/reject] failed:", error);
    return NextResponse.json({ error: "Could not reject the changes. Please try again." }, { status: 500 });
  }
  if (!result?.rejected) {
    return NextResponse.json({ ok: true, alreadyDecided: true, status: result?.status ?? null });
  }

  const tutorId = result.tutor_id;
  const { data: tutor } = await admin
    .from("tutor_profiles")
    .select("slug, profile:profiles!inner ( full_name )")
    .eq("id", tutorId)
    .maybeSingle();
  const origin = new URL(request.url).origin;
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
