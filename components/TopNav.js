"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { BookSproutMark, Wordmark } from "./Logo";
import { Avatar } from "./ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// The site nav (DESIGN.md §6, REDESIGN_DECISIONS.md item 2): a solid white bar,
// always visible, 1px bottom rule, 1128px wide. No search box (search lives on
// the home page). Below 1024px it collapses to logo, a "Find a tutor" magnifier,
// the Messages / Notifications icons (signed in) and a menu button that opens a
// full-width sheet.

const PUBLIC_LINKS = [
  { label: "Find a tutor", href: "/browse" },
  { label: "Companies", href: "/companies" },
  { label: "Blog", href: "/blog" },
  { label: "Become a tutor", href: "/signup" },
];

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // profiles.role — source of truth
  const [canAuthor, setCanAuthor] = useState(false); // profiles.can_author_articles (0061)
  const [isAdmin, setIsAdmin] = useState(false); // profiles.is_admin (0074)
  const [adminPending, setAdminPending] = useState(0); // sum of admin_pending_counts
  const [tutorSlug, setTutorSlug] = useState(null);
  const [profile, setProfile] = useState(null); // { name, avatarUrl } from the DB
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // desktop "Me" dropdown
  const [sheetOpen, setSheetOpen] = useState(false); // compact menu sheet
  const menuRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSheetOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Each navigation closes both menus.
  useEffect(() => {
    setMenuOpen(false);
    setSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setUser(data.user ?? null);
      })
      // Network failure shouldn't surface as an unhandled rejection;
      // onAuthStateChange below still resolves the session.
      .catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // profiles.role is the single source of truth (0041). A NULL role means the
  // user hasn't passed /choose-role yet; middleware keeps them off every real
  // page, so the nav state is moot.
  const isStudent = role === "student";
  const isTutor = role === "tutor";
  const isCompany = role === "partner"; // a tutoring company (0062); never shown to users

  useEffect(() => {
    if (!user) {
      setRole(null);
      setCanAuthor(false);
      setIsAdmin(false);
      setAdminPending(0);
      setTutorSlug(null);
      setProfile(null);
      setUnread(0);
      setUnreadMessages(0);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    let active = true;
    // Resolve the role first, then fetch the tutor row only for tutors. The
    // slug + live name/avatar keep the nav in sync with profile edits (keyed on
    // pathname so it refetches after navigating).
    supabase
      .from("profiles")
      .select("role, full_name, can_author_articles, is_admin")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const r = data?.role ?? null;
        const fullName = data?.full_name ?? null;
        setRole(r);
        // 0061. Independent of role: an author is a designated tutor.
        setCanAuthor(Boolean(data?.can_author_articles));
        // 0074. Display only: /admin 404s non-admins and every admin RPC
        // re-checks. The count is the live queue size, refetched on navigation.
        const admin = Boolean(data?.is_admin);
        setIsAdmin(admin);
        if (admin) {
          supabase.rpc("admin_pending_counts").then(({ data: counts }) => {
            if (!active || !counts) return;
            setAdminPending(
              (counts.verifications ?? 0) + (counts.reviews ?? 0) + (counts.reports ?? 0) + (counts.revisions ?? 0)
            );
          });
        } else {
          setAdminPending(0);
        }
        if (r === "tutor") {
          supabase
            .from("tutor_profiles")
            .select("slug, avatar_url, profile:profiles!inner ( full_name )")
            .eq("id", user.id)
            .maybeSingle()
            .then(({ data: t }) => {
              if (!active) return;
              setTutorSlug(t?.slug ?? null);
              setProfile(t ? { name: t.profile?.full_name ?? null, avatarUrl: t.avatar_url ?? null } : null);
            });
          return;
        }
        setTutorSlug(null);
        if (r === "student") {
          // Students carry their photo on student_profiles.avatar_url (0042).
          supabase
            .from("student_profiles")
            .select("avatar_url")
            .eq("id", user.id)
            .maybeSingle()
            .then(({ data: s }) => {
              if (!active) return;
              setProfile({ name: fullName, avatarUrl: s?.avatar_url ?? null });
            });
          return;
        }
        setProfile({ name: fullName, avatarUrl: null });
      });
    // Unread notifications drive the Notifications badge. Keyed on pathname
    // too, so visiting /notifications (which marks them read) clears it.
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false)
      .then(({ count }) => {
        if (active) setUnread(count ?? 0);
      });
    // Unread messages drive the Messages badge. Same pathname keying.
    supabase.rpc("unread_message_count").then(({ data }) => {
      if (active) setUnreadMessages(data ?? 0);
    });
    return () => {
      active = false;
    };
  }, [user, pathname]);

  const onLogout = async () => {
    setLoggingOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setLoggingOut(false);
    setMenuOpen(false);
    setSheetOpen(false);
    router.push("/");
    router.refresh();
  };

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.email || "";
  const showMessages = isStudent || isTutor; // companies have no messaging

  // The "Me" items, gated exactly as before: role for Profile / My company /
  // Saved tutors, capability for Write and Admin.
  const meItems = [
    isTutor && { label: "Profile", href: tutorSlug ? `/tutor/${tutorSlug}` : "/profile" },
    isCompany && { label: "My company", href: "/company" },
    { label: isStudent ? "Profile and account" : "Account", href: "/account" },
    isStudent && { label: "Saved tutors", href: "/browse?saved=1" },
    canAuthor && { label: "Write", href: "/author" },
    isAdmin && { label: "Admin", href: "/admin", count: adminPending },
  ].filter(Boolean);

  const isActive = (href) => {
    const path = href.split("?")[0];
    return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-surface border-b border-rule">
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 h-16 flex items-center gap-4 lg:gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="MatchTutor home">
          <BookSproutMark size={28} className="shrink-0" />
          <Wordmark className="text-[20px]" />
        </Link>

        {/* Wide: the full bar. */}
        <nav aria-label="Main" className="hidden lg:flex items-center gap-1 flex-1">
          {user ? (
            <>
              <NavItem href="/browse" active={isActive("/browse")}>Browse</NavItem>
              {showMessages && (
                <NavItem href="/messages" active={isActive("/messages")} icon="message" count={unreadMessages}>
                  Messages
                </NavItem>
              )}
              <NavItem href="/notifications" active={isActive("/notifications")} icon="bell" count={unread}>
                Notifications
              </NavItem>
              <NavItem href="/companies" active={isActive("/companies")}>Companies</NavItem>
              <NavItem href="/blog" active={isActive("/blog")}>Blog</NavItem>
            </>
          ) : (
            PUBLIC_LINKS.map((l) => (
              <NavItem key={l.href} href={l.href} active={isActive(l.href)}>
                {l.label}
              </NavItem>
            ))
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {/* Compact: the icon cluster. */}
          <Link
            href="/browse"
            aria-label="Find a tutor"
            className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2"
          >
            <Icon name="search" size={20} />
          </Link>
          {user && showMessages && (
            <IconLink href="/messages" icon="message" label="Messages" count={unreadMessages} />
          )}
          {user && <IconLink href="/notifications" icon="bell" label="Notifications" count={unread} />}

          {user ? (
            <div ref={menuRef} className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={displayName}
                className="inline-flex h-11 items-center gap-2 rounded px-2 text-[14px] leading-5 font-semibold text-[color:var(--text-2)] hover:bg-surface-2"
              >
                <Avatar tutor={{ avatarImg: profile?.avatarUrl, name: displayName }} size={24} />
                Me
                <Icon name="chevron-down" size={16} />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 min-w-[220px] rounded border border-rule bg-surface py-2"
                  style={{ boxShadow: "var(--shadow-float)" }}
                >
                  {displayName && (
                    <div className="px-4 pb-2 mb-2 border-b border-rule text-[12px] leading-4 text-[color:var(--muted)] truncate">
                      {displayName}
                    </div>
                  )}
                  {meItems.map((it) => (
                    <MenuLink key={it.href} href={it.href} count={it.count}>
                      {it.label}
                    </MenuLink>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onLogout}
                    disabled={loggingOut}
                    className="block w-full text-left px-4 h-11 text-[14px] leading-5 text-error hover:bg-surface-2 disabled:opacity-50"
                  >
                    {loggingOut ? "Logging out…" : "Log out"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded px-4 text-[14px] leading-5 font-semibold text-accent hover:bg-surface-2"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-11 items-center rounded px-4 text-[14px] leading-5 font-semibold text-white bg-accent hover:bg-accent-hover"
              >
                Sign up
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
            aria-controls="nav-sheet"
            aria-label={sheetOpen ? "Close menu" : "Open menu"}
            className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2"
          >
            <Icon name={sheetOpen ? "x" : "menu"} size={20} />
          </button>
        </div>
      </div>

      {sheetOpen && (
        <nav
          id="nav-sheet"
          aria-label="Menu"
          className="lg:hidden fixed inset-x-0 bottom-0 top-16 overflow-y-auto bg-surface border-t border-rule"
        >
          <ul className="px-4 py-2">
            {(user
              ? [
                  { label: "Browse", href: "/browse" },
                  { label: "Companies", href: "/companies" },
                  { label: "Blog", href: "/blog" },
                ]
              : PUBLIC_LINKS
            ).map((l) => (
              <SheetLink key={l.href} href={l.href}>
                {l.label}
              </SheetLink>
            ))}
          </ul>
          <div className="border-t border-rule px-4 py-2">
            {user ? (
              <ul>
                {displayName && (
                  <li className="py-2 text-[12px] leading-4 text-[color:var(--muted)] truncate">{displayName}</li>
                )}
                {meItems.map((it) => (
                  <SheetLink key={it.href} href={it.href} count={it.count}>
                    {it.label}
                  </SheetLink>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={onLogout}
                    disabled={loggingOut}
                    className="flex w-full h-11 items-center text-[16px] leading-6 text-error disabled:opacity-50"
                  >
                    {loggingOut ? "Logging out…" : "Log out"}
                  </button>
                </li>
              </ul>
            ) : (
              <div className="flex flex-col gap-2 py-2">
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center justify-center rounded border border-input text-[14px] leading-5 font-semibold text-[color:var(--text)]"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center justify-center rounded bg-accent text-[14px] leading-5 font-semibold text-white"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

// Numeric badge (DESIGN.md §6): 12px/600 white on --accent, 16px tall, 4px
// radius, "9+" above nine. Never a dot.
function Badge({ count, className = "" }) {
  if (!count) return null;
  return (
    <span
      className={`inline-flex h-4 min-w-4 items-center justify-center rounded bg-accent px-1 text-[12px] leading-4 font-semibold text-white tabular-nums ${className}`}
      aria-label={`${count} unread`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function NavItem({ href, active, icon, count, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-11 items-center gap-2 rounded px-3 text-[14px] leading-5 font-semibold whitespace-nowrap hover:bg-surface-2 ${
        active ? "text-accent" : "text-[color:var(--text-2)] hover:text-[color:var(--text)]"
      }`}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
      <Badge count={count} />
    </Link>
  );
}

function IconLink({ href, icon, label, count }) {
  return (
    <Link
      href={href}
      aria-label={count ? `${label}, ${count} unread` : label}
      className="lg:hidden relative inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2"
    >
      <Icon name={icon} size={20} />
      <Badge count={count} className="absolute right-1 top-1" />
    </Link>
  );
}

function MenuLink({ href, count, children }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex h-11 items-center justify-between gap-2 px-4 text-[14px] leading-5 text-[color:var(--text)] hover:bg-surface-2"
    >
      {children}
      <Badge count={count} />
    </Link>
  );
}

function SheetLink({ href, count, children }) {
  return (
    <li>
      <Link
        href={href}
        className="flex h-11 items-center justify-between text-[16px] leading-6 text-[color:var(--text)]"
      >
        {children}
        <Badge count={count} />
      </Link>
    </li>
  );
}
