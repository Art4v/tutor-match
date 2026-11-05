import Link from "next/link";
import { Icon } from "./Icon";
import { Avatar } from "./ui";
import { stripMarkdown } from "@/lib/richText";
import { subjectLabel } from "@/lib/subjects";

// A tutoring company in the /companies directory (DESIGN.md "Company row",
// REDESIGN_DECISIONS.md item 6). Kept under the old `CompanyCard` name so the
// import does not move. It is the tutor ROW (components/TutorCard.js) with a
// square logo: no box, no shadow, no stat tiles. The LIST draws the 1px rules
// between rows, so a row never carries its own.
//
// Layout: logo | details | view link. Below 640px the view link drops and the
// logo shrinks to 56px; the whole row is one link to the company page either
// way.
//
// Subjects come from the company's tutors, never from a stored list (see
// CLAUDE.md "Companies"). listCompanies only carries its preview tutors, so the
// subjects shown are the ones those tutors teach.

const MAX_SUBJECTS = 4;
const MAX_PACKAGES = 2;

function companySubjects(tutors) {
  const seen = new Set();
  const out = [];
  for (const t of tutors) {
    for (const s of t.subjects ?? []) {
      const key = s?.slug || s?.name;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

function packagesSummary(packages) {
  const list = (packages ?? []).filter((p) => p?.label);
  if (list.length === 0) return "";
  const shown = list
    .slice(0, MAX_PACKAGES)
    .map((p) => (p.price != null && p.price !== "" ? `${p.label} $${p.price}` : p.label));
  const more = list.length - shown.length;
  return shown.join(" · ") + (more > 0 ? `, +${more} more` : "");
}

function ReviewsLine({ company }) {
  const n = Number(company.reviewCount) || 0;
  if (n > 0 && company.rating != null) {
    return (
      <span className="inline-flex items-center gap-1">
        <Icon name="star" size={12} />
        {Number(company.rating).toFixed(1)} ({n} {n === 1 ? "review" : "reviews"})
      </span>
    );
  }
  return <span>No reviews yet</span>;
}

export function CompanyCard({ company }) {
  const tagline = stripMarkdown(company.bio || "").trim();
  const location = [company.suburb, company.city].filter(Boolean).join(", ");
  const tutorCount = company.tutorCount ?? 0;
  const tutorsText = `${tutorCount} ${tutorCount === 1 ? "tutor" : "tutors"}`;

  const subjects = companySubjects(company.previewTutors ?? []);
  const shown = subjects.slice(0, MAX_SUBJECTS).map(subjectLabel);
  const moreSubjects = subjects.length - shown.length;

  const packages = packagesSummary(company.packages);
  // Avatar reads `avatarImg` / `name`, so the logo maps onto those.
  const logo = { avatarImg: company.logoImg ?? null, name: company.name };

  return (
    <Link
      href={`/companies/${company.slug}`}
      className="group grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[72px_minmax(0,1fr)_auto] gap-x-4 py-4"
    >
      <span className="sm:hidden">
        <Avatar tutor={logo} size={56} shape="square" />
      </span>
      <span className="hidden sm:block">
        <Avatar tutor={logo} size={72} shape="square" />
      </span>

      <span className="min-w-0 flex flex-col gap-1">
        <span className="text-[16px] leading-6 font-semibold text-[color:var(--text)] group-hover:text-accent [overflow-wrap:anywhere]">
          {company.name}
        </span>

        {tagline && (
          <span className="text-[14px] leading-5 text-[color:var(--text)] line-clamp-1 [overflow-wrap:anywhere]">
            {tagline}
          </span>
        )}

        <span className="text-[14px] leading-5 text-[color:var(--text-2)]">
          {[location, tutorsText].filter(Boolean).join(" · ")}
        </span>

        {shown.length > 0 && (
          <span className="text-[14px] leading-5 text-[color:var(--text-2)]">
            {shown.join(", ")}
            {moreSubjects > 0 && <span className="text-muted">{`, +${moreSubjects} more`}</span>}
          </span>
        )}

        {packages && (
          <span className="text-[14px] leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]">
            {packages}
          </span>
        )}

        <span className="text-[12px] leading-4 text-muted">
          <ReviewsLine company={company} />
        </span>
      </span>

      <span className="hidden sm:flex items-start pl-4 pt-1">
        <span className="inline-flex items-center gap-1 min-h-6 text-[14px] leading-5 font-semibold text-accent group-hover:text-accent-hover whitespace-nowrap">
          View company
          <Icon name="chevron-right" size={16} />
        </span>
      </span>
    </Link>
  );
}
