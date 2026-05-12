"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { Button } from "./ui";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [focused, setFocused] = useState(false);
  const [q, setQ] = useState("");

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

        <div className="hidden md:flex items-center gap-1 ml-auto">
          <NavLink active={isActive("/browse")} href="/browse">Browse</NavLink>
          <NavLink active={isActive("/messages")} href="/messages">
            Messages
            <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10.5px] font-semibold rounded-full bg-slate-900 text-white">2</span>
          </NavLink>
        </div>

        <div className="flex items-center gap-2 md:ml-2 ml-auto">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">Sign Up</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function NavLink({ active, href, children }) {
  return (
    <Link
      href={href}
      className="px-3 h-9 inline-flex items-center text-[13.5px] font-medium rounded-md transition-colors"
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
