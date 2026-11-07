import { listManagedTutors } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../guard";
import { PageHeader, Panel, QueueList, QueueRow, Chip } from "../_components/ui";
import { formatDate } from "../_components/format";

export const metadata = { title: "Managed tutors" };

// The tutors who let MatchTutor manage their profile, through Quick join
// (0076, public since 0077). "New" = not yet marked set up; that is the queue
// the nav badge counts. Every one starts hidden until an admin publishes it.
export default async function ManagedTutorsPage() {
  const { admin } = await requireAdmin();
  const tutors = admin ? await listManagedTutors(admin) : [];
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
        title="Managed tutors"
        lead="Tutors who signed up through Quick join and let MatchTutor set up and manage their profile. Each profile starts hidden until you make it public."
      />
      <div className="space-y-5">
        <Panel title={<span className="inline-flex items-center gap-2">New tutors {fresh.length > 0 && <Chip tone="warn">{fresh.length}</Chip>}</span>} lead="Set up their profile, make it public, then mark it set up." padded={false}>
          <QueueList items={fresh} empty="No new tutors are waiting to be set up." renderRow={row} />
        </Panel>

        <Panel title="Set up" lead="Profiles already set up that MatchTutor still manages." padded={false}>
          <QueueList items={rest} empty="No managed tutors yet." renderRow={row} />
        </Panel>
      </div>
    </>
  );
}
