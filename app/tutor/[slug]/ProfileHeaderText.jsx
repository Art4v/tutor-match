"use client";
import { Icon } from "@/components/Icon";
import { VerifiedTick } from "@/components/ui";
import { InlineMarkdown } from "@/components/RichText";
import { yearRangeLabel } from "@/lib/yearLevels";

/**
 * Header identity block. Name/tagline/meta sit on the left and the at-a-glance
 * stats stack vertically on the right of the same row, so the header reads as
 * one band rather than a stack split by a divider.
 */
export function ProfileHeaderText({ tutor, deliveryLabel }) {
  const stats = [];
  if (tutor.yearsTutoring != null) {
    stats.push({
      key: "years",
      icon: "clock",
      body: (<><Strong>{tutor.yearsTutoring} yrs</Strong> <span>tutoring</span></>),
    });
  }
  if (tutor.yearMin != null && tutor.yearMax != null) {
    stats.push({
      key: "levels",
      icon: "users",
      body: <Strong>{yearRangeLabel(tutor.yearMin, tutor.yearMax)}</Strong>,
    });
  }
  if (tutor.languages.length > 0) {
    stats.push({
      key: "languages",
      icon: "language",
      body: <Strong>{tutor.languages.join(", ")}</Strong>,
    });
  }

  return (
    <div className="flex items-start justify-between gap-6 flex-wrap mt-5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h1
            className="text-[34px] leading-[1.1]"
            style={{ fontWeight: 300, letterSpacing: "-0.02em", color: "var(--ink-graphite-deep)" }}
          >
            {tutor.name}
          </h1>
          {tutor.verified && <VerifiedTick size={22} label />}
        </div>

        {tutor.bio && (
          <div className="text-[17px] mt-[5px]" style={{ color: "var(--ink-muted)" }}>
            <InlineMarkdown text={tutor.bio} />
          </div>
        )}

        <div className="flex items-center gap-[22px] text-[14px] mt-2.5 flex-wrap" style={{ color: "var(--ink-muted)" }}>
          {(tutor.suburb || tutor.city) && (
            <span className="flex items-center gap-1.5">
              <Icon name="map-pin" size={14} />
              {[tutor.suburb, tutor.city].filter(Boolean).join(", ")}
            </span>
          )}
          {deliveryLabel && (
            <span className="flex items-center gap-1.5">
              <Icon name="globe" size={14} /> {deliveryLabel}
            </span>
          )}
          {tutor.responsive && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: "#E8A13A" }} />
              {tutor.responsive}
            </span>
          )}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="flex-none flex flex-col gap-[11px] text-[14px] pr-3.5" style={{ color: "var(--ink-muted)" }}>
          {stats.map((s) => (
            <span key={s.key} className="flex items-center gap-2">
              <Icon name={s.icon} size={14} />
              {s.body}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Strong({ children }) {
  return <span className="font-medium" style={{ color: "var(--ink-graphite)" }}>{children}</span>;
}
