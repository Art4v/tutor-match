"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "./Icon";
import { Avatar, VerifiedTick } from "./ui";
import { EASE_OUT } from "@/lib/motion";
import { subjectLabel } from "@/lib/subjects";
import { stripMarkdown } from "@/lib/richText";

// Brand leaf / sprout mark — decorative overlay on the banner (ported from the
// design handoff). Absolutely positioned by the caller.
function LeafMark({ size = 28, color = "#fff", opacity = 1, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      opacity={opacity}
      aria-hidden="true"
      style={{ position: "absolute", ...style }}
    >
      <path d="M32 60 C32 47 31 39 33 31" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M33 36 C18 35 9 25 10 11 C25 11 35 21 34 35 Z" fill={color} />
      <path d="M34 31 C48 28 56 16 54 3 C40 5 31 17 33 30 Z" fill={color} />
    </svg>
  );
}

// Compact overflow pill for credentials/achievements beyond the ATAR stat.
function MorePill({ count }) {
  return (
    <span
      className="inline-flex items-center font-medium text-[color:var(--ink-muted)] whitespace-nowrap"
      style={{ fontSize: 12, padding: "3px 9px", borderRadius: 999, lineHeight: 1.15, background: "var(--paper-card)", border: "1px solid var(--paper-line)" }}
    >
      +{count} more
    </span>
  );
}

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

// A single cell in the ATAR / rate stat strip.
function StatCell({ value, label, tone = "accent" }) {
  const color = tone === "accent" ? "var(--accent)" : tone === "muted" ? "var(--sage)" : "var(--ink)";
  return (
    <div className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
      <FitText max={18} min={10} className="font-extrabold tabular-nums leading-none" style={{ color }}>
        {value}
      </FitText>
      <span
        className="font-bold uppercase whitespace-nowrap"
        style={{ fontSize: 9, letterSpacing: "0.04em", color: "var(--sage)" }}
      >
        {label}
      </span>
    </div>
  );
}

