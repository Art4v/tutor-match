"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Cursive "written-on" heading (pencil-on-paper theme).
 *
 * Renders the heading in the real Caveat web font (graphite ink) and reveals it
 * with a left-to-right clip wipe on view, so each line appears as if being
 * written. Using the live font (not opentype-generated SVG paths) means every
 * glyph always renders — the variable Caveat font emits NaN path commands that
 * silently truncate an SVG <path>, which is why the stroke-draw approach clipped
 * words mid-way.
 *
 * PURELY PRESENTATIONAL — same text, same semantic tag (`as`). No logic/data.
 *
 * Props:
 *   as     — heading tag ("h1" | "h2" | "h3" | "span"), default "h2"
 *   text   — single-line string (or use `lines`)
 *   lines  — string[] for multi-line headings (each line writes on, staggered)
 *   size   — font-size in px (responsive: scales down via CSS clamp)
 *   color  — text colour, default graphite ink token
 *   className / style — applied to the wrapper tag
 */
export function HandwrittenHeading({
  as: Tag = "h2",
  text,
  lines,
  size = 64,
  color = "var(--ink-graphite)",
  className = "",
  style,
}) {
  const rows = (lines && lines.length ? lines : [text ?? ""]).map((s) => String(s));
  const label = rows.join(" ");
  const wrapRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Responsive size: never exceeds `size`, shrinks on small viewports.
  const fontSize = `clamp(${Math.round(size * 0.42)}px, ${(size / 16).toFixed(2)}rem, ${size}px)`;

  return (
    <Tag
      ref={wrapRef}
      className={`font-hand ${className}`}
      style={{ color, lineHeight: 1.04, fontWeight: 700, ...style }}
      aria-label={label}
    >
      {rows.map((line, i) => (
        <span
          key={i}
          className={`hand-write-line${inView ? " is-writing" : ""}`}
          style={{
            display: "block",
            fontSize,
            // @ts-ignore CSS custom props
            "--write-delay": `${i * 0.5}s`,
            "--write-dur": `${Math.min(1.8, 0.6 + line.length * 0.05)}s`,
          }}
        >
          {line}
        </span>
      ))}
    </Tag>
  );
}

export default HandwrittenHeading;
