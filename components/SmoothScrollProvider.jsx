"use client";
import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Inertial / "delayed" smooth scroll layer. Wraps the app once at the root.
 * - Disables on prefers-reduced-motion.
 * - Disables on coarse pointers (mobile) where native momentum scrolling feels better.
 * - Emits real scroll events, so CSS scroll-snap and IntersectionObserver keep working.
 */

// The active Lenis instance, exposed so blocking overlays (PolicyConsentGate)
// can stop()/start() it — Lenis drives scrolling from its own wheel listener
// and RAF loop, so overflow:hidden on <body> doesn't stop it. Null when Lenis
// is disabled (reduced motion / coarse pointer).
let activeLenis = null;
export function getLenis() {
  return activeLenis;
}

export function SmoothScrollProvider({ children }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.2,
    });
    activeLenis = lenis;

    let rafId;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      activeLenis = null;
    };
  }, []);

  return children;
}
