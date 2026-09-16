"use client";
import { useEffect, useRef, useState } from "react";

// ============================================================================
// The stat tile, and the auto-fitting text inside it.
// ----------------------------------------------------------------------------
// Extracted from components/TutorCard.js so the centre card on /partners can
// render the identical tile rather than a second copy of its chrome. Both files
// import from here; neither redefines it.
//
// It is "use client" because FitText measures with a ResizeObserver. A SERVER
// component can still render <StatTile>: importing a client component marks
// that subtree only, it does not make the importer a client component (same
// note as app/partners/[slug]/PartnerCards.jsx on importing TutorCard).
// ============================================================================

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
export function FitText({ children, max = 18, min = 10, className = "", boxClassName = "", style }) {
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
export function StatTile({ value, label, tone = "accent", compact = false }) {
  const tones = {
    accent: { border: "var(--chip-line)", bg: "var(--desk)", color: "var(--accent)" },
    ink: { border: "var(--paper-line)", bg: "var(--desk-deep)", color: "var(--ink)" },
    muted: { border: "var(--paper-line)", bg: "var(--desk-deep)", color: "var(--sage)" },
  };
  const t = tones[tone] || tones.accent;
  return (
    <div
      className={
        compact
          ? "flex flex-col items-center justify-center gap-0.5 min-w-0 px-1 py-1"
          : "flex flex-col items-center justify-center gap-0.5 md:gap-1 min-w-0 px-1 py-1 md:px-2 md:py-[9px]"
      }
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
        boxClassName={compact ? "h-[15px]" : "h-[15px] md:h-[23px]"}
        className="tabular-nums leading-none"
        style={{ color: t.color, fontWeight: 300 }}
      >
        {value}
      </FitText>
      <span
        className={
          compact
            ? "font-medium uppercase whitespace-nowrap text-[7px]"
            : "font-medium uppercase whitespace-nowrap text-[7px] md:text-[10px]"
        }
        style={{ letterSpacing: "0.06em", color: "var(--sage)" }}
      >
        {label}
      </span>
    </div>
  );
}
