"use client";
import { Icon } from "@/components/Icon";
import { VerifiedTick } from "@/components/ui";
import { InlineMarkdown } from "@/components/RichText";
import { yearRangeLabel } from "@/lib/yearLevels";
import { StaggerChildren, RevealItem } from "@/components/anim/CardReveal";

export function ProfileHeaderText({ tutor, deliveryLabel }) {
  const hasBio = !!tutor.bio;

  return (
    <StaggerChildren delay={0.2} step={0.12} className="mt-5">
      <RevealItem>
        <div className="flex items-center gap-1.5 flex-wrap">
          <h1
            className="text-[36px] leading-tight"
            style={{ fontWeight: 300, letterSpacing: "-0.025em", color: "var(--ink-graphite)" }}
          >
            {tutor.name}
          </h1>
          {tutor.verified && <VerifiedTick size={18} />}
        </div>
      </RevealItem>

      {hasBio && (
        <RevealItem>
          <div className="text-[15px] text-slate-600 mt-1">
            <InlineMarkdown text={tutor.bio} />
          </div>
        </RevealItem>
      )}

      <RevealItem>
        <div className="flex items-center gap-4 text-[13.5px] text-slate-500 mt-2 flex-wrap">
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
        </div>
      </RevealItem>

      <RevealItem>
        <div
          className="flex items-center gap-5 mt-3 text-[13px] text-slate-500 pt-3 flex-wrap"
          style={{ borderTop: "1px solid var(--desk)" }}
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
        </div>
      </RevealItem>
    </StaggerChildren>
  );
}
