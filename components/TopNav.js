"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState("");
  const [user, setUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

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
    router.push("/");
    router.refresh();
  };

  const isActive = (prefix) => pathname === prefix || pathname.startsWith(prefix + "/");

  const submitSearch = () => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    router.push(`/browse${params}`);
  };

  return (
    <div className="sticky top-0 z-30 bg-white" style={{ borderBottom: "1px solid #E5E7EB" }}>
      <div className="max-w-[1400px] mx-auto px-6 h-[60px] flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-white text-[14px]"
            style={{ background: "#0F172A", letterSpacing: "-0.04em" }}
          >tm</div>
          <span className="text-[16px] font-semibold text-slate-900 tracking-tight">tutormatch</span>
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
          <NavLink active={isActive("/browse")} href="/browse" className="hidden md:inline-flex">Browse</NavLink>
          <NavLink active={isActive("/messages")} href="/messages" className="hidden md:inline-flex">
            Messages
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10.5px] font-semibold rounded-full bg-slate-900 text-white">2</span>
          </NavLink>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-2 h-9 px-3 text-[13px] font-medium text-slate-700 rounded-md transition-colors"
                style={{ background: "#F3F4F6" }}
                title={user.email}
              >
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10.5px] font-semibold text-white"
                  style={{ background: "#0F172A" }}
                >
                  {(user.email || "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[180px] truncate">{user.email}</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={onLogout} disabled={loggingOut}>
                {loggingOut ? "Logging out…" : "Log out"}
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
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

function NavLink({ active, href, children, className = "" }) {
  return (
    <Link
      href={href}
      className={`px-3 h-9 items-center text-[13.5px] font-medium rounded-md transition-colors inline-flex ${className}`}
      style={{
        color: active ? "#0F172A" : "#475569",
        background: active ? "#F3F4F6" : "transparent",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#F9FAFB"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </Link>
  );
}
