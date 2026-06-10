"use client";
import { useEffect, useRef } from "react";

/* ───────────────────────────── Tunables ───────────────────────────── */
const DENSITY = 9500; // one dot per ~this many px² of canvas area
const MAX_DOTS = 150;
const MIN_DOTS = 36;
const LINK_DIST = 132; // px: connect dots closer than this
const SPEED = 0.18; // px/frame drift
const DOT_COLOR = "58, 61, 68"; // graphite
const LINE_COLOR = "74, 78, 87"; // graphite ink
const DOT_RADIUS = 1.6;

/**
 * Animated "neural network" constellation — graphite dots drift across the
 * canvas and connect with lines when near. Pure presentation; fills its parent.
 * Transparent canvas so the parent's cream paper shows through.
 */
export function ParticleNetwork({ className = "", style }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dots = [];
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const seed = () => {
      const count = Math.max(MIN_DOTS, Math.min(MAX_DOTS, Math.round((w * h) / DENSITY)));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 2 * SPEED,
        vy: (Math.random() - 0.5) * 2 * SPEED,
      }));
    };

    const fit = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect?.width ?? window.innerWidth));
      h = Math.max(1, Math.floor(rect?.height ?? window.innerHeight));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Links first, so dots sit on top.
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.5;
            ctx.strokeStyle = `rgba(${LINE_COLOR}, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = `rgba(${DOT_COLOR}, 0.6)`;
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x <= 0 || d.x >= w) d.vx *= -1;
        if (d.y <= 0 || d.y >= h) d.vy *= -1;
        d.x = Math.max(0, Math.min(w, d.x));
        d.y = Math.max(0, Math.min(h, d.y));
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    fit();
    if (reduce) {
      draw(); // one static frame
    } else {
      raf = requestAnimationFrame(step);
    }

    const ro = new ResizeObserver(() => {
      fit();
      if (reduce) draw();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  );
}

export default ParticleNetwork;
