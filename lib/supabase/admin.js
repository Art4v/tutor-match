// ============================================================================
// Supabase service-role client (SERVER-ONLY).
// ----------------------------------------------------------------------------
// Created with the SUPABASE_SERVICE_ROLE_KEY, which BYPASSES Row-Level Security.
// Never import this from a client component and never expose the key to the
// browser (it is intentionally NOT prefixed NEXT_PUBLIC_).
//
// It exists because a few server actions can't run as the logged-in user:
//   * inserting `notifications` rows for any user (no INSERT RLS policy exists)
//   * reading a user's email via auth.admin.getUserById (notification emails)
//   * flipping `verified` on approval — when the admin clicks the email link
//     there is NO user session, so an auth.uid()-scoped client/RPC can't do it.
//
// Returns null when the key isn't set (e.g. local dev without the secret) so
// callers can degrade gracefully rather than crash.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

let cached = null;

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  if (cached) return cached;
  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
