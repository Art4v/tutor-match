"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { BookSproutMark } from "./Logo";
import { Button } from "./ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // profiles.role — source of truth
  const [tutorSlug, setTutorSlug] = useState(null);
  const [profile, setProfile] = useState(null); // { name, avatarUrl } from the DB
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Auto-hide on scroll (meuze.ai-style): transparent at the very top, slides up
  // and fades out when scrolling down, reappears (with a frosted backing) when
  // scrolling up. rAF-throttled passive listener; Lenis emits real scroll events
  // so this works under smooth-scroll too (native scroll on coarse pointers).
  useEffect(() => {
    const TOP = 8; // within this many px of the top = always shown, no backing
    const HIDE_AFTER = 80; // only start hiding once past this depth
    const DELTA = 4; // ignore micro-scrolls to avoid jitter
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setScrolled(y > TOP);
      const diff = y - lastY;
      if (y <= TOP) {
        setHidden(false);
      } else if (Math.abs(diff) > DELTA) {
        if (diff > 0 && y > HIDE_AFTER) setHidden(true); // scrolling down
        else if (diff < 0) setHidden(false); // scrolling up
      }
      lastY = y;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Each new page starts with the nav shown.
  useEffect(() => {
    setHidden(false);
  }, [pathname]);

  // Never hide the bar while its dropdown menu is open. The nav stays fixed on
  // every route now (inline profile editing pins its own save bar below the
  // fixed nav at top: var(--nav-h)), so there is no in-flow exception.
  const navHidden = hidden && !menuOpen;

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

  // Role drives the menu: tutors get the Profile link, students get the (v1
  // placeholder) student items. profiles.role is the single source of truth
  // (0041) — we read it from the DB rather than auth metadata, which OAuth
  // accounts never carry. A NULL role means the user hasn't passed /choose-role
  // yet; middleware keeps them off every real page, so the nav state is moot.
  const isStudent = role === "student";
  const isTutor = role === "tutor";

  useEffect(() => {
    if (!user) {
      setRole(null);
      setTutorSlug(null);
      setProfile(null);
      setUnread(0);
      setUnreadMessages(0);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    let active = true;
    // Resolve the role first, then fetch the tutor row only for tutors. The
    // slug + live name/avatar keep the nav chip in sync with profile edits
    // (keyed on pathname so it refetches after navigating away from /settings).
    supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const r = data?.role ?? null;
        const fullName = data?.full_name ?? null;
        setRole(r);
        if (r === "tutor") {
          supabase
            .from("tutor_profiles")
            .select("slug, avatar_url, profile:profiles!inner ( full_name )")
            .eq("id", user.id)
            .maybeSingle()
            .then(({ data: t }) => {
              if (!active) return;
              setTutorSlug(t?.slug ?? null);
              setProfile(
                t ? { name: t.profile?.full_name ?? null, avatarUrl: t.avatar_url ?? null } : null
              );
            });
          return;
        }
        setTutorSlug(null);
        if (r === "student") {
          // Students carry their photo on student_profiles.avatar_url (0042);
          // surface it in the chip just like the tutor avatar.
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
        setProfile(null);
      });
    // Unread notifications drive the dot on the avatar chip + menu item. Keyed on
    // pathname too, so visiting /notifications (which marks them read) clears it.
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false)
      .then(({ count }) => {
        if (active) setUnread(count ?? 0);
      });
    // Unread messages drive the Messages menu pill. Same pathname keying, so
    // opening /messages (which marks the read thread) refreshes the count.
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
    router.push("/");
    router.refresh();
  };

  return (
    <div
      className="nav-floating fixed top-0 left-0 right-0 z-40"
      style={{
        transform: navHidden ? "translateY(-100%)" : "translateY(0)",
        opacity: navHidden ? 0 : 1,
        pointerEvents: navHidden ? "none" : "auto",
        background: "transparent",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        borderBottom: "1px solid transparent",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-[64px] flex items-center gap-6">
        <Link href="/" className="nav-logo flex items-center gap-2 group">
          <BookSproutMark size={28} className="nav-logo-mark shrink-0" />
          <span className="text-[19px] leading-none" style={{ fontWeight: 400, letterSpacing: "-0.01em" }}>
            <span className="nav-logo-word" style={{ color: "var(--ink-graphite)" }}>Match</span>
            <span className="nav-logo-word" style={{ color: "var(--accent)" }}>Tutor</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 ml-auto">
          {user ? (
            (() => {
              const displayName = profile?.name || user.user_metadata?.full_name || user.email || "";
              const avatarUrl = profile?.avatarUrl || null;
              return (
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="relative inline-flex items-center gap-2 h-9 px-2.5 sm:px-3 text-[13px] font-medium text-slate-700 rounded-md transition-colors"
                    style={{ background: menuOpen ? "var(--accent-softer)" : "var(--desk)", color: menuOpen ? "var(--accent)" : "var(--ink-muted)" }}
                    title={displayName}
                  >
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10.5px] font-medium text-white overflow-hidden bg-cover bg-center"
                      style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : { background: "var(--ink)" }}
                    >
                      {!avatarUrl && (displayName || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="max-w-[110px] sm:max-w-[180px] truncate">{displayName}</span>
                    <Icon name="chevron-down" size={14} className="text-slate-400 shrink-0" />
                    {unread + unreadMessages > 0 && !menuOpen && (
                      <span
                        className="absolute"
                        style={{ top: 5, left: 26, width: 9, height: 9, borderRadius: 999, background: "var(--accent)", border: "2px solid #fff" }}
                        aria-label={`${unread + unreadMessages} unread notifications and messages`}
                      />
                    )}
                  </button>
                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-2 z-40 bg-[color:var(--paper-card)]"
                      style={{
                        border: "1px solid var(--paper-line)",
                        borderRadius: 12,
                        boxShadow: "0 10px 24px -8px rgba(0,30,30,0.12)",
                        minWidth: 200,
                        padding: 4,
                      }}
                    >
                      <NavMenuLink href="/browse" onClick={() => setMenuOpen(false)}>
                        Browse
                      </NavMenuLink>
                      {isTutor && (
                        <NavMenuLink href={tutorSlug ? `/tutor/${tutorSlug}` : "/profile"} onClick={() => setMenuOpen(false)}>
                          Profile
                        </NavMenuLink>
                      )}
                      <NavMenuLink href="/notifications" onClick={() => setMenuOpen(false)}>
                        <span className="flex items-center justify-between gap-2">
                          Notifications
                          {unread > 0 && (
                            <span
                              className="inline-flex items-center justify-center text-[11px] font-medium text-white tabular-nums"
                              style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "var(--accent)" }}
                            >
                              {unread > 9 ? "9+" : unread}
                            </span>
                          )}
                        </span>
                      </NavMenuLink>
                      {(isStudent || isTutor) && (
                        // Messaging is live for both roles: students initiate,
                        // tutors reply. The pill mirrors the notifications count.
                        <NavMenuLink href="/messages" onClick={() => setMenuOpen(false)}>
                          <span className="flex items-center justify-between gap-2">
                            Messages
                            {unreadMessages > 0 && (
                              <span
                                className="inline-flex items-center justify-center text-[11px] font-medium text-white tabular-nums"
                                style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "var(--accent)" }}
                              >
                                {unreadMessages > 9 ? "9+" : unreadMessages}
                              </span>
                            )}
                          </span>
                        </NavMenuLink>
                      )}
                      <NavMenuLink href="/account" onClick={() => setMenuOpen(false)}>
                        {isStudent ? "Profile and Account" : "Account"}
                      </NavMenuLink>
                      {isStudent && (
                        // Saved tutors is live (→ /browse with the saved filter pre-applied).
                        <NavMenuLink href="/browse?saved=1" onClick={() => setMenuOpen(false)}>
                          Saved Tutors
                        </NavMenuLink>
                      )}
                      <NavMenuButton onClick={onLogout} disabled={loggingOut} danger>
                        {loggingOut ? "Logging out…" : "Log out"}
                      </NavMenuButton>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm">Sign Up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NavMenuLink({ href, onClick, children }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="block w-full text-left px-3 py-2 text-[13.5px] rounded-md transition-colors"
      style={{
        background: hover ? "var(--accent-softer)" : "transparent",
        color: hover ? "var(--accent)" : "var(--ink-muted)",
      }}
    >
      {children}
    </Link>
  );
}

function NavMenuButton({ onClick, disabled, danger, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="block w-full text-left px-3 py-2 text-[13.5px] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        color: danger ? "#DC2626" : "var(--ink-muted)",
        background: hover && !disabled ? (danger ? "#FEF2F2" : "var(--accent-softer)") : "transparent",
      }}
    >
      {children}
    </button>
  );
}
