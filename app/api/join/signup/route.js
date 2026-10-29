import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkSignupInput } from "@/lib/signupValidation";
import { checkRateLimit } from "@/lib/rateLimit";
import { originOf } from "@/lib/admin/route";
import { JOIN_DETAILS_PATH } from "@/lib/tutorInvite";
import { clientIp, inviteKeyValid, redeemInvite, redeemErrorMessage } from "../shared";

export const runtime = "nodejs";

// Email signup through the tutor invite page (0076). Same checks as
// /api/auth/signup, plus the invite key (checked FIRST, so a dead link creates
// no account) and the management consent. The new account is bound to the
// invite straight away, before email confirmation, so rotating the key later
// never strands someone halfway through.
export async function POST(request) {
  const limit = checkRateLimit(`join-signup:${clientIp(request)}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { key, fullName, email, password, agreed, consent } = body ?? {};

  const name = typeof fullName === "string" ? fullName.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Your full name is required." }, { status: 400 });
  }
  if (consent !== true) {
    return NextResponse.json({ error: "Please authorise MatchTutor to set up your profile." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Signups through this link aren't available right now." }, { status: 503 });
  }
  if (!(await inviteKeyValid(admin, key))) {
    return NextResponse.json({ error: redeemErrorMessage("invalid_key") }, { status: 400 });
  }

  const invalid = await checkSignupInput({ email, password, agreed });
  if (invalid) {
    return NextResponse.json(invalid, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  // The confirmation link may follow the browser's Origin, as /api/auth/signup
  // does (Supabase checks it against the Redirect URLs allowlist). The admins'
  // alert link must not: a raw POST can send any Origin header.
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const startedAt = Date.now();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(JOIN_DETAILS_PATH)}`,
      data: { full_name: name },
    },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Only bind an account THIS request created; anything else may be someone
  // else's. A confirmed email comes back as a user with no identities and a
  // made-up id, but an existing UNCONFIRMED one comes back as the real user,
  // identities and all (GoTrue just resends its confirmation). So also require
  // the account to be brand new (a minute of slack for clock skew).
  const createdAt = Date.parse(data.user?.created_at ?? "");
  const createdNow = Number.isFinite(createdAt) && createdAt >= startedAt - 60 * 1000;
  if (
    !data.user ||
    (Array.isArray(data.user.identities) && data.user.identities.length === 0) ||
    !createdNow
  ) {
    return NextResponse.json({ status: "exists" });
  }

  const redeemed = await redeemInvite(admin, { userId: data.user.id, key, origin: originOf(request) });
  if (!redeemed.ok) {
    // The account exists but is not bound (the key was rotated in the last
    // moment, say). It continues as an ordinary new account.
    return NextResponse.json({ error: redeemErrorMessage(redeemed.hint) }, { status: 400 });
  }

  return NextResponse.json({ status: data.session ? "session" : "confirm" });
}
