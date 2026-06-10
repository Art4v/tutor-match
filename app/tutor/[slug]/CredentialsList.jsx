"use client";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { EASE_OUT } from "@/lib/motion";

/**
 * Waterfall reveal: each credential row drops in from above, one after the
 * other, with a clear sequential cadence.
 */
export function CredentialsList({ tiles }) {
  if (!tiles?.length) return null;
  return (
    <motion.div
      className="flex flex-col gap-2.5"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.4, delayChildren: 0.05 } },
      }}
    >
      {tiles.map((c) => (
        <motion.div
          key={c.key}
          className="px-4 py-3 flex items-center gap-4"
          style={{ border: "1px solid var(--paper-line)", borderRadius: 12, background: "var(--bg-soft)" }}
          variants={{
            hidden: { opacity: 0, y: -22 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: EASE_OUT },
            },
          }}
        >
          <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 uppercase tracking-wider font-medium w-[120px] shrink-0">
            <Icon name={c.icon} size={12} /> {c.caption}
          </div>
          <div className={`text-[14px] font-semibold text-slate-900 leading-snug${c.kind === "stat" ? " tabular-nums" : ""}`}>
            {c.value}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
