"use client";
import { Children } from "react";
import { motion } from "motion/react";
import { EASE_OUT, DURATION_MED, STAGGER_FAST } from "@/lib/motion";

/**
 * Staggered mount fade for a column of profile cards — the same short entrance
 * the browse results use (app/browse/BrowseResultsGrid.jsx). It fires on mount,
 * not on scroll, so a card is never blank when it's already in view.
 *
 * Children are wrapped individually, so conditionally-rendered cards
 * (`{cond && <Card/>}`) pass through untouched when they're false.
 */
export function RevealStack({ children, className, as = "div", delayChildren = 0.05 }) {
  const Comp = motion[as] || motion.div;
  return (
    <Comp
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: STAGGER_FAST, delayChildren } },
      }}
      className={className}
    >
      {Children.map(children, (child) =>
        child == null || typeof child === "boolean" ? child : (
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: DURATION_MED, ease: EASE_OUT } },
            }}
          >
            {child}
          </motion.div>
        )
      )}
    </Comp>
  );
}
