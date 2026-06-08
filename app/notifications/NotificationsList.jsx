"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Icon + accent per notification type.
const TYPES = {
  welcome: { icon: "sparkle", color: "var(--accent)", bg: "var(--accent-softer)" },
  verification_requested: { icon: "shield", color: "var(--accent)", bg: "var(--accent-softer)" },
  verification_approved: { icon: "shield-check", color: "#10B981", bg: "#ECFDF5" },
};
const FALLBACK = { icon: "bell", color: "#64748B", bg: "#F3F4F6" };

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
    return (
      <div
        className="flex flex-col items-center justify-center text-center"
        style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: "48px 24px" }}
      >
        <span className="inline-flex items-center justify-center mb-3" style={{ width: 48, height: 48, borderRadius: 999, background: "#F3F4F6", color: "#94A3B8" }}>
          <Icon name="bell" size={22} />
        </span>
        <p className="text-[15px] font-medium text-slate-900">No notifications yet</p>
        <p className="text-[13px] text-slate-500 mt-1">We'll let you know about verification and account updates here.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((n) => {
        const t = TYPES[n.type] || FALLBACK;
        const unread = wasUnread.has(n.id);
        return (
          <li
            key={n.id}
            className="flex items-start gap-3.5"
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 14,
              padding: 16,
              background: unread ? "var(--accent-softer)" : "#fff",
            }}
          >
            <span className="inline-flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: 999, background: t.bg, color: t.color }}>
              <Icon name={t.icon} size={17} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-slate-900">{n.title}</span>
                {unread && <span className="inline-block shrink-0" style={{ width: 7, height: 7, borderRadius: 999, background: "var(--accent)" }} />}
              </div>
              {n.body && <p className="text-[13px] text-slate-500 mt-0.5 leading-[1.5]">{n.body}</p>}
              <p className="text-[12px] text-slate-400 mt-1.5">{relativeTime(n.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
