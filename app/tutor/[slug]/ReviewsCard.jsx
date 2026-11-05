"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ReportModal } from "@/components/ReportModal";
import { useSavedTutors } from "@/components/SavedTutorsProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getMyReviewForTutor, getMyReviewForCompany } from "@/lib/supabase/reviews";
import { Section } from "./ProfileCards";
import { ReviewItem } from "./ReviewItem";
import { ReviewMenu } from "./ReviewMenu";
import { ReviewsModal } from "./ReviewsModal";
import { ReviewFormModal } from "./ReviewFormModal";
import { useTutorBlock } from "./TutorBlockProvider";

// The Reviews section of a tutor or company profile (main column).
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

// Status shown on the author's own not-yet-public review, as coloured text
// (DESIGN.md: status colours are for text; the label carries the meaning).
const OWN_STATUS = {
  pending: {
    label: "Awaiting approval",
    note: "Our team checks every review before it appears. Only you can see this.",
    className: "text-[color:var(--text-2)]",
  },
  rejected: {
    label: "Not published",
    note: "This review wasn't approved. Editing it sends it back to us for another look.",
    className: "text-warning",
  },
  // 0059: taken down after a report. Terminal: the RLS update policy excludes
  // 'removed', so editing it back into circulation isn't possible.
  removed: {
    label: "Removed",
    note: "This review was removed after it was reported. It can't be edited back, but you can delete it.",
    className: "text-error",
  },
};

