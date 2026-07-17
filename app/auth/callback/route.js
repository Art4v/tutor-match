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
import { postAuthDest } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

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
        await sendWelcomeIfNeeded(createSupabaseAdminClient(), user.id, {
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          origin,
        });
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
        return NextResponse.redirect(`${origin}${postAuthDest(role)}`);
      }
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Send each failure to the page that requested the flow: OAuth failures back
  // to /login (its ?error=oauth banner), a signup-confirm failure to /login, and
  // recovery (token_hash) failures to the reset page's invalid state.
  if (isOAuth) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }
  if (type === "signup" || type === "email") {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }
  return NextResponse.redirect(`${origin}/reset-password?error=link_invalid`);
}
