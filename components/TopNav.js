"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function TopNav() {
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState("");
  const [user, setUser] = useState(null);
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
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-white text-[14px]"
            style={{ background: "#0F172A", letterSpacing: "-0.04em" }}
          >tm</div>
          <span className="text-[16px] font-semibold text-slate-900 tracking-tight">TutorMatch</span>
        </Link>

        <div
          className="flex-1 max-w-[480px] hidden md:flex items-center gap-2 px-3 h-9 rounded-lg transition-colors"
          style={{
            background: focused ? "#fff" : "#F3F4F6",
            border: `1px solid ${focused ? "#D1D5DB" : "transparent"}`,
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
              const displayName = user.user_metadata?.full_name || user.email || "";
              return (
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="hidden sm:inline-flex items-center gap-2 h-9 px-3 text-[13px] font-medium text-slate-700 rounded-md transition-colors"
                    style={{ background: "#F3F4F6" }}
                    title={displayName}
                  >
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10.5px] font-semibold text-white"
                      style={{ background: "#0F172A" }}
                    >
                      {(displayName || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <span className="max-w-[180px] truncate">{displayName}</span>
                    <Icon name="chevron-down" size={14} className="text-slate-400 shrink-0" />
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
                      <Link
                        href="/browse"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="block w-full text-left px-3 py-2 text-[13.5px] text-slate-700 hover:bg-slate-100 rounded-md"
                      >
                        Browse
                      </Link>
                      <Link
                        href="/dashboard"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="block w-full text-left px-3 py-2 text-[13.5px] text-slate-700 hover:bg-slate-100 rounded-md"
                      >
                        Dashboard
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={onLogout}
                        disabled={loggingOut}
                        className="block w-full text-left px-3 py-2 text-[13.5px] hover:bg-slate-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ color: "#DC2626" }}
                      >
                        {loggingOut ? "Logging out…" : "Log out"}
                      </button>
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
