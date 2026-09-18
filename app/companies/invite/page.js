import { DeskBackdrop } from "@/components/DeskBackdrop";
import { requireInviter } from "./guard";
import { InviteCompanies } from "./InviteCompanies";

export const metadata = {
  title: "Invite a company",
  robots: { index: false, follow: false },
};

// Formatted here, on the server, so the client never re-formats a timestamp
// and can't disagree with it at hydration (see ReviewItem.jsx).
const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Australia/Sydney",
});

export default async function InviteCompaniesPage() {
  const { supabase } = await requireInviter();

  // list_partners_for_inviter (0068) re-checks the capability in SQL; the
  // guard above only turns a refusal into a redirect.
  const { data, error } = await supabase.rpc("list_partners_for_inviter");

  const companies = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    hidden: c.visibility === "hidden",
    claimed: c.claimed,
    invitedBy: c.invited_by_name,
    createdLabel: c.created_at ? dateFmt.format(new Date(c.created_at)) : "",
  }));

  return (
    <div className="desk-surface bleed-under-nav relative">
      <DeskBackdrop className="-z-10" />
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 py-8">
        <InviteCompanies initialCompanies={companies} loadFailed={Boolean(error)} />
      </div>
    </div>
  );
}
