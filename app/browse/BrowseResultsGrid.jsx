"use client";
import { motion } from "motion/react";
import { TutorCard } from "@/components/TutorCard";
import { EASE_OUT, DURATION_MED, STAGGER_FAST } from "@/lib/motion";

export function BrowseResultsGrid({ tutors }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: STAGGER_FAST, delayChildren: 0.05 } },
      }}
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
    >
      {tutors.map((t) => (
        <motion.div
          key={t.id}
          variants={{
            hidden: { opacity: 0, y: 14 },
            show: { opacity: 1, y: 0, transition: { duration: DURATION_MED, ease: EASE_OUT } },
          }}
        >
          <TutorCard tutor={t} />
        </motion.div>
      ))}
    </motion.div>
  );
}
