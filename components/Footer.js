import Link from "next/link";
import { Wordmark } from "./Logo";
import { ReportBugLink } from "./ReportBugLink";

// The site footer (DESIGN.md §6, REDESIGN_DECISIONS.md item 2): one light row
// with a top rule. "Become a tutor" is the site-wide tutor call to action, shown
// to logged-out visitors only (`showBecomeTutor`, decided by SiteFooter).
const LINK = "inline-flex min-h-6 items-center text-[14px] leading-5 text-[color:var(--text-2)] hover:text-[color:var(--text)]";

export function Footer({ showBecomeTutor = false }) {
  return (
    <footer className="border-t border-rule bg-surface">
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 py-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/" aria-label="MatchTutor home" className="inline-flex items-center">
          <Wordmark className="text-[16px]" />
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {showBecomeTutor && (
            <Link href="/signup" className={LINK}>
              Become a tutor
            </Link>
          )}
          <Link href="/companies" className={LINK}>
            Companies
          </Link>
          <Link href="/blog" className={LINK}>
            Blog
          </Link>
          <Link href="/terms-of-service" className={LINK}>
            Terms of Service
          </Link>
          <Link href="/privacy-policy" className={LINK}>
            Privacy Policy
          </Link>
          <ReportBugLink className={LINK} />
        </nav>
        <span className="text-[12px] leading-4 text-[color:var(--muted)] sm:ml-auto">
          © {new Date().getFullYear()} MatchTutor
        </span>
      </div>
    </footer>
  );
}
