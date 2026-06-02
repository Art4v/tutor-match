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
}
