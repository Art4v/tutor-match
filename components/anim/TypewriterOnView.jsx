"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

/**
 * Reveals `text` character-by-character once the element enters the viewport.
 * - Renders the full text invisibly to reserve layout space (no shift when typing finishes).
 * - Optional cursor (accent caret) while typing; disappears at the end.
 * - `onDone` callback fires when typing completes — used to chain clauses.
 * - Respects prefers-reduced-motion: text shows instantly.
 *
 * Props:
 *   text:        string to type
 *   speed:       ms per character (default 26)
 *   delay:       ms before typing starts (default 0)
 *   cursor:      show blinking caret while typing (default true)
 *   start:       boolean override — when false, blocks typing until set true.
 *                Use this to chain: clause B's start = clauseADone.
 *   as:          tag/className target (the wrapper renders as a span)
 *   className:   className for the wrapper
 *   onDone:      fires once typing finishes
 */
export function TypewriterOnView({
  text = "",
  speed = 26,
  delay = 0,
  cursor = true,
  start = true,
  as: As = "span",
  className = "",
  style,
  onDone,
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px -5% 0px" });
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!inView || !start) return;
    if (typeof window !== "undefined") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        setCount(text.length);
        setDone(true);
        onDoneRef.current && onDoneRef.current();
        return;
      }
    }
    const startTimer = setTimeout(() => {
      let i = 0;
      let last = performance.now();
      let rafId;
      const tick = (now) => {
        const elapsed = now - last;
        if (elapsed >= speed) {
          const steps = Math.max(1, Math.floor(elapsed / speed));
          i = Math.min(text.length, i + steps);
          setCount(i);
          last = now;
        }
        if (i < text.length) {
          rafId = requestAnimationFrame(tick);
        } else {
          setDone(true);
          onDoneRef.current && onDoneRef.current();
        }
      };
      rafId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafId);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [inView, start, text, speed, delay]);

  const visible = text.slice(0, count);
  const hidden = text.slice(count);
  const showCaret = cursor && inView && start && !done;

  return (
    <As ref={ref} className={className} style={style} aria-label={text}>
      <span aria-hidden="true">{visible}</span>
      {showCaret && <span className="typewriter-caret" aria-hidden="true" />}
      <span aria-hidden="true" style={{ opacity: 0 }}>{hidden}</span>
    </As>
  );
}
