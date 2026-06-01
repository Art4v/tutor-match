// ============================================================================
// Auth callback — the landing route for Supabase email-link redirects.
// ----------------------------------------------------------------------------
// The password-recovery email uses {{ .ConfirmationURL }}, which sends the user
// through Supabase's /verify endpoint and then redirects here with a `?code=`
// (the redirect target is the redirect_to the app passed to
// resetPasswordForEmail: `<origin>/auth/callback?next=/reset-password`). We trade
// that code for a session with exchangeCodeForSession(), writing the session
// cookies via the server client, then forward to `next` (default `/`).
//
// On failure (missing / expired / already-used code) we send the user to the
// reset page in its invalid-link state so they can request a fresh link.
//
// NOTE: for the redirect to be honored, the redirect_to must match a WILDCARDED
// Redirect-URLs entry (`<origin>/auth/callback**`) because it carries a `?next=`
// query string — otherwise Supabase falls back to the bare Site URL.
// ============================================================================

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  // --- TEMP DIAGNOSTICS (remove after debugging) ---
  console.log("[auth/callback] incoming URL:", request.url);
  console.log("[auth/callback] params:", { code, tokenHash, type, next });
  const verifierCookie = request.cookies
    .getAll()
    .find((c) => c.name.includes("code-verifier"));
  console.log(
    "[auth/callback] code-verifier cookie present:",
    Boolean(verifierCookie),
    verifierCookie?.name
  );
  console.log(
    "[auth/callback] all cookie names:",
    request.cookies.getAll().map((c) => c.name)
  );
  // --- END DIAGNOSTICS ---

  const supabase = createSupabaseServerClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    console.log("[auth/callback] verifyOtp error:", error);
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("[auth/callback] exchangeCodeForSession error:", error);
    ok = !error;
  }

  if (ok) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/reset-password?error=link_invalid`);
}
