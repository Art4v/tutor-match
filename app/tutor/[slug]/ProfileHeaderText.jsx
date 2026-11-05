"use client";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { VerifiedTick } from "@/components/ui";
import { InlineMarkdown } from "@/components/RichText";
import { yearRangeLabel } from "@/lib/yearLevels";

/**
 * The profile header's name block (REDESIGN_DECISIONS.md item 5): full name,
 * verified mark or company, tagline, then plain-text facts. Shared by the
 * public view and the owner editor, which pass the same display shape.
 *
 * Every fact comes from the tutor's own fields and is omitted when empty: no
 * hard-coded delivery modes, no "0 years". The response time is self-reported
 * (a select in the editor, data flag 2), so it is labelled as the tutor's own
 * estimate and carries no status dot.
 */
export function ProfileHeaderText({ tutor, deliveryLabel }) {
  const location = [tutor.suburb, tutor.city].filter(Boolean).join(", ");
  const years = Number(tutor.yearsTutoring);
  const facts = [
    location,
    deliveryLabel,
    Number.isFinite(years) && years > 0 ? `${years} ${years === 1 ? "year" : "years"} tutoring` : null,
    tutor.yearMin != null && tutor.yearMax != null ? yearRangeLabel(tutor.yearMin, tutor.yearMax) : null,
    tutor.languages?.length > 0 ? `Speaks ${tutor.languages.join(", ")}` : null,
  ].filter(Boolean);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold text-[color:var(--text)] break-words">
          {tutor.name}
        </h1>
        {/* A company tutor shows the company's name INSTEAD of the verified
            mark, never as well. The mark is earned by an individual tutor; it
            must not be handed out by association with a company we invited. */}
        {tutor.company ? (
          <Link
            href={`/companies/${tutor.company.slug}`}
            className="inline-flex min-h-6 items-center gap-1 text-[14px] leading-5 font-semibold text-accent hover:text-accent-hover"
            style={{ transition: "color 120ms ease-out" }}
          >
            <Icon name="building" size={16} />
            {tutor.company.name}
          </Link>
        ) : (
          tutor.verified && <VerifiedTick size={20} label />
        )}
      </div>

      {tutor.bio && (
        <p className="mt-1 text-[16px] leading-6 text-[color:var(--text-2)] break-words">
          <InlineMarkdown text={tutor.bio} />
        </p>
      )}

      {facts.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[14px] leading-5 text-[color:var(--text-2)]">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[14px] leading-5 text-[color:var(--text-2)]">
        {/* Reviews of a company tutor belong to the company (0067), so the
            tutor's own (always empty) count would mislead. */}
        {!tutor.company && <RatingLine rating={tutor.rating} count={tutor.reviews} />}
        {tutor.responsive && <span>{tutor.responsive} (tutor&apos;s estimate)</span>}
      </div>
    </div>
  );
}

function RatingLine({ rating, count }) {
  const n = Number(count) || 0;
  const avg = rating == null ? null : Number(rating);
  if (n > 0 && Number.isFinite(avg)) {
    return (
      <a href="#reviews" className="inline-flex min-h-6 items-center gap-1 text-[color:var(--text)] hover:text-accent">
        <Icon name="star" size={16} />
        <span className="font-semibold">{avg.toFixed(1)}</span>
        <span className="text-[color:var(--text-2)]">({n} {n === 1 ? "review" : "reviews"})</span>
      </a>
    );
  }
  return <span>No reviews yet</span>;
}
