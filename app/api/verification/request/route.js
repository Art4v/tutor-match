import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { adminRequestEmail, userRequestedEmail } from "@/lib/email/send";
import { emailAdmins } from "@/lib/admin/alerts";
import { adminPaths } from "@/lib/admin/urls";
import { isAccountEnabled } from "@/lib/supabase/account";

export const runtime = "nodejs";

// A tutor requests that their account be verified. Auth-gated. Flips them to
// 'pending' via the request_tutor_verification RPC, then (only on a real
// transition) notifies the tutor and alerts the admins with a dashboard link.
// Idempotent: re-requesting while already pending/verified sends no new email.
export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // middleware exempts /api, so enforce "not disabled" here (0052).
  if (!(await isAccountEnabled(supabase, user.id))) {
    return NextResponse.json({ error: "Your account is disabled." }, { status: 403 });
  }

  // Read the current status first so we only email on a genuine transition.
  const { data: before } = await supabase
    .from("tutor_profiles")
    .select("verification_status, slug, profile:profiles!inner ( full_name )")
    .eq("id", user.id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "No tutor profile." }, { status: 404 });
  }

  const wasActionable = before.verification_status === "none" || before.verification_status === "rejected";

  const { data: status, error: rpcError } = await supabase.rpc("request_tutor_verification");
  if (rpcError) {
    return NextResponse.json({ error: "Could not submit your request." }, { status: 500 });
  }

  // Side effects only on a real none/rejected -> pending transition.
  if (wasActionable && status === "pending") {
    const admin = createSupabaseAdminClient();
    const tutorName = before.profile?.full_name || "A tutor";
    const origin = new URL(request.url).origin;
    const profileUrl = before.slug ? `${origin}/tutor/${before.slug}` : null;
    const approveUrl = `${origin}${adminPaths.verification(user.id)}`;

    // Tutor: "we've got your request" (in-app notification + email).
    await notifyUser(admin, user.id, {
      type: "verification_requested",
      title: "Verification request sent",
      body: "We've received your request — an admin will review your profile shortly.",
      email: { subject: "We've got your verification request", html: userRequestedEmail({ name: tutorName }) },
    });

    // Admins: an alert linking to the request in /admin.
    await emailAdmins({
      subject: `Verification request: ${tutorName}`,
      html: adminRequestEmail({ tutorName, approveUrl, profileUrl }),
    });
  }

  return NextResponse.json({ status });
}
