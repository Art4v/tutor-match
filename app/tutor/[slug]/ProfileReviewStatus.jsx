"use client";

import { useState } from "react";
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

  // Status is plain text: a heading, then one line (DESIGN.md: status colours
  // are for text; the words carry the meaning).
  const head = {
    live: { title: "Profile up to date", body: "Edits you make are saved as a draft. Submit them for review when you're ready." },
    draft: { title: "Unsubmitted changes", body: "Your draft is saved. Submit it so our team can review it." },
    rejected: { title: "Not approved", body: reason ? reason : "A reviewer couldn't approve these changes. Update your draft and submit again, or discard it." },
    pending: { title: `Under review since ${formatDate(submittedAt)}`, body: "We'll email you when it's been reviewed. Editing now takes it out of review." },
  }[state];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[16px] leading-6 font-semibold text-[color:var(--text)]">Profile changes</h3>
        {hasDraft && (
          // Segmented control, 4px radius (no pill). Switches what the page shows.
          <div className="inline-flex rounded border border-input" role="tablist" aria-label="Show">
            {["draft", "live"].map((m, i) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={viewMode === m}
                onClick={() => onViewMode(m)}
                className={
                  "h-11 px-4 text-[14px] leading-5 font-semibold " +
                  (i === 0 ? "rounded-l " : "rounded-r border-l border-input ") +
                  (viewMode === m ? "bg-accent text-white" : "bg-surface text-[color:var(--text)] hover:bg-surface-2")
                }
                style={{ transition: "background-color 120ms ease-out" }}
              >
                {m === "draft" ? "Draft" : "Live"}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className={"mt-2 text-[14px] leading-5 font-semibold " + (state === "rejected" ? "text-warning" : "text-[color:var(--text)]")}>
        {head.title}
      </p>
      <p className="mt-1 text-[14px] leading-5 text-[color:var(--text-2)]">
        {state === "rejected" && reason ? <>Reviewer&apos;s note: &ldquo;{head.body}&rdquo;</> : head.body}
      </p>

      {viewMode === "live" && hasDraft && (
        <p className="mt-2 text-[12px] leading-4 text-muted">You&apos;re viewing your live profile. Switch to Draft to edit.</p>
      )}

      {hasDraft && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(state === "draft" || state === "rejected") && (
            <Button variant="primary" onClick={onSubmit} disabled={busy}>
              {busy === "submit" ? "Submitting…" : "Submit for review"}
            </Button>
          )}
          {state === "pending" && (
            <Button variant="outline" onClick={onResend} disabled={!!busy || !canResend}>
              {busy === "resend" ? "Sending…" : canResend ? "Resend to reviewer" : "Resent today"}
            </Button>
          )}
          {confirmDiscard ? (
            <>
              <Button variant="outline" onClick={() => setConfirmDiscard(false)} disabled={!!busy}>
                Keep draft
              </Button>
              <Button variant="danger" onClick={async () => { await onDiscard(); setConfirmDiscard(false); }} disabled={!!busy}>
                {busy === "discard" ? "Discarding…" : "Discard changes"}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDiscard(true)} disabled={!!busy}>
              Discard changes
            </Button>
          )}
        </div>
      )}

      <p className="mt-4 text-[12px] leading-4 text-muted">
        Students see your live profile until changes are approved.
      </p>
    </div>
  );
}
