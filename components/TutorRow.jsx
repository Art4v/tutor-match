"use client";
import Link from "next/link";
import { Icon } from "./Icon";
import { Avatar, VerifiedTick, shortName } from "./ui";
import { SaveTutorButton } from "./SaveTutorButton";
import { subjectLabel } from "@/lib/subjects";
import { stripMarkdown } from "@/lib/richText";

// The tutor ROW, which replaced the old card grid. It has no box of
// its own: no border, background, radius or shadow. The LIST draws the 1px
// rules between rows, so a row can be dropped into any list:
//
//   <ul className="border-t border-[color:var(--paper-line)]">
//     <li className="border-b border-[color:var(--paper-line)]"><TutorRow tutor={t} /></li>
//   </ul>
//
// Every colour is a token, never a hex value, so a parent can retheme the row
// by redefining the tokens (an inverse band needs no prop).
//
// Variants:
//   full     photo | details | rate. Name, tick or company, tagline, two
//            credentials, two-line bio, subjects, school / place / reviews.
//            Below 640px the rate moves onto the name line.
//   feature  the home marquee (components/FeaturedTutors.jsx). The original
//            card's content as text, sized to fill a fixed-height lane. No
//            bookmark.
//
// The whole row is one link. The bookmark sits OUTSIDE it (a button inside an
// <a> is invalid HTML). Hover changes the name colour only.

const MAX_SUBJECTS = 4;

/** "ATAR 99.15" for the ATAR credential; any other credential reads as written. */
function credentialText(c) {
  if (!c?.label) return null;
  const label = String(c.label).trim();
  if (!label) return null;
  return c.icon === "atar" ? `ATAR ${label}` : label;
}

