"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { EASE_OUT } from "@/lib/motion";

/**
 * Auto-advancing cross-fade slideshow. Images are stacked absolutely and the
 * active one fades to opacity 1 while the others fade to 0, so the outgoing and
 * incoming frames cross-dissolve.
 *
 * Respects prefers-reduced-motion the same way TypewriterOnView / .accent-shine
 * do elsewhere: when reduce is set we freeze on the first image, run no timer,
 * and use a zero-duration transition so nothing animates.
 *
 * Props:
 *   images:        [{ src, alt }]
 *   interval:      ms each slide holds before advancing (default 4500)
 *   fade:          cross-fade duration in seconds (default 1.1)
 *   priorityFirst: eager-load the first slide (it's near the LCP in the hero)
 *   className / imgClassName / style: passed through to wrapper / <img>s
 */
export function CrossfadeSlideshow({
  images = [],
  interval = 4500,
  fade = 1.1,
  className = "",
  imgClassName = "",
  style,
  priorityFirst = false,
}) {
  const [index, setIndex] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e) => setReduce(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reduce || images.length <= 1) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % images.length),
      interval,
    );
    return () => clearInterval(id);
  }, [reduce, images.length, interval]);

  if (images.length === 0) return null;

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{ position: "relative", overflow: "hidden", ...style }}
    >
      {images.map((img, i) => {
        const active = reduce ? i === 0 : i === index;
        return (
          <motion.img
            key={img.src}
            src={img.src}
            alt={img.alt || ""}
            className={imgClassName}
            loading={priorityFirst && i === 0 ? "eager" : "lazy"}
            draggable={false}
            initial={false}
            animate={{ opacity: active ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : fade, ease: EASE_OUT }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              userSelect: "none",
            }}
          />
        );
      })}
    </div>
  );
}
