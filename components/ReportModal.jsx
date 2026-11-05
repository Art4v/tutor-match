"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";

// Report dialog, in two modes, on the shared Modal shell (a full-screen sheet
// below 640px while the form shows). Collects a required category + optional
// details; the caller files the report via onSubmit. Scrim click + Escape
// cancel unless mid-submit (busy); the result states always dismiss.
//
//   kind="conversation" (default) — "report and block" the other party. The
//     caller also does the block (existing blockUser flow), so the copy says so.
//   kind="review" — report a published review. Reporting a review does NOT
//     block anybody, so no copy here may mention blocking.
//
// Keep these values in sync with the 0059 CHECK, CATEGORIES in
// app/api/reports/route.js, and the two label maps (lib/email/send.js,
// app/admin/_components/format.js).
export const REPORT_CATEGORIES = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "scam", label: "Scam or fraud" },
  { value: "inappropriate_review", label: "Inappropriate review" },
  { value: "other", label: "Other" },
];

// A review can't be a "scam" and reporting one isn't harassment reporting, so
// the review mode offers a narrower, relevant set.
const REVIEW_CATEGORY_VALUES = ["inappropriate_review", "harassment", "spam", "other"];

const MAX_DETAILS = 2000;

export function ReportModal({
  name,
  kind = "conversation", // "conversation" | "review"
  busy = false,
  error = "",
  sent = false,
  alreadyReported = false,
  onCancel,
  onSubmit,
}) {
  const aboutAReview = kind === "review";
  const categories = aboutAReview
    ? REVIEW_CATEGORY_VALUES.map((v) => REPORT_CATEGORIES.find((c) => c.value === v)).filter(Boolean)
    : REPORT_CATEGORIES.filter((c) => c.value !== "inappropriate_review");
  // Preselect the obvious reason so reporting a review is one click.
  const [category, setCategory] = useState(aboutAReview ? "inappropriate_review" : "");
  const [details, setDetails] = useState("");

  // Modal re-runs its effect when onClose changes identity; callers pass inline
  // arrows, so hand it a stable function that reads the latest onCancel.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const close = useCallback(() => cancelRef.current?.(), []);

  // "Already reported" state: a report against this person is still pending
  // review, so filing a second one is blocked. Informational, no form.
  if (alreadyReported) {
    return (
      <Modal
        title="Already reported"
        onClose={close}
        width={420}
        zIndex={80}
        footer={<Button variant="primary" onClick={onCancel}>Done</Button>}
      >
        <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
          {aboutAReview
            ? "You've already reported this review. Our team is still looking at it, so there's nothing more to send right now."
            : `You've already reported ${name || "this person"}, and they stay blocked. Our team is still reviewing that report, so there's nothing more to send right now.`}
        </p>
      </Modal>
    );
  }

  const submit = () => {
    if (!category || busy) return;
    onSubmit({ category, details: details.trim() });
  };

  // Success state: shown after the report is filed, confirming it was sent.
  if (sent) {
    return (
      <Modal
        title="Report sent"
        onClose={close}
        width={420}
        zIndex={80}
        footer={<Button variant="primary" onClick={onCancel}>Done</Button>}
      >
        <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
          {aboutAReview
            ? "Thanks for letting us know. Our team will take a look at that review and decide whether it should stay up."
            : `Thanks for letting us know. We've blocked ${name || "this person"} and our team will review the conversation.`}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title={aboutAReview ? "Report this review?" : `Report and block ${name || "this person"}?`}
      onClose={close}
      dismissable={!busy}
      sheet
      width={480}
      zIndex={80}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={busy || !category}>
            {busy ? "Reporting…" : aboutAReview ? "Report review" : "Report and block"}
          </Button>
        </>
      }
    >
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
        {aboutAReview
          ? "We'll send it to our team to review. Nobody is blocked, and the person who wrote it isn't told they've been reported."
          : "We'll block them and send this conversation to our team to review. They aren't told they've been reported."}
      </p>

      {/* Category picker */}
      <fieldset className="mt-6">
        <legend className="mb-2 text-[14px] leading-5 font-semibold text-[color:var(--text)]">Reason</legend>
        <div className="flex flex-col">
          {categories.map((c) => (
            <label
              key={c.value}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded px-3 text-[14px] leading-5 text-[color:var(--text)] hover:bg-surface-2 ${
                category === c.value ? "bg-surface-2" : ""
              }`}
            >
              <input
                type="radio"
                name="report-category"
                value={c.value}
                checked={category === c.value}
                onChange={() => setCategory(c.value)}
                disabled={busy}
                className="h-4 w-4 shrink-0"
                style={{ accentColor: "var(--accent)" }}
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Optional details */}
      <label className="mt-4 block">
        <span className="text-[14px] leading-5 font-semibold text-[color:var(--text)]">Details (optional)</span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, MAX_DETAILS))}
          disabled={busy}
          rows={3}
          placeholder="Anything else our team should know"
          className="mt-2 block w-full resize-none rounded border border-input bg-surface px-3 py-2 text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder focus:border-accent disabled:opacity-50"
        />
      </label>

      {error && <p role="alert" className="mt-2 text-[14px] leading-5 text-error">{error}</p>}
    </Modal>
  );
}
