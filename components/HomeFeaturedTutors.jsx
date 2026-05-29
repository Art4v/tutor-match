"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { TutorCard } from "@/components/TutorCard";
import { TypewriterOnView } from "@/components/anim/TypewriterOnView";
import { EASE_OUT, DURATION_MED, STAGGER_FAST } from "@/lib/motion";

export function HomeFeaturedTutors({ tutors = [], totalTutors = 0 }) {
  const [headlineDone, setHeadlineDone] = useState(false);
  const empty = tutors.length === 0;
  const seeAllLabel = "See all tutors";

  return (
    <section
      className="snap-section"
      style={{
        background:
          "radial-gradient(40% 45% at 82% 28%, rgba(30,58,138,0.06) 0%, rgba(255,255,255,0) 60%)",
      }}
    >
      <div className="max-w-[1200px] w-full mx-auto px-6 pt-10 pb-6">
        <div className="flex items-end justify-between mb-4 gap-6">
          <div className="max-w-[720px]">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="font-display italic text-[18px] mb-4 accent-shine"
              style={{ color: "var(--accent)", fontWeight: 500 }}
            >
              Featured
            </motion.div>
            <h2
              className="font-display text-[40px] md:text-[52px] leading-[1.05] text-slate-900"
              style={{ fontWeight: 500 }}
            >
              <TypewriterOnView
                text="Browse our tutors."
                speed={26}
                onDone={() => setHeadlineDone(true)}
              />
            </h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={headlineDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.1 }}
              className="text-[15.5px] text-slate-500 mt-4 leading-[1.55]"
            >
              {empty
                ? "No tutors have published their profiles yet — check back soon."
                : "Independently verified, currently accepting students."}
            </motion.p>
          </div>

          {!empty && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={headlineDone ? { opacity: 1, x: 0 } : { opacity: 0, x: 10 }}
              transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.2 }}
              className="hidden md:block"
            >
              <Link
                href="/browse"
                className="group inline-flex items-center gap-2 text-[13.5px] font-medium relative"
                style={{ color: "var(--accent)" }}
              >
                {seeAllLabel}
                <span className="relative inline-flex">
                  <Icon name="arrow-right" size={14} />
                </span>
                <span
                  aria-hidden="true"
                  className="absolute left-0 right-[24px] -bottom-0.5 h-px origin-left scale-x-0 group-hover:scale-x-100"
                  style={{
                    background: "var(--accent)",
                    transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
              </Link>
            </motion.div>
          )}
        </div>

        {!empty && (
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-8% 0px" }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: STAGGER_FAST, delayChildren: 0.2 } },
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
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
        )}
      </div>
    </section>
  );
}
