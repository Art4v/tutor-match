import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getPendingCounts, listHistory } from "@/lib/supabase/adminDashboard";
import { requireAdmin } from "./guard";
import { PageHeader, Panel, HistoryList } from "./_components/ui";
import { AlertsToggle } from "./_components/AlertsToggle";

export const metadata = { title: "Overview" };

const QUEUES = [
  { key: "verifications", href: "/admin/verification", label: "Verification requests", icon: "shield-check" },
  { key: "reviews", href: "/admin/reviews", label: "Reviews to moderate", icon: "star" },
  { key: "reports", href: "/admin/reports", label: "Open reports", icon: "flag" },
  { key: "revisions", href: "/admin/profile-changes", label: "Profile changes", icon: "pencil" },
];

export default async function AdminOverviewPage() {
  const { supabase, user } = await requireAdmin();
  const [counts, history, { data: me }] = await Promise.all([
    getPendingCounts(supabase),
    listHistory(supabase, { pageSize: 8 }),
    supabase.from("profiles").select("admin_alerts_muted").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader icon="sliders" title="Admin" lead="Everything waiting for a decision, and what the team has done recently." />

      {/* Queues as ruled rows (label, count), not tiles. */}
      <ul className="border-t border-[color:var(--paper-line)]">
        {QUEUES.map((q) => {
          const n = counts[q.key];
          return (
            <li key={q.key} className="border-b border-[color:var(--paper-line)]">
              <Link href={q.href} className="flex items-center gap-4 -mx-2 px-2 py-3.5 hover:bg-[color:var(--bg-soft)]">
                <span className="flex-1 min-w-0 text-[14.5px] font-medium text-slate-800">{q.label}</span>
                <span
                  className="text-[20px] leading-none tabular-nums"
                  style={{ color: n ? "var(--accent)" : "var(--ink-muted)", fontWeight: 300 }}
                >
                  {n}
                </span>
                <span className="shrink-0 text-slate-400">
                  <Icon name="chevron-right" size={16} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Panel title="Alert emails">
        <AlertsToggle initialMuted={Boolean(me?.admin_alerts_muted)} />
      </Panel>

      <Panel title="Recent activity" padded={false}>
        <HistoryList rows={history.rows} empty="No admin actions yet." />
        <div className="py-3" style={{ borderTop: "1px solid var(--paper-line)" }}>
          <Link href="/admin/history" className="inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--accent)" }}>
            Full history <Icon name="arrow-right" size={13} />
          </Link>
        </div>
      </Panel>
    </div>
  );
}
