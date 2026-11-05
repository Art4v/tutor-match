import { Avatar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { parseRichTextBlocks, RichTextBlock } from "@/components/RichText";
import { Section, SidebarCard, contactColumnClass } from "@/app/tutor/[slug]/ProfileCards";
import { PackageList } from "@/app/tutor/[slug]/RateCard";
import { TutorCard } from "@/components/TutorCard";

// Shared company sections, used by BOTH the public page (server) and the owner
// inline-editing shell (OwnerCompany, client) so the two cannot drift. Same
// arrangement, and same reason, as app/tutor/[slug]/ProfileCards.jsx, and the
// same flat structure as the tutor profile (REDESIGN_DECISIONS.md item 6):
// header, main-column sections divided by rules, a contact column.
//
// These are all server-safe (no hooks, no event handlers) so the public page
// stays a server component.

/**
 * The one contact route a company has. Companies cannot be messaged on
 * MatchTutor: `start_conversation()` only accepts a student caller and a
 * tutor_profiles target, so a company is structurally unmessageable and this
 * button is the deliberate replacement, not a fallback.
 *
 * Renders nothing without a website: better no button than a dead one.
 */
export function EnquireButton({ company, full = true }) {
  if (!company.websiteUrl) return null;
  return (
    <a
      href={company.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex h-11 items-center justify-center rounded border border-accent bg-accent px-6 text-[14px] leading-5 font-semibold text-white hover:border-accent-hover hover:bg-accent-hover ${
        full ? "w-full" : ""
      }`}
      style={{ transition: "background-color 120ms ease-out, border-color 120ms ease-out" }}
    >
      <span className="truncate">Enquire at {company.name}</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * Banner only if the company uploaded one (no strip, no gradient fallback),
 * square logo overlapping its bottom-left edge, then the name block.
 */
export function CompanyHeaderCard({ company }) {
  const location = [company.suburb, company.city].filter(Boolean).join(", ");
  const banner = company.bannerImg || null;
  const n = Number(company.reviewCount) || 0;
  const avg = company.rating == null ? null : Number(company.rating);
  return (
    <header className="border-b border-rule pb-6">
      {banner && (
        <div
          aria-hidden="true"
          className="h-[120px] sm:h-[160px] rounded bg-surface-2"
          style={{ backgroundImage: `url(${banner})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className={banner ? "-mt-12 ml-4 w-fit sm:ml-6" : "w-fit"}>
          <CompanyLogo company={company} size={112} ring={!!banner} />
        </div>
        <div className={`min-w-0 flex-1 ${banner ? "sm:pt-4" : "sm:pt-2"}`}>
          <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold text-[color:var(--text)] break-words">
            {company.name}
          </h1>
          {company.bio && (
            <p className="mt-1 max-w-[680px] text-[16px] leading-6 text-[color:var(--text-2)] break-words">{company.bio}</p>
          )}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] leading-5 text-[color:var(--text-2)]">
            <li>Tutoring company</li>
            {location && <li>{location}</li>}
            <li>
              {n > 0 && Number.isFinite(avg) ? (
                <a href="#reviews" className="inline-flex min-h-6 items-center gap-1 text-[color:var(--text)] hover:text-accent">
                  <Icon name="star" size={16} />
                  <span className="font-semibold">{avg.toFixed(1)}</span>
                  <span className="text-[color:var(--text-2)]">({n} {n === 1 ? "review" : "reviews"})</span>
                </a>
              ) : (
                "No reviews yet"
              )}
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}

/**
 * Company logo: the shared Avatar in its square (4px) form (DESIGN.md §4).
 * Fallback: initials from the company name on the neutral tint. Also called
 * with a bare { logoImg, initial } shape by CompanyTutorsEditor.
 */
export function CompanyLogo({ company, size = 112, ring = false }) {
  return (
    <Avatar
      tutor={{
        avatarImg: company.logoImg || null,
        name: company.name,
        // Initials come from the name when there is one; the stored column is
        // only the fallback for callers that pass no name.
        initial: company.name ? undefined : company.initial,
      }}
      size={size}
      ring={ring}
      shape="square"
    />
  );
}

export function CompanyAboutCard({ company }) {
  const blocks = parseRichTextBlocks(company.bioLong ?? "");
  return (
    <Section id="about" title="About">
      <div className="max-w-[680px] text-[16px] leading-6 text-[color:var(--text)]">
        {blocks.map((b, idx) => (
          <div key={idx} className="mb-4 last:mb-0">
            <RichTextBlock block={b} idx={idx} />
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * The company's contact column: packages only, then Enquire. There is no hourly
 * rate and no "from $X" headline (0069), because a company's packages are
 * rarely hourly and a single headline price would claim a unit nobody set.
 * Nothing is selectable: every price applies to every tutor the company lists.
 */
export function CompanyRateCard({ company, showEnquire = true }) {
  const packages = company.packages ?? [];
  return (
    <div className={contactColumnClass}>
      <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">Packages</h2>
      {packages.length === 0 ? (
        <p className="mt-1 text-[14px] leading-5 text-[color:var(--text-2)]">Contact the company for current pricing.</p>
      ) : (
        <PackageList packages={packages} title={null} className="mt-4" />
      )}

      {showEnquire && company.websiteUrl && (
        <div className="mt-6">
          <EnquireButton company={company} />
        </div>
      )}
    </div>
  );
}

/**
 * The company's tutors, rendered with the SAME <TutorCard> as /browse rather
 * than a bespoke row. A company tutor is an ordinary tutor_profiles row, so it
 * already has every field the card reads (suburb / city arrive via the 0066
 * mirrors; there is no rate since 0069, and `isCompanyTutor` drops the card's
 * per-hour tile), and reusing the card is what stops the company page drifting
 * from the listing a student sees everywhere else.
 *
 * They render as rows in a ruled list, exactly as on /browse (no nested cards).
 *
 * Two props are deliberately off here. `company` is left unset by
 * `companyTutorRowToCard`, so the card falls back to its verified-tick slot and
 * renders nothing there: the company's own chip on every card of the company's
 * own page says nothing. `showSave` is false for the reason the card itself
 * suppresses the bookmark for company tutors (saved_tutors has no "save a
 * company's tutor" story yet).
 *
 * TutorCard is a client component. Importing it does not make this file or the
 * public page a client component; it just marks that subtree.
 *
 * Hidden tutors are filtered here rather than in the query, because the owner
 * editor reuses `listCompanyTutors` and must see them.
 */
export function CompanyTutorsCard({ tutors, companyName }) {
  const visible = (tutors ?? []).filter((t) => t.visibility === "public");
  if (visible.length === 0) return null;
  return (
    <Section
      title="Our tutors"
      subtitle={`${visible.length} ${visible.length === 1 ? "tutor" : "tutors"} at ${companyName}`}
    >
      <ul className="border-t border-rule">
        {visible.map((t) => (
          <li key={t.id} className="border-b border-rule">
            <TutorCard tutor={t} showSave={false} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function CompanyLocationCard({ company }) {
  const location = [company.suburb, company.city].filter(Boolean).join(", ");
  return (
    <SidebarCard title="Location" subtitle={location || "Location not set yet."}>
      {company.websiteUrl && (
        <a
          href={company.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-6 items-center gap-1 text-[14px] leading-5 font-semibold text-accent hover:text-accent-hover"
          style={{ transition: "color 120ms ease-out" }}
        >
          Visit website <Icon name="external" size={16} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </SidebarCard>
  );
}
