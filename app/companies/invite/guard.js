import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The gate for /companies/invite. A copy of app/author/guard.js reading
 * profiles.can_invite_companies (0068).
 *
 * A convenience, NOT the security boundary: every inviter RPC re-checks the
 * flag in SQL, so a user who got past this still can't create or list
 * anything. What this buys is a redirect instead of a page of errors.
 */
export async function requireInviter() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/companies/invite");

  const { data: profile } = await supabase
    .from("profiles")
    .select("can_invite_companies")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.can_invite_companies) redirect("/");

  return { supabase, user };
}
