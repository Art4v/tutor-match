// ============================================================================
// Auth callback — the landing route for Supabase email-link redirects.
// ----------------------------------------------------------------------------
// Two link shapes land here; both mint a session, then forward to `next`:
//
//   1. token_hash + type — what the password-recovery email uses. The template
//      builds the link from {{ .RedirectTo }} (= `<origin>/auth/callback?next=…`)
//      and appends `&token_hash=…&type=recovery`, so the link points straight at
//      this route. verifyOtp() confirms the token and writes the session — no
//      Supabase /verify hop and no PKCE code exchange, so it works even when the
//      link is opened in a different browser. (For RedirectTo to render the right
//      origin, `<origin>/auth/callback**` must be a WILDCARD Redirect-URLs entry —
//      the `?next=` query string won't match a bare entry.)
//
//   2. code — the PKCE grant (exchangeCodeForSession), kept for OAuth / any
//      provider that sends the user back with `?code=`.
//
// On failure (missing / expired / already-used token) we send the user to the
// reset page in its invalid-link state so they can request a fresh link.
// ============================================================================

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeIfNeeded } from "@/lib/notifications";
import { postAuthDest, safeNext } from "@/lib/roles";
import { INVITE_COOKIE, JOIN_DETAILS_PATH } from "@/lib/tutorInvite";
import { redeemInvite } from "@/app/api/join/shared";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  // Same-origin paths only: `${origin}${next}` with next="@evil.example" (or
  // ".evil.example") would leave the site.
  const next = safeNext(searchParams.get("next"), "/");

  // The tutor invite key parked by /api/join/start for a Google sign-in. It is
  // cleared on every way out of this route, so a sign-in that never completed
  // cannot leave it lying around for the next one.
  const inviteKey = request.cookies.get(INVITE_COOKIE)?.value;
  const finish = (res) => {
    if (inviteKey) res.cookies.delete(INVITE_COOKIE);
    return res;
  };

  const supabase = createSupabaseServerClient();
  let ok = false;
  let isOAuth = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    // PKCE grant — used by OAuth (Google). exchangeCodeForSession mints the
    // session from the code Supabase appended to the redirect.
    isOAuth = true;
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) {
    // A new account is now confirmed (OAuth sign-in, or an email-signup confirm
    // link with type=signup/email — but NOT password recovery). Send the
    // one-time welcome; sendWelcomeIfNeeded is idempotent and never throws.
    const isSignupConfirm = !isOAuth && (type === "signup" || type === "email");
    if (isOAuth || isSignupConfirm) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const admin = createSupabaseAdminClient();
        await sendWelcomeIfNeeded(admin, user.id, {
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          origin,
        });
        // Tutor invite (0076): a Google sign-in started on /join parked the
        // key in a cookie. Redeem it now that we know who signed in, but only
        // for that flow (its `next` is the details step): a cookie left by an
        // abandoned attempt must never bind whoever signs in next, through
        // /login's Google button or an ordinary signup confirmation. On
        // failure (rotated key, a student account) the user just carries on
        // through the normal flow below.
        let invited = false;
        if (inviteKey && isOAuth && next.startsWith(JOIN_DETAILS_PATH)) {
          const redeemed = await redeemInvite(admin, { userId: user.id, key: inviteKey, origin });
          invited = redeemed.ok;
        }
        // Role-aware landing (0041): profiles.role is the source of truth. A
        // brand-new account (email confirm or OAuth) has role NULL and MUST pick
        // one at /choose-role before continuing; a returning user lands on their
        // role home. This makes the OAuth `next` param irrelevant for routing.
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        const role = profile?.role ?? null;
        // An invited tutor continues to the optional documents step, whether
        // they came back from Google or from the confirmation email (whose
        // `next` the invite signup route set). /join/details itself sends
        // anyone it has nothing for on to /profile.
        const toDetails = role === "tutor" && (invited || next.startsWith(JOIN_DETAILS_PATH));
        return finish(NextResponse.redirect(`${origin}${toDetails ? JOIN_DETAILS_PATH : postAuthDest(role)}`));
      }
    }
    return finish(NextResponse.redirect(`${origin}${next}`));
  }

  // Send each failure to the page that requested the flow: OAuth failures back
  // to /login (its ?error=oauth banner), a signup-confirm failure to /login, and
  // recovery (token_hash) failures to the reset page's invalid state.
  if (isOAuth) {
    return finish(NextResponse.redirect(`${origin}/login?error=oauth`));
  }
  if (type === "signup" || type === "email") {
    return finish(NextResponse.redirect(`${origin}/login?error=link_invalid`));
  }
  return finish(NextResponse.redirect(`${origin}/reset-password?error=link_invalid`));
}
