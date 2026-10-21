import { listReviewQueue } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../guard";
import { PageHeader, Panel, QueueList, QueueRow } from "../_components/ui";
import { formatDate } from "../_components/format";

export const metadata = { title: "Reviews" };

export default async function ReviewQueuePage() {
  const { admin } = await requireAdmin();
  const queue = admin ? await listReviewQueue(admin) : [];

  return (
    <>
      <PageHeader icon="star" title="Reviews" lead="Student reviews waiting to be published, oldest first." />
      <Panel padded={false}>
        <QueueList
          items={queue}
          empty="No reviews are waiting."
          renderRow={(r) => (
            <QueueRow
              href={adminPaths.review(r.id)}
              title={`${r.studentName} on ${r.subjectName}`}
              meta={`${r.rating}/5${r.body ? ` · ${r.body}` : " · rating only"}`}
              aside={formatDate(r.at)}
            />
          )}
        />
      </Panel>
    </>
  );
}
