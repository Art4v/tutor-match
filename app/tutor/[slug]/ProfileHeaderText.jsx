"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { VerifiedTick } from "@/components/ui";
import { TypewriterOnView } from "@/components/anim/TypewriterOnView";
import { InlineMarkdown } from "@/components/RichText";
import { stripMarkdown } from "@/lib/richText";
import { EASE_OUT } from "@/lib/motion";
import { yearRangeLabel } from "@/lib/yearLevels";

export function ProfileHeaderText({ tutor, deliveryLabel }) {
  const [nameDone, setNameDone] = useState(false);
  const [bioDone, setBioDone] = useState(false);
  const hasBio = !!tutor.bio;
  // The typewriter animates the plain text (markers would type out literally);
  // once it finishes we swap in the bold/italic-rendered version in place.
  const plainBio = stripMarkdown(tutor.bio);

  // If there's no bio, treat it as already done so the meta fades in after the name.
  const metaReady = hasBio ? bioDone : nameDone;

  const fadeUp = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: EASE_OUT },
  };

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight">
          <TypewriterOnView
            text={tutor.name}
            speed={36}
            onDone={() => setNameDone(true)}
          />
        </h1>
        {tutor.verified && <VerifiedTick size={18} />}
      </div>

      {hasBio && (
        <div className="text-[15px] text-slate-600 mt-1">
          {bioDone ? (
            <InlineMarkdown text={tutor.bio} />
          ) : (
            <TypewriterOnView
              text={plainBio}
              speed={18}
              start={nameDone}
              onDone={() => setBioDone(true)}
            />
          )}
        </div>
      )}

      <motion.div
        className="flex items-center gap-4 text-[13.5px] text-slate-500 mt-2 flex-wrap"
        initial={fadeUp.initial}
        animate={metaReady ? fadeUp.animate : fadeUp.initial}
        transition={{ ...fadeUp.transition, delay: 0.05 }}
      >
        {(tutor.suburb || tutor.city) && (
          <span className="flex items-center gap-1.5">
            <Icon name="map-pin" size={13} />
            {[tutor.suburb, tutor.city].filter(Boolean).join(", ")}
          </span>
        )}
        {deliveryLabel && (
          <span className="flex items-center gap-1.5">
            <Icon name="globe" size={13} /> {deliveryLabel}
          </span>
        )}
        {tutor.responsive && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#F59E0B" }} />
            {tutor.responsive}
          </span>
        )}
      </motion.div>

      <motion.div
        className="flex items-center gap-5 mt-5 text-[13px] text-slate-500 pt-5 flex-wrap"
        style={{ borderTop: "1px solid #F1F5F9" }}
        initial={fadeUp.initial}
        animate={metaReady ? fadeUp.animate : fadeUp.initial}
        transition={{ ...fadeUp.transition, delay: 0.22 }}
      >
        {tutor.rating != null && (
          <span className="flex items-center gap-1.5 tabular-nums">
            <Icon name="star" size={13} className="text-slate-700" />
            <span className="text-slate-900 font-medium">{tutor.rating.toFixed(1)}</span>
            · {tutor.reviews} reviews
          </span>
        )}
        {tutor.yearsTutoring != null && (
          <span className="flex items-center gap-1.5">
            <Icon name="clock" size={13} />
            <span className="text-slate-900 font-medium">{tutor.yearsTutoring} yrs</span>
            <span>tutoring</span>
          </span>
        )}
        {tutor.yearMin != null && tutor.yearMax != null && (
          <span className="flex items-center gap-1.5">
            <Icon name="users" size={13} />
            {yearRangeLabel(tutor.yearMin, tutor.yearMax)}
          </span>
        )}
        {tutor.languages.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Icon name="language" size={13} />
            {tutor.languages.join(", ")}
          </span>
        )}
      </motion.div>
    </div>
  );
}
