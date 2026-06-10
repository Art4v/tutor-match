"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "./Icon";
import { Avatar, VerifiedTick } from "./ui";
import { EASE_OUT } from "@/lib/motion";
import { subjectLabel } from "@/lib/subjects";
import { stripMarkdown } from "@/lib/richText";

// Enlarged headline credential tag. `truncate` lets the label shrink (used when
// an achievement stands in for a missing ATAR) so the tag can never push past
// its container into the rate; `active={false}` renders the muted "No ATAR"
// placeholder so the footer keeps a consistent height across cards.
function CredTag({ icon, active = true, truncate = false, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${truncate ? "min-w-0" : "shrink-0"}`}
      style={{
        maxWidth: "100%",
        fontSize: 14,
        padding: "5px 11px",
        borderRadius: 8,
        lineHeight: 1.15,
        background: active ? "var(--accent-softer)" : "var(--bg-soft)",
        color: active ? "var(--accent)" : "var(--sage)",
        border: `1px solid ${active ? "var(--accent-line)" : "var(--paper-line)"}`,
      }}
    >
      <Icon name={icon} size={14} className="shrink-0" />
      <span className={truncate ? "truncate" : "whitespace-nowrap"}>{children}</span>
    </span>
  );
}

// Compact overflow pill for credentials/achievements beyond the headline one.
// Fixed, short footprint and shrink-0 so it never gets squeezed out.
function MorePill({ count }) {
  return (
    <span
      className="shrink-0 inline-flex items-center font-medium text-[color:var(--ink-muted)] whitespace-nowrap"
      style={{ fontSize: 13, padding: "5px 9px", borderRadius: 8, lineHeight: 1.15, background: "var(--paper-card)", border: "1px solid var(--paper-line)" }}
    >
      +{count} more
    </span>
  );
}

// Compact subject chip — slightly smaller than the shared `Chip` so more
// subjects fit per row on the card.
function SubjectChip({ children }) {
  return (
    <span
      className="inline-flex items-center font-medium whitespace-nowrap"
      style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 7, lineHeight: 1.2, color: "var(--ink)", background: "var(--paper-card)", border: "1px solid var(--paper-line)" }}
    >
      {children}
    </span>
  );
}

// Subject chips that fill the available vertical space — wraps across as many
// rows as fit between the bio and the footer, then caps with a "+N" pill. Packs
// chips off-screen first (measured) so the visible rows never overflow / clip a
// chip mid-row. Re-runs on width AND height changes (it lives in a flex region
// whose height shifts with the rest of the card).
function SubjectChipsFill({ subjects }) {
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
    <div ref={containerRef} className="relative h-full flex flex-wrap content-start gap-1.5 overflow-hidden">
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

const CARD_HEIGHT = 400;

// Motion variants: a single source of truth for the hover behaviour. On enter,
// y eases up to -3px while rotate plays a small back-and-forth wobble that
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
  // Headline credential: the ATAR if set, otherwise the tutor's first
  // achievement stands in for it. Everything past the headline collapses into a
  // "+N more" pill. `otherCreds` is every non-ATAR achievement.
  const atar = credentials.find((c) => c.icon === "atar")?.label || null;
  const otherCreds = credentials.filter((c) => c.icon !== "atar");
  const headlineCred = atar ? null : otherCreds[0] || null;
  const moreCount = atar ? otherCreds.length : Math.max(0, otherCreds.length - 1);

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
        <div
          className="shrink-0"
          style={tutor.bannerImg
            ? { height: 62, background: `url(${tutor.bannerImg}) center / cover no-repeat` }
            : { height: 62, background: tutor.bannerBg ?? tutor.avatarBg, opacity: 0.55 }}
        />

        <div className="px-6 pb-6 flex flex-col flex-1 min-h-0">
          <div className="shrink-0" style={{ marginTop: -32, marginBottom: 12 }}>
            <Avatar tutor={tutor} size={64} ring />
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="font-hand text-[22px] font-semibold text-[color:var(--ink)] truncate leading-tight pr-1">
              {tutor.name}
            </span>
            {tutor.verified && <VerifiedTick size={14} />}
          </div>

          {/* Tagline (one line, reserved) */}
          <div className="text-[13.5px] text-[color:var(--ink-muted)] mt-0.5 truncate shrink-0" style={{ minHeight: "1.35em" }}>
            {stripMarkdown(tutor.bio) || " "}
          </div>

          {/* Location (one line, reserved) */}
          <div className="text-[12.5px] text-[color:var(--sage)] mt-0.5 flex items-center gap-1 shrink-0" style={{ minHeight: "1.3em" }}>
            {(tutor.suburb || tutor.city) ? (
              <>
                <Icon name="map-pin" size={11} />
                <span className="truncate">
                  {tutor.suburb}{tutor.suburb && tutor.city ? " · " : ""}{tutor.city}
                </span>
              </>
            ) : (
              " "
            )}
          </div>

          {/* Long bio — capped at 3 lines with ellipsis so the card stays
              skimmable. */}
          <div
            className="text-[13px] text-[color:var(--ink-muted)] mt-3 shrink-0 leading-[1.55]"
            style={{
              maxHeight: "calc(3 * 1.55 * 13px)",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {stripMarkdown(tutor.bioLong) || " "}
          </div>

          {/* Subjects fill the gap between the bio and the pinned footer — they
              wrap across as many rows as fit, so a tutor with many subjects
              shows more instead of leaving whitespace. This flex-1 region also
              absorbs leftover space, pinning the footer to the card's edge. The
              bottom margin reserves a gap so the last row (or its "+N" cutoff)
              never touches the school line below. */}
          <div className="flex-1 min-h-0 mt-3 mb-3">
            <SubjectChipsFill subjects={subjects} />
          </div>

          {/* Footer: featured school line + headline credential / rate. */}
          <div className="shrink-0">
            {/* Education: show the high school only; fall back to the university
                when no high school is listed. */}
            <div
              className="flex items-center gap-1.5 text-[13px] text-[color:var(--ink-muted)] mb-3"
              style={{ minHeight: "1.3em" }}
            >
              <Icon name="graduation" size={14} />
              <span className="truncate">
                {tutor.highSchool || tutor.university || (
                  <span className="text-[color:var(--sage)] italic">School not listed</span>
                )}
              </span>
            </div>

            <div
              className="pt-4 flex items-center gap-3 border-t"
              style={{ borderColor: "var(--paper-line)" }}
            >
              <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
                {atar ? (
                  <CredTag icon="trophy">{atar} <span className="font-medium opacity-80">ATAR</span></CredTag>
                ) : headlineCred ? (
                  <CredTag icon={headlineCred.icon || "trophy"} truncate>{headlineCred.label}</CredTag>
                ) : (
                  <CredTag icon="trophy" active={false}>No ATAR</CredTag>
                )}
                {moreCount > 0 && <MorePill count={moreCount} />}
              </div>
              <div className="text-right shrink-0 leading-none" style={{ paddingRight: 3 }}>
                <span className="text-[22px] font-bold text-[color:var(--ink)] tabular-nums">${tutor.rate}</span>
                <span className="text-[13px] text-[color:var(--sage)] font-medium">/hr</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
      {/* Folded paper corner — decorative, never intercepts the link. */}
      <span aria-hidden="true" className="dog-ear" />
    </motion.div>
  );
}
