import Link from "next/link";
import { Icon } from "@/components/Icon";
import { listHistory, listAdmins } from "@/lib/supabase/adminDashboard";
import { requireAdmin } from "../guard";
import { PageHeader, Panel, HistoryList } from "../_components/ui";
import { ACTION_GROUPS } from "../_components/format";

export const metadata = { title: "History" };

const UUID = /^[0-9a-f-]{36}$/i;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Every admin action, newest first. Filters live in the URL (a plain GET
// form), so a filtered view is shareable and the back button works.
export default async function HistoryPage({ searchParams }) {
  const { supabase, admin } = await requireAdmin();

  const pick = (key, ok) => {
    const v = (searchParams?.[key] ?? "").toString();
    return ok(v) ? v : "";
  };
  const filters = {
    adminId: pick("admin", (v) => UUID.test(v)),
    action: pick("action", (v) => ACTION_GROUPS.some((g) => g.value === v)),
    from: pick("from", (v) => YMD.test(v)),
    to: pick("to", (v) => YMD.test(v)),
    page: Math.max(1, Number(searchParams?.page) || 1),
  };

  const [{ rows, total, page, pageSize }, admins] = await Promise.all([
    listHistory(supabase, filters),
    admin ? listAdmins(admin) : [],
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hrefFor = (p) => {
    const qs = new URLSearchParams();
    if (filters.adminId) qs.set("admin", filters.adminId);
    if (filters.action) qs.set("action", filters.action);
    if (filters.from) qs.set("from", filters.from);
    if (filters.to) qs.set("to", filters.to);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/admin/history?${s}` : "/admin/history";
  };
  const field = { height: 38, border: "1px solid var(--paper-line)", borderRadius: 10, background: "var(--paper-card)", padding: "0 10px", fontSize: 14 };

  return (
    <>
      <PageHeader icon="clock" title="History" lead="Every decision and change made from this dashboard." />
      <Panel padded={false}>
        <form action="/admin/history" className="px-5 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end">
          <label className="text-[12px] text-slate-500">
            Admin
            <select name="admin" defaultValue={filters.adminId} className="block w-full mt-1" style={field}>
              <option value="">Everyone</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.full_name || "Unnamed admin"}</option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-slate-500">
            Type
            <select name="action" defaultValue={filters.action} className="block w-full mt-1" style={field}>
              <option value="">All actions</option>
              {ACTION_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-slate-500">
            From
            <input type="date" name="from" defaultValue={filters.from} className="block w-full mt-1" style={field} />
          </label>
          <label className="text-[12px] text-slate-500">
            To
            <input type="date" name="to" defaultValue={filters.to} className="block w-full mt-1" style={field} />
          </label>
          <button type="submit" className="font-medium text-[14px] text-white" style={{ background: "var(--accent)", borderRadius: 10, height: 38, padding: "0 16px" }}>
            Filter
          </button>
        </form>

        <HistoryList rows={rows} empty="No actions match these filters." />

        <div className="px-5 sm:px-6 py-3 flex items-center justify-between text-[13px] text-slate-500" style={{ borderTop: "1px solid var(--paper-line)" }}>
          <span>
            {total} {total === 1 ? "action" : "actions"}
          </span>
          {pages > 1 && (
            <span className="inline-flex items-center gap-3">
              {page > 1 && (
                <Link href={hrefFor(page - 1)} className="inline-flex items-center gap-1" style={{ color: "var(--accent)" }}>
                  <Icon name="chevron-left" size={14} /> Newer
                </Link>
              )}
              <span>
                Page {page} of {pages}
              </span>
              {page < pages && (
                <Link href={hrefFor(page + 1)} className="inline-flex items-center gap-1" style={{ color: "var(--accent)" }}>
                  Older <Icon name="chevron-right" size={14} />
                </Link>
              )}
            </span>
          )}
        </div>
      </Panel>
    </>
  );
}
