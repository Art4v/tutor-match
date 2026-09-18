import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyCompany } from "@/lib/supabase/companies";

export const metadata = { title: "Your company" };

/**
 * Thin "take me to my own company page" resolver, the company counterpart of
 * /profile. It exists for the same reason: homeFor("company") has to return a
 * fixed URL, but the company's slug isn't known at that point.
 *
 * Editing happens inline on the public page (/companies/[slug]) via the owner
 * short-circuit, so this route only redirects there.
 */
export default async function CompanyRedirectPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const mine = await getMyCompany(supabase, user.id);

  // No company row. Either the account isn't a company, or it owned one whose
  // owner_id was nulled (see the on-delete-set-null note in 0063). Nothing to
  // resolve to either way.
  if (!mine) redirect("/");

  redirect(`/companies/${mine.slug}`);
}
