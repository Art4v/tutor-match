import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { adminMarksRequestEmail, userMarksRequestedEmail } from "@/lib/email/send";
import { emailAdmins } from "@/lib/admin/alerts";
import { adminPaths } from "@/lib/admin/urls";
import { isAccountEnabled } from "@/lib/supabase/account";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const RATE = { limit: 10, windowMs: 60 * 60 * 1000 };

// The tutor's side of the "marks verified" seal (0083). Both verbs are
// auth-gated and scoped to the caller by the RPC, which is the boundary.
async function session() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  // middleware exempts /api, so enforce "not disabled" here (0052).
  if (!(await isAccountEnabled(supabase, user.id))) {
    return { res: NextResponse.json({ error: "Your account is disabled." }, { status: 403 }) };
  }
  const { allowed } = checkRateLimit(`marks-request:${user.id}`, RATE);
  if (!allowed) {
    return { res: NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 }) };
  }
  return { supabase, user };
}

// POST (no body): a verified tutor asks for the seal. request_marks_verification
// moves none/declined to pending. Only on that real transition are the tutor
// acknowledged and the admins alerted, so a double click sends nothing twice.
export async function POST(request) {
  const s = await session();
  if (s.res) return s.res;
  const { supabase, user } = s;

  const { data: before } = await supabase
    .from("tutor_profiles")
    .select("marks_status, slug, profile:profiles!inner ( full_name )")
    .eq("id", user.id)
    .maybeSingle();
  if (!before) {
    return NextResponse.json({ error: "No tutor profile." }, { status: 404 });
  }
  const wasActionable = before.marks_status === "none" || before.marks_status === "declined";

  const { data: status, error } = await supabase.rpc("request_marks_verification");
  if (error) {
    // 22023 carries a message written for the tutor (not verified yet, managed).
    if (error.code === "22023") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not submit your request." }, { status: 500 });
  }

  if (wasActionable && status === "pending") {
    const admin = createSupabaseAdminClient();
    const tutorName = before.profile?.full_name || "A tutor";
    const origin = new URL(request.url).origin;
    const profileUrl = before.slug ? `${origin}/tutor/${before.slug}` : null;

    await notifyUser(admin, user.id, {
      type: "marks_requested",
      title: "Marks verification request sent",
      body: "We've received your request. An admin will check your supporting documents shortly.",
      email: { subject: "We've got your marks verification request", html: userMarksRequestedEmail({ name: tutorName }) },
    });

    await emailAdmins({
      subject: `Marks verification request: ${tutorName}`,
      html: adminMarksRequestEmail({
        tutorName,
        reviewUrl: `${origin}${adminPaths.verification(user.id)}`,
        profileUrl,
      }),
    });
  }

  return NextResponse.json({ status });
}

// DELETE: the tutor withdraws a pending request (pending -> none), which
// unlocks their files. Nobody is emailed; the request just leaves the queue.
export async function DELETE() {
  const s = await session();
  if (s.res) return s.res;

  const { data: status, error } = await s.supabase.rpc("withdraw_marks_request");
  if (error) {
    return NextResponse.json({ error: "Could not withdraw your request." }, { status: 500 });
  }
  return NextResponse.json({ status });
}
