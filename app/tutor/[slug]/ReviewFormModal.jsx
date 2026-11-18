"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { StarRating } from "@/components/StarRating";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import { MAX_DURATION_YEARS, splitDuration } from "@/lib/reviewDuration";

// Write a review. Same modal chrome as ReviewsModal (there is no shared <Modal>
// primitive in this codebase; ConfirmModal is confirm-only), including the
// scroll lock, so the two behave identically.
//
// The rating is mandatory and the text optional, matching the 0057 CHECKs. Text
// is clamped client-side AND server-side, the convention used by ReportModal /
// the reports route.
//
// "How long have you been with …" (0080) is optional too: two dropdowns, years
// and months, sent as ONE total (durationMonths). A blank dropdown counts as 0
// and a total of 0 means "not given" (null), so this field never blocks a
// submit, and clearing both on an edit removes the duration.
//
// A plain <textarea>, deliberately not RichTextField: that lives in the
// tutor-only profile editor and pulls in the emoji picker and AI affordances,
// none of which belong in a student's review.

const MAX_BODY = 500; // must match the 0057 CHECK and the route

// Built once: "" is the blank placeholder option, the rest are whole numbers.
const YEAR_OPTIONS = Array.from({ length: MAX_DURATION_YEARS + 1 }, (_, n) => ({
  value: String(n),
  label: `${n} ${n === 1 ? "year" : "years"}`,
}));
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, n) => ({
  value: String(n),
  label: `${n} ${n === 1 ? "month" : "months"}`,
}));

// Native selects, written here rather than imported from the profile editor's
// sections.js: that module drags the suburb picker, subject picker and crop
// modal into every page that shows a review form.
function DurationSelect({ id, label, placeholder, value, onChange, options }) {
  return (
    <div className="relative flex-1 min-w-0">
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-[14px] appearance-none outline-none"
        style={{
          padding: "10px 34px 10px 12px",
          border: "1px solid var(--paper-line)",
          borderRadius: 8,
          background: "var(--bg-soft)",
          color: value === "" ? "var(--sage)" : "var(--ink)",
          fontFamily: "inherit",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--sage)" }}>
        <Icon name="chevron-down" size={14} />
      </span>
    </div>
  );
}

export function ReviewFormModal({
  tutorName,
  mode = "create", // "create" | "edit"
  initialRating = 0,
  initialBody = "",
  initialDurationMonths = null, // total months, or null when none was given
  busy = false,
  error = "",
  sent = false,
  onCancel,
  onSubmit,
}) {
  const editing = mode === "edit";
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState(initialBody);
  // Strings, because they are <select> values; "" is the blank placeholder.
  // An existing duration pre-fills BOTH (2 years reads "2 years" + "0 months").
  const [years, setYears] = useState(() =>
    initialDurationMonths ? String(splitDuration(initialDurationMonths).years) : ""
  );
  const [months, setMonths] = useState(() =>
    initialDurationMonths ? String(splitDuration(initialDurationMonths).months) : ""
  );

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
          {editing ? "Your changes are saved" : "Thanks for your review"}
        </h2>
        <p className="text-[13.5px] text-slate-600 mt-2 leading-[1.55]">
          {editing
            ? `An edited review goes back to our team for another check, so it will be hidden from ${firstName}'s profile until it's approved again.`
            : `Our team checks every review before it goes live, so it may take a little while to appear on ${firstName}'s profile.`}
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
        {editing ? "Edit your review" : `Review ${firstName}`}
      </h2>
      <p className="text-[13.5px] text-slate-600 mt-1.5 leading-[1.55]">
        {editing
          ? "Editing sends your review back to our team, so it will be hidden until it's approved again."
          : "Your name and photo show with your review. It appears once our team has checked it."}
      </p>

      <div className="mt-5">
        <div className="text-[13px] font-medium mb-2" style={{ color: "var(--ink)" }}>
          Your rating
        </div>
        <StarRating value={rating} onChange={setRating} size={30} gap={6} label={`Your rating for ${firstName}, out of 5 stars`} />
      </div>

      <div className="mt-5">
        <label htmlFor="review-duration-years" className="block text-[13px] font-medium mb-2" style={{ color: "var(--ink)" }}>
          How long have you been with {firstName}?{" "}
          <span style={{ color: "var(--sage)", fontWeight: 400 }}>(optional)</span>
        </label>
        <div className="flex items-center gap-2.5">
          <DurationSelect
            id="review-duration-years"
            label={`Years with ${firstName}`}
            placeholder="Years"
            value={years}
            onChange={setYears}
            options={YEAR_OPTIONS}
          />
          <DurationSelect
            id="review-duration-months"
            label={`Months with ${firstName}`}
            placeholder="Months"
            value={months}
            onChange={setMonths}
            options={MONTH_OPTIONS}
          />
        </div>
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
          onClick={() => {
            // Blank counts as 0; a zero total is "not given".
            const total = (Number(years) || 0) * 12 + (Number(months) || 0);
            onSubmit({ rating, body: body.trim(), durationMonths: total > 0 ? total : null });
          }}
          disabled={busy || rating < 1}
        >
          {busy ? "Saving…" : editing ? "Save changes" : "Submit review"}
        </Button>
      </div>
    </>,
    440
  );
}
