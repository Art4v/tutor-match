import { listRevisionQueue } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../guard";
import { PageHeader, Panel, QueueList, QueueRow } from "../_components/ui";
import { formatDate } from "../_components/format";

export const metadata = { title: "Profile changes" };

export default async function RevisionQueuePage() {
  const { admin } = await requireAdmin();
  const queue = admin ? await listRevisionQueue(admin) : [];

  return (
    <>
      <PageHeader
        icon="pencil"
        title="Profile changes"
        lead="Verified tutors' edits waiting for approval. Students see the current profile until you approve."
      />
      <Panel padded={false}>
        <QueueList
          items={queue}
          empty="No profile changes are waiting."
          renderRow={(r) => (
            <QueueRow href={adminPaths.revision(r.id)} title={r.tutorName} aside={r.at ? `Submitted ${formatDate(r.at)}` : null} />
          )}
        />
      </Panel>
    </>
  );
}
