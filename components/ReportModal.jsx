"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";

// "Report and block" dialog. Modeled on ConfirmModal's chrome. The caller does
// the block (existing blockUser flow) and files the report via onSubmit; this
// component only collects a required category + optional details. Backdrop click
// + Escape cancel unless mid-submit (busy).
export const REPORT_CATEGORIES = [
  { value: "harassment", label: "Harassment or abuse" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "scam", label: "Scam or fraud" },
  { value: "other", label: "Other" },
];

const MAX_DETAILS = 2000;

export function ReportModal({ name, busy = false, error = "", sent = false, alreadyReported = false, onCancel, onSubmit }) {
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    const onKey = (e) => {
      // Escape closes the form (unless mid-submit) or dismisses a result state.
      if (e.key === "Escape" && (sent || alreadyReported || !busy)) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, sent, alreadyReported, onCancel]);

  // "Already reported" state: a report against this person is still pending
  // review, so filing a second one is blocked. Informational, no form.
  if (alreadyReported) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: "rgba(15,23,42,0.5)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-already-title"
        onClick={onCancel}
      >
        <div
          className="bg-[color:var(--paper-card)] w-full"
          style={{ maxWidth: 420, borderRadius: "var(--radius-card)", padding: 24, boxShadow: "0 24px 60px rgba(15,23,42,0.28)", textAlign: "center" }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className="inline-flex items-center justify-center mb-3.5"
            style={{ width: 44, height: 44, borderRadius: 999, background: "var(--bg-soft)", color: "var(--ink-muted)" }}
          >
            <Icon name="flag" size={22} />
          </span>
          <h2 id="report-already-title" className="text-[17px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
            Already reported
          </h2>
          <p className="text-[13.5px] text-slate-600 mt-1.5">
            You've already reported {name || "this person"}, and they stay blocked. Our team is still reviewing that report, so there's nothing more to send right now.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-2 font-medium w-full"
              style={{
                background: "var(--paper-card)",
                color: "var(--ink-graphite)",
                border: "1px solid var(--paper-line)",
                padding: "10px 20px",
                fontSize: 14,
                height: 42,
                borderRadius: 10,
                cursor: "pointer",
                letterSpacing: "-0.005em",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (!category || busy) return;
    onSubmit({ category, details: details.trim() });
  };

  // Success state: shown after the report is filed, confirming it was sent.
  if (sent) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ background: "rgba(15,23,42,0.5)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-sent-title"
        onClick={onCancel}
      >
        <div
          className="bg-[color:var(--paper-card)] w-full"
          style={{ maxWidth: 420, borderRadius: "var(--radius-card)", padding: 24, boxShadow: "0 24px 60px rgba(15,23,42,0.28)", textAlign: "center" }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className="inline-flex items-center justify-center mb-3.5"
            style={{ width: 44, height: 44, borderRadius: 999, background: "var(--accent-softer)", color: "var(--accent)" }}
          >
            <Icon name="check-circle" size={22} />
          </span>
          <h2 id="report-sent-title" className="text-[17px] font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
            Report sent
          </h2>
          <p className="text-[13.5px] text-slate-600 mt-1.5">
            Thanks for letting us know. We've blocked {name || "this person"} and our team will review the conversation.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-2 font-medium w-full"
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "1px solid var(--accent)",
                padding: "10px 20px",
                fontSize: 14,
                height: 42,
                borderRadius: 10,
                cursor: "pointer",
                letterSpacing: "-0.005em",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full"
        style={{ maxWidth: 440, borderRadius: "var(--radius-card)", padding: 24, boxShadow: "0 24px 60px rgba(15,23,42,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex items-center justify-center shrink-0"
            style={{ width: 36, height: 36, borderRadius: 999, background: "#FEE2E2", color: "#DC2626" }}
          >
            <Icon name="flag" size={18} />
          </span>
          <div>
            <h2 id="report-modal-title" className="text-[17px] font-semibold tracking-tight" style={{ color: "#B91C1C" }}>
              Report and block {name || "this person"}?
            </h2>
            <p className="text-[13.5px] text-slate-600 mt-1.5">
              We'll block them and send this conversation to our team to review. They aren't told they've been reported.
            </p>
          </div>
        </div>

        {/* Category picker */}
        <fieldset className="mt-5">
          <legend className="text-[12.5px] font-semibold text-slate-500 mb-2">Reason</legend>
          <div className="flex flex-col gap-1">
            {REPORT_CATEGORIES.map((c) => (
              <label
                key={c.value}
                className="flex items-center gap-2.5 text-[14px] text-slate-700 cursor-pointer rounded-lg px-2.5 py-2 hover:bg-slate-50"
                style={category === c.value ? { background: "var(--bg-soft)" } : undefined}
              >
                <input
                  type="radio"
                  name="report-category"
                  value={c.value}
                  checked={category === c.value}
                  onChange={() => setCategory(c.value)}
                  disabled={busy}
                  style={{ accentColor: "#DC2626" }}
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Optional details */}
        <label className="block mt-4">
          <span className="text-[12.5px] font-semibold text-slate-500">Details (optional)</span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, MAX_DETAILS))}
            disabled={busy}
            rows={3}
            placeholder="Anything else our team should know."
            className="mt-1.5 w-full text-[14px] text-slate-800 rounded-lg px-3 py-2 resize-none disabled:opacity-60"
            style={{ background: "var(--paper-card)", border: "1px solid var(--paper-line)", outline: "none" }}
          />
        </label>

        {error && <p className="mt-2 text-[13px]" style={{ color: "#DC2626" }}>{error}</p>}

        <div className="flex items-center justify-end gap-2.5 mt-5">
          <Button variant="outline" size="md" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !category}
            className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "#DC2626",
              color: "#fff",
              border: "1px solid #DC2626",
              padding: "9px 16px",
              fontSize: 14,
              height: 40,
              borderRadius: 10,
              cursor: busy || !category ? "not-allowed" : "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            <Icon name="flag" size={14} />
            {busy ? "Reporting…" : "Report and block"}
          </button>
        </div>
      </div>
    </div>
  );
}
