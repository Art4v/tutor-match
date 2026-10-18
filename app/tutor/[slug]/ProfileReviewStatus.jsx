"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" })
    : "";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The verified tutor's review controls, in the owner card (0072). Their edits
 * save to a private draft; this shows where that draft stands and offers the
 * next step.
 *
 *   state "live"     no unsubmitted changes
 *   state "draft"    changes saved, not yet submitted
 *   state "rejected" a reviewer sent the changes back (reason shown)
 *   state "pending"  submitted and under review (resend once a day)
 *
 * Also hosts the Live | Draft toggle that switches what the page shows.
 */
export function ProfileReviewStatus({
  state,
  submittedAt,
  adminNotifiedAt,
  reason,
  viewMode,
  onViewMode,
  onSubmit,
  onDiscard,
  onResend,
  busy,
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const canResend = !adminNotifiedAt || Date.now() - new Date(adminNotifiedAt).getTime() >= DAY_MS;
  const hasDraft = state !== "live";

  const head = {
    live: { icon: "check-circle", color: "var(--accent)", title: "Profile up to date", body: "Edits you make are saved as a draft. Submit them for review when you're ready." },
    draft: { icon: "pencil", color: "var(--ink)", title: "Unsubmitted changes", body: "Your draft is saved. Submit it so our team can review it." },
    rejected: { icon: "alert-triangle", color: "#B45309", title: "Not approved", body: reason ? reason : "A reviewer couldn't approve these changes. Update your draft and submit again, or discard it." },
    pending: { icon: "clock", color: "var(--accent)", title: `Under review since ${formatDate(submittedAt)}`, body: "We'll email you when it's been reviewed. Editing now takes it out of review." },
  }[state];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-[14px] font-light text-slate-800 tracking-tight">Profile changes</h3>
        {hasDraft && (
          <div className="inline-flex p-0.5 text-[11.5px] font-medium" style={{ background: "var(--bg-soft)", borderRadius: 999, border: "1px solid var(--paper-line)" }} role="tablist" aria-label="Show">
            {["draft", "live"].map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={viewMode === m}
                onClick={() => onViewMode(m)}
                className="px-2.5 py-0.5 transition-colors"
                style={{ borderRadius: 999, background: viewMode === m ? "var(--ink)" : "transparent", color: viewMode === m ? "#fff" : "var(--ink-muted)" }}
              >
                {m === "draft" ? "Draft" : "Live"}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[12.5px] leading-[1.5] flex items-start gap-2 mt-2" style={{ color: state === "rejected" ? "#92400E" : "var(--ink-muted)" }}>
        <span className="shrink-0 mt-0.5" style={{ color: head.color }}><Icon name={head.icon} size={14} /></span>
        <span>
          <span className="font-medium" style={{ color: state === "rejected" ? "#92400E" : "var(--ink)" }}>{head.title}.</span>{" "}
          {state === "rejected" && reason ? <>Reviewer&apos;s note: &ldquo;{head.body}&rdquo;</> : head.body}
        </span>
      </p>

      {viewMode === "live" && hasDraft && (
        <p className="text-[12px] text-slate-500 mt-2">You&apos;re viewing your live profile. Switch to Draft to edit.</p>
      )}

      {hasDraft && (
        <div className="mt-3 space-y-2">
          {(state === "draft" || state === "rejected") && (
            <Button variant="primary" size="md" icon="shield-check" onClick={onSubmit} disabled={busy} full>
              {busy === "submit" ? "Submitting…" : "Submit for review"}
            </Button>
          )}
          {state === "pending" && (
            <Button variant="outline" size="md" icon="send" onClick={onResend} disabled={!!busy || !canResend} full>
              {busy === "resend" ? "Sending…" : canResend ? "Resend to reviewer" : "Resent today"}
            </Button>
          )}
          {confirmDiscard ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                disabled={!!busy}
                className="flex-1 px-3 py-1.5 text-[12.5px] font-medium rounded-full"
                style={{ background: "var(--paper-card)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)" }}
              >
                Keep draft
              </button>
              <button
                type="button"
                onClick={async () => { await onDiscard(); setConfirmDiscard(false); }}
                disabled={!!busy}
                className="flex-1 px-3 py-1.5 text-[12.5px] font-medium rounded-full disabled:opacity-60"
                style={{ background: "#DC2626", color: "#fff" }}
              >
                {busy === "discard" ? "Discarding…" : "Discard changes"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              disabled={!!busy}
              className="w-full text-[12.5px] font-medium py-1 transition-colors hover:text-red-600 disabled:opacity-60"
              style={{ color: "var(--ink-muted)" }}
            >
              Discard changes
            </button>
          )}
        </div>
      )}

      <p className="text-[11.5px] text-slate-400 mt-3 leading-[1.5]">
        Students see your live profile until changes are approved.
      </p>
    </div>
  );
}
