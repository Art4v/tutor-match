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

  // Look up current state (and name for the email).
  const { data: tutor, error: readErr } = await admin
    .from("tutor_profiles")
    .select("verification_status, profile:profiles!inner ( full_name )")
    .eq("id", tutorId)
    .maybeSingle();
  if (readErr || !tutor) {
    return NextResponse.json({ error: "Tutor not found." }, { status: 404 });
  }

  // Only a request that is STILL pending can be decided. Anything else means
  // the link is stale: already decided, or the request was withdrawn (status
  // back to 'none'). Report the current state and send no notification.
  if (tutor.verification_status !== "pending") {
    return NextResponse.json({ ok: true, alreadyDecided: true, status: tutor.verification_status });
  }

  // The status predicate is the real guard, not the read above: the service-role
  // client bypasses RLS, so without it a decision landing between the read and
  // this write (a second click, the other button, a withdrawal) would be
  // overwritten. Same pattern as /api/reviews/approve.
  const { data: updated, error: updateErr } = await admin
    .from("tutor_profiles")
    .update({ verification_status: "rejected" })
    .eq("id", tutorId)
    .eq("verification_status", "pending")
    .select("id");
  if (updateErr) {
    return NextResponse.json({ error: "Could not reject, please try again." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    const { data: current } = await admin
      .from("tutor_profiles")
      .select("verification_status")
      .eq("id", tutorId)
      .maybeSingle();
    return NextResponse.json({ ok: true, alreadyDecided: true, status: current?.verification_status ?? null });
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
