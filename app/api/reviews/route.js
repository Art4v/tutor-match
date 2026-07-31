import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { sendEmail, adminReviewEmail, reviewReceivedEmail } from "@/lib/email/send";
import { signReviewToken } from "@/lib/reviewToken";
import { getReviewForModeration } from "@/lib/supabase/reviews";
import { isAccountEnabled } from "@/lib/supabase/account";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "matchtutoraustralia@gmail.com";
const MAX_BODY = 500; // must match the 0057 CHECK
// Soft cap so one account can't flood the admin inbox. Submits and edits share
// the budget, because an edit re-queues the review and sends a fresh link. It is
// in-process, so on serverless this is per-instance (see lib/rateLimit.js) — a
// blunt instrument, not a security boundary. The real gate is that nothing
// publishes without approval.
const RATE = { limit: 10, windowMs: 60 * 60 * 1000 };

// ---------------------------------------------------------------------------
// Reviews written by students. Every write here goes through the USER-SCOPED
// client on purpose: the 0057 RLS policies require student_id = auth.uid() AND
// status = 'pending' on both insert and update, so a student can neither
// self-approve nor sneak an edit past moderation. None of that has to be
// re-checked in JS — attempting it just fails.
// ---------------------------------------------------------------------------

/** Shared gate: signed in, enabled, and actually a student. */
async function requireStudent(supabase) {
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

  const { data: me } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "student") {
    return { res: NextResponse.json({ error: "Only students can leave reviews." }, { status: 403 }) };
  }

  const { allowed } = checkRateLimit(`review:${user.id}`, RATE);
  if (!allowed) {
    return { res: NextResponse.json({ error: "You're leaving reviews too quickly. Try again later." }, { status: 429 }) };
  }

  return { user, me };
}

/** Shared validation for the two writable fields. */
function parseReviewFields(payload) {
  const rating = payload?.rating;
  // Empty text must become NULL, not "": the 0057 CHECK rejects a blank-but-
  // present body (so the card never renders an empty paragraph).
  const trimmed = typeof payload?.body === "string" ? payload.body.trim().slice(0, MAX_BODY) : "";
  const body = trimmed === "" ? null : trimmed;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "A rating from 1 to 5 is required." };
  }
  return { rating, body };
}

/** Email the admin a fresh one-click moderation link. Throws if the secret is unset. */
async function emailAdminForReview({ request, reviewId, studentName, tutorName, rating, body }) {
  const origin = new URL(request.url).origin;
  const reviewUrl = `${origin}/admin/review?token=${encodeURIComponent(signReviewToken(reviewId))}`;
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Review: ${studentName} reviewed ${tutorName}`,
    html: adminReviewEmail({ studentName, tutorName, rating, body, reviewUrl }),
  });
}

// ---------------------------------------------------------------------------
// POST — leave a review. One per tutor (the 0057 UNIQUE turns a repeat into 409).
// ---------------------------------------------------------------------------
export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const gate = await requireStudent(supabase);
  if (gate.res) return gate.res;
  const { user, me } = gate;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const tutorId = payload?.tutorId;
  const { rating, body, error: fieldError } = parseReviewFields(payload);
  if (fieldError || !tutorId) {
    return NextResponse.json({ error: fieldError || "A tutor is required." }, { status: 400 });
  }

  // The target must be a real, publicly listable tutor. RLS already hides
  // disabled owners (0055); visibility + confirmation are app-level filters, so
  // check them here the way the public query helpers do.
  const { data: tutor } = await supabase
    .from("tutor_profiles")
    .select("id, visibility, email_confirmed_at, profile:profiles!inner ( full_name )")
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
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "You've already reviewed this tutor.", status: "exists" }, { status: 409 });
    }
    console.error("[reviews] insert failed:", insertErr);
    return NextResponse.json({ error: "Could not save your review." }, { status: 500 });
  }

  // Side effects only after a real insert. Signing the token throws when
  // REVIEW_APPROVE_SECRET is unset; if that (or any side effect) fails, delete
  // the row rather than strand a pending review the admin is never told about —
  // the same reasoning as app/api/reports/route.js.
  try {
    const admin = createSupabaseAdminClient();
    const studentName = me?.full_name || "A student";
    const tutorName = tutor.profile?.full_name || "a tutor";

    await emailAdminForReview({ request, reviewId: inserted.id, studentName, tutorName, rating, body });

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

// ---------------------------------------------------------------------------
// PATCH — edit your own review. Re-queues it for moderation.
//
// status/approved_at are set explicitly, but the RLS update policy's
// `with check (… and status = 'pending')` is what actually guarantees an edit
// can't stay published: even a caller crafting their own request cannot leave
// the row approved. The 0057 trigger drops it out of the tutor's average the
// instant the status changes, which is what "hidden until re-approved" means.
// ---------------------------------------------------------------------------
export async function PATCH(request) {
  const supabase = createSupabaseServerClient();
  const gate = await requireStudent(supabase);
  if (gate.res) return gate.res;
  const { me } = gate;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const reviewId = payload?.reviewId;
  const { rating, body, error: fieldError } = parseReviewFields(payload);
  if (fieldError || !reviewId) {
    return NextResponse.json({ error: fieldError || "A review is required." }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await supabase
    .from("reviews")
    .update({ rating, body, status: "pending", approved_at: null })
    .eq("id", reviewId)
    .select("id")
    .maybeSingle();

  if (updateErr) {
    console.error("[reviews] update failed:", updateErr);
    return NextResponse.json({ error: "Could not save your changes." }, { status: 500 });
  }
  // No row came back: it doesn't exist, isn't yours, or has been removed after a
  // report (the RLS USING clause excludes 'removed'). All three are a 404 here.
  if (!updated) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  // Re-queue with the admin. Unlike POST there is nothing to roll back — the
  // edit is already saved and correctly sitting in 'pending'; a failed email
  // just means it waits for the next one rather than vanishing.
  try {
    const admin = createSupabaseAdminClient();
    const found = await getReviewForModeration(admin, reviewId);
    await emailAdminForReview({
      request,
      reviewId,
      studentName: found?.studentName || me?.full_name || "A student",
      tutorName: found?.tutorName || "a tutor",
      rating,
      body,
    });
  } catch (err) {
    console.error("[reviews] could not email the admin about an edit:", err);
  }

  return NextResponse.json({ status: "submitted", id: reviewId });
}

// ---------------------------------------------------------------------------
// DELETE — remove your own review. RLS scopes it to the author; the 0057 trigger
// recalculates the tutor's average.
// ---------------------------------------------------------------------------
export async function DELETE(request) {
  const supabase = createSupabaseServerClient();
  const gate = await requireStudent(supabase);
  if (gate.res) return gate.res;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const reviewId = payload?.reviewId;
  if (!reviewId) {
    return NextResponse.json({ error: "A review is required." }, { status: 400 });
  }

  const { error: deleteErr } = await supabase.from("reviews").delete().eq("id", reviewId);
  if (deleteErr) {
    console.error("[reviews] delete failed:", deleteErr);
    return NextResponse.json({ error: "Could not delete your review." }, { status: 500 });
  }

  // Deleting something already gone is a success, so the UI is idempotent.
  return NextResponse.json({ status: "deleted" });
}
