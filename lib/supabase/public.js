// ============================================================================
// Supabase public client (cookieless, anonymous).
// ----------------------------------------------------------------------------
// For server code that reads ONLY public data and wants to be cacheable: the
// sitemap, llms.txt and the /tutors landing pages.
//
// Why not createSupabaseServerClient()? That one reads cookies(), and touching
// cookies() opts the whole route into dynamic rendering, which silently defeats
// `export const revalidate = 3600`. Every crawler hit would then query Supabase.
// This client never sees a cookie, so it always runs as `anon` and the route can
// be statically cached and revalidated.
//
// Safe by construction: as `anon` it can read exactly what Row Level Security
// already makes public, nothing more. Never use it for anything a signed-in user
// should see differently (owner views, saved tutors, drafts).
// ============================================================================

import { createClient } from "@supabase/supabase-js";

export function createSupabasePublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
