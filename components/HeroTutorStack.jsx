"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { TutorCard } from "@/components/TutorCard";
import { EASE_OUT } from "@/lib/motion";

// Height of a TutorCard (CARD_HEIGHT in TutorCard.js) — the stack reserves this
// so the absolutely-positioned cards have a box to live in.
const CARD_HEIGHT = 504;
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
      style={{ height: CARD_HEIGHT }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
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
          ? { x: -64, scale: 0.9, opacity: 0.6 }
          : isRight
          ? { x: 64, scale: 0.9, opacity: 0.6 }
          : { x: 0, scale: 0.8, opacity: 0 };

        const zIndex = isCenter ? 30 : visible ? 20 : 10;

        return (
          <motion.div
            key={tutor.id ?? tutor.slug ?? i}
            className="absolute top-0 left-1/2 w-full max-w-[340px]"
            style={{ zIndex, marginLeft: -170, pointerEvents: visible ? "auto" : "none" }}
            initial={false}
            animate={target}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          >
            <TutorCard tutor={tutor} />
          </motion.div>
        );
      })}

      {n > 1 && (
        <>
          <StackArrow side="left" onClick={() => go(-1)} />
          <StackArrow side="right" onClick={() => go(1)} />
        </>
      )}
    </div>
  );
}

function StackArrow({ side, onClick }) {
  const isLeft = side === "left";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? "Previous tutor" : "Next tutor"}
      className="absolute top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full inline-flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      style={{
        [isLeft ? "left" : "right"]: -6,
        background: "var(--paper-card)",
        border: "1px solid var(--line)",
        color: "var(--ink)",
        boxShadow: "0 6px 18px -8px rgba(60,55,45,0.28)",
      }}
    >
      <Icon name={isLeft ? "chevron-left" : "chevron-right"} size={20} />
    </button>
  );
}
