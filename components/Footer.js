import Link from "next/link";
import { BookSproutMark } from "./Logo";

export function Footer() {
  return (
    <footer className="py-5" style={{ borderTop: "1px solid var(--line)", background: "var(--paper)" }}>
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col items-center gap-1 text-[11.5px] text-slate-400">
        <span className="flex items-center gap-1.5 font-hand text-[19px] leading-none" style={{ fontWeight: 700 }}>
          <BookSproutMark size={20} className="shrink-0" />
          <span style={{ color: "var(--ink-graphite)" }}>match</span>
          <span style={{ color: "var(--accent)" }}>tutor</span>
        </span>
        <div className="flex items-center gap-4 mt-1.5">
          <Link href="/terms-of-service" className="accent-link--glow transition-colors hover:text-[color:var(--ink-muted)]">
            Terms of Service
          </Link>
          <Link href="/privacy-policy" className="accent-link--glow transition-colors hover:text-[color:var(--ink-muted)]">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
