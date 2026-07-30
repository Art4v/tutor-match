"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui";
import { useSavedTutors } from "@/components/SavedTutorsProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getMyReviewForTutor } from "@/lib/supabase/reviews";
import { SidebarHeading, cardStyle } from "./ProfileCards";
import { ReviewItem } from "./ReviewItem";
import { ReviewsModal } from "./ReviewsModal";
import { ReviewFormModal } from "./ReviewFormModal";
import { useTutorBlock } from "./TutorBlockProvider";

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
// VIEWER IDENTITY comes from useSavedTutors(), not useTutorBlock(). This card
// also renders inside OwnerProfile, which returns early from page.js BEFORE
// TutorBlockProvider mounts — reading identity from that context would leave the
// owner view stuck at ready:false forever. SavedTutorsProvider is mounted in the
// root layout, so it works in both trees. Block state still comes from
// useTutorBlock(), whose defaults (blocked:false) are harmless in the owner view
// because isStudent is false there anyway.
//
// A student also sees their OWN review pinned above the public list while it is
// pending or rejected — the public list is approved-only, so that is the only
// way the author ever sees it.

const INLINE_LIMIT = 2;

// Pill shown on the author's own not-yet-public review. Amber mirrors
// `verification_rejected` in NotificationsList.
const OWN_STATUS = {
  pending: {
    label: "Awaiting approval",
    note: "Our team checks every review before it appears. Only you can see this.",
    style: { background: "var(--bg-soft)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)" },
  },
  rejected: {
    label: "Not published",
    note: "This review wasn't approved. Editing it sends it back to us for another look.",
    style: { background: "#FEF3C7", color: "#B45309", border: "1px solid #FDE68A" },
  },
};

export function ReviewsCard({ tutorId, tutorName, rating, reviewCount, reviews = [] }) {
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();

  const { isStudent, isLoggedIn, userId, ready } = useSavedTutors();
  const { blocked, blockedByThem } = useTutorBlock();

  const [myReview, setMyReview] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);

  // The author's own row, in any status (RLS self-read). Skipped entirely for
  // guests and tutors, who have nothing of their own to see.
  useEffect(() => {
    if (!ready || !isStudent || !userId || !tutorId) return;
    let active = true;
    getMyReviewForTutor(createSupabaseBrowserClient(), userId, tutorId).then((r) => {
      if (active) setMyReview(r);
    });
    return () => {
      active = false;
    };
  }, [ready, isStudent, userId, tutorId]);

  const submit = useCallback(
    async ({ rating: newRating, body }) => {
      if (busy) return;
      setBusy(true);
      setFormError("");
      try {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tutorId, rating: newRating, body }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError(data?.error || "Could not save your review. Please try again.");
          return;
        }
        setSent(true);
        // Reflect the pending review immediately rather than waiting for a
        // refetch; it can't appear in the public list until it's approved.
        setMyReview({ id: data.id, rating: newRating, body: body || null, status: "pending", createdAt: new Date().toISOString() });
      } catch {
        setFormError("Network error. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, tutorId]
  );

  const closeForm = () => {
    setFormOpen(false);
    setFormError("");
    if (sent) {
      setSent(false);
      router.refresh();
    }
  };

  // Blocking works like messaging: a block in either direction takes the control
  // away rather than failing on submit.
  const isBlocked = blocked || blockedByThem;
  const canReview = ready && isStudent && !isBlocked && !myReview;
  // Nothing is rendered until `ready`, because until the role resolves we can't
  // tell a student from a tutor from a guest, and each gets a different control.
  const showSignupDecoy = ready && !isLoggedIn;

  const cta = canReview ? (
    <div className="mt-4">
      <Button variant="soft" size="md" icon="star" full onClick={() => setFormOpen(true)}>
        Write a review
      </Button>
    </div>
  ) : showSignupDecoy ? (
    <div className="mt-4">
      <Link
        href="/signup"
        className="w-full inline-flex items-center justify-center gap-2 font-medium transition-colors"
        style={{
          background: "var(--accent-softer)",
          color: "var(--accent)",
          border: "1px solid var(--accent-line)",
          padding: "8px 16px",
          fontSize: 14,
          height: 38,
          borderRadius: 9,
        }}
      >
        <Icon name="star" size={15} />
        Sign up to leave a review
      </Link>
    </div>
  ) : null;

  const ownStatus = myReview && OWN_STATUS[myReview.status];
  const ownBlock = ownStatus ? (
    <div
      className="mt-4 pt-4"
      style={{ borderTop: "1px solid var(--paper-line)" }}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>Your review</span>
        <span
          className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium shrink-0"
          style={{ ...ownStatus.style, borderRadius: 999 }}
        >
          {ownStatus.label}
        </span>
      </div>
      <ReviewItem review={{ ...myReview, authorName: "You", authorAvatarUrl: null }} clamp />
      <p className="text-[11.5px] leading-[1.5] mt-2" style={{ color: "var(--sage)" }}>
        {ownStatus.note}
      </p>
    </div>
  ) : null;

  const modals = formOpen ? (
    <ReviewFormModal
      tutorName={tutorName}
      busy={busy}
      error={formError}
      sent={sent}
      onCancel={closeForm}
      onSubmit={submit}
    />
  ) : null;

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
        {ownBlock}
        {cta}
        {modals}
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

      {ownBlock}
      {cta}

      {showAll && (
        <ReviewsModal
          tutorName={tutorName}
          rating={hasAvg ? avg : null}
          reviewCount={count}
          reviews={reviews}
          onClose={() => setShowAll(false)}
        />
      )}
      {modals}
    </div>
  );
}
