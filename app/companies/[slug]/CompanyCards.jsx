import { Icon } from "@/components/Icon";
import { parseRichTextBlocks, RichTextBlock } from "@/components/RichText";
import { cardStyle, SidebarCard } from "@/app/tutor/[slug]/ProfileCards";
import { TutorCard } from "@/components/TutorCard";

// Shared company card chrome, used by BOTH the public page (server) and the
// owner inline-editing shell (OwnerCompany, client) so the two cannot drift.
// Same arrangement, and same reason, as app/tutor/[slug]/ProfileCards.jsx.
//
// These are all server-safe (no hooks, no event handlers) so the public page
// stays a server component.

/**
 * The one contact route a company has. Companies cannot be messaged on
 * MatchTutor: `start_conversation()` only accepts a student caller and a
 * tutor_profiles target, so a company is structurally unmessageable and this
 * button is the deliberate replacement, not a fallback.
 *
 * Renders nothing without a website — better no button than a dead one.
 */
export function EnquireButton({ company, full = true }) {
  if (!company.websiteUrl) return null;
  return (
    <a
      href={company.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={
        "inline-flex items-center justify-center gap-1.5 text-[14px] font-medium transition-opacity hover:opacity-90 " +
        (full ? "w-full" : "")
      }
      style={{ background: "var(--accent)", color: "#fff", borderRadius: 999, padding: "12px 22px" }}
    >
      Enquire at {company.name}
      <Icon name="external" size={14} />
    </a>
  );
}

export function CompanyHeaderCard({ company }) {
  const location = [company.suburb, company.city].filter(Boolean).join(", ");
  return (
    <div className="relative bg-[color:var(--paper-card)] overflow-hidden" style={cardStyle}>
      <div
        style={{
          height: 150,
          background: company.bannerImg
            ? `url(${company.bannerImg}) center / cover no-repeat`
            : `linear-gradient(135deg, ${company.bannerBg ?? company.avatarBg ?? "var(--accent-softer)"}, oklch(0.96 0.01 250))`,
        }}
      />
      <div className="px-7 pb-[22px]" style={{ marginTop: -54 }}>
        <CompanyLogo company={company} size={108} ring />
        <h1
          className="text-[34px] leading-none mt-4 break-words"
          style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
        >
          {company.name}
        </h1>
        {company.bio && (
          <p className="text-[15px] mt-2 max-w-[60ch] break-words" style={{ color: "var(--sage)" }}>
            {company.bio}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="building" size={14} /> Tutoring company
          </span>
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="map-pin" size={14} /> {location}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Logo with the same fallback ladder as components/ui.js Avatar (image →
 * colour + initial), but standalone: Avatar reads tutor-shaped keys.
 */
export function CompanyLogo({ company, size = 108, ring = false }) {
  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: company.logoImg
          ? `url(${company.logoImg}) center / cover no-repeat`
          : company.avatarBg ?? "var(--accent-softer)",
        border: ring ? "4px solid var(--paper-card)" : undefined,
        color: "var(--accent)",
        fontSize: size * 0.38,
        fontWeight: 300,
      }}
      aria-hidden={!!company.logoImg}
    >
      {!company.logoImg && (company.initial ?? "?")}
    </span>
  );
}

export function CompanyAboutCard({ company }) {
  const blocks = parseRichTextBlocks(company.bioLong ?? "");
  return (
    <section id="about" className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "20px 24px" }}>
      <h2 className="text-[22px] font-light text-slate-800 tracking-tight mb-4">About</h2>
      <div className="text-[15.5px] leading-[1.72] max-w-[70ch]" style={{ color: "var(--ink)" }}>
        {blocks.map((b, idx) => (
          <div key={idx} className="mb-3 last:mb-0">
            <RichTextBlock block={b} idx={idx} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The company's one rate card. Deliberately NOT interactive the way the tutor
 * RateCard is (which tracks a selected package): there is nothing to select
 * here, since every price applies to every tutor the company lists.
 */
export function CompanyRateCard({ company, showEnquire = true }) {
  const packages = company.packages ?? [];
  return (
    <div className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "18px 20px" }}>
      {company.fromPrice != null ? (
        <>
          <div className="flex items-baseline gap-1">
            <span className="text-[16px]" style={{ color: "var(--sage)" }}>from</span>
            <span
              className="text-[40px] font-light tabular-nums"
              style={{ color: "var(--ink-graphite-deep)", letterSpacing: "-0.02em" }}
            >
              ${company.fromPrice}
            </span>
          </div>
          <div className="text-[13.5px] mt-1" style={{ color: "var(--sage)" }}>
            Set by the company, the same for every tutor here.
          </div>
        </>
      ) : (
        <div className="text-[13.5px]" style={{ color: "var(--sage)" }}>
          Contact the company for current pricing.
        </div>
      )}

      {packages.length > 0 && (
        <div className="flex flex-col gap-[10px] mt-5">
          {packages.map((p, i) => (
            <div
              key={i}
              className="w-full flex items-center justify-between px-4 py-3.5"
              style={{
                border: "1px solid var(--accent-line)",
                borderRadius: 11,
                background: "var(--accent-softer)",
                color: "var(--ink-graphite)",
              }}
            >
              <span className="text-[14px] font-medium">{p.label}</span>
              <span className="text-[14px] font-medium tabular-nums">${p.price}</span>
            </div>
          ))}
        </div>
      )}

      {showEnquire && company.websiteUrl && (
        <div className="mt-5">
          <EnquireButton company={company} />
        </div>
      )}
    </div>
  );
}

/**
 * The company's tutors, rendered with the SAME <TutorCard> as /browse rather
 * than a bespoke row. A company tutor is an ordinary tutor_profiles row, so it
 * already has every field the card reads (rate / suburb / city arrive via the
 * 0066 mirrors), and reusing the card is what stops the company page drifting
 * from the listing a student sees everywhere else.
 *
 * `compact` is what keeps the section the size it was before the card moved in
 * here: it pins TutorCard to the phone composition (80px avatar, 88px rail, no
 * "View full profile") at every width, because this card is nested one level
 * deep inside another and the browse size dwarfs its container.
 *
 * Two more props are deliberately off here. `company` is left unset by
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
    <section className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "20px 24px" }}>
      <h2 className="text-[22px] font-light text-slate-800 tracking-tight">Our tutors</h2>
      <p className="text-[13px] text-slate-500 mt-0.5 mb-4">
        {visible.length} {visible.length === 1 ? "tutor" : "tutors"} at {companyName}.
      </p>
      <div className="flex flex-col gap-3">
        {visible.map((t) => (
          <TutorCard key={t.id} tutor={t} compact showSave={false} />
        ))}
      </div>
    </section>
  );
}

export function CompanyLocationCard({ company }) {
  const location = [company.suburb, company.city].filter(Boolean).join(", ");
  return (
    <SidebarCard title="Where we are" subtitle={location || "Location not set yet."}>
      {company.websiteUrl && (
        <a
          href={company.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] mt-3"
          style={{ color: "var(--accent)" }}
        >
          Visit website <Icon name="external" size={13} />
        </a>
      )}
    </SidebarCard>
  );
}
