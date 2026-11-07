import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkSignupInput } from "@/lib/signupValidation";
import { originOf } from "@/lib/admin/route";
import { JOIN_DETAILS_PATH } from "@/lib/tutorInvite";
import { consumeQuickJoinAttempt, redeemInvite, redeemErrorMessage, TOO_MANY_ATTEMPTS } from "../shared";

export const runtime = "nodejs";

// Email signup through Quick join (0076, public since 0077). Same checks as
// /api/auth/signup, plus the management consent and the durable per-IP limit,
// which is consumed only once the input is valid and BEFORE the account is
// created, so a blocked bot creates nothing. The new account is managed
// straight away, before email confirmation.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { fullName, email, password, agreed, consent } = body ?? {};

  const name = typeof fullName === "string" ? fullName.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Your full name is required." }, { status: 400 });
  }
  if (consent !== true) {
    return NextResponse.json({ error: "Please authorise MatchTutor to set up your profile." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Quick join isn't available right now." }, { status: 503 });
  }

  const invalid = await checkSignupInput({ email, password, agreed });
  if (invalid) {
    return NextResponse.json(invalid, { status: 400 });
  }

  if (!(await consumeQuickJoinAttempt(admin, request))) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
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

  const redeemed = await redeemInvite(admin, { userId: data.user.id, origin: originOf(request) });
  if (!redeemed.ok) {
    // The account exists but is not managed (a database error, say). It
    // continues as an ordinary new account.
    return NextResponse.json({ error: redeemErrorMessage(redeemed.hint) }, { status: 400 });
  }

  return NextResponse.json({ status: data.session ? "session" : "confirm" });
}
