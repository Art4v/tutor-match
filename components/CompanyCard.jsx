import Link from "next/link";
import { Icon } from "./Icon";
import { CompanyLogo } from "@/app/centres/[slug]/CompanyCards";
import { stripMarkdown } from "@/lib/richText";
import { subjectLabel } from "@/lib/subjects";

// A tutoring company in the /centres feed, as a ROW (the same pattern as
// components/TutorRow.jsx): logo | details | "View centre". No box of its own;
// the list draws the rules between rows (app/centres/CompaniesFeed.jsx).
//
// Differences from the tutor row:
//   - a square 4px logo (people are circles, companies are squares)
//   - "Suburb, STATE · N tutors", the company's subjects and up to two
//     packages instead of credentials and an hourly rate (a company prices by
//     package only, 0069)
//   - the right column is a "View centre" label instead of a rate; below
//     640px it hides and the whole row is the link anyway
//
// The whole row is one link to the company page. A company's subjects are
// DERIVED from its tutors, never stored: listCompanies loads up to three
// preview tutors per company, so the row shows those tutors' subjects.
//
// Server component: it renders no client leaves any more.

const MAX_SUBJECTS = 4;
const MAX_PACKAGES = 2;

function formatPrice(price) {
  const n = Number(price);
  return Number.isFinite(n) ? `$${n}` : null;
}

export function CompanyCard({ company }) {
  const tagline = stripMarkdown(company.bio || "").trim();
  const place = [company.suburb, company.city].filter(Boolean).join(", ");
  const count = company.tutorCount ?? 0;
  const tutorsText = `${count} ${count === 1 ? "tutor" : "tutors"}`;
  const placeLine = [place, tutorsText].filter(Boolean).join(" · ");

  // Unique subjects across the preview tutors, in the order they appear.
  const seen = new Set();
  const subjects = [];
  for (const t of company.previewTutors ?? []) {
    for (const s of t.subjects ?? []) {
      const key = s?.slug || s?.name;
      if (key && !seen.has(key)) {
        seen.add(key);
        subjects.push(s);
      }
    }
  }
  const shownSubjects = subjects.slice(0, MAX_SUBJECTS).map(subjectLabel);
  const moreSubjects = subjects.length - shownSubjects.length;

  const packages = (company.packages ?? [])
    .map((p) => {
      const price = formatPrice(p.price);
      return p.label && price ? `${p.label} ${price}` : null;
    })
    .filter(Boolean);
  const shownPackages = packages.slice(0, MAX_PACKAGES);
  const morePackages = packages.length - shownPackages.length;

  const reviews = Number(company.reviewCount) || 0;

  return (
    <Link
      href={`/centres/${company.slug}`}
      className="group grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[72px_minmax(0,1fr)_auto] gap-x-4 py-4"
    >
      <span className="sm:hidden">
        <CompanyLogo company={company} size={56} radius={4} />
      </span>
      <span className="hidden sm:block">
        <CompanyLogo company={company} size={72} radius={4} />
      </span>

      <span className="min-w-0 flex flex-col gap-1">
        <span className="text-[16px] leading-6 font-medium text-[color:var(--ink-graphite)] group-hover:text-[color:var(--accent)] transition-colors [overflow-wrap:anywhere]">
          {company.name}
        </span>
        {tagline && (
          <span className="text-[14px] leading-5 text-[color:var(--ink-graphite)] line-clamp-1 [overflow-wrap:anywhere]">
            {tagline}
          </span>
        )}
        <span className="text-[14px] leading-5 text-[color:var(--ink-muted)]">{placeLine}</span>
        {shownSubjects.length > 0 && (
          <span className="text-[14px] leading-5 text-[color:var(--ink-muted)] line-clamp-1 [overflow-wrap:anywhere]">
            {shownSubjects.join(", ")}
            {moreSubjects > 0 && <span className="text-[color:var(--sage)]">{`, +${moreSubjects} more`}</span>}
          </span>
        )}
        {shownPackages.length > 0 && (
          <span className="text-[14px] leading-5 text-[color:var(--ink-muted)] line-clamp-1 [overflow-wrap:anywhere]">
            {shownPackages.join(" · ")}
            {morePackages > 0 && <span className="text-[color:var(--sage)]">{`, +${morePackages} more`}</span>}
          </span>
        )}
        <span className="text-[12px] leading-4 text-[color:var(--sage)]">
          {reviews > 0 && company.rating != null ? (
            <span className="inline-flex items-center gap-1">
              <Icon name="star" size={12} />
              {company.rating.toFixed(1)} ({reviews} {reviews === 1 ? "review" : "reviews"})
            </span>
          ) : (
            "No reviews yet"
          )}
        </span>
      </span>

      {/* Visual only: the whole row is already the link. */}
      <span className="hidden sm:flex items-start pl-4 pt-1 min-w-[120px] justify-end">
        <span className="inline-flex items-center gap-1 text-[14px] font-medium text-[color:var(--accent)] whitespace-nowrap">
          View centre
          <Icon name="chevron-right" size={14} className="shrink-0" />
        </span>
      </span>
    </Link>
  );
}

export default CompanyCard;
