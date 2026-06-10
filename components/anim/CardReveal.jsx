"use client";
import { motion } from "motion/react";
import { EASE_OUT } from "@/lib/motion";

/**
 * `RevealChildren` — wraps the inner content of a card so it fades in after
 * the card container itself has settled. Pair with a SectionReveal-wrapped
 * card outer; the outer animates first (~0.5s), then this layer fades.
 *
 * Use for any non-text child: chips, lists, icons, buttons, images, dividers.
 */
export function RevealChildren({ children, delay = 0.55, y = 6, className = "", style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/**
 * `StaggerChildren` — for cards whose contents are a series of small items
 * (chips, list rows). Direct children must be motion.* elements or wrapped in
 * `RevealItem` below.
 */
export function StaggerChildren({ children, delay = 0.5, step = 0.06, className = "", style }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: step, delayChildren: delay } },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, y = 6, className = "", style }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
