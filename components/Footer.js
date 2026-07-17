import Link from "next/link";
import { BookSproutMark } from "./Logo";

export function Footer() {
  return (
    <footer style={{ background: "var(--footer-bg)", padding: "36px 0" }}>
      <div className="max-w-[1200px] mx-auto px-6 flex flex-col items-center gap-1 text-[12.5px]">
        {/* The mark's greens are props (not tokens) here: on the near-black
            footer it needs its own lighter tints to stay legible. */}
        <span className="flex items-center gap-2 text-[19px] leading-none" style={{ fontWeight: 400 }}>
          <BookSproutMark size={22} accent="#2E8B87" sage="#5EA5A1" seam="var(--footer-bg)" className="shrink-0" />
          <span>
            <span style={{ color: "#C7DEDC" }}>Match</span>
            <span style={{ color: "#5EA5A1" }}>Tutor</span>
          </span>
        </span>
        <div className="flex items-center gap-4 mt-2.5">
          <Link href="/terms-of-service" className="footer-link">
            Terms of Service
          </Link>
          <Link href="/privacy-policy" className="footer-link">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
