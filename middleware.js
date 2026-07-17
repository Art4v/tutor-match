// ============================================================================
// Next.js middleware — refreshes the Supabase auth session cookie on every
// request. Pattern adapted from the official @supabase/ssr docs:
//   https://supabase.com/docs/guides/auth/server-side/nextjs
// ============================================================================

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { homeFor } from "@/lib/roles";

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() forces a token refresh when the session is near expiry.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Deferred role choice (0041): every new account is created with a NULL role
  // and MUST pass through /choose-role before doing anything else. Enforce that
  // here so it can't be skipped by navigating directly. profiles.role is the
  // source of truth; we read it under the caller's own RLS (self-read).
  if (user) {
    const { pathname } = request.nextUrl;
    const onChooser = pathname.startsWith("/choose-role");
    const onDisabled = pathname.startsWith("/account-disabled");
    // Signed-in users have no business on the sign-in/sign-up forms; they get
    // bounced to their own home surface below. Note /forgot-password and
    // /reset-password are deliberately NOT included: a recovery link mints a
    // real session before landing on /reset-password, so gating them on "is
    // logged in" would break password resets outright.
    const onAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
    // Paths a NULL-role (mid-signup) user must still reach: the chooser itself,
    // auth/API routes, and the policy pages they may want to read first. Also the
    // disabled screen — the disabled gate below takes precedence and parks them
    // there, so the role gate must not pull a NULL-role disabled user off it to
    // /choose-role (that ping-pong was an infinite redirect loop).
    const exempt =
      onChooser ||
      onDisabled ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/terms-of-service") ||
      pathname.startsWith("/privacy-policy") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password");

    // Paths a DISABLED user must still reach: the disabled screen itself, auth
    // routes (so Log out works), and the policy pages. Everything else (incl.
    // /api — messaging is DB-frozen for disabled users anyway) redirects to the
    // disabled screen.
    const disabledExempt =
      onDisabled ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/terms-of-service") ||
      pathname.startsWith("/privacy-policy");

    // We only need the profile when a redirect is possible: an enforceable page
    // (to push NULL-role/disabled users to their gate), the chooser, the auth
    // pages (to push signed-in users off them), or the disabled screen itself
    // (to push re-enabled users back out).
    if (!exempt || onChooser || onAuthPage || !disabledExempt || onDisabled) {
      // Fail open: on any read error the fields are undefined and we don't
      // redirect, so a transient DB blip can never trap a user.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .maybeSingle();
      const role = profile?.role;
      const status = profile?.status;

      // Disabled gate takes precedence over the role gate.
      if (status === "disabled" && !disabledExempt) {
        return redirectPreservingCookies(request, response, "/account-disabled");
      }
      if (status && status !== "disabled" && onDisabled) {
        // Re-enabled while sitting on the disabled screen — send them home.
        return redirectPreservingCookies(request, response, "/");
      }

      if (role === null && !exempt) {
        // Hasn't chosen yet — send them to the gate (carry over refreshed cookies).
        return redirectPreservingCookies(request, response, "/choose-role");
      }
      // Pages that have nothing left to offer a signed-in user with a role: the
      // chooser (they already chose) and the login/signup forms (they're already
      // in). Send them to their home instead. Last, so the disabled and NULL-role
      // gates above still win for the users they cover.
      if (role && (onChooser || onAuthPage)) {
        return redirectPreservingCookies(request, response, homeFor(role));
      }
    }
  }

  return response;
}

// Redirect while keeping the auth cookies the session refresh just set on
// `refreshed` — otherwise the redirect response would drop the rotated token.
function redirectPreservingCookies(request, refreshed, path) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  refreshed.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    // Run on every request except static assets and image optimization.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
