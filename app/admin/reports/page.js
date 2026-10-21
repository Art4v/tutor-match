import { listReportQueue } from "@/lib/supabase/adminDashboard";
import { adminPaths } from "@/lib/admin/urls";
import { requireAdmin } from "../guard";
import { PageHeader, Panel, QueueList, QueueRow, Chip } from "../_components/ui";
import { formatDate, REPORT_CATEGORY_LABELS } from "../_components/format";

export const metadata = { title: "Reports" };

export default async function ReportQueuePage() {
  const { admin } = await requireAdmin();
  const queue = admin ? await listReportQueue(admin) : [];

  return (
    <>
      <PageHeader icon="flag" title="Reports" lead="Open reports about conversations and reviews, oldest first." />
      <Panel padded={false}>
        <QueueList
          items={queue}
          empty="No open reports."
          renderRow={(r) => (
            <QueueRow
              href={adminPaths.report(r.id)}
              title={`${r.reporterName} reported ${r.reportedName}`}
              meta={REPORT_CATEGORY_LABELS[r.category] || "Other"}
              aside={
                <span className="inline-flex items-center gap-2">
                  <Chip>{r.aboutAReview ? "Review" : "Conversation"}</Chip>
                  {formatDate(r.at)}
                </span>
              }
            />
          )}
        />
      </Panel>
    </>
  );
}
