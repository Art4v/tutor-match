import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The gate for every /author route.
 *
 * This is a convenience, NOT the security boundary. The real enforcement is the
 * RLS on `articles` (0061), which requires both ownership and
 * profiles.can_author_articles on every write — so a user who got past this
 * check somehow still cannot write anything. What this buys is a redirect
 * instead of a page full of failed saves.
 *
 * Redirects rather than 404s: someone who used to have access and had it
 * revoked should land somewhere useful, not on an error.
 */
export async function requireAuthor() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("can_author_articles, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.can_author_articles) redirect("/");

  return { supabase, user, fullName: profile.full_name ?? null };
}
