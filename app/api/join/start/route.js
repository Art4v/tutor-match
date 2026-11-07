import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE } from "@/lib/tutorInvite";
import { consumeQuickJoinAttempt, redeemInvite, redeemErrorMessage, TOO_MANY_ATTEMPTS } from "../shared";

export const runtime = "nodejs";

// POST { consent, intent } from /quick-join, for the two paths that are not
// an email signup:
//   * intent "opt_in", signed in (an existing tutor, or a new account with no
//     role yet): redeem now -> { status: "redeemed" }. No session -> 401, so
//     the page can say so instead of believing it opted in.
//   * intent "oauth", signed out, about to Continue with Google: set a
//     short-lived httpOnly marker cookie that /auth/callback redeems once
//     Google sends the tutor back -> { status: "oauth" }.
// Both consume one durable per-IP attempt (0077) before anything is bound.
// JSON only: request.json() would also parse a cross-site text/plain form
// post (which needs no CORS preflight), and that must not be able to plant
// the marker in a visitor's browser.
export async function POST(request) {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 415 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { consent, intent } = body ?? {};
  if (intent !== "opt_in" && intent !== "oauth") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (consent !== true) {
    return NextResponse.json({ error: "Please authorise MatchTutor to set up your profile." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Quick join isn't available right now." }, { status: 503 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (intent === "opt_in") {
    if (!user) {
      return NextResponse.json(
        { error: "Your session has expired. Please log in again, then come back to Quick join." },
        { status: 401 }
      );
    }
    if (!(await consumeQuickJoinAttempt(admin, request))) {
      return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
    }
    const origin = new URL(request.url).origin;
    const redeemed = await redeemInvite(admin, { userId: user.id, origin });
    if (!redeemed.ok) {
      return NextResponse.json({ error: redeemErrorMessage(redeemed.hint), hint: redeemed.hint }, { status: 400 });
    }
    return NextResponse.json({ status: "redeemed", created: redeemed.created });
  }

  // intent "oauth": the page only offers Google to a signed-out visitor. If a
  // session exists after all (signed in on another tab), say so rather than
  // mark a Google sign-in for whichever account Google returns.
  if (user) {
    return NextResponse.json(
      { error: "You're already signed in. Reload this page to continue with your account." },
      { status: 409 }
    );
  }

  if (!(await consumeQuickJoinAttempt(admin, request))) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const res = NextResponse.json({ status: "oauth" });
  res.cookies.set(INVITE_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE,
  });
  return res;
}
