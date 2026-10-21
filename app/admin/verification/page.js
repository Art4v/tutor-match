import { listVerificationQueue } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../guard";
import { PageHeader, Panel, QueueList, QueueRow } from "../_components/ui";
import { formatDate } from "../_components/format";

export const metadata = { title: "Verification" };

export default async function VerificationQueuePage() {
  const { admin } = await requireAdmin();
  const queue = admin ? await listVerificationQueue(admin) : [];

  return (
    <>
      <PageHeader icon="shield-check" title="Verification" lead="Tutors asking for the verified badge, oldest first." />
      <Panel padded={false}>
        <QueueList
          items={queue}
          empty="No verification requests are waiting."
          renderRow={(t) => (
            <QueueRow
              href={adminPaths.verification(t.id)}
              title={t.name}
              meta={t.location || "No location set"}
              aside={t.at ? `Requested ${formatDate(t.at)}` : null}
            />
          )}
        />
      </Panel>
    </>
  );
}
