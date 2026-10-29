import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE } from "@/lib/tutorInvite";
import { clientIp, inviteKeyValid, redeemInvite, redeemErrorMessage } from "../shared";

export const runtime = "nodejs";

// POST { key, consent, intent } from the invite page, for the two paths that
// are not an email signup:
//   * intent "opt_in", signed in (an existing tutor, or a new account with no
//     role yet): redeem now -> { status: "redeemed" }. No session -> 401, so
//     the page can say so instead of believing it opted in.
//   * intent "oauth", signed out, about to Continue with Google: check the key
//     and park it in a short-lived httpOnly cookie that /auth/callback redeems
//     once Google sends the tutor back -> { status: "oauth" }.
// JSON only: request.json() would also parse a cross-site text/plain form
// post (which needs no CORS preflight), and that must not be able to park a
// key in a visitor's browser.
export async function POST(request) {
  const limit = checkRateLimit(`join-start:${clientIp(request)}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 415 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { key, consent, intent } = body ?? {};
  if (intent !== "opt_in" && intent !== "oauth") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
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

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (intent === "opt_in") {
    if (!user) {
      return NextResponse.json(
        { error: "Your session has expired. Please log in again, then open this invite link." },
        { status: 401 }
      );
    }
    const origin = new URL(request.url).origin;
    const redeemed = await redeemInvite(admin, { userId: user.id, key, origin });
    if (!redeemed.ok) {
      return NextResponse.json({ error: redeemErrorMessage(redeemed.hint), hint: redeemed.hint }, { status: 400 });
    }
    return NextResponse.json({ status: "redeemed", created: redeemed.created });
  }

  // intent "oauth": the page only offers Google to a signed-out visitor. If a
  // session exists after all (signed in on another tab), say so rather than
  // park a key for whichever account Google returns.
  if (user) {
    return NextResponse.json(
      { error: "You're already signed in. Reload this page to continue with your account." },
      { status: 409 }
    );
  }

  const res = NextResponse.json({ status: "oauth" });
  res.cookies.set(INVITE_COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE,
  });
  return res;
}
