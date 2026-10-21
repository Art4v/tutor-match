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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {QUEUES.map((q) => {
          const n = counts[q.key];
          return (
            <Link
              key={q.key}
              href={q.href}
              className="bg-[color:var(--paper-card)] flex items-center gap-3 p-4 hover:bg-[color:var(--bg-soft)]"
              style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)" }}
            >
              <span
                className="inline-flex items-center justify-center shrink-0"
                style={{ width: 38, height: 38, borderRadius: 999, background: n ? "var(--accent-softer)" : "var(--bg-soft)", color: n ? "var(--accent)" : "var(--ink-muted)" }}
              >
                <Icon name={q.icon} size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[26px] leading-none tabular-nums" style={{ color: "var(--ink-graphite)", fontWeight: 300 }}>{n}</div>
                <div className="text-[13px] text-slate-500 mt-1">{q.label}</div>
              </div>
              <Icon name="chevron-right" size={16} />
            </Link>
          );
        })}
      </div>

      <Panel title="Alert emails">
        <AlertsToggle initialMuted={Boolean(me?.admin_alerts_muted)} />
      </Panel>

      <Panel title="Recent activity" padded={false}>
        <HistoryList rows={history.rows} empty="No admin actions yet." />
        <div className="px-5 sm:px-6 py-3" style={{ borderTop: "1px solid var(--paper-line)" }}>
          <Link href="/admin/history" className="inline-flex items-center gap-1 text-[13px]" style={{ color: "var(--accent)" }}>
            Full history <Icon name="arrow-right" size={13} />
          </Link>
        </div>
      </Panel>
    </div>
  );
}
