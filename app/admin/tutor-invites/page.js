import { listManagedTutors } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../guard";
import { PageHeader, Panel, QueueList, QueueRow, Chip } from "../_components/ui";
import { formatDate } from "../_components/format";
import { InviteLinkCard } from "./InviteLinkCard";

export const metadata = { title: "Tutor invites" };

// The tutor invite link and the tutors who let MatchTutor manage their
// profile (0076). "New" = not yet marked set up; that is the queue the nav
// badge counts.
export default async function TutorInvitesPage() {
  const { supabase, admin } = await requireAdmin();
  const [{ data: keyRow }, tutors] = await Promise.all([
    supabase.rpc("admin_get_tutor_invite_key"),
    admin ? listManagedTutors(admin) : Promise.resolve([]),
  ]);
  const fresh = tutors.filter((t) => !t.setupDone);
  const rest = tutors.filter((t) => t.setupDone);

  const row = (t) => (
    <QueueRow
      href={adminPaths.managedTutor(t.id)}
      title={t.name}
      meta={[
        t.visibility === "public" ? "Public" : "Hidden",
        t.verificationStatus === "verified" ? "Verified" : "Not verified",
        t.materialsSubmitted ? "Documents step done" : "Documents step not done",
      ].join(" · ")}
      aside={`Joined ${formatDate(t.managedAt)}`}
    />
  );

  return (
    <>
      <PageHeader
        icon="send"
        title="Tutor invites"
        lead="Send this link to a tutor. They create an account and let MatchTutor set up and manage their profile."
      />
      <div className="space-y-5">
        <Panel
          title="Invite link"
          lead={
            keyRow?.rotated_at
              ? `Anyone with this link can sign up as a managed tutor. Last rotated ${formatDate(keyRow.rotated_at)}${keyRow.rotated_by ? ` by ${keyRow.rotated_by}` : ""}.`
              : "Anyone with this link can sign up as a managed tutor."
          }
        >
          {keyRow?.key ? <InviteLinkCard initialKey={keyRow.key} /> : <p className="text-[13.5px] text-slate-500">The invite link isn&apos;t set up. Apply migration 0076.</p>}
        </Panel>

        <Panel title={<span className="inline-flex items-center gap-2">New tutors {fresh.length > 0 && <Chip tone="warn">{fresh.length}</Chip>}</span>} lead="Set up their profile, make it public, then mark it set up." padded={false}>
          <QueueList items={fresh} empty="No new tutors are waiting to be set up." renderRow={row} />
        </Panel>

        <Panel title="Managed tutors" lead="Profiles already set up that MatchTutor still manages." padded={false}>
          <QueueList items={rest} empty="No managed tutors yet." renderRow={row} />
        </Panel>
      </div>
    </>
  );
}
