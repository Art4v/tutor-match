"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Icon per notification type (DESIGN.md "Notifications row"): a plain grey
// glyph; only rejections and warnings take the warning colour.
const TYPES = {
  welcome: { icon: "bell" },
  verification_requested: { icon: "shield" },
  verification_approved: { icon: "shield-check" },
  verification_rejected: { icon: "alert-triangle", warning: true },
  review_submitted: { icon: "star" },
  review_approved: { icon: "check-circle" },
  review_published: { icon: "star" },
  review_rejected: { icon: "alert-triangle", warning: true },
  profile_revision_submitted: { icon: "clock" },
  profile_revision_approved: { icon: "check-circle" },
  profile_revision_rejected: { icon: "alert-triangle", warning: true },
  managed_profile_updated: { icon: "pencil" },
  managed_verification_set: { icon: "shield-check" },
};
const FALLBACK = { icon: "bell" };

function relativeTime(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotificationsList({ initial }) {
  // Snapshot which rows arrived unread so they keep the unread treatment while
  // being marked read in the background (clears the nav badge on the next load).
  const wasUnread = useMemo(
    () => new Set((initial ?? []).filter((n) => !n.read).map((n) => n.id)),
    [initial]
  );
  const [items] = useState(initial ?? []);
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();

  useEffect(() => {
    if (wasUnread.size === 0) return;
    supabaseRef.current
      .from("notifications")
      .update({ read: true })
      .in("id", Array.from(wasUnread))
      .then(() => {});
  }, [wasUnread]);

  if (items.length === 0) {
    return (
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
        No notifications yet.{" "}
        <Link href="/browse" className="inline-flex min-h-6 items-center text-accent hover:text-[color:var(--accent-hover)]">
          Find a tutor
        </Link>
      </p>
    );
  }

  return (
    <ul className="border-t border-rule">
      {items.map((n) => {
        const t = TYPES[n.type] || FALLBACK;
        const unread = wasUnread.has(n.id);
        return (
          <li
            key={n.id}
            className={`flex items-start gap-3 border-b border-rule px-4 py-4 ${unread ? "bg-surface-2" : "bg-surface"}`}
          >
            <span
              className="inline-flex shrink-0 pt-1"
              style={{ color: t.warning ? "var(--warning)" : "var(--muted)" }}
              aria-hidden="true"
            >
              <Icon name={t.icon} size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p
                className={`text-[14px] leading-6 text-[color:var(--text)] ${unread ? "font-semibold" : "font-normal"}`}
              >
                {n.title}
                {unread && <span className="sr-only"> (unread)</span>}
              </p>
              {n.body && <p className="text-[14px] leading-5 text-[color:var(--text-2)]">{n.body}</p>}
            </div>
            <time
              dateTime={n.created_at}
              className="shrink-0 pt-1 text-[12px] leading-4 text-muted whitespace-nowrap"
            >
              {relativeTime(n.created_at)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
