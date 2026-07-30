"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { StarRating } from "@/components/StarRating";
import { SidebarHeading, cardStyle } from "./ProfileCards";
import { ReviewItem } from "./ReviewItem";
import { ReviewsModal } from "./ReviewsModal";

// Ratings & reviews, in the profile sidebar. Replaces the hardcoded "Coming
// soon" RatingsCard.
//
// `rating` / `reviewCount` come from tutor_profiles, where 0058 made them
// aggregate over get_tutor_reviews() itself — the same function that produced
// `reviews`. So the summary and the list below it are guaranteed to agree
// (including the case where a reviewer's account was disabled, which hides their
// review and drops it from the average), and this component never has to total
// anything itself.
//
// Two reviews show inline; the rest live behind "See all N reviews", which opens
// a scrollable modal. Both surfaces render the same ReviewItem so they can't
// drift.
//
// The "write a review" control is deliberately NOT here yet — it needs the
// submit route, so it lands with that slice rather than shipping as a button
// that does nothing.

const INLINE_LIMIT = 2;

export function ReviewsCard({ tutorName, rating, reviewCount, reviews = [] }) {
  const [showAll, setShowAll] = useState(false);

  // numeric(2,1) can arrive as a string depending on the client; the read
  // mappers already coerce, but this keeps toFixed safe either way.
  const avg = rating == null ? null : Number(rating);
  const hasAvg = avg != null && Number.isFinite(avg);
  const count = reviewCount ?? 0;

  if (count === 0) {
    return (
      <div className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "18px 20px" }}>
        <SidebarHeading>Ratings &amp; reviews</SidebarHeading>
        <div className="flex flex-col items-center text-center py-5">
          <StarRating value={0} size={20} gap={6} label="No rating yet" />
          <div className="text-[13.5px] leading-[1.55] max-w-[260px] mt-3" style={{ color: "var(--sage)" }}>
            No reviews yet. Once a student leaves one and it has been checked, it will show up here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "18px 20px" }}>
      <SidebarHeading>Ratings &amp; reviews</SidebarHeading>

      {/* Summary */}
      <div className="flex items-center gap-3 mt-3">
        {hasAvg && (
          <div
            className="text-[34px] font-light leading-none tabular-nums"
            style={{ color: "var(--ink-graphite-deep)" }}
          >
            {avg.toFixed(1)}
          </div>
        )}
        <div className="min-w-0">
          <StarRating value={hasAvg ? avg : 0} size={16} gap={3} />
          <div className="text-[12.5px] mt-1" style={{ color: "var(--sage)" }}>
            Based on {count} {count === 1 ? "review" : "reviews"}
          </div>
        </div>
      </div>

      <div
        className="mt-4 pt-4 space-y-4"
        style={{ borderTop: "1px solid var(--paper-line)" }}
      >
        {reviews.slice(0, INLINE_LIMIT).map((r) => (
          <ReviewItem key={r.id} review={r} clamp />
        ))}
      </div>

      {/* Guarded on the fetched list, not `count`, so a failed RPC can never
          open an empty modal. The two agree in every non-error case. */}
      {reviews.length > INLINE_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 mt-4 text-[13px] font-medium transition-colors hover:bg-slate-50"
          style={{
            color: "var(--accent)",
            border: "1px solid var(--paper-line)",
            borderRadius: 10,
            padding: "9px 12px",
          }}
        >
          See all {count} reviews
          <Icon name="chevron-right" size={14} />
        </button>
      )}

      {showAll && (
        <ReviewsModal
          tutorName={tutorName}
          rating={hasAvg ? avg : null}
          reviewCount={count}
          reviews={reviews}
          onClose={() => setShowAll(false)}
        />
      )}
    </div>
  );
}
