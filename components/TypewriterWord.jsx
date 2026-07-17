"use client";
import { useEffect, useState } from "react";

/**
 * Looping typewriter word — types each word character-by-character, holds it,
 * erases it, then moves to the next, forever (Wyzant-style hero headline).
 *
 * PURELY PRESENTATIONAL — takes the word list as a prop, no data fetching.
 * Rendered `aria-hidden`: the semantic headline text is the parent's
 * `aria-label` (see HomeHero), so the churn never reaches screen readers.
 *
 * Props:
 *   words      — string[] to cycle through (renders nothing when empty)
 *   startDelay — ms before the first character (lets the hero's entrance
 *                settle first), default 600
 *   typeMs / eraseMs / holdMs / gapMs — per-char type/erase speed, full-word
 *                hold, and empty pause between words
 *   className / style — applied to the wrapper span
 */
export function TypewriterWord({
  words = [],
  startDelay = 600,
  typeMs = 80,
  eraseMs = 45,
  holdMs = 1600,
  gapMs = 350,
  className = "",
  style,
}) {
  const n = words.length;

  // Skip the per-character churn when the user prefers reduced motion.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // One state object drives the machine: each transition schedules the next
  // via a single timeout, so unmount cleanup is just clearTimeout.
  // Phases: wait (startDelay) → typing ⇄ erasing (hold/gap are the timeouts
  // on the phase boundaries).
  const [pos, setPos] = useState({ i: 0, len: 0, phase: "wait" });

  useEffect(() => {
    if (n === 0 || reduced) return;
    const word = words[pos.i % n];
    let delay;
    let next;
    if (pos.phase === "wait") {
      delay = startDelay;
      next = { ...pos, phase: "typing" };
    } else if (pos.phase === "typing") {
      if (pos.len < word.length) {
        delay = typeMs;
        next = { ...pos, len: pos.len + 1 };
      } else {
        delay = holdMs;
        next = { ...pos, phase: "erasing" };
      }
    } else {
      if (pos.len > 0) {
        delay = eraseMs;
        next = { ...pos, len: pos.len - 1 };
      } else {
        delay = gapMs;
        next = { i: (pos.i + 1) % n, len: 0, phase: "typing" };
      }
    }
    const id = setTimeout(() => setPos(next), delay);
    return () => clearTimeout(id);
  }, [pos, reduced, n, words, startDelay, typeMs, eraseMs, holdMs, gapMs]);

  // Reduced motion: swap the whole word on a calm interval instead of typing.
  useEffect(() => {
    if (n < 2 || !reduced) return;
    const id = setInterval(
      () => setPos((p) => ({ ...p, i: (p.i + 1) % n })),
      3000
    );
    return () => clearInterval(id);
  }, [reduced, n]);

  if (n === 0) return null;

  const word = words[pos.i % n];
  const shown = reduced ? word : word.slice(0, pos.len);

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ color: "var(--accent)", whiteSpace: "nowrap", ...style }}
    >
      {shown}
      {!reduced && (
        <span
          className="type-caret"
          style={{
            display: "inline-block",
            width: 3,
            height: "0.9em",
            borderRadius: 2,
            background: "var(--accent)",
            verticalAlign: "-0.08em",
            marginLeft: 3,
          }}
        />
      )}
    </span>
  );
}

export default TypewriterWord;
