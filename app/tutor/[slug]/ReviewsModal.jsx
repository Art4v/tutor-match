"use client";
import { Button } from "@/components/ui";
import { StarRating } from "@/components/StarRating";
import { Modal } from "@/components/Modal";
import { ReviewItem } from "./ReviewItem";

// The full review list, for when the Reviews section has more than it shows
// inline. On the shared Modal shell, which owns the scrim, Escape, focus and
// the scroll lock; the body is its own scroll region so a long list scrolls
// inside the dialog rather than growing it past the viewport.
//
// `actionsFor(review)` lets the caller attach the per-review menu, so the
// author can edit their own review from here as well as from the section.
export function ReviewsModal({ tutorName, rating, reviewCount, reviews, actionsFor, onClose }) {
  const firstName = (tutorName ?? "").trim().split(/\s+/)[0] || "this tutor";

  return (
    <Modal
      title={`Reviews for ${firstName}`}
      onClose={onClose}
      width={560}
      footer={
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex items-center gap-2">
        <StarRating value={rating ?? 0} size={16} />
        <span className="text-[14px] leading-5 text-[color:var(--text-2)]">
          {rating != null && `${rating.toFixed(1)} average, `}
          {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
        </span>
      </div>
      <ul className="mt-4 border-t border-rule">
        {reviews.map((r) => (
          <li key={r.id} className="border-b border-rule py-4 last:border-b-0">
            <ReviewItem review={r} actions={actionsFor?.(r)} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}
