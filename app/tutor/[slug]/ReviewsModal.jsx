"use client";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { StarRating } from "@/components/StarRating";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import { ReviewItem } from "./ReviewItem";

// The full review list, for when the sidebar card has more than it shows inline.
//
// There is no generic <Modal> primitive in this codebase (ConfirmModal is
// confirm-only, with no children), so this repeats the established chrome from
// ConfirmModal / ReportModal: same backdrop, radius, shadow and padding, Escape
// and backdrop-click to close. The body is its own scroll region so a long list
// scrolls inside the card rather than growing it past the viewport.

export function ReviewsModal({ tutorName, rating, reviewCount, reviews, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Freeze the page behind the modal, so a scroll gesture that leaves the list
  // doesn't drift the profile underneath. The component only mounts while open,
  // so unmount is the unlock.
  useEffect(() => {
    lockScroll();
    return () => unlockScroll();
  }, []);

  const firstName = (tutorName ?? "").trim().split(/\s+/)[0] || "this tutor";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,30,30,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reviews-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full flex flex-col"
        style={{
          maxWidth: 520,
          maxHeight: "min(680px, calc(100vh - 48px))",
          borderRadius: "var(--radius-card)",
          padding: 24,
          boxShadow: "0 24px 60px rgba(0,30,30,0.28)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="reviews-modal-title" className="text-[19px] font-light tracking-tight text-slate-800">
              Reviews for {firstName}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <StarRating value={rating ?? 0} size={14} />
              <span className="text-[13px]" style={{ color: "var(--sage)" }}>
                {rating != null && `${rating.toFixed(1)} average, `}
                {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reviews"
            className="inline-flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            style={{ width: 32, height: 32, borderRadius: 999 }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div
          className="mt-4 -mx-1 px-1 overflow-y-auto overscroll-contain min-h-0 flex-1 space-y-4"
          style={{ borderTop: "1px solid var(--paper-line)", paddingTop: 16, WebkitOverflowScrolling: "touch" }}
        >
          {reviews.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </div>

        <div className="flex justify-end mt-5 shrink-0">
          <Button variant="outline" size="md" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
