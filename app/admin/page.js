import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getPendingCounts, listHistory } from "@/lib/supabase/adminDashboard";
import { requireAdmin } from "./guard";
import { PageHeader, Panel, HistoryList } from "./_components/ui";
import { AlertsToggle } from "./_components/AlertsToggle";

export const metadata = { title: "Overview" };

const QUEUES = [
  { key: "verifications", href: "/admin/verification", label: "Verification requests" },
  { key: "reviews", href: "/admin/reviews", label: "Reviews to moderate" },
  { key: "reports", href: "/admin/reports", label: "Open reports" },
  { key: "revisions", href: "/admin/profile-changes", label: "Profile changes" },
];

export default async function AdminOverviewPage() {
  const { supabase, user } = await requireAdmin();
  const [counts, history, { data: me }] = await Promise.all([
    getPendingCounts(supabase),
    listHistory(supabase, { pageSize: 8 }),
    supabase.from("profiles").select("admin_alerts_muted").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <>
      <PageHeader title="Admin" lead="Everything waiting for a decision, and what the team has done recently." />

      <Panel title="Waiting for a decision" padded={false}>
        <ul className="border-t border-rule">
          {QUEUES.map((q) => {
            const n = counts[q.key];
            return (
              <li key={q.key} className="border-b border-rule">
                <Link
                  href={q.href}
                  className="flex items-center gap-4 min-h-11 px-3 py-3 hover:bg-surface-2"
                  style={{ transition: "background-color 120ms ease-out" }}
                >
                  <span className="flex-1 min-w-0 text-[14px] leading-5 font-semibold text-[color:var(--text)]">{q.label}</span>
                  <span className={`text-[14px] leading-5 tabular-nums ${n ? "font-semibold text-[color:var(--text)]" : "text-[color:var(--text-2)]"}`}>
                    {n}
                  </span>
                  <span className="shrink-0 text-muted">
                    <Icon name="chevron-right" size={16} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Alert emails">
        <AlertsToggle initialMuted={Boolean(me?.admin_alerts_muted)} />
      </Panel>

      <Panel title="Recent activity" padded={false}>
        <HistoryList rows={history.rows} empty="No admin actions yet." />
        <Link href="/admin/history" className="inline-flex items-center min-h-6 mt-3 text-[14px] leading-5 text-accent hover:text-accent-hover">
          Full history
        </Link>
      </Panel>
    </>
  );
}
