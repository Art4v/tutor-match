"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// `icon` is kept on each entry for any caller that reads it; the nav itself is
// plain text (DESIGN.md: no decorative icons).
export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Overview", icon: "sliders", exact: true },
  { href: "/admin/verification", label: "Verification", icon: "shield-check", count: "verifications" },
  { href: "/admin/reviews", label: "Reviews", icon: "star", count: "reviews" },
  { href: "/admin/reports", label: "Reports", icon: "flag", count: "reports" },
  { href: "/admin/profile-changes", label: "Profile changes", icon: "pencil", count: "revisions" },
  { href: "/admin/tutor-invites", label: "Tutor invites", icon: "send", count: "invites" },
  { href: "/admin/companies", label: "Companies", icon: "building" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/history", label: "History", icon: "clock" },
];

const badgeText = (n) => (n > 9 ? "9+" : String(n));

// A plain left nav at 1024px and up; below that, one "Section" select that
// navigates on change. The counts come from the layout (admin_pending_counts),
// so they refresh with every navigation and every router.refresh() after a
// decision.
export function AdminNav({ counts }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (s) => (s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(`${s.href}/`));
  const countFor = (s) => (s.count ? counts?.[s.count] ?? 0 : 0);
  const current = ADMIN_SECTIONS.find(isActive)?.href ?? "/admin";

  return (
    <nav aria-label="Admin sections" className="lg:sticky lg:top-24 lg:self-start">
      <div className="lg:hidden">
        <label htmlFor="admin-section" className="block mb-1 text-[14px] leading-5 font-semibold text-[color:var(--text)]">
          Section
        </label>
        <select
          id="admin-section"
          value={current}
          onChange={(e) => router.push(e.target.value)}
          className="block w-full h-11 px-3 rounded border border-input bg-surface text-[14px] leading-5 text-[color:var(--text)]"
        >
          {ADMIN_SECTIONS.map((s) => {
            const n = countFor(s);
            return (
              <option key={s.href} value={s.href}>
                {n > 0 ? `${s.label} (${n})` : s.label}
              </option>
            );
          })}
        </select>
      </div>

      <ul className="hidden lg:block">
        {ADMIN_SECTIONS.map((s) => {
          const active = isActive(s);
          const n = countFor(s);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 h-11 px-3 rounded text-[14px] leading-5 ${
                  active
                    ? "bg-surface-2 text-accent font-semibold"
                    : "text-[color:var(--text)] hover:bg-surface-2"
                }`}
                style={{ transition: "background-color 120ms ease-out" }}
              >
                <span className="flex-1 truncate">{s.label}</span>
                {n > 0 && (
                  <span
                    className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded bg-accent text-white text-[12px] leading-4 font-semibold tabular-nums"
                  >
                    {badgeText(n)}
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
