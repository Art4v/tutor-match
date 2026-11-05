import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ACTION_LABELS, formatDateTime } from "./format";
import { historyTargetHref } from "@/lib/admin/urls";

// Presentational building blocks shared by every /admin page. Server-safe (no
// hooks); the interactive pieces live in DecisionPanel.jsx.
//
// DESIGN.md: no cards. A page is a title, then sections (20px heading, content,
// a rule before the next). Lists are rows divided by rules. The one tint is
// --surface-2, used for the item under review (Inset) and decided notes.

const TEXT_2 = "text-[color:var(--text-2)]";

// `icon` is accepted for compatibility with existing call sites and ignored:
// headings carry no icons.
// eslint-disable-next-line no-unused-vars
export function PageHeader({ icon, title, lead, back }) {
  return (
    <div className="mb-8">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 min-h-6 mb-2 text-[14px] leading-5 text-accent hover:text-accent-hover">
          <Icon name="chevron-left" size={16} /> {back.label}
        </Link>
      )}
      <h1 className="text-[24px] leading-8 font-semibold text-[color:var(--text)]">{title}</h1>
      {lead && <p className={`text-[14px] leading-5 mt-1 ${TEXT_2}`}>{lead}</p>}
    </div>
  );
}

/**
 * A section: heading, content, then a rule before the next section. With
 * `padded={false}` the content is a ruled list that closes itself, so the
 * section adds no rule of its own.
 */
export function Panel({ title, lead, children, className = "", padded = true }) {
  return (
    <section
      className={`mb-8 last:mb-0 ${padded ? "pb-8 border-b border-rule last:pb-0 last:border-b-0" : ""} ${className}`}
    >
      {(title || lead) && (
        <div className="mb-4">
          {title && <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">{title}</h2>}
          {lead && <p className={`text-[14px] leading-5 mt-1 ${TEXT_2}`}>{lead}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** The item under review (a profile, a review body): a light grey area, no border. */
export function Inset({ children, className = "" }) {
  return <div className={`bg-surface-2 rounded p-4 text-[14px] leading-5 text-[color:var(--text)] ${className}`}>{children}</div>;
}

export function EmptyState({ children }) {
  return <p className={`py-4 text-[14px] leading-5 ${TEXT_2}`}>{children}</p>;
}

/** A queue: a list of linked rows. */
export function QueueList({ items, empty, renderRow }) {
  if (!items.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="border-t border-rule">
      {items.map((item) => (
        <li key={item.id} className="border-b border-rule">
          {renderRow(item)}
        </li>
      ))}
    </ul>
  );
}

export function QueueRow({ href, title, meta, aside }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 min-h-11 px-3 py-3 hover:bg-surface-2"
      style={{ transition: "background-color 120ms ease-out" }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] leading-5 font-semibold text-[color:var(--text)] truncate">{title}</div>
        {meta && <div className={`text-[14px] leading-5 truncate ${TEXT_2}`}>{meta}</div>}
      </div>
      {aside && <div className="shrink-0 text-[12px] leading-4 text-muted">{aside}</div>}
      <span className="shrink-0 text-muted">
        <Icon name="chevron-right" size={16} />
      </span>
    </Link>
  );
}

/**
 * A label. Status tones (good / bad / warn) are a small 4px-radius label in the
 * status colour; everything else is plain secondary text.
 */
export function Chip({ children, tone = "muted" }) {
  const status = {
    good: "text-success border-success",
    bad: "text-error border-error",
    warn: "text-warning border-warning",
  }[tone];
  if (!status) {
    return <span className={`text-[12px] leading-4 whitespace-nowrap ${TEXT_2}`}>{children}</span>;
  }
  return (
    <span className={`inline-flex items-center px-1 rounded border text-[12px] leading-4 font-semibold whitespace-nowrap ${status}`}>
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
    <div className="bg-surface-2 rounded p-4 text-[14px] leading-5">
      <div className="font-semibold text-[color:var(--text)]">{text}</div>
      {last && (
        <div className={`mt-1 ${TEXT_2}`}>
          {ACTION_LABELS[last.action] || last.action} by {last.admin_name || "an admin"} on {formatDateTime(last.created_at)}
          {last.reason ? `. Note: "${last.reason}"` : ""}
        </div>
      )}
    </div>
  );
}

/** History rows, shared by /admin/history, the overview and the user page. */
export function HistoryList({ rows, empty = "Nothing yet." }) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="border-t border-rule">
      {rows.map((row) => {
        const href = historyTargetHref(row);
        return (
          <li key={row.id} className="border-b border-rule min-h-11 px-3 py-3">
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
              <div className="min-w-0 flex-1 text-[14px] leading-5 text-[color:var(--text)]">
                <span className="font-semibold">{row.admin_name || "Former admin"}</span>{" "}
                <span className={TEXT_2}>{(ACTION_LABELS[row.action] || row.action).toLowerCase()}</span>
                {row.target_label && (
                  <>
                    {": "}
                    {href ? (
                      <Link href={href} className="text-accent hover:text-accent-hover">
                        {row.target_label}
                      </Link>
                    ) : (
                      <span>{row.target_label}</span>
                    )}
                  </>
                )}
              </div>
              <div className="shrink-0 text-[12px] leading-4 text-muted">{formatDateTime(row.created_at)}</div>
            </div>
            {row.reason && <div className={`text-[14px] leading-5 mt-1 whitespace-pre-wrap ${TEXT_2}`}>Note: {row.reason}</div>}
          </li>
        );
      })}
    </ul>
  );
}
