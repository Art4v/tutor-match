"use client";
import { AnimatePresence, motion } from "motion/react";
import { TutorRow } from "@/components/TutorRow";
import { useSavedTutors } from "@/components/SavedTutorsProvider";
import { EASE_OUT, DURATION_MED, STAGGER_FAST } from "@/lib/motion";

export function BrowseResultsGrid({ tutors, savedOnly = false }) {
  const { ready, isSaved } = useSavedTutors();

  // On the saved filter, the list is server-rendered from the saved set at load
  // time. Unsaving a tutor only flips client state, so without this the card
  // would linger until a refresh. Once the saved set is loaded, drop any card
  // that's no longer saved so an unsave removes it immediately. Before `ready`
  // we show the server list untouched (it already equals the saved set), so
  // there's no empty flash on load.
  const visible = savedOnly && ready ? tutors.filter((t) => isSaved(t.id)) : tutors;

  // A ruled list of rows: the list draws the rules (top on the <ul>, bottom on
  // each <li>), never the row.
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
      <AnimatePresence mode="popLayout">
        {visible.map((t) => (
          <motion.li
            key={t.id}
            layout
            className="border-b border-[color:var(--paper-line)]"
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: DURATION_MED, ease: EASE_OUT } },
            }}
            exit={{ opacity: 0, transition: { duration: 0.2, ease: EASE_OUT } }}
          >
            <TutorRow tutor={t} />
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
