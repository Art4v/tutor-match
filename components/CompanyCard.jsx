import Link from "next/link";
import { Icon } from "./Icon";
import { TutorCard } from "./TutorCard";
import { StatTile } from "./StatTile";
import { CompanyLogo } from "@/app/companies/[slug]/CompanyCards";
import { stripMarkdown } from "@/lib/richText";
import { cardStyle } from "@/app/tutor/[slug]/ProfileCards";

// A tutoring company in the /companies feed. Deliberately the SAME geometry as
// components/TutorCard.js: the two feeds sit one click apart, and a company that
// renders at a different scale reads as a different kind of object. The header
// band (logo · text · stat rail) is TutorCard's composition with the slots
// remapped; the difference is what sits under it.
//
// THE ROSTER BAND SPANS THE FULL CARD WIDTH, INCLUDING UNDER THE RAIL. That is
// the one intentional departure. TutorCard's subject strip lives INSIDE its
// left column, so it stops at the rail divider; this band is a sibling of the
// whole header band, one level up, so its top border crosses the rail too and
// the rail's border-l runs the header band's height only. That contrast is the
// point: the stats describe the company, the band describes its people.
//
// The card is NOT a single <a>. Each tutor card below links to /tutor/[slug]
// and anchors cannot nest, so the company link is the header band only (a <Link>
// wrapping body + rail, exactly as TutorCard does) and the roster sits outside
// it as a sibling. Do NOT "fix" that with an absolutely positioned overlay link
// across the card: it would cover the tutor cards and swallow their clicks.
//
// The roster renders the REAL <TutorCard compact>, the same component and the
// same mode app/companies/[slug]/CompanyCards.jsx uses under "Our tutors", so a
// tutor reads identically in the feed and on the company's page. `compact` is
// what keeps a nested card from carrying the same weight as the company card
// enclosing it: it pins TutorCard to its phone composition at every width.
//
// Sizes, phone -> md. Literal classes at the point of use, never interpolated —
// Tailwind's JIT scans source statically and can't see a class built from a
// variable.
//   header band   min-h-[140px]  md:min-h-[200px]
//   rail width    w-[88px]       md:w-[210px]
//   logo          80             132   (a size prop, see the two-logo note)
//
// Three things here are load-bearing rather than aesthetic:
//
// The roster is CAPPED (lib/supabase/companies.js PREVIEW_TUTOR_LIMIT) with a
// "View all N" link for the rest. A compact card is about 190px tall, so an
// uncapped roster would let one large company fill the feed on its own, and the
// company's own page already lists every tutor.
//
// overflow:hidden on the outer element is what clips the roster band to the
// card's 14px bottom corners.
//
// A company with no public tutors drops the band entirely and the card ends at
// the header band, the same way TutorCard drops its subject strip for a tutor
// with no subjects. listCompanies already sorts tutor-having companies first, so
// those land at the end of the feed.
//
// This is a SERVER component rendering client leaves (<StatTile>, <TutorCard>),
// which is exactly what CompanyCards.jsx does on the company page. The cost is
// that the preview tutors cross into the RSC payload; the cap is what bounds
// it.
export function CompanyCard({ company }) {
  const tagline = stripMarkdown(company.bio).trim();
  const longBio = stripMarkdown(company.bioLong).trim();
  const location = [company.suburb, company.city].filter(Boolean).join(" · ");
  const tutors = company.previewTutors ?? [];
  const extra = Math.max(0, (company.tutorCount ?? 0) - tutors.length);

  // Top tile: the company's rating, or its roster size until it has reviews.
  // Most companies launch with none, and an empty RATING tile would be the first
  // thing a visitor read. `muted` on the empty branch mirrors TutorCard, which
  // mutes the tile for a tutor with no credentials.
  const rated = company.rating != null;
  const topValue = rated ? company.rating.toFixed(1) : String(company.tutorCount ?? 0);
  const topLabel = rated ? "Rating" : "Tutors";
  const topTone = rated || (company.tutorCount ?? 0) > 0 ? "accent" : "muted";

  return (
    <article
      style={{
        ...cardStyle,
        position: "relative",
        backgroundColor: "var(--paper-card)",
        overflow: "hidden",
      }}
    >
      {/* HEADER BAND — the company link. Everything inside it is inert, so
          there's no nested anchor. */}
      <Link href={`/companies/${company.slug}`} className="flex overflow-hidden">
        <div className="flex-1 min-w-0 flex items-stretch gap-3 md:gap-5 p-3 md:p-5 min-h-[140px] md:min-h-[200px]">
          {/* Logo rendered TWICE at two sizes. CompanyLogo writes its width,
              height and font size inline from a numeric prop and takes no
              className, exactly like Avatar, so Tailwind can't resize it. The
              hidden copy costs one DOM node and no request: the logo is a CSS
              background, and a display:none element doesn't fetch one. */}
          <div className="shrink-0 flex items-center md:hidden">
            <CompanyLogo company={company} size={80} />
          </div>
          <div className="shrink-0 hidden md:flex items-center">
            <CompanyLogo company={company} size={132} />
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {/* No bookmark on a company card, so none of these rows carry
                TutorCard's pr-12 clearance. */}
            <span
              className="truncate leading-tight text-[15px] md:text-[20px]"
              style={{ fontWeight: 300, letterSpacing: "-0.02em", color: "var(--ink-graphite)" }}
            >
              {company.name}
            </span>

            {/* Each block renders only when it has content and none reserves
                height, so a company missing a bio doesn't leave a gap. */}
            {tagline && (
              <div
                className="max-w-full leading-[1.3] mt-0.5 md:mt-1 text-[11.5px] md:text-[14px]"
                style={{
                  fontWeight: 500,
                  color: "var(--accent)",
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  overflowWrap: "anywhere",
                }}
              >
                {tagline}
              </div>
            )}

            {/* overflowWrap: anywhere is what makes the clamp hold against an
                unbroken run of characters, which would otherwise widen the card
                and its grid track rather than wrapping. Same guard, and the
                same reasoning, as TutorCard's long bio. */}
            {longBio && (
              <div
                className="leading-[1.5] mt-1 md:mt-1.5 text-[10.5px] md:text-[12.5px]"
                style={{
                  color: "var(--ink-muted)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  overflowWrap: "anywhere",
                }}
              >
                {longBio}
              </div>
            )}

            {location && (
              <div
                className="max-w-full truncate mt-1 md:mt-1.5 text-[10px] md:text-[12px]"
                style={{ color: "var(--sage)" }}
              >
                {location}
              </div>
            )}
          </div>
        </div>

        {/* RAIL — a direct child of the Link, so its divider runs the full
            height of the header band. */}
        <div className="shrink-0 flex flex-col justify-center border-l border-[color:var(--line)] gap-1.5 md:gap-2.5 p-2 md:p-5 w-[88px] md:w-[210px]">
          <div className="grid grid-cols-1 gap-1.5 md:gap-2.5">
            <StatTile value={topValue} label={topLabel} tone={topTone} />
            {/* A company with no rate card yet says "Ask", not a dash: the dash
                reads as a rendering failure, and the brand's copy rule bars the
                em dash from anything a visitor sees. */}
            <StatTile
              value={company.fromPrice != null ? `$${company.fromPrice}` : "Ask"}
              label={company.fromPrice != null ? "from" : "for pricing"}
              tone={company.fromPrice != null ? "ink" : "muted"}
            />
          </div>

          {/* Visual only: the band is already the link, and a nested <a> would
              be invalid. Desktop only, like TutorCard's, because the 88px phone
              rail can't carry the label without wrapping. */}
          <span
            className="w-full hidden md:inline-flex items-center justify-center gap-1.5 font-medium text-white text-[13px] px-[14px] py-[10px]"
            style={{ background: "var(--ink-graphite)", borderRadius: 11 }}
          >
            View company
            <Icon name="arrow-right" size={14} className="shrink-0" />
          </span>
        </div>
      </Link>

      {/* ROSTER — a sibling of the link, spanning the full card width. Dropped
          entirely when the company lists nobody, rather than leaving an empty
          tinted band. */}
      {tutors.length > 0 && (
        <div
          className="px-3 md:px-5 pt-2.5 pb-3 md:pb-4"
          style={{ borderTop: "1px solid var(--line)", background: "var(--desk)" }}
        >
          <div
            className="font-medium uppercase text-[9px] md:text-[10px]"
            style={{ letterSpacing: "0.06em", color: "var(--sage)" }}
          >
            Tutors
          </div>
          {/* The real card, in the same `compact` mode CompanyTutorsCard uses on
              the company's own page, so a tutor reads identically in both places.
              Each one is its own <a>, which is why this whole band sits OUTSIDE
              the company link above. */}
          <div className="mt-2 flex flex-col gap-3">
            {tutors.map((t) => (
              <TutorCard key={t.id} tutor={t} compact showSave={false} />
            ))}
          </div>

          {extra > 0 && (
            <Link
              href={`/companies/${company.slug}`}
              className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-medium"
              style={{ color: "var(--accent)" }}
            >
              View all {company.tutorCount} tutors
              <Icon name="arrow-right" size={14} className="shrink-0" />
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
