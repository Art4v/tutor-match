"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Icon per notification type. Always grey: the row, not the icon, says
// whether it is unread.
const TYPES = {
  welcome: "sparkle",
  verification_requested: "shield",
  verification_approved: "shield-check",
  verification_rejected: "alert-triangle",
  review_submitted: "star",
  review_approved: "check-circle",
  review_published: "star",
  review_rejected: "alert-triangle",
  profile_revision_submitted: "clock",
  profile_revision_approved: "check-circle",
  profile_revision_rejected: "alert-triangle",
  managed_profile_updated: "pencil",
  managed_verification_set: "shield-check",
};
const FALLBACK = "bell";

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
  // Snapshot which rows arrived unread so we can keep the accent while marking
  // them read in the background (clears the nav dot on the next load).
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
    // Empty list: one line of text. No icon tile, no box.
    return (
      <p className="border-t border-[color:var(--paper-line)] pt-6 text-[14px] text-[color:var(--ink-muted)]">
        No notifications yet. We&apos;ll let you know about verification and account updates here.
      </p>
    );
  }

  // A ruled list. Unread rows sit on the light surface; no dots, no photos.
  return (
    <ul className="border-t border-[color:var(--paper-line)]">
      {items.map((n) => {
        const icon = TYPES[n.type] || FALLBACK;
        const unread = wasUnread.has(n.id);
        return (
          <li
            key={n.id}
            className="flex items-start gap-3 px-3 py-4 border-b border-[color:var(--paper-line)]"
            style={{ background: unread ? "var(--desk)" : undefined }}
          >
            <span className="shrink-0 mt-0.5" style={{ color: "var(--sage)" }}>
              <Icon name={icon} size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3">
                <span
                  className="flex-1 min-w-0 text-[14px] font-medium"
                  style={{ color: unread ? "var(--ink-graphite)" : "var(--ink-muted)" }}
                >
                  {n.title}
                </span>
                <span className="shrink-0 text-[12px] text-slate-400">{relativeTime(n.created_at)}</span>
              </div>
              {n.body && <p className="text-[14px] text-slate-500 mt-1 leading-[1.5]">{n.body}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
