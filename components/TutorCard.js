"use client";
import Link from "next/link";
import { Icon } from "./Icon";
import { Avatar, VerifiedTick, shortName } from "./ui";
import { SaveTutorButton } from "./SaveTutorButton";
import { subjectLabel } from "@/lib/subjects";
import { stripMarkdown } from "@/lib/richText";
import { yearRangeLabel } from "@/lib/yearLevels";

// The tutor row (DESIGN.md §6, REDESIGN_DECISIONS.md item 4). Kept under the old
// `TutorCard` name so every list (browse, home, /tutors pages, a company's
// tutors, related tutors) switches with no import changes. It is a ROW, not a
// card: no box, no shadow. The LIST draws the 1px rules between rows (wrap rows
// in `divide-y divide-rule` or a bordered <ul>), so a row never carries its own.
//
// Layout: photo | details | rate. Below 640px the rate moves onto the name line
// and the photo shrinks to 56px. The whole row is one link to the profile; the
// bookmark sits outside the link (a button inside an <a> is invalid HTML).
//
// Props kept from the card for call-site compatibility: `showSave`, `tabIndex`,
// `showVerifiedLabel`. `compact` is accepted and ignored (a row works at every
// width).

const MAX_SUBJECTS = 4;

/** "ATAR 99.15" for the ATAR credential; any other credential reads as written. */
function credentialText(c) {
  if (!c?.label) return null;
  const label = String(c.label).trim();
  return c.icon === "atar" ? `ATAR ${label}` : label;
}

/** DESIGN.md rate rule: a missing or $0 rate reads "Rate not listed". */
function RateBlock({ tutor, align = "right" }) {
  if (tutor.isCompanyTutor || tutor.company) {
    return <span className="text-[14px] leading-5 text-[color:var(--muted)]">Priced by package</span>;
  }
  const rate = Number(tutor.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return <span className="text-[14px] leading-5 text-[color:var(--muted)]">Rate not listed</span>;
  }
  return (
    <span className={`inline-flex items-baseline gap-1 ${align === "right" ? "justify-end" : ""}`}>
      <span className="text-[20px] leading-7 font-semibold text-[color:var(--text)] tabular-nums">${rate}</span>
      <span className="text-[12px] leading-4 text-[color:var(--muted)]">per hour</span>
    </span>
  );
}

function ReviewsLine({ tutor }) {
  const n = Number(tutor.reviews) || 0;
  if (n > 0 && tutor.rating != null) {
    return (
      <span className="inline-flex items-center gap-1">
        <Icon name="star" size={12} />
        {Number(tutor.rating).toFixed(1)} ({n} {n === 1 ? "review" : "reviews"})
      </span>
    );
  }
  return <span>No reviews yet</span>;
}

export function TutorCard({ tutor, showSave = true, tabIndex = 0, showVerifiedLabel = true }) {
  const company = tutor.company ?? null;
  const credentials = (tutor.credentials || []).map(credentialText).filter(Boolean).slice(0, 2);
  const subjects = (tutor.subjects || []).filter((s) => s?.name);
  const shown = subjects.slice(0, MAX_SUBJECTS).map(subjectLabel);
  const more = subjects.length - shown.length;

  const tagline = stripMarkdown(tutor.bio || "").trim();
  const bio = stripMarkdown(tutor.bioLong || "").trim();
  const school = tutor.highSchool || tutor.university || "";
  const place = [tutor.suburb, tutor.city].filter(Boolean).join(", ");
  const schoolPlace = [school, place].filter(Boolean).join(" · ");

  const years =
    tutor.yearMin != null && tutor.yearMax != null ? yearRangeLabel(tutor.yearMin, tutor.yearMax) : "";
  const modes = [
    tutor.deliversInPerson && tutor.suburb ? `In person near ${tutor.suburb}` : tutor.deliversInPerson ? "In person" : null,
    tutor.deliversOnline ? "Online" : null,
  ].filter(Boolean);
  const fit = [years, ...modes].filter(Boolean).join(" · ");

  const save = showSave && !company;

  return (
    <div className="relative">
      {save && <SaveTutorButton tutorId={tutor.id} variant="card" className="top-4 right-0 z-10" tabIndex={tabIndex} />}
      <Link
        href={`/tutor/${tutor.slug}`}
        tabIndex={tabIndex}
        className="group grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[72px_minmax(0,1fr)_auto] gap-x-4 py-4"
      >
        <span className="sm:hidden">
          <Avatar tutor={tutor} size={56} />
        </span>
        <span className="hidden sm:block">
          <Avatar tutor={tutor} size={72} />
        </span>

        <span className={`min-w-0 flex flex-col gap-1 ${save ? "pr-12 sm:pr-0" : ""}`}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[16px] leading-6 font-semibold text-[color:var(--text)] group-hover:text-accent">
              {shortName(tutor.name)}
            </span>
            {company ? (
              <span className="inline-flex items-center gap-1 text-[12px] leading-4 text-[color:var(--text-2)]">
                <Icon name="building" size={12} />
                {company.name}
              </span>
            ) : (
              tutor.verified && <VerifiedTick size={14} label={showVerifiedLabel} />
            )}
            <span className="sm:hidden ml-auto">
              <RateBlock tutor={tutor} align="left" />
            </span>
          </span>

          {tagline && (
            <span className="text-[14px] leading-5 text-[color:var(--text)] line-clamp-1 [overflow-wrap:anywhere]">
              {tagline}
            </span>
          )}

          {credentials.length > 0 && (
            <span className="text-[14px] leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]">
              {credentials.join(" · ")}
            </span>
          )}

          {fit && <span className="text-[14px] leading-5 text-[color:var(--text-2)]">{fit}</span>}

          {bio && (
            <span className="text-[14px] leading-5 text-[color:var(--text-2)] line-clamp-2 [overflow-wrap:anywhere]">
              {bio}
            </span>
          )}

          {shown.length > 0 && (
            <span className="text-[14px] leading-5 text-[color:var(--text-2)]">
              {shown.join(", ")}
              {more > 0 && <span className="text-[color:var(--muted)]">{`, +${more} more`}</span>}
            </span>
          )}

          <span className="flex flex-wrap gap-x-2 text-[12px] leading-4 text-[color:var(--muted)]">
            {schoolPlace && <span>{schoolPlace}</span>}
            {schoolPlace && <span aria-hidden="true">·</span>}
            <ReviewsLine tutor={tutor} />
          </span>
        </span>

        <span className="hidden sm:flex flex-col items-end text-right pl-4 pt-14 min-w-[120px]">
          <RateBlock tutor={tutor} />
        </span>
      </Link>
    </div>
  );
}

export default TutorCard;
