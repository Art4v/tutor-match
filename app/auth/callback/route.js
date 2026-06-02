// ============================================================================
// OAuth (PKCE) callback — exchanges the auth code for a session.
// ----------------------------------------------------------------------------
// Flow: the Google button calls supabase.auth.signInWithOAuth({ redirectTo:
//   `${origin}/auth/callback?next=...` }). Google sends the user to
//   Supabase (/auth/v1/callback), which redirects back here with `?code=...`.
//   We exchange that code for a session — the server client's setAll() writes
//   the session cookies onto this response (same mechanism /api/auth/signup
//   relies on) — then send the user to `next`.
// Pattern from the official @supabase/ssr Next.js App Router docs.
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

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/settings";

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // In production behind a proxy/load balancer, trust the forwarded host so
      // the redirect lands on the public URL rather than the internal origin.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      if (isLocal || !forwardedHost) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      const proto = request.headers.get("x-forwarded-proto") ?? "https";
      return NextResponse.redirect(`${proto}://${forwardedHost}${next}`);
    }
  }

  // Missing code or a failed exchange — back to login with an error flag.
  return NextResponse.redirect(`${origin}/login?error=oauth`);
export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const supabase = createSupabaseServerClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (ok) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/reset-password?error=link_invalid`);
}
