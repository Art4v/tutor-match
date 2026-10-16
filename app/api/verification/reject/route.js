import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { userRejectedEmail } from "@/lib/email/send";
import { verifyApproveToken } from "@/lib/verifyToken";

export const runtime = "nodejs";

// Reject a verification request. NO user session — like the approve route, the
// admin clicks a link from their email, so the signed token (not auth) is the
// authorization. Validates the token, sets the tutor to 'rejected' via the
// service-role client, then notifies them. The tutor can update their profile
// and resubmit (request_tutor_verification moves rejected -> pending). Driven by
// the Reject button on /admin/verify.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { tutorId, error: tokenError } = verifyApproveToken(body?.token);
  if (tokenError) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured for reviews." }, { status: 500 });
  }

  // Look up current state (and name for the email). Already-rejected is a no-op
  // success so a double-click doesn't error.
  const { data: tutor, error: readErr } = await admin
    .from("tutor_profiles")
    .select("verification_status, profile:profiles!inner ( full_name )")
    .eq("id", tutorId)
    .maybeSingle();
  if (readErr || !tutor) {
    return NextResponse.json({ error: "Tutor not found." }, { status: 404 });
  }

  if (tutor.verification_status === "rejected") {
    return NextResponse.json({ ok: true, alreadyRejected: true });
  }

  // Only a PENDING request can be decided. The link is signed for the tutor,
  // not for one request, so without this predicate an old email could act on
  // a tutor who has since withdrawn (none) or been decided another way. It is
  // in the UPDATE itself, not just the read above, so two clicks racing each
  // other can't both win (the 0060 pattern).
  const { data: updated, error: updateErr } = await admin
    .from("tutor_profiles")
    .update({ verification_status: "rejected" })
    .eq("id", tutorId)
    .eq("verification_status", "pending")
    .select("id");
  if (!updateErr && (!Array.isArray(updated) || updated.length === 0)) {
    return NextResponse.json(
      { error: "This request is no longer waiting for review. The tutor may have withdrawn it by editing their profile." },
      { status: 409 }
    );
  }
  if (updateErr) {
    return NextResponse.json({ error: "Could not reject — please try again." }, { status: 500 });
  }

  const name = tutor.profile?.full_name || "";
  const origin = new URL(request.url).origin;
  const profileUrl = `${origin}/profile`;

  await notifyUser(admin, tutorId, {
    type: "verification_rejected",
    title: "Verification not approved",
    body: "An admin reviewed your profile and couldn't verify it this time. Update your profile and you can request another review.",
    email: { subject: "Your MatchTutor verification wasn't approved", html: userRejectedEmail({ name, profileUrl }) },
  });

  return NextResponse.json({ ok: true });
}
