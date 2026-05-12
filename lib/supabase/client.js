// ============================================================================
// Supabase browser client.
// ----------------------------------------------------------------------------
// Used from React client components (e.g. /signup, /login forms).
// Reads the project URL + anon key from .env.local. See .env.local.example
// for the full setup steps. In short:
//   1. Create a Supabase project at https://supabase.com
//   2. Project Settings -> API -> copy "Project URL" and the "anon public" key
//   3. Paste them into .env.local as:
//        NEXT_PUBLIC_SUPABASE_URL=...
//        NEXT_PUBLIC_SUPABASE_ANON_KEY=...
//   4. Restart `npm run dev`.
// ============================================================================

"use client";
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
