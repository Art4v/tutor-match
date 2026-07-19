"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * Social proof strip between the hero and "How it works": one row of six fixed
 * slots, each holding a top NSW/VIC high school. Every 2.5s a single slot
 * crossfades to a school not already on screen, so the row is always in gentle
 * motion but never blank. Replaces the old two-row CSS marquee.
 *
 * Two deliberate constraints:
 *  - The first six are rendered in list order so server and client agree;
 *    randomisation only starts once the interval runs after mount.
 *  - All six slots are always in the DOM. Narrow screens hide slots with
 *    responsive classes rather than state, so there is no hydration mismatch
 *    and no first-paint pop. `visibleCount` only steers which slots the timer
 *    bothers to swap.
 */

// `name` is the full school name (used for the image `alt` and the screen
// reader list); `short` is the compact display label; `logo` is the crest under
// /public/images/marquee (sourced from each school's Wikipedia infobox). A null
// `logo` falls back to text only, so a slot never breaks if a crest is missing.
const POOL = [
  { name: "James Ruse Agricultural High School", short: "James Ruse Agricultural HS", logo: "/images/marquee/james-ruse.png" },
  { name: "North Sydney Boys High School", short: "North Sydney Boys HS", logo: "/images/marquee/north-sydney-boys.jpg" },
  { name: "North Sydney Girls High School", short: "North Sydney Girls HS", logo: "/images/marquee/north-sydney-girls.png" },
  { name: "Sydney Boys High School", short: "Sydney Boys HS", logo: "/images/marquee/sydney-boys.svg" },
  { name: "Sydney Girls High School", short: "Sydney Girls HS", logo: "/images/marquee/sydney-girls.png" },
  { name: "Baulkham Hills High School", short: "Baulkham Hills HS", logo: "/images/marquee/baulkham-hills.png" },
  { name: "Hornsby Girls High School", short: "Hornsby Girls HS", logo: "/images/marquee/hornsby-girls.png" },
  { name: "Normanhurst Boys High School", short: "Normanhurst Boys HS", logo: "/images/marquee/normanhurst-boys.png" },
  { name: "Fort Street High School", short: "Fort Street HS", logo: "/images/marquee/fort-street.png" },
  { name: "Girraween High School", short: "Girraween HS", logo: "/images/marquee/girraween.png" },
  { name: "Penrith High School", short: "Penrith HS", logo: "/images/marquee/penrith.png" },
  { name: "St George Girls High School", short: "St George Girls HS", logo: "/images/marquee/st-george-girls.png" },
  { name: "Hurlstone Agricultural High School", short: "Hurlstone Agricultural HS", logo: "/images/marquee/hurlstone.png" },
  { name: "Sydney Grammar School", short: "Sydney Grammar", logo: "/images/marquee/sydney-grammar.png" },
  { name: "Abbotsleigh", short: "Abbotsleigh", logo: "/images/marquee/abbotsleigh.png" },
  { name: "Mac.Robertson Girls' High School", short: "Mac.Robertson Girls HS", logo: "/images/marquee/macrobertson-girls.png" },
  { name: "Bacchus Marsh Grammar", short: "Bacchus Marsh Grammar", logo: "/images/marquee/bacchus-marsh-grammar.svg" },
  { name: "Nossal High School", short: "Nossal HS", logo: "/images/marquee/nossal.png" },
  { name: "Haileybury", short: "Haileybury", logo: "/images/marquee/haileybury.svg" },
  { name: "Ruyton Girls' School", short: "Ruyton Girls' School", logo: "/images/marquee/ruyton-girls.svg" },
  { name: "Melbourne Girls Grammar", short: "Melbourne Girls Grammar", logo: "/images/marquee/melbourne-girls-grammar.png" },
  { name: "Melbourne High School", short: "Melbourne HS", logo: "/images/marquee/melbourne-high.png" },
  { name: "Melbourne Grammar School", short: "Melbourne Grammar", logo: "/images/marquee/melbourne-grammar.png" },
  { name: "Huntingtower School", short: "Huntingtower", logo: "/images/marquee/huntingtower.png" },
];

const SLOTS = 6;
// Each swap waits a fresh random gap in this range, so the row never settles
// into a metronome the eye can predict.
const SWAP_MIN_MS = 1200;
const SWAP_MAX_MS = 1700;
const FADE_S = 1.1;
const LOGO_H = 34;
const LOGO_W = 48;

