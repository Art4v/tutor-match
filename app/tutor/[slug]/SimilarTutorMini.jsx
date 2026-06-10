"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Avatar, VerifiedTick } from "@/components/ui";
import { EASE_OUT } from "@/lib/motion";
import { stripMarkdown } from "@/lib/richText";

// Same hover choreography as TutorCard: small lift + shake wobble + shadow.
const miniVariants = {
  rest: {
    y: 0,
    rotate: 0,
    boxShadow: "0 0 0 0 rgba(15,23,42,0)",
    borderColor: "var(--paper-line)",
    transition: {
      y: { duration: 0.45, ease: EASE_OUT },
      rotate: { duration: 0.4, ease: EASE_OUT },
      boxShadow: { duration: 0.4, ease: EASE_OUT },
      borderColor: { duration: 0.3, ease: EASE_OUT },
    },
  },
  hover: {
    y: -4,
    rotate: [0, -0.9, 0.9, -0.45, 0.2, 0],
    boxShadow: "0 18px 36px -20px rgba(15,23,42,0.22)",
    borderColor: "var(--line-strong)",
    transition: {
      y: { duration: 0.42, ease: EASE_OUT },
      rotate: {
        duration: 0.62,
        ease: "easeOut",
        times: [0, 0.18, 0.4, 0.62, 0.82, 1],
      },
      boxShadow: { duration: 0.42, ease: EASE_OUT },
      borderColor: { duration: 0.3, ease: EASE_OUT },
    },
  },
};

export function SimilarTutorMini({ tutor }) {
  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={miniVariants}
      className="paper-page"
      style={{
        background: "var(--paper-card)",
        border: "1px solid var(--paper-line)",
        borderRadius: 12,
        willChange: "transform, box-shadow",
      }}
    >
      <Link
        href={`/tutor/${tutor.slug}`}
        className="block overflow-hidden"
        style={{ borderRadius: 12 }}
      >
        <div
          style={tutor.bannerImg
            ? { height: 28, background: `url(${tutor.bannerImg}) center / cover no-repeat` }
            : { height: 28, background: tutor.bannerBg ?? tutor.avatarBg, opacity: 0.55 }}
        />
        <div className="px-3 pb-3">
          <div style={{ marginTop: -18, marginBottom: 6 }}>
            <Avatar tutor={tutor} size={36} ring />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-hand text-[16px] font-semibold text-slate-900 truncate leading-tight pr-1">
              {tutor.name}
            </span>
            {tutor.verified && <VerifiedTick size={11} />}
          </div>
          <div
            className="text-[11.5px] text-slate-500 truncate mt-0.5"
            style={{ minHeight: "1.3em" }}
          >
            {stripMarkdown(tutor.bio) || " "}
          </div>
          <div
            className="mt-2 pt-2 flex items-baseline justify-end"
            style={{ borderTop: "1px solid var(--desk)" }}
          >
            <div className="tabular-nums">
              <span className="text-[13px] font-semibold text-slate-900">${tutor.rate}</span>
              <span className="text-[11px] text-slate-400">/hr</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
