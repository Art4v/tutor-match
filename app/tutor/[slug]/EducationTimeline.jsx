"use client";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { EASE_OUT } from "@/lib/motion";

/**
 * Waterfall reveal: each row drops in from above, one after the other,
 * with the connector line drawing down between markers.
 */
export function EducationTimeline({ education }) {
  if (!education?.length) return null;
  const last = education.length - 1;

  return (
    <motion.ul
      className="space-y-5"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.4, delayChildren: 0.05 } },
      }}
    >
      {education.map((e, i) => (
        <motion.li
          key={i}
          className="flex gap-4 items-start"
          variants={{
            hidden: { opacity: 0, y: -24 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: EASE_OUT },
            },
          }}
        >
          <div className="flex flex-col items-center" style={{ width: 32 }}>
            <div
              className="w-8 h-8 rounded-md inline-flex items-center justify-center text-slate-600 shrink-0"
              style={{ background: "var(--desk)" }}
            >
              <Icon name="graduation" size={14} />
            </div>
            {i < last && (
              <motion.div
                style={{
                  width: 1,
                  flex: 1,
                  background: "var(--paper-line)",
                  marginTop: 4,
                  minHeight: 16,
                  transformOrigin: "top center",
                }}
                variants={{
                  hidden: { scaleY: 0 },
                  show: {
                    scaleY: 1,
                    transition: { duration: 0.32, ease: EASE_OUT, delay: 0.18 },
                  },
                }}
              />
            )}
          </div>

          <div className="pb-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[14.5px] font-semibold text-slate-900">{e.school}</div>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full text-slate-600"
                style={{ background: "var(--desk)" }}
              >
                {e.level === "university" ? "University" : "High School"}
              </span>
            </div>
            <div className="text-[13.5px] text-slate-500 mt-0.5">{e.detail}</div>
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}
