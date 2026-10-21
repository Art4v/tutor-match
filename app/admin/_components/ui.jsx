import Link from "next/link";
import { Icon } from "@/components/Icon";
import { cardStyle } from "@/app/tutor/[slug]/ProfileCards";
import { ACTION_LABELS, formatDateTime } from "./format";
import { historyTargetHref } from "@/lib/admin/urls";

// Presentational building blocks shared by every /admin page. Server-safe (no
// hooks); the interactive pieces live in DecisionPanel.jsx.

export function PageHeader({ icon, title, lead, back }) {
  return (
    <div className="mb-5">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-[13px] mb-3" style={{ color: "var(--accent)" }}>
          <Icon name="chevron-left" size={14} /> {back.label}
        </Link>
      )}
      <div className="flex items-start gap-3">
        {icon && (
          <span
            className="inline-flex items-center justify-center shrink-0"
            style={{ width: 40, height: 40, borderRadius: 999, background: "var(--accent-softer)", color: "var(--accent)" }}
          >
            <Icon name={icon} size={20} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[30px] leading-tight" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>
            {title}
          </h1>
          {lead && <p className="text-[13.5px] text-slate-500 mt-1">{lead}</p>}
        </div>
      </div>
    </div>
  );
}

export function Panel({ title, lead, children, className = "", padded = true }) {
  return (
    <section className={`bg-[color:var(--paper-card)] ${className}`} style={cardStyle}>
      {(title || lead) && (
        <div className="px-5 sm:px-6 pt-5 pb-3">
          {title && <h2 className="text-[18px] font-light text-slate-800 tracking-tight">{title}</h2>}
          {lead && <p className="text-[13px] text-slate-500 mt-0.5">{lead}</p>}
        </div>
      )}
      <div className={padded ? "px-5 sm:px-6 pb-5" : ""}>{children}</div>
    </section>
  );
}

/** A soft inset box for the item under review (a profile, a review body). */
export function Inset({ children, className = "" }) {
  return (
    <div className={`text-[14px] ${className}`} style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 12, padding: 16 }}>
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return <p className="px-5 sm:px-6 py-6 text-[14px] text-slate-500">{children}</p>;
}

/** A queue: a list of linked rows. */
export function QueueList({ items, empty, renderRow }) {
  if (!items.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} style={{ borderTop: "1px solid var(--paper-line)" }}>
          {renderRow(item)}
        </li>
      ))}
    </ul>
  );
}

export function QueueRow({ href, title, meta, aside }) {
  return (
    <Link href={href} className="flex items-center gap-4 px-5 sm:px-6 py-3.5 hover:bg-[color:var(--bg-soft)]">
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-medium text-slate-800 truncate">{title}</div>
        {meta && <div className="text-[12.5px] text-slate-500 mt-0.5 truncate">{meta}</div>}
      </div>
      {aside && <div className="shrink-0 text-[12.5px] text-slate-500">{aside}</div>}
      <span className="shrink-0 text-slate-400">
        <Icon name="chevron-right" size={16} />
      </span>
    </Link>
  );
}

export function Chip({ children, tone = "muted" }) {
  const tones = {
    good: { bg: "var(--accent-softer)", color: "var(--accent)", border: "var(--accent-line)" },
    bad: { bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
    warn: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
    muted: { bg: "var(--bg-soft)", color: "var(--ink-muted)", border: "var(--paper-line)" },
  };
  const t = tones[tone] ?? tones.muted;
  return (
    <span
      className="inline-flex items-center text-[11.5px] font-medium whitespace-nowrap"
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}`, borderRadius: 999, padding: "2px 9px" }}
    >
      {children}
    </span>
  );
}

/**
 * Shown in place of the decision controls once an item is no longer pending.
 * `last` is the latest History row for the item, when there is one; items
 * decided before 0074 (by email link) have none.
 */
export function DecidedNote({ text, last }) {
  return (
    <div
      className="flex items-start gap-2.5 text-[14px]"
      style={{ background: "var(--desk)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)", borderRadius: 12, padding: "14px 16px" }}
    >
      <span className="mt-0.5">
        <Icon name="info" size={17} />
      </span>
      <div>
        <div className="font-medium">{text}</div>
        {last && (
          <div className="text-[13px] mt-0.5">
            {ACTION_LABELS[last.action] || last.action} by {last.admin_name || "an admin"} on {formatDateTime(last.created_at)}
            {last.reason ? `. Note: "${last.reason}"` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

/** History rows, shared by /admin/history, the overview and the user page. */
export function HistoryList({ rows, empty = "Nothing yet." }) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul>
      {rows.map((row) => {
        const href = historyTargetHref(row);
        return (
          <li key={row.id} className="px-5 sm:px-6 py-3" style={{ borderTop: "1px solid var(--paper-line)" }}>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
              <div className="min-w-0 flex-1 text-[14px] text-slate-800">
                <span className="font-medium">{row.admin_name || "Former admin"}</span>{" "}
                <span className="text-slate-600">{(ACTION_LABELS[row.action] || row.action).toLowerCase()}</span>
                {row.target_label && (
                  <>
                    {": "}
                    {href ? (
                      <Link href={href} className="hover:underline" style={{ color: "var(--accent)" }}>
                        {row.target_label}
                      </Link>
                    ) : (
                      <span>{row.target_label}</span>
                    )}
                  </>
                )}
              </div>
              <div className="shrink-0 text-[12.5px] text-slate-400">{formatDateTime(row.created_at)}</div>
            </div>
            {row.reason && <div className="text-[13px] text-slate-500 mt-1 whitespace-pre-wrap">Note: {row.reason}</div>}
          </li>
        );
      })}
    </ul>
  );
}
