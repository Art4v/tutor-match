"use client";
import { AnimatePresence, motion } from "motion/react";
import { TutorCard } from "@/components/TutorCard";
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

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: STAGGER_FAST, delayChildren: 0.05 } },
      }}
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7"
    >
      <AnimatePresence mode="popLayout">
        {visible.map((t) => (
          <motion.div
            key={t.id}
            layout
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0, transition: { duration: DURATION_MED, ease: EASE_OUT } },
            }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2, ease: EASE_OUT } }}
          >
            <TutorCard tutor={t} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
