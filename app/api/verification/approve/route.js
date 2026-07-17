import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { userApprovedEmail } from "@/lib/email/send";
import { verifyApproveToken } from "@/lib/verifyToken";

export const runtime = "nodejs";

// Approve a verification request. NO user session — the admin clicks a link from
// their email, so a signed token (not auth) is the authorization. Validates the
// token, flips the tutor to verified via the service-role client, then notifies
// the tutor. Driven by the Approve button on /admin/verify (which POSTs here).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { tutorId, error: tokenError } = verifyApproveToken(body?.token);
  if (tokenError) {
    return NextResponse.json({ error: "This approval link is invalid or has expired." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured for approvals." }, { status: 500 });
  }

  // Look up current state (and name/slug for the email). Already-verified is a
  // no-op success so a double-click doesn't error.
  const { data: tutor, error: readErr } = await admin
    .from("tutor_profiles")
    .select("verification_status, slug, profile:profiles!inner ( full_name )")
    .eq("id", tutorId)
    .maybeSingle();
  if (readErr || !tutor) {
    return NextResponse.json({ error: "Tutor not found." }, { status: 404 });
  }

  if (tutor.verification_status === "verified") {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const { error: updateErr } = await admin
    .from("tutor_profiles")
    .update({ verification_status: "verified" })
    .eq("id", tutorId);
  if (updateErr) {
    return NextResponse.json({ error: "Could not approve — please try again." }, { status: 500 });
  }

  const name = tutor.profile?.full_name || "";
  const origin = new URL(request.url).origin;
  const profileUrl = tutor.slug ? `${origin}/tutor/${tutor.slug}` : null;

  await notifyUser(admin, tutorId, {
    type: "verification_approved",
    title: "You're verified ✓",
    body: "Your profile now shows the verified badge and ranks higher in search.",
    email: { subject: "You're verified on MatchTutor ✓", html: userApprovedEmail({ name, profileUrl }) },
  });

  return NextResponse.json({ ok: true });
}