// Which slots a given breakpoint actually shows. Mirrors the responsive classes
// on the slots below; keep the two in sync.
function useVisibleCount() {
  const [count, setCount] = useState(SLOTS);
  useEffect(() => {
    const md = window.matchMedia("(min-width: 768px)");
    const sm = window.matchMedia("(min-width: 640px)");
    const sync = () => setCount(md.matches ? 6 : sm.matches ? 3 : 2);
    sync();
    md.addEventListener("change", sync);
    sm.addEventListener("change", sync);
    return () => {
      md.removeEventListener("change", sync);
      sm.removeEventListener("change", sync);
    };
  }, []);
  return count;
}

function Slot({ school, className }) {
  return (
    // Fixed height because the crossfading children are absolutely positioned
    // and so contribute no height of their own.
    <div className={`relative items-center justify-center ${className}`} style={{ height: 48 }}>
      {/* `sync` lets the outgoing and incoming schools overlap, so the slot
          crossfades rather than dipping to empty. */}
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={school.name}
          className="absolute inset-0 flex items-center justify-start gap-2.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_S, ease: "easeInOut" }}
        >
          {school.logo && (
            // Every crest is normalised to the same 34px HEIGHT rather than
            // boxed into a square: nearly all the logos are portrait shields,
            // so equal height is what reads as equal size. The column is a
            // fixed width (the widest logo, Nossal at 1.42:1, is exactly 48px
            // at 34 tall) so the label always starts at the same offset and the
            // row keeps an even rhythm as schools swap. Re-measure LOGO_W if a
            // wider logo is ever added. Desaturated so the crest palettes read
            // as one calm band.
            <span
              className="flex items-center justify-center shrink-0"
              style={{ width: LOGO_W, height: LOGO_H }}
            >
              <img
                src={school.logo}
                alt=""
                draggable={false}
                style={{ height: "100%", width: "auto", maxWidth: "100%", objectFit: "contain", filter: "grayscale(1)", opacity: 0.65 }}
              />
            </span>
          )}
          <span
            className="text-[12.5px] font-medium leading-tight min-w-0"
            style={{ color: "#5E7A78", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {school.short || school.name}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function SchoolsStrip() {
  // Indices into POOL. First render is list order, so SSR and hydration match.
  const [slots, setSlots] = useState(() => Array.from({ length: SLOTS }, (_, i) => i));
  const visibleCount = useVisibleCount();
  const reduceMotion = useReducedMotion();
  const cursor = useRef(0);
  const visibleRef = useRef(visibleCount);
  visibleRef.current = visibleCount;

  // Warm the cache for crests that aren't mounted yet, so a swap doesn't fade
  // in a half-loaded image. Local files, so this is cheap.
  useEffect(() => {
    for (const { logo } of POOL) {
      if (logo) new Image().src = logo;
    }
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    // A self-rescheduling timeout rather than an interval: the gap is redrawn
    // after every swap.
    let id;
    const tick = () => {
      // Don't burn through the pool while the tab is backgrounded.
      if (!document.hidden) {
        setSlots((prev) => {
          // Round-robin over the *visible* slots only, so narrow screens don't
          // waste most swaps on hidden ones.
          const target = cursor.current % visibleRef.current;
          cursor.current += 1;
          // Never show the same school twice in the row.
          const candidates = POOL.map((_, i) => i).filter((i) => !prev.includes(i));
          if (!candidates.length) return prev;
          const next = [...prev];
          next[target] = candidates[Math.floor(Math.random() * candidates.length)];
          return next;
        });
      }
      id = setTimeout(tick, SWAP_MIN_MS + Math.random() * (SWAP_MAX_MS - SWAP_MIN_MS));
    };
    id = setTimeout(tick, SWAP_MIN_MS + Math.random() * (SWAP_MAX_MS - SWAP_MIN_MS));
    return () => clearTimeout(id);
  }, [reduceMotion]);

  return (
    <section
      className="border-y flex flex-col justify-center"
      style={{ background: "var(--desk-deep)", borderColor: "var(--line-soft)", padding: "28px 0" }}
      aria-label="Schools our tutors come from"
    >
      <div className="w-full px-6 pb-4 text-center">
        <span
          className="text-[13px] font-medium uppercase"
          style={{ color: "var(--sage)", letterSpacing: "0.1em" }}
        >
          Trusted tutors from
        </span>
      </div>

      {/* The cycling row is decorative churn; the static list below carries the
          same information to screen readers once, without the churn. */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-2 max-w-6xl w-full mx-auto px-6"
        aria-hidden="true"
      >
        {slots.map((poolIndex, slot) => (
          <Slot
            key={slot}
            school={POOL[poolIndex]}
            className={slot < 2 ? "flex" : slot < 3 ? "hidden sm:flex" : "hidden md:flex"}
          />
        ))}
      </div>

      <ul className="sr-only">
        {POOL.map((s) => (
          <li key={s.name}>{s.name}</li>
        ))}
      </ul>
    </section>
  );
}

export default SchoolsStrip;