/** The row always answers "how much?". Company tutors have no hourly rate (0069). */
function RateBlock({ tutor, align = "right" }) {
  if (tutor.isCompanyTutor || tutor.company) {
    return <span className="text-[14px] leading-5 text-[color:var(--sage)] whitespace-nowrap">Priced by package</span>;
  }
  const rate = Number(tutor.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return <span className="text-[14px] leading-5 text-[color:var(--sage)] whitespace-nowrap">Rate not listed</span>;
  }
  return (
    <span
      className={`inline-flex flex-col leading-none ${align === "right" ? "items-end" : "items-start"}`}
    >
      <span className="text-[20px] leading-7 font-medium text-[color:var(--ink-graphite)] tabular-nums">${rate}</span>
      <span className="text-[12px] leading-4 text-[color:var(--sage)] whitespace-nowrap">per hour</span>
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

function NameLine({ tutor, company, showVerifiedLabel, children }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
      <span className="text-[16px] leading-6 font-medium text-[color:var(--ink-graphite)] group-hover:text-[color:var(--accent)] transition-colors truncate">
        {shortName(tutor.name)}
      </span>
      {/* Company name INSTEAD of the tick, never both: the tick is earned by an
          individual tutor, not granted by association. */}
      {company ? (
        <span className="inline-flex items-center gap-1 text-[12px] leading-4 text-[color:var(--ink-muted)] min-w-0">
          <Icon name="building" size={12} className="shrink-0" />
          <span className="truncate max-w-[180px]">{company.name}</span>
        </span>
      ) : (
        // The script label hides below sm, where it would push the rate off
        // the name line; the tick itself stays.
        tutor.verified && <VerifiedTick size={15} label={showVerifiedLabel} labelClassName="hidden sm:inline" />
      )}
      {children}
    </span>
  );
}

export function TutorRow({
  tutor,
  variant = "full",
  showSave = true,
  tabIndex = 0,
  showVerifiedLabel = true,
}) {
  const company = tutor.company ?? null;
  const credentials = (tutor.credentials || []).map(credentialText).filter(Boolean).slice(0, 2);
  const subjects = (tutor.subjects || []).filter((s) => s?.name);
  const shown = subjects.slice(0, MAX_SUBJECTS).map(subjectLabel);
  const more = subjects.length - shown.length;

  const tagline = stripMarkdown(tutor.bio || "").trim();
  const bio = stripMarkdown(tutor.bioLong || "").trim();

  const subjectsLine = shown.length > 0 && (
    <span className="text-[14px] leading-5 text-[color:var(--accent)] line-clamp-1 [overflow-wrap:anywhere]">
      {shown.join(", ")}
      {more > 0 && <span className="text-[color:var(--sage)]">{`, +${more} more`}</span>}
    </span>
  );
  const taglineLine = tagline && (
    <span className="text-[14px] leading-5 text-[color:var(--ink-graphite)] line-clamp-1 [overflow-wrap:anywhere]">
      {tagline}
    </span>
  );
  const credentialsLine = credentials.length > 0 && (
    <span className="text-[14px] leading-5 text-[color:var(--ink-muted)] line-clamp-1 [overflow-wrap:anywhere]">
      {credentials.join(" · ")}
    </span>
  );

  if (variant === "feature") {
    // Home marquee (components/FeaturedTutors.jsx). The original card's content
    // as text. Left: name + tick, tagline, credentials, two-line bio, school.
    // Right, from md: the rate, then subjects (+N more) and location, then
    // "View full profile". Below md the right column is too narrow for those
    // lines, so the left keeps "school · location" and subjects are dropped (as
    // the original phone card did). Fills a FIXED-height lane (heights noted in
    // FeaturedTutors.jsx). A missing location is simply left out.
    const featSchool = tutor.highSchool || tutor.university || "";
    const featPlace = [tutor.suburb, tutor.city].filter(Boolean).join(", ");
    const featSchoolPlace = [featSchool, featPlace].filter(Boolean).join(" · ");
    // From md the bio runs long enough that the left column ends level with
    // the right one (rate, subjects, +N more, location, View full profile):
    // three lines, plus one for each of the tagline / credentials lines a tutor
    // doesn't have, so a sparse profile still fills the column. Phones keep two
    // lines; their lane is shorter. Literal classes for Tailwind's scanner.
    const missingLines = (tagline ? 0 : 1) + (credentials.length ? 0 : 1);
    const featBioClamp = ["md:line-clamp-3", "md:line-clamp-4", "md:line-clamp-5"][missingLines];
    // Narrower than the row's 4: the right column holds two, then "+N more".
    const sideShown = subjects.slice(0, 2).map(subjectLabel);
    const sideMore = subjects.length - sideShown.length;
    const muted = "text-[12px] md:text-[14px] leading-4 md:leading-5 text-[color:var(--ink-muted)] line-clamp-1 [overflow-wrap:anywhere]";
    return (
      <Link
        href={`/tutor/${tutor.slug}`}
        tabIndex={tabIndex}
        className="group h-full grid grid-cols-[64px_minmax(0,1fr)] md:grid-cols-[96px_minmax(0,1fr)] gap-x-4 md:gap-x-5 items-center"
      >
        {/* Two sizes: Avatar takes a numeric size, not a class. A hidden
            background-image is never fetched, so the copy costs nothing. */}
        <span className="self-center md:hidden">
          <Avatar tutor={tutor} size={64} />
        </span>
        <span className="self-center hidden md:block">
          <Avatar tutor={tutor} size={96} />
        </span>

        {/* Details and the rate column share one grid, top-aligned, so the rate
            sits level with the name. The grid as a whole stays vertically
            centred in the lane; its columns stretch so "View full profile"
            can sit at the bottom of the right one. */}
        <span className="min-w-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 md:gap-x-5">
        <span className="min-w-0 flex flex-col gap-1">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-[15px] md:text-[20px] leading-5 md:leading-7 font-medium text-[color:var(--ink-graphite)] group-hover:text-[color:var(--accent)] transition-colors truncate">
              {shortName(tutor.name)}
            </span>
            {company ? (
              <span className="inline-flex items-center gap-1 text-[12px] leading-4 text-[color:var(--ink-muted)] min-w-0">
                <Icon name="building" size={12} className="shrink-0" />
                <span className="truncate max-w-[160px]">{company.name}</span>
              </span>
            ) : (
              tutor.verified && <VerifiedTick size={16} />
            )}
          </span>
          {tagline && (
            <span className="text-[12px] md:text-[14px] leading-4 md:leading-5 text-[color:var(--ink-graphite)] line-clamp-1 [overflow-wrap:anywhere]">
              {tagline}
            </span>
          )}
          {credentials.length > 0 && <span className={muted}>{credentials.join(" · ")}</span>}
          {bio && (
            <span className={`text-[12px] md:text-[14px] leading-4 md:leading-5 text-[color:var(--ink-muted)] line-clamp-2 ${featBioClamp} [overflow-wrap:anywhere]`}>
              {bio}
            </span>
          )}
          {/* School alone from md (location moved under the rate); school and
              location together on phones, where the right column has no room. */}
          {featSchool && (
            <span className="hidden md:block text-[12px] leading-4 text-[color:var(--sage)] truncate">
              {featSchool}
            </span>
          )}
          {featSchoolPlace && (
            <span className="md:hidden text-[11px] leading-4 text-[color:var(--sage)] truncate">
              {featSchoolPlace}
            </span>
          )}
        </span>

        <span className="flex flex-col items-end text-right pl-1 md:pl-2">
          <RateBlock tutor={tutor} />
          {(sideShown.length > 0 || featPlace) && (
            <span className="hidden md:flex flex-col items-end gap-1 mt-3 w-[170px]">
              {/* "+N more" is its own line so the clamp on long subject names
                  can never cut it off. */}
              {sideShown.length > 0 && (
                <span className="text-[13px] leading-[18px] text-[color:var(--accent)] line-clamp-2 [overflow-wrap:anywhere]">
                  {sideShown.join(", ")}
                </span>
              )}
              {sideMore > 0 && (
                <span className="text-[12px] leading-4 text-[color:var(--sage)] whitespace-nowrap">{`+${sideMore} more`}</span>
              )}
              {featPlace && (
                <span className="text-[12px] leading-4 text-[color:var(--sage)] line-clamp-1 [overflow-wrap:anywhere]">
                  {featPlace}
                </span>
              )}
            </span>
          )}
          {/* Visual only: the whole row is already the link. The footer's link
              style (`.footer-link` in globals.css), driven by hovering the ROW
              since the span itself is not the link. */}
          <span className="hidden md:inline mt-auto pt-3 text-[13px] font-medium whitespace-nowrap text-[#5E8280] group-hover:text-[#7FC4C0] transition-colors duration-[160ms] ease-out">
            View full profile
          </span>
        </span>
        </span>
      </Link>
    );
  }

  const school = tutor.highSchool || tutor.university || "";
  const place = [tutor.suburb, tutor.city].filter(Boolean).join(", ");
  const schoolPlace = [school, place].filter(Boolean).join(" · ");
  const save = showSave && !company;

  return (
    <div className="relative">
      {save && (
        <SaveTutorButton tutorId={tutor.id} variant="card" className="top-4 right-0 z-10" tabIndex={tabIndex} />
      )}
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

        <span className={`min-w-0 flex flex-col gap-1 ${save ? "pr-12 sm:pr-14" : ""}`}>
          <NameLine tutor={tutor} company={company} showVerifiedLabel={showVerifiedLabel}>
            <span className="sm:hidden ml-auto">
              <RateBlock tutor={tutor} align="left" />
            </span>
          </NameLine>
          {taglineLine}
          {credentialsLine}
          {bio && (
            <span className="text-[14px] leading-5 text-[color:var(--ink-muted)] line-clamp-2 [overflow-wrap:anywhere]">
              {bio}
            </span>
          )}
          {subjectsLine}
          {/* Inline text, not flex: a flex row wraps the separator onto its own
              line. The separator is glued to the reviews text with a no-break
              space so a wrap never strands it. */}
          <span className="block text-[12px] leading-4 text-[color:var(--sage)] [overflow-wrap:anywhere]">
            {schoolPlace && <>{schoolPlace} </>}
            <span className="whitespace-nowrap">
              {schoolPlace && <span aria-hidden="true">·{" "}</span>}
              <ReviewsLine tutor={tutor} />
            </span>
          </span>
        </span>

        <span className="hidden sm:flex flex-col items-end text-right pl-4 pt-14 min-w-[120px]">
          <RateBlock tutor={tutor} />
        </span>
      </Link>
    </div>
  );
}

export default TutorRow;
