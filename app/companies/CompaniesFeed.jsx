"use client";
import { motion } from "motion/react";
import { EASE_OUT, DURATION_MED, STAGGER_FAST } from "@/lib/motion";

/**
 * The /companies feed's entry stagger, matching /browse so the two feeds arrive
 * the same way now that both are ruled lists of rows.
 *
 * Both wrappers take `children` rather than importing CompanyCard and mapping
 * over data the way BrowseResultsGrid does. That is what keeps the card on the
 * server: a client component that IMPORTS a component pulls it into the client
 * bundle, but one that merely renders children handed down from a server page
 * does not. Browse doesn't need the distinction, since TutorRow is client
 * already.
 *
 * Deliberately less than BrowseResultsGrid carries:
 *
 * No `layout` prop. Framer animates layout with transforms plus scale
 * corrections, which can smear a row's contents. Browse needs it because it filters rows CLIENT
 * side (the saved-tutors toggle); /companies is URL-driven and re-renders from
 * the server, so nothing moves under the animation.
 *
 * No AnimatePresence or exit variant, for the same reason: nothing here is ever
 * removed client-side.
 */
export function CompaniesFeed({ children }) {
  // A ruled list of company rows: the list draws the rules, never the row.
  return (
    <motion.ul
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: STAGGER_FAST, delayChildren: 0.05 } },
      }}
      className="border-t border-[color:var(--paper-line)]"
    >
      {children}
    </motion.ul>
  );
}

export function CompaniesFeedItem({ children }) {
  return (
    <motion.li
      className="border-b border-[color:var(--paper-line)]"
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: DURATION_MED, ease: EASE_OUT } },
      }}
    >
      {children}
    </motion.li>
  );
}
