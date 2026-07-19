"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { TutorCard } from "@/components/TutorCard";
import { EASE_OUT } from "@/lib/motion";

// SHELVED: nothing renders this component (see app/page.js). The numbers below
// describe the OLD 340x530 portrait TutorCard. TutorCard is now a wide
// horizontal row (~256px tall, full width of its column), so this stack would
// need a real rework — not just new constants — before it could be un-shelved:
// a 3-up carousel of full-width rows doesn't fit the hero's right column at all.
const CARD_HEIGHT = 530;
const CARD_WIDTH = 340;
// The hero showed the card a touch smaller than the /browse grid did. Done as a
// transform on the whole stack rather than by shrinking the card itself, which
// is shared with /browse.
const STACK_SCALE = 0.96;
const AUTO_MS = 4500;

/**
 * A stacked carousel of tutor cards for the hero's right column: one focused
 * card in the centre with a single dimmed card peeking symmetrically on each
 * side. Auto-advances on a timer (paused on hover / after a manual arrow click /
 * under prefers-reduced-motion) and can be stepped with the chevron arrows.
 * Every card keeps its own `/tutor/[slug]` link (TutorCard wraps itself in one),
 * so clicking a peek card opens that tutor's profile.
 */
export function HeroTutorStack({ tutors = [] }) {
  const n = tutors.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on every manual step so the auto-advance timer restarts cleanly
  // (no double-advance right after a click).
  const [tick, setTick] = useState(0);

  // Pause auto-rotation when the user prefers reduced motion.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const go = (dir) => {
    setActive((a) => (a + dir + n) % n);
    setTick((t) => t + 1);
  };

  useEffect(() => {
    if (paused || reduced || n < 2) return;
    const id = setInterval(() => setActive((a) => (a + 1) % n), AUTO_MS);
    return () => clearInterval(id);
  }, [paused, reduced, n, tick]);

  if (n === 0) return null;

  return (
    <div
      className="relative w-full max-w-[460px] mx-auto"
      // Reserve the SCALED height so the shrink doesn't leave a gap underneath
      // (a transform doesn't affect layout size). The arrows live outside the
      // scaled wrapper, so they keep their 44px hit target.
      style={{ height: CARD_HEIGHT * STACK_SCALE }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="absolute inset-x-0 top-0"
        style={{ height: CARD_HEIGHT, transform: `scale(${STACK_SCALE})`, transformOrigin: "top center" }}
      >
      {tutors.map((tutor, i) => {
        // Shortest signed distance from the active card (wrap-around).
        let d = i - active;
        if (d > n / 2) d -= n;
        if (d < -n / 2) d += n;

        const isCenter = d === 0;
        const isLeft = d === -1;
        const isRight = d === 1;
        const visible = isCenter || isLeft || isRight;

        const target = isCenter
          ? { x: 0, scale: 1, opacity: 1 }
          : isLeft
          ? { x: -64, scale: 0.9, opacity: 0.5 }
          : isRight
          ? { x: 64, scale: 0.9, opacity: 0.5 }
          : { x: 0, scale: 0.8, opacity: 0 };

        const zIndex = isCenter ? 30 : visible ? 20 : 10;

        return (
          <motion.div
            key={tutor.id ?? tutor.slug ?? i}
            className="absolute top-0 left-1/2 w-full"
            style={{
              zIndex,
              maxWidth: CARD_WIDTH,
              marginLeft: -CARD_WIDTH / 2,
              pointerEvents: visible ? "auto" : "none",
            }}
            initial={false}
            animate={target}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <TutorCard tutor={tutor} showSave={false} />
          </motion.div>
        );
      })}
      </div>

      {n > 1 && (
        <>
          <StackArrow side="left" onClick={() => go(-1)} />
          <StackArrow side="right" onClick={() => go(1)} />
        </>
      )}
    </div>
  );
}

// Minimal arrow: a bare, vertically elongated chevron in faded grey — no pill,
// no shadow. A soft rectangle fades in on hover to show it's a target. The
// chevron is hand-drawn rather than the shared `chevron-left` Icon because that
// one is on a square 24 grid and can't be stretched without thinning its stroke.
function StackArrow({ side, onClick }) {
  const isLeft = side === "left";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? "Previous tutor" : "Next tutor"}
      className="group absolute top-1/2 -translate-y-1/2 z-40 inline-flex items-center justify-center px-2 py-2 bg-transparent"
      style={{ [isLeft ? "left" : "right"]: -8 }}
    >
      {/* Hover rectangle, behind the chevron. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: "rgba(255,255,255,0.72)", border: "1px solid var(--line)", borderRadius: 6 }}
      />
      <svg
        width="14"
        height="44"
        viewBox="0 0 14 44"
        fill="none"
        aria-hidden="true"
        className="relative text-[color:var(--sage)] opacity-45 transition-opacity duration-200 group-hover:opacity-90"
      >
        <path
          d={isLeft ? "M10 3 L4 22 L10 41" : "M4 3 L10 22 L4 41"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
