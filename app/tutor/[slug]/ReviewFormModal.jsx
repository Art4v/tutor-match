"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { StarRating } from "@/components/StarRating";
import { Modal } from "@/components/Modal";

// Write or edit a review, on the shared Modal shell as a `sheet` (full screen
// below 640px, since it holds a form). The shell owns the scrim, Escape, focus
// and the scroll lock; while a save is in flight the dialog cannot be
// dismissed, as before.
//
// The rating is mandatory and the text optional, matching the 0057 CHECKs. Text
// is clamped client-side AND server-side, the convention used by ReportModal /
// the reports route.
//
// A plain <textarea>, deliberately not RichTextField: that lives in the
// tutor-only profile editor and pulls in the emoji picker and AI affordances,
// none of which belong in a student's review.

const MAX_BODY = 500; // must match the 0057 CHECK and the route

export function ReviewFormModal({
  tutorName,
  mode = "create", // "create" | "edit"
  initialRating = 0,
  initialBody = "",
  busy = false,
  error = "",
  sent = false,
  onCancel,
  onSubmit,
}) {
  const editing = mode === "edit";
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState(initialBody);

  const firstName = (tutorName ?? "").trim().split(/\s+/)[0] || "this tutor";

  // ---- Sent ---------------------------------------------------------------
  if (sent) {
    return (
      <Modal
        title={editing ? "Your changes are saved" : "Thanks for your review"}
        onClose={onCancel}
        width={440}
        footer={<Button variant="primary" onClick={onCancel}>Done</Button>}
      >
        <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
          {editing
            ? `An edited review goes back to our team for another check, so it will be hidden from ${firstName}'s profile until it's approved again.`
            : `Our team checks every review before it goes live, so it may take a little while to appear on ${firstName}'s profile.`}
        </p>
      </Modal>
    );
  }

  // ---- Form ---------------------------------------------------------------
  return (
    <Modal
      title={editing ? "Edit your review" : `Review ${firstName}`}
      onClose={onCancel}
      dismissable={!busy}
      sheet
      width={480}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSubmit({ rating, body: body.trim() })}
            disabled={busy || rating < 1}
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Submit review"}
          </Button>
        </>
      }
    >
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
        {editing
          ? "Editing sends your review back to our team, so it will be hidden until it's approved again."
          : "Your name and photo show with your review. It appears once our team has checked it."}
      </p>

      <fieldset className="mt-6">
        <legend className="mb-2 text-[14px] leading-5 font-semibold text-[color:var(--text)]">Your rating</legend>
        <StarRating value={rating} onChange={setRating} size={32} gap={8} label={`Your rating for ${firstName}, out of 5 stars`} />
      </fieldset>

      <div className="mt-6">
        <label htmlFor="review-body" className="mb-2 block text-[14px] leading-5 font-semibold text-[color:var(--text)]">
          Your review <span className="font-normal text-[color:var(--muted)]">(optional)</span>
        </label>
        <textarea
          id="review-body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
          className="w-full resize-none rounded border border-input bg-surface p-3 text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder focus:border-accent focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        />
        <div className="mt-1 text-right text-[12px] leading-4 text-[color:var(--muted)]">
          {body.length}/{MAX_BODY}
        </div>
      </div>

      {error && <p className="mt-2 text-[14px] leading-5 text-error">{error}</p>}
    </Modal>
  );
}
