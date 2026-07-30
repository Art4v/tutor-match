"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { StarRating } from "@/components/StarRating";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";

// Write a review. Same modal chrome as ReviewsModal (there is no shared <Modal>
// primitive in this codebase; ConfirmModal is confirm-only), including the
// scroll lock, so the two behave identically.
//
// The rating is mandatory and the text optional, matching the 0057 CHECKs. Text
// is clamped client-side AND server-side, the convention used by ReportModal /
// the reports route.
//
// A plain <textarea>, deliberately not RichTextField: that lives in the
// tutor-only profile editor and pulls in the emoji picker and AI affordances,
// none of which belong in a student's review.

const MAX_BODY = 500; // must match the 0057 CHECK and the route

export function ReviewFormModal({ tutorName, busy = false, error = "", sent = false, onCancel, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  useEffect(() => {
    lockScroll();
    return () => unlockScroll();
  }, []);

  const firstName = (tutorName ?? "").trim().split(/\s+/)[0] || "this tutor";

  const shell = (children, maxWidth) => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,30,30,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-form-title"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full"
        style={{ maxWidth, borderRadius: "var(--radius-card)", padding: 24, boxShadow: "0 24px 60px rgba(0,30,30,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  // ---- Sent ---------------------------------------------------------------
  if (sent) {
    return shell(
      <>
        <span
          className="inline-flex items-center justify-center mb-4"
          style={{ width: 44, height: 44, borderRadius: 999, background: "var(--accent-softer)", color: "var(--accent)" }}
        >
          <Icon name="check-circle" size={22} />
        </span>
        <h2 id="review-form-title" className="text-[19px] font-light tracking-tight text-slate-800">
          Thanks for your review
        </h2>
        <p className="text-[13.5px] text-slate-600 mt-2 leading-[1.55]">
          Our team checks every review before it goes live, so it may take a little while to appear on
          {" "}{firstName}&apos;s profile.
        </p>
        <div className="flex justify-end mt-6">
          <Button variant="primary" size="md" onClick={onCancel}>Done</Button>
        </div>
      </>,
      420
    );
  }

  // ---- Form ---------------------------------------------------------------
  return shell(
    <>
      <h2 id="review-form-title" className="text-[19px] font-light tracking-tight text-slate-800">
        Review {firstName}
      </h2>
      <p className="text-[13.5px] text-slate-600 mt-1.5 leading-[1.55]">
        Your name and photo show with your review. It appears once our team has checked it.
      </p>

      <div className="mt-5">
        <div className="text-[13px] font-medium mb-2" style={{ color: "var(--ink)" }}>
          Your rating
        </div>
        <StarRating value={rating} onChange={setRating} size={30} gap={6} label={`Your rating for ${firstName}, out of 5 stars`} />
      </div>

      <div className="mt-5">
        <label htmlFor="review-body" className="block text-[13px] font-medium mb-2" style={{ color: "var(--ink)" }}>
          Your review <span style={{ color: "var(--sage)", fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          id="review-body"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
          placeholder={`What were your sessions with ${firstName} like?`}
          className="w-full text-[14px] p-3 resize-none"
          style={{ border: "1px solid var(--paper-line)", borderRadius: 8, background: "var(--bg-soft)", color: "var(--ink)" }}
        />
        <div className="text-[11.5px] mt-1 text-right" style={{ color: "var(--sage)" }}>
          {body.length}/{MAX_BODY}
        </div>
      </div>

      {error && <p className="text-[13px] mt-2" style={{ color: "#DC2626" }}>{error}</p>}

      <div className="flex items-center justify-end gap-2.5 mt-5">
        <Button variant="outline" size="md" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button
          variant="primary"
          size="md"
          onClick={() => onSubmit({ rating, body: body.trim() })}
          disabled={busy || rating < 1}
        >
          {busy ? "Sending…" : "Submit review"}
        </Button>
      </div>
    </>,
    440
  );
}
