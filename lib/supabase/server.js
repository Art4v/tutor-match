// ============================================================================
// Supabase server client (for Server Components, Route Handlers, Server Actions).
// ----------------------------------------------------------------------------
// Reads the auth session from the request cookies. Pair with middleware.js to
// keep the session refreshed across requests. See .env.local.example for the
// one-time Supabase project setup.
//
// Not used by anything in slice 1 (auth pages are client-side), but it's
// included now so later slices that need to read the user on the server don't
// have to refactor.
// ============================================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Calling set() from a Server Component throws — safe to ignore
            // when middleware is doing the actual session refresh.
          }
        },
      },
    }
  );
}
