"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Overview", icon: "sliders", exact: true },
  { href: "/admin/verification", label: "Verification", icon: "shield-check", count: "verifications" },
  { href: "/admin/reviews", label: "Reviews", icon: "star", count: "reviews" },
  { href: "/admin/reports", label: "Reports", icon: "flag", count: "reports" },
  { href: "/admin/profile-changes", label: "Profile changes", icon: "pencil", count: "revisions" },
  { href: "/admin/companies", label: "Companies", icon: "building" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/history", label: "History", icon: "clock" },
];

// Sidebar on wide screens, a scrolling chip row on phones. The counts come
// from the layout (admin_pending_counts), so they refresh with every
// navigation and every router.refresh() after a decision.
export function AdminNav({ counts }) {
  const pathname = usePathname();
  const isActive = (s) => (s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(`${s.href}/`));

  return (
    <nav aria-label="Admin sections" className="lg:sticky lg:top-24 lg:self-start">
      <ul className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
        {ADMIN_SECTIONS.map((s) => {
          const active = isActive(s);
          const n = s.count ? counts?.[s.count] ?? 0 : 0;
          return (
            <li key={s.href} className="shrink-0">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-2.5 text-[14px] font-medium whitespace-nowrap"
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: active ? "var(--accent-softer)" : "transparent",
                  color: active ? "var(--accent)" : "var(--ink-muted)",
                  border: `1px solid ${active ? "var(--accent-line)" : "transparent"}`,
                }}
              >
                <Icon name={s.icon} size={16} />
                <span className="flex-1">{s.label}</span>
                {n > 0 && (
                  <span
                    className="inline-flex items-center justify-center text-[11.5px] tabular-nums text-white"
                    style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "var(--accent)" }}
                  >
                    {n}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
