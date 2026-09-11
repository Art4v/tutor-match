import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyPartner } from "@/lib/supabase/partners";

export const metadata = { title: "Your centre" };

/**
 * Thin "take me to my own centre page" resolver, the partner counterpart of
 * /profile. It exists for the same reason: homeFor("partner") has to return a
 * fixed URL, but the partner's slug isn't known at that point.
 *
 * Editing happens inline on the public page (/partners/[slug]) via the owner
 * short-circuit, so this route only redirects there.
 */
export default async function PartnerRedirectPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const mine = await getMyPartner(supabase, user.id);

  // No partner row. Either the account isn't a partner, or it owned one whose
  // owner_id was nulled (see the on-delete-set-null note in 0063). Nothing to
  // resolve to either way.
  if (!mine) redirect("/");

  redirect(`/partners/${mine.slug}`);
}
