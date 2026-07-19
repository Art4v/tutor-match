"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { Avatar, VerifiedTick } from "./ui";
import { SaveTutorButton } from "./SaveTutorButton";
import { subjectLabel } from "@/lib/subjects";
import { stripMarkdown } from "@/lib/richText";

// Credential icon → human label for the stat-cell subtitle, mirroring the
// editor's CREDENTIAL_TYPES (components/profile-edit/sections.js). The cell
// uppercases it via CSS, so these stay sentence-case here.
const CRED_CAPTIONS = {
  atar: "ATAR",
  trophy: "Award",
  graduation: "Degree",
  "check-badge": "State rank",
  star: "Highlight",
};
const captionForIcon = (icon) => CRED_CAPTIONS[icon] || "Credential";

// Single-line text that scales its font down to fit its container. Short values
// (ATAR, rate) keep `max`; long credential labels shrink toward `min`, with
// truncation as a last resort so they can never spill the cell.
//
// It fits against the box's HEIGHT as well as its width. Width alone isn't
// enough: `max` is a JS prop set as an inline fontSize, which no Tailwind class
// can override, so a short value like "99.85" would render at the full desktop
// 21px even in the much narrower phone rail (it still fits widthwise). Capping
// at the box height lets `boxClassName` drive the size responsively — give the
// box `h-[16px] md:h-[23px]` and the value follows the breakpoint.
function FitText({ children, max = 18, min = 10, className = "", boxClassName = "", style }) {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [size, setSize] = useState(max);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      const b = boxRef.current, t = textRef.current;
      if (!b || !t) return;
      // Measure the natural width at full size, then restore.
      const prev = t.style.fontSize;
      t.style.fontSize = max + "px";
      const natural = t.scrollWidth;
      t.style.fontSize = prev;
      const avail = b.clientWidth;
      const availH = b.clientHeight;
      if (natural > 0 && avail > 0) {
        let next = natural > avail ? Math.floor((max * avail) / natural) : max;
        // Never taller than the box (leading-none makes the line box ~= the
        // font size, so the height doubles as a font-size ceiling).
        if (availH > 0) next = Math.min(next, availH);
        setSize(Math.max(min, next));
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [children, max, min]);

  return (
    <div ref={boxRef} className={`w-full flex items-center justify-center min-w-0 ${boxClassName}`}>
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap overflow-hidden text-ellipsis max-w-full ${className}`}
        style={{ fontSize: size, ...style }}
      >
        {children}
      </span>
    </div>
  );
}

// One of the twin stat tiles under the school/location line. `tone` picks the
// pair from the design: "accent" is the credential tile (teal value on a teal
// tint), "ink" is the rate tile (near-black value on a neutral tint).
function StatTile({ value, label, tone = "accent" }) {
  const tones = {
    accent: { border: "var(--chip-line)", bg: "var(--desk)", color: "var(--accent)" },
    ink: { border: "var(--paper-line)", bg: "var(--desk-deep)", color: "var(--ink)" },
    muted: { border: "var(--paper-line)", bg: "var(--desk-deep)", color: "var(--sage)" },
  };
  const t = tones[tone] || tones.accent;
  return (
    <div
      className="flex flex-col items-center justify-center gap-0.5 md:gap-1 min-w-0 px-1 py-1 md:px-2 md:py-[9px]"
      style={{ border: `1px solid ${t.border}`, background: t.bg, borderRadius: 9 }}
    >
      {/* The box's FIXED height does double duty: it caps the font size per
          breakpoint (see FitText), and it keeps every tile the same height
          whatever the fitted size turns out to be. Without it the tile is only
          as tall as its text, so a long credential ("State rank 3 - Physics",
          shrunk to 9px) made a shorter tile than a short one ("99.85" at 21px)
          — and since the rail drives card height, whole cards in the list came
          out different heights. */}
      <FitText
        max={21}
        min={9}
        boxClassName="h-[15px] md:h-[23px]"
        className="tabular-nums leading-none"
        style={{ color: t.color, fontWeight: 300 }}
      >
        {value}
      </FitText>
      <span
        className="font-medium uppercase whitespace-nowrap text-[7px] md:text-[10px]"
        style={{ letterSpacing: "0.06em", color: "var(--sage)" }}
      >
        {label}
      </span>
    </div>
  );
}

// Compact subject pill — fully rounded teal-tint chip, smaller than the shared
// `Chip` so more subjects fit per row on the card.
function SubjectChip({ children }) {
  return (
    <span
      className="inline-flex items-center font-medium whitespace-nowrap text-[10.5px] md:text-[12px] px-2 py-[3px] md:px-[11px] md:py-1"
      style={{ borderRadius: 999, lineHeight: 1.2, color: "var(--pill-ink)", background: "var(--pill)" }}
    >
      {children}
    </span>
  );
}

// Subject chips that fill the available vertical space — wraps across as many
// rows as fit, then caps with a "+N" pill. Packs chips off-screen first
// (measured) so the visible rows never overflow / clip a chip mid-row. Re-runs
// on width AND height changes (it lives in a flex region whose height shifts
// with the rest of the card). `center` centres the rows.
function SubjectChipsFill({ subjects, center = false }) {
  const containerRef = useRef(null);
  const measureRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(subjects.length);

  useEffect(() => {
    if (!containerRef.current || !measureRef.current) return;
    const recalc = () => {
      const c = containerRef.current, m = measureRef.current;
      if (!c || !m) return;
      const availW = c.offsetWidth;
      const availH = c.offsetHeight;
      const chipNodes = [...m.querySelectorAll('[data-kind="chip"]')];
      if (chipNodes.length === 0) { setVisibleCount(0); return; }
      const widths = chipNodes.map((n) => n.offsetWidth);
      const chipH = chipNodes[0].offsetHeight;
      const moreNode = m.querySelector('[data-kind="more"]');
      const moreW = moreNode ? moreNode.offsetWidth : 0;
      const colGap = 6, rowGap = 6;
      // Whole rows only — if not even one row fully fits, render nothing
      // (sentinel -1: not even the "+N" pill) rather than a half-clipped row.
      const maxRows = Math.floor((availH + rowGap) / (chipH + rowGap));
      if (maxRows < 1) { setVisibleCount(-1); return; }

      // Greedily flow `n` chip widths (plus an optional trailing "+N" pill) into
      // `maxRows` rows of width `availW`; returns whether they all fit.
      const fits = (n, includeMore) => {
        let row = 0, x = 0;
        const place = (w) => {
          const nx = x === 0 ? w : x + colGap + w;
          if (nx <= availW) { x = nx; return true; }
          row++;
          if (row >= maxRows) return false;
          x = w;
          return w <= availW;
        };
        for (let i = 0; i < n; i++) if (!place(widths[i])) return false;
        if (includeMore && !place(moreW)) return false;
        return true;
      };

      if (fits(widths.length, false)) { setVisibleCount(widths.length); return; }
      let n = 0;
      for (let k = widths.length - 1; k >= 0; k--) {
        if (fits(k, true)) { n = k; break; }
      }
      setVisibleCount(n);
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [subjects]);

  if (subjects.length === 0) return <div ref={containerRef} className="h-full" />;

  const visible = subjects.slice(0, Math.max(0, visibleCount));
  // Never silently drop everything: when not even one full row fits
  // (visibleCount === -1) but the tutor DOES have subjects, still surface a
  // "+N" pill so the count is visible rather than nothing.
  const extra = visibleCount < 0 ? subjects.length : subjects.length - visible.length;

  return (
    <div
      ref={containerRef}
      className={`relative h-full flex flex-wrap content-start gap-1.5 overflow-hidden ${center ? "justify-center" : ""}`}
    >
      <div
        ref={measureRef}
        aria-hidden
        style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", left: -9999, top: 0, display: "flex", gap: 6, whiteSpace: "nowrap" }}
      >
        {subjects.map((s, i) => (
          <span data-kind="chip" key={i}>
            <SubjectChip>{subjectLabel(s)}</SubjectChip>
          </span>
        ))}
        <span data-kind="more">
          <SubjectChip>+{subjects.length}</SubjectChip>
        </span>
      </div>
      {visible.map((s, i) => (
        <span key={i} className="shrink-0">
          <SubjectChip>{subjectLabel(s)}</SubjectChip>
        </span>
      ))}
      {extra > 0 && (
        <span className="shrink-0">
          <SubjectChip>+{extra}</SubjectChip>
        </span>
      )}
    </div>
  );
}

// The card is a horizontal row, always: a left column (avatar · text over the
// subject strip) beside a full-height stat rail. The layout NEVER stacks — the
// same three zones hold at every width and the components scale down instead,
// so a phone gets the desktop composition in miniature.
//
// Every size lives as a literal Tailwind class at the point of use rather than
// as a constant here — the JIT scans source statically and can't see a class
// name built from a variable. The set, phone -> md:
//   body height    h-[120px]  md:h-[200px]
//   rail width     w-[112px]  md:w-[210px]
//   strip height   h-[44px]   md:h-[56px]
//   chips box      h-[26px]   md:h-[36px]
//   avatar         64         132   (a size prop, see the two-Avatar note below)
//
// Two of those are load-bearing rather than aesthetic:
//
// The md strip height must clear TWO chip rows or SubjectChipsFill silently
// drops to one — it renders whole rows only. A chip is 12px text at line-height
// 1.2 plus 4px padding top/bottom (~23px) and rows are 6px apart, so two rows
// need >= 52px; the surplus keeps the "+N" pill in reach. The phone height is a
// deliberate ONE row: there isn't the width for more beside the rail.
//
// The chips box must stay a FIXED height at both sizes. SubjectChipsFill
// measures offsetHeight, so an auto-height box collapses and it renders nothing
// at all.

// Bookmark placement. It's a sibling of the card <Link> (never nested), so it
// can't flow inline in the text column and has to be positioned. It sits at the
// top-right of the TEXT column, just left of the rail divider — the rail is now
// flush to the card's right edge, so that's rail width + an 8px gap:
// 88 + 8 = 96 on a phone, 210 + 8 = 218 from md up.
// Written out in full rather than interpolated — Tailwind's JIT scans source
// statically and can't see a class built from a template literal.
const SAVE_POS = "top-2 right-[96px] md:top-3 md:right-[218px]";

// Resting shadow. Static — the card has NO hover animation at all: no lift, no
// wobble, no shadow change, no border change. That's why this is a plain <div>
// rather than a motion element and why nothing here is a motion variant.
// (The entry stagger when a list renders is separate — it lives on the wrapper
// in app/browse/BrowseResultsGrid.jsx, not on the card.)
const CARD_SHADOW = "0 1px 2px 0 rgba(0,30,30,0.03), 0 18px 44px -20px rgba(0,49,47,0.14)";

export function TutorCard({ tutor, showSave = true }) {
  const credentials = (tutor.credentials || []).filter((c) => c?.label);
  const subjects = (tutor.subjects || []).filter((s) => s?.name);
  // Headline stat: the tutor's first credential — labelled by its type (ATAR /
  // Award / Degree / State rank / Highlight). Tutors choose which one leads by
  // ordering their credentials in the editor.
  const top = credentials[0] || null;
  const statValue = top?.label || "—";
  const statLabel = top ? captionForIcon(top.icon) : "None";
  const statTone = top ? "accent" : "muted";

  // Trimmed because these gate whether their block renders at all: rich-text
  // fields that have been typed into and cleared can strip down to whitespace
  // rather than "", which would pass a truthy check and render an empty block.
  const tagline = stripMarkdown(tutor.bio).trim();
  const longBio = stripMarkdown(tutor.bioLong).trim();
  const location = [tutor.suburb, tutor.city].filter(Boolean).join(" · ");
  const school = tutor.highSchool || tutor.university;
  // Design pairs school and location into one quiet line. Either side can be
  // missing, so join only what's present rather than emitting a bare "·".
  const schoolLocation = [school, location].filter(Boolean).join(" · ");

  return (
    <div
      style={{
        position: "relative",
        backgroundColor: "var(--paper-card)",
        border: "1px solid var(--paper-line)",
        borderRadius: 14,
        boxShadow: CARD_SHADOW,
        overflow: "hidden",
      }}
    >
      {/* Bookmark overlay — a sibling of the card <Link> (not nested, so the
          HTML stays valid). See SAVE_POS for why it's placed by class rather
          than the variant's own offset. Suppressed on showcase cards. */}
      {showSave && <SaveTutorButton tutorId={tutor.id} variant="card" className={SAVE_POS} />}
      <Link
        href={`/tutor/${tutor.slug}`}
        className="relative cursor-pointer flex overflow-hidden"
      >
        {/* LEFT COLUMN — body band over the subject strip. Sits beside the rail
            rather than above it, which is what lets the rail reach the card's
            bottom edge and cuts the strip off at the divider. */}
        <div className="flex-1 min-w-0 flex flex-col">
        {/* Body band: avatar · text. A min-height plus flex-1, not a fixed
            height — whichever column is taller sets the card height, and when
            it's the rail (which happens on phones, where the rail's contents
            don't shrink as far as the body's) the body has to absorb the extra
            or the surplus shows as a bare white sliver under the tinted strip. */}
        <div className="flex-1 flex items-stretch gap-3 md:gap-5 p-3 md:p-5 min-h-[120px] md:min-h-[200px]">
          {/* Avatar — a plain rounded square (no banner behind it to straddle,
              so no white ring either), centred in its own stretched cell so it
              lines up with the text column.

              Rendered TWICE at two sizes rather than once: Avatar writes
              width/height/fontSize as inline styles from its numeric `size`
              prop and takes no className/style, so Tailwind can't resize it and
              the initials' font size wouldn't scale anyway. The hidden copy
              costs one DOM node and no network request — browsers don't fetch
              background-image on a display:none element, and the avatar is a
              background image. */}
          <div className="shrink-0 flex items-center md:hidden">
            <Avatar tutor={tutor} size={64} radius={10} fontScale={0.44} weight={300} />
          </div>
          <div className="shrink-0 hidden md:flex items-center">
            <Avatar tutor={tutor} size={132} radius={16} fontScale={0.44} weight={300} />
          </div>

          {/* Text column. Each block keeps the minHeight it had on the portrait
              card so rows stay aligned when a tutor is missing a field. */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {/* Name + verified rosette. The bookmark floats over this column's
                right edge at BOTH sizes now (it anchors to the rail divider,
                which no longer moves), so the padding is unconditional — it
                clears the 38px control plus its 8px offset. */}
            <div className="flex items-center gap-1 md:gap-1.5 min-w-0 pr-12">
              <span
                className="truncate leading-tight text-[15px] md:text-[20px]"
                style={{ fontWeight: 300, letterSpacing: "-0.02em", color: "var(--ink-graphite)" }}
              >
                {tutor.name}
              </span>
              {tutor.verified && <VerifiedTick size={15} />}
            </div>

            {/* The three blocks below are each rendered ONLY when they have
                content, and none of them reserves height. A tutor missing a
                tagline or bio would otherwise leave a blank gap where the empty
                block still held its minHeight, and the rest of the text sat
                stranded below it. Row alignment doesn't depend on these any
                more — the body band's min-h and the rail keep every card in the
                list the same height. */}

            {/* Tagline — one line. On a phone the rows are tight enough that
                the bookmark's 38px circle reaches down past the name into this
                line, so it needs the same clearance; by md the name alone is
                tall enough to clear it. */}
            {tagline && (
              <div
                className="mt-0.5 md:mt-1 max-w-full leading-[1.3] text-[11.5px] md:text-[14px] pr-12 md:pr-0"
                style={{
                  fontWeight: 500,
                  color: "var(--accent)",
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {tagline}
              </div>
            )}

            {/* Long bio — capped at 2 lines. */}
            {longBio && (
              <div
                className="mt-1 md:mt-1.5 leading-[1.5] text-[10.5px] md:text-[12.5px]"
                style={{
                  color: "var(--ink-muted)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {longBio}
              </div>
            )}

            {/* School · Location — deliberately quieter than the stat tiles. */}
            {schoolLocation && (
              <div
                className="mt-1 md:mt-1.5 max-w-full truncate text-[10px] md:text-[12px]"
                style={{ color: "var(--sage)" }}
              >
                {schoolLocation}
              </div>
            )}
          </div>
        </div>

        {/* Subject strip. Sits inside the left column, so it stops at the rail
            divider instead of running under it. Dropped entirely for a tutor
            with no subjects, so the card ends at the body instead of trailing
            an empty tinted band. */}
        {subjects.length > 0 && (
          <div
            className="shrink-0 flex items-center px-3 md:px-5 h-[44px] md:h-[56px]"
            style={{ borderTop: "1px solid var(--line)", background: "var(--desk)" }}
          >
            {/* Fixed height on purpose — SubjectChipsFill measures offsetHeight
                and renders whole rows only, so an auto-height box collapses and
                it renders nothing at all. */}
            <div className="w-full h-[26px] md:h-[36px]">
              <SubjectChipsFill subjects={subjects} />
            </div>
          </div>
        )}
        </div>

        {/* RIGHT COLUMN — the stat rail, a direct child of the <Link> so it
            spans the card's full height and its divider runs top to bottom.
            Contents centre against the whole card, not just the body band. */}
        <div className="shrink-0 flex flex-col justify-center gap-1.5 md:gap-2.5 p-2 md:p-5 w-[88px] md:w-[210px] border-l border-[color:var(--line)]">
          {/* Twin stat tiles: top credential · rate. The first tile follows the
              tutor's chosen lead credential (see captionForIcon), so it reads
              "ATAR" for most tutors but "Award" / "Degree" / "State rank" when
              they've ordered a different one first. Always stacked now — the
              rail is a column at every width. */}
          <div className="grid grid-cols-1 gap-1.5 md:gap-2.5">
            <StatTile value={statValue} label={statLabel} tone={statTone} />
            <StatTile value={`$${tutor.rate}`} label="per hour" tone="ink" />
          </div>

          {/* CTA — visual only; the whole card is already the link, so this is
              a styled span (a nested <button>/<a> inside <a> is invalid).
              Desktop only: the phone rail is too narrow to carry it without the
              label wrapping awkwardly, and nothing is lost — tapping anywhere
              on the card already navigates to the profile. */}
          <span
            className="w-full hidden md:inline-flex items-center justify-center gap-1.5 font-medium text-white text-[13px] px-[14px] py-[10px]"
            style={{ background: "var(--ink-graphite)", borderRadius: 11 }}
          >
            View full profile
            <Icon name="arrow-right" size={14} className="shrink-0" />
          </span>
        </div>
      </Link>
    </div>
  );
}