// Compact subject chip — slightly smaller than the shared `Chip` so more
// subjects fit per row on the card.
function SubjectChip({ children }) {
  return (
    <span
      className="inline-flex items-center font-medium whitespace-nowrap"
      style={{ fontSize: 11, padding: "3px 8px", borderRadius: 7, lineHeight: 1.2, color: "var(--ink-2, var(--ink))", background: "var(--paper-card)", border: "1px solid var(--paper-line)" }}
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
  const extra = visibleCount < 0 ? 0 : subjects.length - visible.length;

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

const CARD_HEIGHT = 458;

// Motion variants: a single source of truth for the hover behaviour. On enter,
// y eases up to -4px while rotate plays a small back-and-forth wobble that
// settles on 0; the shadow + border ease in. On leave, every property
// interpolates back to rest with the same easing — no snapping, no overlap.
// Both boxShadow strings MUST keep the same shape (same layers, same value
// count per layer: contact + drop + sheet + glow) — motion can only tween
// shadows with matching templates; a mismatch makes it swap discretely
// instead of fading. Layers that exist in only one state fade via alpha.
const cardVariants = {
  rest: {
    y: 0,
    rotate: 0,
    // Cream sheet: soft drop shadow + a faint offset "sheet beneath" so the card
    // reads like a page in a small stack.
    boxShadow: "0 1px 2px 0 rgba(60,55,45,0.05), 0 10px 26px -16px rgba(60,55,45,0.22), 5px 7px 0 -3px rgba(120,114,98,0.12), 0 0 22px 0 rgba(94,122,90,0)",
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
    boxShadow: "0 1px 2px 0 rgba(60,55,45,0), 0 18px 36px -20px rgba(40,38,34,0.26), 7px 9px 0 -3px rgba(120,114,98,0.16), 0 0 22px 0 rgba(94,122,90,0.18)",
    borderColor: "var(--accent-line)",
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

export function TutorCard({ tutor }) {
  const credentials = (tutor.credentials || []).filter((c) => c?.label);
  const subjects = (tutor.subjects || []).filter((s) => s?.name);
  // Headline stat: the ATAR if set, otherwise the tutor's first credential
  // stands in for it — labelled by its type (Award / Degree / State rank /
  // Highlight). Everything past the headline collapses into a "+N more" pill so
  // nothing they listed is silently dropped.
  const atar = credentials.find((c) => c.icon === "atar")?.label || null;
  const otherCreds = credentials.filter((c) => c.icon !== "atar");
  const headlineCred = atar ? null : otherCreds[0] || null;
  const statValue = atar || headlineCred?.label || "—";
  const statLabel = atar ? "ATAR" : headlineCred ? captionForIcon(headlineCred.icon) : "ATAR";
  const statTone = atar || headlineCred ? "accent" : "muted";
  const moreCount = atar ? otherCreds.length : Math.max(0, otherCreds.length - 1);

  const tagline = stripMarkdown(tutor.bio);
  const longBio = stripMarkdown(tutor.bioLong);
  const location = [tutor.suburb, tutor.city].filter(Boolean).join(" · ");
  const school = tutor.highSchool || tutor.university;

  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={cardVariants}
      className="paper-grain"
      style={{
        position: "relative",
        height: CARD_HEIGHT,
        backgroundColor: "var(--paper-card)",
        border: "1px solid var(--paper-line)",
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
        willChange: "transform, box-shadow",
      }}
    >
      <Link
        href={`/tutor/${tutor.slug}`}
        className="relative cursor-pointer flex flex-col h-full overflow-hidden"
      >
        {/* Coloured banner — the tutor's uploaded banner image if present, else
            their backdrop colour. Leaf marks are a decorative overlay. */}
        <div
          className="shrink-0 relative overflow-hidden"
          style={tutor.bannerImg
            ? { height: 88, background: `url(${tutor.bannerImg}) center / cover no-repeat` }
            : { height: 88, background: tutor.bannerBg ?? tutor.avatarBg }}
        >
          <LeafMark size={84} color="#fff" opacity={0.14} style={{ right: -12, bottom: -20 }} />
        </div>

        <div className="px-4 pb-4 flex flex-col flex-1 min-h-0 items-center text-center">
          {/* Avatar "crown" — straddles the banner. */}
          <div className="shrink-0" style={{ marginTop: -50, marginBottom: 6 }}>
            <Avatar tutor={tutor} size={100} ring />
          </div>

          {/* Name + verified checkmark (kept design, slightly smaller). */}
          <div className="flex items-center justify-center gap-1.5 shrink-0 max-w-full">
            <span className="text-[19px] font-extrabold tracking-[-0.02em] text-[color:var(--ink)] truncate leading-tight">
              {tutor.name}
            </span>
            {tutor.verified && <VerifiedTick size={15} />}
          </div>

          {/* Tagline (one line, reserved) — no leaf icon. */}
          <div className="text-[12.5px] font-bold text-[color:var(--accent)] mt-1 truncate shrink-0 max-w-full" style={{ minHeight: "1.3em" }}>
            {tagline || " "}
          </div>

          {/* Long bio — capped at 2 lines so the centred stack stays compact. */}
          <div
            className="text-[11.5px] text-[color:var(--ink-muted)] mt-1 shrink-0 leading-[1.5]"
            style={{
              minHeight: "1.5em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {longBio || " "}
          </div>

          {/* Location — deliberately quieter than the ATAR / rate stats. */}
          <div className="text-[11.5px] text-[color:var(--sage)] mt-1.5 flex items-center justify-center gap-1 shrink-0 max-w-full" style={{ minHeight: "1.3em" }}>
            {location ? (
              <>
                <Icon name="map-pin" size={10} className="shrink-0" />
                <span className="truncate">{location}</span>
              </>
            ) : (
              " "
            )}
          </div>

          {/* School line. */}
          <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[color:var(--ink)] mt-1 shrink-0 max-w-full" style={{ minHeight: "1.3em" }}>
            <Icon name="graduation" size={13} className="shrink-0" />
            <span className="truncate">
              {school || <span className="text-[color:var(--sage)] font-normal italic">School not listed</span>}
            </span>
          </div>

          {/* Stat strip: ATAR · rate. */}
          <div
            className="w-full flex items-center mt-2.5 shrink-0"
            style={{ padding: "10px 14px", borderRadius: 11, border: "1px solid var(--paper-line)" }}
          >
            <StatCell value={statValue} label={statLabel} tone={statTone} />
            <div className="self-stretch" style={{ width: 1, background: "var(--paper-line)" }} />
            <StatCell value={`$${tutor.rate}`} label="per hr" tone="ink" />
          </div>

          {/* Other credentials the tutor listed, collapsed into a pill. */}
          {moreCount > 0 && (
            <div className="mt-1.5 shrink-0">
              <MorePill count={moreCount} />
            </div>
          )}

          {/* Subjects fill the gap above the CTA — wrap across as many rows as
              fit, then cap with a "+N" pill. This flex-1 region also absorbs
              leftover space, pinning the CTA to the card's bottom edge. */}
          <div className="w-full flex-1 min-h-0 mt-2.5 mb-2.5">
            <SubjectChipsFill subjects={subjects} center />
          </div>

          {/* CTA — visual only; the whole card is already the link, so this is a
              styled span (a nested <button>/<a> inside <a> is invalid). */}
          <span
            className="w-full shrink-0 inline-flex items-center justify-center gap-1.5 font-semibold text-white"
            style={{ background: "var(--accent)", borderRadius: 9, padding: "9px 14px", fontSize: 12.5 }}
          >
            View full profile
            <Icon name="arrow-right" size={14} className="shrink-0" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
