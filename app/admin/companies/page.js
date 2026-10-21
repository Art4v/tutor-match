import { listCompaniesForAdmin } from "@/lib/supabase/adminDashboard";
import { requireAdmin } from "../guard";
import { formatDate } from "../_components/format";
import { InviteCompanies } from "./InviteCompanies";

export const metadata = { title: "Companies" };

// Invites (formerly /companies/invite) plus hide / show / delete. The list
// comes from list_partners_for_inviter, which re-checks the caller is an admin.
export default async function AdminCompaniesPage() {
  const { supabase } = await requireAdmin();
  const { companies, failed } = await listCompaniesForAdmin(supabase);

  const rows = companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    hidden: c.visibility === "hidden",
    claimed: c.claimed,
    invitedBy: c.invited_by_name,
    createdLabel: formatDate(c.created_at),
  }));

  return <InviteCompanies initialCompanies={rows} loadFailed={failed} />;
}
