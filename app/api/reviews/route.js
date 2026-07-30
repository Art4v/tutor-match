import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { sendEmail, adminReviewEmail, reviewReceivedEmail } from "@/lib/email/send";
import { signReviewToken } from "@/lib/reviewToken";
import { isAccountEnabled } from "@/lib/supabase/account";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "matchtutoraustralia@gmail.com";
const MAX_BODY = 500; // must match the 0057 CHECK
// Soft cap so one account can't flood the admin inbox. In-process, so on
// serverless this is per-instance (see lib/rateLimit.js) — a blunt instrument,
// not a security boundary. The real gate is that nothing publishes unapproved.
const RATE = { limit: 10, windowMs: 60 * 60 * 1000 };

// A student leaves a review for a tutor. Auth-gated, students only, one per
// tutor (the 0057 UNIQUE turns a repeat into a 409). The row is written through
// the USER-SCOPED client on purpose: the RLS insert policy requires
// student_id = auth.uid() AND status = 'pending', so a student structurally
// cannot self-approve. Then the admin gets a one-click moderation link and the
// student gets a "thanks for leaving a review" confirmation.
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

  // Reviewing is student-only. The reviews.student_id FK to student_profiles
  // would reject a tutor anyway, but a clean 403 beats a constraint violation.
  const { data: me } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "student") {
    return NextResponse.json({ error: "Only students can leave reviews." }, { status: 403 });
  }

  const { allowed } = checkRateLimit(`review:${user.id}`, RATE);
  if (!allowed) {
    return NextResponse.json({ error: "You're leaving reviews too quickly. Try again later." }, { status: 429 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const tutorId = payload?.tutorId;
  const rating = payload?.rating;
  // Empty text must become NULL, not "": the 0057 CHECK rejects a blank-but-
  // present body (so the card never renders an empty paragraph).
  const trimmed = typeof payload?.body === "string" ? payload.body.trim().slice(0, MAX_BODY) : "";
  const body = trimmed === "" ? null : trimmed;

  if (!tutorId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "A tutor and a rating from 1 to 5 are required." }, { status: 400 });
  }

  // The target must be a real, publicly listable tutor. RLS already hides
  // disabled owners (0055); visibility + confirmation are app-level filters, so
  // check them here the way the public query helpers do.
  const { data: tutor } = await supabase
    .from("tutor_profiles")
    .select("id, slug, visibility, email_confirmed_at, profile:profiles!inner ( full_name )")
    .eq("id", tutorId)
    .maybeSingle();
  if (!tutor || tutor.visibility !== "public" || !tutor.email_confirmed_at) {
    return NextResponse.json({ error: "Tutor not found." }, { status: 404 });
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("reviews")
    .insert({ tutor_id: tutorId, student_id: user.id, rating, body })
    .select("id")
    .maybeSingle();

  if (insertErr) {
    // 0057's UNIQUE (tutor_id, student_id): one review per tutor per student.
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "You've already reviewed this tutor.", status: "exists" }, { status: 409 });
    }
    console.error("[reviews] insert failed:", insertErr);
    return NextResponse.json({ error: "Could not save your review." }, { status: 500 });
  }

  // Side effects only after a real insert. Signing the token throws when
  // REVIEW_APPROVE_SECRET is unset; if that (or any side effect) fails, delete
  // the row rather than strand a pending review the admin will never be told
  // about — the same reasoning as app/api/reports/route.js.
  try {
    const admin = createSupabaseAdminClient();
    const origin = new URL(request.url).origin;
    const reviewUrl = `${origin}/admin/review?token=${encodeURIComponent(signReviewToken(inserted.id))}`;
    const studentName = me?.full_name || "A student";
    const tutorName = tutor.profile?.full_name || "a tutor";

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Review: ${studentName} reviewed ${tutorName}`,
      html: adminReviewEmail({ studentName, tutorName, rating, body, reviewUrl }),
    });

    await notifyUser(admin, user.id, {
      type: "review_submitted",
      title: "Review submitted",
      body: "Thanks for leaving a review. Our team checks every review before it appears on the tutor's profile.",
      email: { subject: "Thanks for leaving a review", html: reviewReceivedEmail({ name: studentName, tutorName }) },
    });
  } catch (err) {
    console.error("[reviews] side effects failed, rolling back the review row:", err);
    await supabase.from("reviews").delete().eq("id", inserted.id);
    return NextResponse.json({ error: "Could not save your review. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ status: "submitted", id: inserted.id });
}
