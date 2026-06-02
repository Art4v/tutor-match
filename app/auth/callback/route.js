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
