"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "./Icon";
import { Avatar, VerifiedTick } from "./ui";
import { SaveTutorButton } from "./SaveTutorButton";
import { EASE_OUT } from "@/lib/motion";
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

// Single-line text that scales its font down to fit its container's width.
// Short values (ATAR, rate) keep `max`; long credential labels shrink toward
// `min`, with truncation as a last resort so they can never spill the cell.
function FitText({ children, max = 18, min = 10, className = "", style }) {
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
      if (natural > 0 && avail > 0) {
        setSize(natural > avail ? Math.max(min, Math.floor((max * avail) / natural)) : max);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [children, max, min]);

  return (
    <div ref={boxRef} className="w-full flex justify-center min-w-0">
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
    accent: { border: "#DDE9E8", bg: "#F7FBFB", color: "var(--accent)" },
    ink: { border: "var(--paper-line)", bg: "var(--desk-deep)", color: "var(--ink)" },
    muted: { border: "var(--paper-line)", bg: "var(--desk-deep)", color: "var(--sage)" },
  };
  const t = tones[tone] || tones.accent;
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 min-w-0"
      style={{ border: `1px solid ${t.border}`, background: t.bg, borderRadius: 11, padding: "9px 8px" }}
    >
      <FitText max={21} min={11} className="tabular-nums leading-none" style={{ color: t.color, fontWeight: 300 }}>
        {value}
      </FitText>
      <span
        className="font-medium uppercase whitespace-nowrap"
        style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--sage)" }}
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
      className="inline-flex items-center font-medium whitespace-nowrap"
      style={{ fontSize: 12, padding: "4px 11px", borderRadius: 999, lineHeight: 1.2, color: "#015F5C", background: "var(--pill)" }}
    >
      {children}
    </span>
  );
}

// Subject chips that fill the available vertical space — wraps across as many
// rows as fit, then caps with a "+N" pill. Packs chips off-screen first
// (measured) so the visible rows never overflow / clip a chip mid-row. Re-runs
// on width AND height changes (it lives in a flex region whose height shifts
// with the rest of the card). `center` centres the rows for the Crown layout.
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

// The design's card is 420x580; we keep close to the original 504px footprint
// and let the card fill its column (browse grid / hero stack), so the vertical
// rhythm below is the design's proportions scaled to fit. The extra 26px over
// the original buys the subject region a guaranteed second row (see
// SUBJECTS_MIN_H).
const CARD_HEIGHT = 530;

// Floor for the subject region. SubjectChipsFill only renders WHOLE rows, so
// this must clear two of them or it silently drops to one: a chip is 12px text
// at line-height 1.2 plus 4px padding top/bottom (~23px), and rows are 6px
// apart, so two rows need >= 52px. The surplus keeps the "+N" pill in reach
// when a tutor has more subjects than fit.
const SUBJECTS_MIN_H = 56;

