"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState("");
  const [user, setUser] = useState(null);
  const [tutorSlug, setTutorSlug] = useState(null);
  const [profile, setProfile] = useState(null); // { name, avatarUrl } from the DB
  const [unread, setUnread] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Tutors have a public profile page; fetch the slug (for the menu link) plus
  // the saved name + avatar so the nav chip reflects the live profile rather
  // than the name captured in auth metadata at signup (which a profile edit
  // never updates). Keyed on pathname too, so editing in /settings shows up in
  // the chip once the tutor navigates away — the nav persists across client
  // navigation and wouldn't otherwise refetch.
  //
  // We resolve the row by id (the PK) rather than gating on
  // `user_metadata.role === "tutor"`: OAuth (Google) signups never get a role
  // written to auth metadata — the DB trigger sets it — so that gate would hide
  // the Profile link (and the live name/avatar) for every OAuth tutor. A
  // non-tutor (e.g. student) simply has no matching row and gets null.
  useEffect(() => {
    if (!user) {
      setTutorSlug(null);
      setProfile(null);
      setUnread(0);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    let active = true;
    supabase
      .from("tutor_profiles")
      .select("slug, avatar_url, profile:profiles!inner ( full_name )")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setTutorSlug(data?.slug ?? null);
        setProfile(
          data
            ? { name: data.profile?.full_name ?? null, avatarUrl: data.avatar_url ?? null }
            : null
        );
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

  const submitSearch = () => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    router.push(`/browse${params}`);
  };

  return (
    <div className="sticky top-0 z-40 bg-white" style={{ borderBottom: "1px solid #E5E7EB" }}>
      <div className="max-w-[1400px] mx-auto px-6 h-[60px] flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-white text-[14px] transition-colors"
            style={{ background: "var(--accent)", letterSpacing: "-0.04em" }}
          >mt</div>
          <span className="text-[16px] font-semibold tracking-tight">
            <span className="text-slate-900">match</span>
            <span className="accent-glow" style={{ color: "var(--accent)" }}>tutor</span>
          </span>
        </Link>

        <div
          className="flex-1 max-w-[480px] hidden md:flex items-center gap-2 px-3 h-9 rounded-lg transition-colors"
          style={{
            background: focused ? "#fff" : "#F3F4F6",
            border: `1px solid ${focused ? "var(--accent)" : "transparent"}`,
            boxShadow: focused ? "0 0 0 3px var(--accent-ring)" : "none",
          }}
        >
          <Icon name="search" size={15} className="text-slate-500" />
          <input
            placeholder="Search tutors, subjects, locations…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-slate-400"
          />
          <span className="text-[11px] text-slate-400 hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border" style={{ borderColor: "#E5E7EB" }}>⌘K</span>
        </div>

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
                    className="relative hidden sm:inline-flex items-center gap-2 h-9 px-3 text-[13px] font-medium text-slate-700 rounded-md transition-colors"
                    style={{ background: menuOpen ? "var(--accent-softer)" : "#F3F4F6", color: menuOpen ? "var(--accent)" : "#334155" }}
                    title={displayName}
                  >
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10.5px] font-semibold text-white overflow-hidden bg-cover bg-center"
                      style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : { background: "#0F172A" }}
                    >
                      {!avatarUrl && (displayName || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="max-w-[180px] truncate">{displayName}</span>
                    <Icon name="chevron-down" size={14} className="text-slate-400 shrink-0" />
                    {unread > 0 && !menuOpen && (
                      <span
                        className="absolute"
                        style={{ top: 5, left: 26, width: 9, height: 9, borderRadius: 999, background: "var(--accent)", border: "2px solid #fff" }}
                        aria-label={`${unread} unread notifications`}
                      />
                    )}
                  </button>
                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-2 z-40 bg-white"
                      style={{
                        border: "1px solid #E5E7EB",
                        borderRadius: 12,
                        boxShadow: "0 10px 24px -8px rgba(15,23,42,0.12)",
                        minWidth: 200,
                        padding: 4,
                      }}
                    >
                      <NavMenuLink href="/browse" onClick={() => setMenuOpen(false)}>
                        Browse
                      </NavMenuLink>
                      {tutorSlug && (
                        <NavMenuLink href={`/tutor/${tutorSlug}`} onClick={() => setMenuOpen(false)}>
                          Profile
                        </NavMenuLink>
                      )}
                      <NavMenuLink href="/notifications" onClick={() => setMenuOpen(false)}>
                        <span className="flex items-center justify-between gap-2">
                          Notifications
                          {unread > 0 && (
                            <span
                              className="inline-flex items-center justify-center text-[11px] font-semibold text-white tabular-nums"
                              style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "var(--accent)" }}
                            >
                              {unread > 9 ? "9+" : unread}
                            </span>
                          )}
                        </span>
                      </NavMenuLink>
                      <NavMenuLink href="/settings" onClick={() => setMenuOpen(false)}>
                        Settings
                      </NavMenuLink>
                      <NavMenuLink href="/account" onClick={() => setMenuOpen(false)}>
                        Account
                      </NavMenuLink>
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
                <Button variant="primary" size="sm" glow>Sign Up</Button>
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
        color: hover ? "var(--accent)" : "#334155",
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
        color: danger ? "#DC2626" : "#334155",
        background: hover && !disabled ? (danger ? "#FEF2F2" : "var(--accent-softer)") : "transparent",
      }}
    >
      {children}
    </button>
  );
}
