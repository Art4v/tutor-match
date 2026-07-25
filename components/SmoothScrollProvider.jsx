"use client";
import { useEffect } from "react";
import Lenis from "lenis";
import { registerLenis } from "@/lib/scrollLock";

/**
 * Inertial / "delayed" smooth scroll layer. Wraps the app once at the root.
 * - Disables on prefers-reduced-motion.
 * - Disables on coarse pointers (mobile) where native momentum scrolling feels better.
 * - Emits real scroll events, so CSS scroll-snap and IntersectionObserver keep working.
 */
export function SmoothScrollProvider({ children }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return;

    const lenis = new Lenis({
      duration: 0.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.2,
    });

    registerLenis(lenis);

    let rafId;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      registerLenis(null);
    };
  }, []);

  return children;
}
