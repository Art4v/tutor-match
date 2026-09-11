import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Shadow accounts live on a reserved TLD. RFC 2606 guarantees `.invalid` never
// resolves, which is not cosmetic — it is the third of the three guarantees
// below. Keep it.
const SHADOW_EMAIL_DOMAIN = "partners.matchtutor.invalid";

/**
 * Resolve the partner the caller owns, or null. Every handler here is scoped
 * through this: a partner can only ever touch its own tutors.
 */
async function callerPartner(supabase, userId) {
  const { data } = await supabase
    .from("partners")
    .select("id, name, visibility")
    .eq("owner_id", userId)
    .maybeSingle();
  return data ?? null;
}

/**
 * POST { name } — add a tutor to the caller's centre.
 *
 * A partner tutor is an ordinary `tutor_profiles` row, and that table's id FKs
 * through `profiles` to `auth.users`, so the row cannot exist without an auth
 * user. We mint a shadow one. THREE THINGS MUST HOLD, and each fails silently
 * rather than loudly if it doesn't:
 *
 *   1. `profiles.full_name` must be set. BROWSE_SELECT joins `profiles!inner`,
 *      so a null name drops the tutor from every browse result with no error.
 *   2. `email_confirmed_at` must be stamped. All five public read helpers in
 *      lib/supabase/tutors.js filter on it being non-null.
 *   3. The account must be unable to authenticate. No password is ever set, so
 *      password sign-in is out. Password RESET is the live risk, and existing
 *      code already closes it: /api/auth/forgot-password runs
 *      domainCanReceiveMail (DNS MX, then A/AAAA), and a `.invalid` address
 *      resolves to nothing, so the route 400s before Supabase is ever asked.
 *      The address is also a random uuid, so it cannot be guessed to try.
 *
 * (1) and (2) are done inside provision_partner_tutor so they are atomic with
 * the insert rather than three separate writes that can half-fail.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Give your tutor a name." }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: "That name is too long." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const partner = await callerPartner(supabase, user.id);
  if (!partner) {
    return NextResponse.json({ error: "Only a centre can add tutors." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const email = `partner-tutor-${randomUUID()}@${SHADOW_EMAIL_DOMAIN}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    // No password, deliberately. Also flag the row for anyone reading auth.users
    // directly and wondering what these accounts are.
    user_metadata: { shadow_partner_tutor: true, partner_id: partner.id },
  });
  if (createError || !created?.user) {
    return NextResponse.json(
      { error: createError?.message || "Could not create the tutor." },
      { status: 500 }
    );
  }

  const { data: slug, error: provisionError } = await admin.rpc("provision_partner_tutor", {
    p_uid: created.user.id,
    p_partner_id: partner.id,
    p_name: name,
  });

  if (provisionError) {
    // Roll the auth user back, or we leave an orphan that nothing references and
    // nothing can clean up (the same failure mode uploadTutorDoc guards against
    // when its row insert fails after the file upload).
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return NextResponse.json(
      { error: provisionError.message || "Could not create the tutor." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: created.user.id, slug, name });
}

/**
 * DELETE { tutorId } — unlist a tutor.
 *
 * A real delete, not a hide. The locked behaviour is "the partner unlists and
 * the profile disappears", and deleting the auth user cascades cleanly through
 * profiles -> tutor_profiles -> every child table, which is also what stops
 * this design accumulating orphaned shadow accounts over time.
 *
 * Safe precisely because of what a partner tutor is NOT: it holds no reviews
 * (those are centre-level) and no conversations (partner tutors cannot be
 * messaged), so there is no history to strand.
 */
export async function DELETE(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const tutorId = typeof body?.tutorId === "string" ? body.tutorId : null;
  if (!tutorId) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const partner = await callerPartner(supabase, user.id);
  if (!partner) {
    return NextResponse.json({ error: "Only a centre can remove tutors." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  // Ownership check through the ADMIN client, against the partner we resolved
  // from the caller's own session. Doing it here rather than trusting the
  // request means a partner cannot delete another centre's tutor by id, and a
  // deliberately narrow select keeps the check readable.
  const { data: target } = await admin
    .from("tutor_profiles")
    .select("id, partner_id")
    .eq("id", tutorId)
    .maybeSingle();

  if (!target || target.partner_id !== partner.id) {
    return NextResponse.json({ error: "That tutor isn't yours." }, { status: 403 });
  }

  const { error } = await admin.auth.admin.deleteUser(tutorId);
  if (error) {
    return NextResponse.json({ error: error.message || "Could not remove the tutor." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