// Motion variants: a single source of truth for the hover behaviour. On enter,
// y eases up to -4px while rotate plays a small back-and-forth wobble that
// settles on 0; the shadow + border ease in. On leave, every property
// interpolates back to rest with the same easing — no snapping, no overlap.
// Both boxShadow strings MUST keep the same shape (same layers, same value
// count per layer: contact + drop) — motion can only tween shadows with
// matching templates; a mismatch makes it swap discretely instead of fading.
const cardVariants = {
  rest: {
    y: 0,
    rotate: 0,
    boxShadow: "0 1px 2px 0 rgba(0,30,30,0.03), 0 18px 44px -20px rgba(0,49,47,0.14)",
    borderColor: "var(--paper-line)",
    transition: {
      y: { duration: 0.45, ease: EASE_OUT },
      rotate: { duration: 0.4, ease: EASE_OUT },
      boxShadow: { duration: 0.4, ease: EASE_OUT },
      borderColor: { duration: 0.3, ease: EASE_OUT },
    },
  },
  hover: {
    y: -4,
    rotate: [0, -0.9, 0.9, -0.45, 0.2, 0],
    boxShadow: "0 2px 4px 0 rgba(0,30,30,0.05), 0 22px 48px -20px rgba(0,49,47,0.22)",
    borderColor: "var(--line-strong)",
    transition: {
      y: { duration: 0.42, ease: EASE_OUT },
      rotate: {
        duration: 0.62,
        ease: "easeOut",
        times: [0, 0.18, 0.4, 0.62, 0.82, 1],
      },
      boxShadow: { duration: 0.42, ease: EASE_OUT },
      borderColor: { duration: 0.3, ease: EASE_OUT },
    },
  },
};

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

  const tagline = stripMarkdown(tutor.bio);
  const longBio = stripMarkdown(tutor.bioLong);
  const location = [tutor.suburb, tutor.city].filter(Boolean).join(" · ");
  const school = tutor.highSchool || tutor.university;
  // Design pairs school and location into one quiet line. Either side can be
  // missing, so join only what's present rather than emitting a bare "·".
  const schoolLocation = [school, location].filter(Boolean).join(" · ");

  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={cardVariants}
      style={{
        position: "relative",
        height: CARD_HEIGHT,
        backgroundColor: "var(--paper-card)",
        border: "1px solid var(--paper-line)",
        borderRadius: 14,
        overflow: "hidden",
        willChange: "transform, box-shadow",
      }}
    >
      {/* Bookmark overlay — a sibling of the card <Link> (not nested, so the
          HTML stays valid) pinned to the banner's top-right corner. Suppressed
          on the home hero showcase cards (showSave={false}). */}
      {showSave && <SaveTutorButton tutorId={tutor.id} variant="card" />}
      <Link
        href={`/tutor/${tutor.slug}`}
        className="relative cursor-pointer flex flex-col h-full overflow-hidden"
      >
        {/* Coloured banner — the tutor's uploaded banner image if present, else
            their flat backdrop tint. The only full-bleed element on the card. */}
        <div
          className="shrink-0 relative overflow-hidden"
          style={tutor.bannerImg
            ? { height: 108, background: `url(${tutor.bannerImg}) center / cover no-repeat` }
            : { height: 108, background: tutor.bannerBg ?? tutor.avatarBg }}
        />

        {/* Everything below the banner carries the side padding. */}
        <div className="flex flex-col flex-1 min-h-0 items-center text-center" style={{ padding: "0 24px 22px" }}>
          {/* Avatar frame — a rounded square straddling the banner, half over
              the tint and half over the white card. */}
          <div className="shrink-0" style={{ marginTop: -58, marginBottom: 12 }}>
            <Avatar
              tutor={tutor}
              size={116}
              radius={14}
              fontScale={0.44}
              weight={300}
              ring
              ringColor="#fff"
              ringWidth={4}
            />
          </div>

          {/* Name + verified rosette. */}
          <div className="flex items-center justify-center gap-1.5 shrink-0 max-w-full">
            <span
              className="truncate leading-tight"
              style={{ fontSize: 22, fontWeight: 300, letterSpacing: "-0.02em", color: "var(--ink-graphite)" }}
            >
              {tutor.name}
            </span>
            {tutor.verified && <VerifiedTick size={15} />}
          </div>

          {/* Tagline — one line, height reserved so cards stay aligned. */}
          <div
            className="mt-1.5 shrink-0 max-w-full leading-[1.3]"
            style={{
              fontSize: 14.5,
              fontWeight: 500,
              color: "var(--accent)",
              minHeight: "1.3em",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {tagline || " "}
          </div>

          {/* Long bio — capped at 2 lines so the centred stack stays compact. */}
          <div
            className="mt-1 shrink-0 leading-[1.5]"
            style={{
              fontSize: 12.5,
              color: "var(--ink-muted)",
              minHeight: "3em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {longBio || " "}
          </div>

          {/* School · Location — deliberately quieter than the stat tiles. */}
          <div
            className="mt-1 shrink-0 max-w-full truncate"
            style={{ fontSize: 12, color: "var(--sage)", minHeight: "1.3em" }}
          >
            {schoolLocation || " "}
          </div>

          {/* Twin stat tiles: top credential · rate. The left tile follows the
              tutor's chosen lead credential (see captionForIcon), so it reads
              "ATAR" for most tutors but "Award" / "Degree" / "State rank" when
              they've ordered a different one first. */}
          <div className="w-full grid grid-cols-2 gap-2.5 mt-3 shrink-0">
            <StatTile value={statValue} label={statLabel} tone={statTone} />
            <StatTile value={`$${tutor.rate}`} label="per hour" tone="ink" />
          </div>

          {/* Subjects fill the gap above the CTA — wrap across as many rows as
              fit, then cap with a "+N" pill. This flex-1 region absorbs leftover
              space (pinning the CTA to the bottom) but reserves a guaranteed
              two-row minimum (minHeight) so subjects never collapse to nothing
              on content-heavy cards; lighter cards grow it to more rows. */}
          <div className="w-full flex-1 min-h-0 mt-2.5" style={{ minHeight: SUBJECTS_MIN_H }}>
            <SubjectChipsFill subjects={subjects} center />
          </div>

          {/* CTA — visual only; the whole card is already the link, so this is a
              styled span (a nested <button>/<a> inside <a> is invalid). */}
          <span
            className="w-full shrink-0 inline-flex items-center justify-center gap-1.5 font-medium text-white"
            style={{ background: "var(--ink-graphite)", borderRadius: 11, padding: "11px 14px", fontSize: 13, marginTop: 12 }}
          >
            View full profile
            <Icon name="arrow-right" size={14} className="shrink-0" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
