"use client";
import { motion } from "motion/react";
import { EASE_OUT, DURATION_MED, STAGGER_FAST } from "@/lib/motion";

/**
 * The /partners feed's entry stagger, matching /browse so the two feeds arrive
 * the same way now that they share a card shape.
 *
 * Both wrappers take `children` rather than importing PartnerCard and mapping
 * over data the way BrowseResultsGrid does. That is what keeps the card on the
 * server: a client component that IMPORTS a component pulls it into the client
 * bundle, but one that merely renders children handed down from a server page
 * does not. Browse doesn't need the distinction, since TutorCard is client
 * already.
 *
 * Deliberately less than BrowseResultsGrid carries:
 *
 * No `layout` prop. Framer animates layout with transforms plus scale
 * corrections, which visibly smears a card containing a horizontal scroller and
 * can reset its scrollLeft. Browse needs it because it filters cards CLIENT
 * side (the saved-tutors toggle); /partners is URL-driven and re-renders from
 * the server, so nothing moves under the animation.
 *
 * No AnimatePresence or exit variant, for the same reason: nothing here is ever
 * removed client-side.
 */
export function PartnersFeed({ children }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: STAGGER_FAST, delayChildren: 0.05 } },
      }}
      className="flex flex-col gap-4"
    >
      {children}
    </motion.div>
  );
}

export function PartnersFeedItem({ children }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: DURATION_MED, ease: EASE_OUT } },
      }}
    >
      {children}
    </motion.div>
  );
}
