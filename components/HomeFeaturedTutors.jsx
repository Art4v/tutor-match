"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { TutorCard } from "@/components/TutorCard";
import { HandwrittenHeading } from "@/components/HandwrittenHeading";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { EASE_OUT, DURATION_MED, STAGGER_FAST } from "@/lib/motion";

export function HomeFeaturedTutors({ tutors = [] }) {
  const empty = tutors.length === 0;

  return (
    <section className="relative overflow-hidden min-h-[70vh] flex flex-col justify-center desk-surface">
      {/* Cream desk with faint floating stationery. */}
      <DeskBackdrop />

      <div className="relative z-10 max-w-[1200px] w-full mx-auto px-6 py-10">
        <div className="max-w-[720px] mx-auto text-center flex flex-col items-center mb-7">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="font-hand text-[24px] mb-2"
            style={{ color: "var(--accent)", fontWeight: 600 }}
          >
            Featured
          </motion.div>
          <HandwrittenHeading as="h2" text="Browse our tutors." size={52} className="flex flex-col items-center" />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.1 }}
            className="text-[15.5px] text-[color:var(--ink-muted)] mt-3 leading-[1.55]"
          >
            {empty
              ? "No tutors have published their profiles yet — check back soon."
              : "Independently verified, currently accepting students."}
          </motion.p>
        </div>

        {!empty && (
          <>
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-8% 0px" }}
              variants={{
                hidden: {},
                // Hold the cards until the eyebrow + handwritten heading + subtitle
                // have animated in, so the grid clearly follows the text.
                show: { transition: { staggerChildren: STAGGER_FAST, delayChildren: 0.7 } },
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-[1060px] mx-auto"
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

            <div className="mt-7 flex justify-center">
              <Link
                href="/browse"
                className="group inline-flex items-center gap-2 text-[14px] font-medium relative"
                style={{ color: "var(--accent)" }}
              >
                See all tutors
                <Icon name="arrow-right" size={14} />
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-[24px] -bottom-0.5 h-px origin-left scale-x-0 group-hover:scale-x-100"
                  style={{ background: "var(--accent)", transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)" }}
                />
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