// `companyId` (0067) makes this card serve a COMPANY instead of a tutor. Exactly
// one of tutorId / companyId is ever set, matching the DB CHECK. Only three
// things actually differ — which "my review" read runs, which key the POST
// carries, and the copy — so branching here is far cheaper than a second card
// that would have to track this one's moderation states forever.
export function ReviewsCard({ tutorId, companyId, tutorName, rating, reviewCount, reviews = [] }) {
  const subjectId = tutorId ?? companyId;
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();

  const { isStudent, isLoggedIn, userId, ready } = useSavedTutors();
  const { blocked, blockedByThem } = useTutorBlock();

  const [myReview, setMyReview] = useState(null);
  const [formMode, setFormMode] = useState(null); // null | "create" | "edit"
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [sent, setSent] = useState(false);
  // Reporting someone else's review: which review id, plus the dialog's state.
  const [reportFor, setReportFor] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [reportAlready, setReportAlready] = useState(false);

  // The author's own row, in any status (RLS self-read). Skipped entirely for
  // guests and tutors, who have nothing of their own to see.
  useEffect(() => {
    if (!ready || !isStudent || !userId || !subjectId) return;
    let active = true;
    const client = createSupabaseBrowserClient();
    const load = companyId
      ? getMyReviewForCompany(client, userId, companyId)
      : getMyReviewForTutor(client, userId, tutorId);
    load.then((r) => {
      if (active) setMyReview(r);
    });
    return () => {
      active = false;
    };
  }, [ready, isStudent, userId, tutorId, companyId, subjectId]);

  // Create and edit hit the same endpoint with a different verb; the server
  // forces an edited review back to 'pending' either way.
  const submit = useCallback(
    async ({ rating: newRating, body }) => {
      if (busy) return;
      const editing = formMode === "edit";
      setBusy(true);
      setFormError("");
      try {
        const res = await fetch("/api/reviews", {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing
              ? { reviewId: myReview?.id, rating: newRating, body }
              : companyId
                ? { companyId, rating: newRating, body }
                : { tutorId, rating: newRating, body }
          ),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError(data?.error || "Could not save your review. Please try again.");
          return;
        }
        setSent(true);
        // Reflect the pending review immediately rather than waiting for a
        // refetch; it can't appear in the public list until it's approved.
        setMyReview((prev) => ({
          ...prev,
          id: data.id ?? prev?.id,
          rating: newRating,
          body: body || null,
          status: "pending",
          createdAt: prev?.createdAt ?? new Date().toISOString(),
        }));
      } catch {
        setFormError("Network error. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, formMode, myReview?.id, tutorId, companyId]
  );

  const remove = useCallback(async () => {
    if (busy || !myReview?.id) return;
    setBusy(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: myReview.id }),
      });
      if (!res.ok) return;
      setMyReview(null);
      setConfirmDelete(false);
      router.refresh();
    } catch {
      // Leave the dialog open so the action can be retried.
    } finally {
      setBusy(false);
    }
  }, [busy, myReview?.id, router]);

  const closeForm = () => {
    setFormMode(null);
    setFormError("");
    if (sent) {
      setSent(false);
      // An edit pulls the review out of the public list, so the server-rendered
      // list and the aggregate both need re-reading.
      router.refresh();
    }
  };

  const submitReport = useCallback(
    async ({ category, details }) => {
      if (!reportFor) return;
      setReportBusy(true);
      setReportError("");
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewId: reportFor, category, details }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setReportError(data?.error || "Could not send your report. Please try again.");
          return;
        }
        // A still-pending report of the same review is a silent no-op server
        // side, so say so rather than claiming a second one was filed.
        if (data?.status === "pending") setReportAlready(true);
        else setReportSent(true);
      } catch {
        setReportError("Network error. Please try again.");
      } finally {
        setReportBusy(false);
      }
    },
    [reportFor]
  );

  // Edit / delete belong only to the author; everyone else signed in can report.
  // The public list carries no author id (get_tutor_reviews deliberately returns
  // names, not uuids), so ownership is matched on the review id we already
  // fetched for this viewer. Logged-out viewers get no menu at all.
  const actionsFor = (review) => {
    if (!ready) return null;
    const mine = myReview && review.id === myReview.id;

    if (mine) {
      // A removed review can't be edited back (the RLS update policy excludes
      // 'removed'), so only offer the delete.
      const removed = myReview.status === "removed";
      return (
        <ReviewMenu
          label="Your review options"
          items={[
            ...(removed ? [] : [{ icon: "pencil", label: "Edit review", onClick: () => setFormMode("edit") }]),
            { icon: "trash", label: "Delete review", danger: true, onClick: () => setConfirmDelete(true) },
          ]}
        />
      );
    }

    if (!isLoggedIn) return null;
    return (
      <ReviewMenu
        items={[
          {
            icon: "flag",
            label: "Report review",
            danger: true,
            onClick: () => {
              setReportError("");
              setReportSent(false);
              setReportAlready(false);
              setReportFor(review.id);
            },
          },
        ]}
      />
    );
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
      <Button variant="outline" onClick={() => setFormMode("create")}>
        Write a review
      </Button>
    </div>
  ) : showSignupDecoy ? (
    <div className="mt-2">
      <Link
        href="/signup"
        className="inline-flex min-h-6 items-center text-[14px] leading-5 font-semibold text-accent hover:text-accent-hover"
        style={{ transition: "color 120ms ease-out" }}
      >
        Sign up to leave a review
      </Link>
    </div>
  ) : null;

  const ownStatus = myReview && OWN_STATUS[myReview.status];
  const ownBlock = ownStatus ? (
    <div className="mt-4 border-t border-rule pt-4">
      <div className="mb-3 flex items-center gap-2 text-[12px] leading-4">
        <span className="font-semibold text-[color:var(--text)]">Your review</span>
        <span className={`font-semibold ${ownStatus.className}`}>{ownStatus.label}</span>
      </div>
      <ReviewItem
        review={{ ...myReview, authorName: "You", authorAvatarUrl: null }}
        clamp
        actions={actionsFor(myReview)}
      />
      <p className="mt-2 text-[12px] leading-4 text-[color:var(--muted)]">{ownStatus.note}</p>
    </div>
  ) : null;

  const modals = (
    <>
      {formMode && (
        <ReviewFormModal
          tutorName={tutorName}
          mode={formMode}
          initialRating={formMode === "edit" ? myReview?.rating ?? 0 : 0}
          initialBody={formMode === "edit" ? myReview?.body ?? "" : ""}
          busy={busy}
          error={formError}
          sent={sent}
          onCancel={closeForm}
          onSubmit={submit}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete your review?"
          body="It will be removed from this profile and the rating will update. This can't be undone."
          confirmLabel="Delete review"
          confirmingLabel="Deleting…"
          icon="trash"
          tone="danger"
          busy={busy}
          onCancel={() => { if (!busy) setConfirmDelete(false); }}
          onConfirm={remove}
        />
      )}
      {reportFor && (
        <ReportModal
          kind="review"
          busy={reportBusy}
          error={reportError}
          sent={reportSent}
          alreadyReported={reportAlready}
          onCancel={() => {
            if (reportSent || reportAlready || !reportBusy) setReportFor(null);
          }}
          onSubmit={submitReport}
        />
      )}
    </>
  );

  // numeric(2,1) can arrive as a string depending on the client; the read
  // mappers already coerce, but this keeps toFixed safe either way.
  const avg = rating == null ? null : Number(rating);
  const hasAvg = avg != null && Number.isFinite(avg);
  const count = reviewCount ?? 0;

  // A flat profile section (DESIGN.md §6). Empty: one line plus one action.
  if (count === 0) {
    return (
      <Section id="reviews" title="Reviews">
        <p className="text-[14px] leading-5 text-[color:var(--text-2)]">No reviews yet.</p>
        {ownBlock}
        {cta}
        {modals}
      </Section>
    );
  }

  return (
    <Section id="reviews" title="Reviews">
      <div className="flex items-center gap-3">
        {hasAvg && (
          <span className="text-[32px] leading-10 font-semibold tabular-nums text-[color:var(--text)]">{avg.toFixed(1)}</span>
        )}
        <div className="min-w-0">
          <StarRating value={hasAvg ? avg : 0} size={16} gap={2} />
          <div className="mt-1 text-[12px] leading-4 text-[color:var(--muted)]">
            Based on {count} {count === 1 ? "review" : "reviews"}
          </div>
        </div>
      </div>

      <ul className="mt-4 border-t border-rule">
        {reviews.slice(0, INLINE_LIMIT).map((r) => (
          <li key={r.id} className="border-b border-rule py-4">
            <ReviewItem review={r} clamp actions={actionsFor(r)} />
          </li>
        ))}
      </ul>

      {/* Guarded on the fetched list, not `count`, so a failed RPC can never
          open an empty modal. The two agree in every non-error case. */}
      {reviews.length > INLINE_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 inline-flex min-h-11 items-center text-[14px] leading-5 font-semibold text-accent hover:text-accent-hover"
          style={{ transition: "color 120ms ease-out" }}
        >
          See all {count} reviews
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
          actionsFor={actionsFor}
          onClose={() => setShowAll(false)}
        />
      )}
      {modals}
    </Section>
  );
}
