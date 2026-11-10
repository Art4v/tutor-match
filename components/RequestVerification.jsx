"use client";

import { Fragment, useCallback, useState } from "react";
import { Icon } from "./Icon";
import { Button, VerifiedTick } from "./ui";
import { SupportingDocumentsModal, SupportingDocumentsPanel, useSupportingDocs } from "./SupportingDocuments";

// Shared "Request verification" card. Used in the /settings sidebar and as the
// final /onboarding step. Owns its own status (seeded from `status`) so the UI
// updates immediately on request without touching parent editor state (which
// would spuriously flag unsaved changes). Verification is a recommendation, not
// a gate: an incomplete profile gets a soft note, never a disabled button.
//
// Props:
//   status         'none' | 'rejected' | 'pending' | 'verified'
//   completionPct  0–100, drives the "complete your profile first" hint
//   beforeRequest  optional async () => boolean, run before POSTing (onboarding
//                  saves the profile first); return false to abort
//   onRequested    optional (newStatus) => void, notifies the parent
//   unstyled       render without the bordered Card wrapper (when nested inside
//                  another card, e.g. the owner sidebar)
//   docsMode       private supporting documents (0079): "inline" (onboarding)
//                  shows the upload area in the card, "modal" (profile sidebar)
//                  shows a count and a Manage button. Omitted: no documents.
export function RequestVerification({ status: initialStatus = "none", completionPct = 100, beforeRequest, onRequested, unstyled = false, docsMode }) {
  const [status, setStatus] = useState(initialStatus);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [docsOpen, setDocsOpen] = useState(false);
  const closeDocs = useCallback(() => setDocsOpen(false), []);

  const docs = useSupportingDocs(!!docsMode && status !== "verified");
  const locked = status === "pending";
  const count = docs.docs.length;
  const fileWord = `${count} ${count === 1 ? "file" : "files"}`;

  const request = async () => {
    setWorking(true);
    setError("");
    try {
      if (beforeRequest) {
        const ok = await beforeRequest();
        if (ok === false) { setWorking(false); return; }
      }
      const res = await fetch("/api/verification/request", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Couldn't submit your request. Please try again.");
        setWorking(false);
        return;
      }
      const next = data?.status || "pending";
      setDocsOpen(false);
      setStatus(next);
      onRequested?.(next);
    } catch {
      setError("Network error. Please try again.");
    }
    setWorking(false);
  };

  const Wrapper = unstyled ? Fragment : Card;

  // Nothing to show on a locked request that has no files.
  const showDocs = !!docsMode && status !== "verified" && !docs.loading && (!locked || count > 0);

  const documents = showDocs && (
    <div className={locked ? "mt-3" : "mb-3"}>
      {docsMode === "inline" ? (
        <>
          <h4 className="text-[13px] font-medium text-slate-700">Supporting documentation</h4>
          <p className="text-[12px] text-slate-500 leading-[1.5] mt-0.5 mb-2">
            {locked
              ? "Sent with your request. These can't be changed while it's under review."
              : "Highly recommended. Only MatchTutor admins can see these, and they're deleted once you're verified."}
          </p>
          <SupportingDocumentsPanel state={docs} readOnly={locked} />
        </>
      ) : (
        <>
          <div style={{ background: "var(--accent-softer)", border: "1px solid var(--accent-line)", borderRadius: 10, padding: 14 }}>
            <div className="flex items-start gap-3">
              <span
                className="shrink-0 flex items-center justify-center"
                style={{ width: 32, height: 32, borderRadius: 8, background: "var(--paper-card)", border: "1px solid var(--accent-line)", color: "var(--accent)" }}
              >
                <Icon name="file-text" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-[13px] font-medium text-slate-800">Supporting documentation</h4>
                <p className="text-[12px] text-slate-500 leading-[1.5] mt-0.5">
                  {locked
                    ? "Sent with your request. These can't be changed while it's under review."
                    : "Highly recommended. Only MatchTutor admins can see these, and they're deleted once you're verified."}
                </p>
                <p className="text-[12px] font-medium mt-1.5" style={{ color: count > 0 || docs.busy ? "var(--accent)" : "var(--ink-graphite)" }}>
                  {docs.busy ? "Uploading…" : count > 0 ? `${fileWord} ${locked ? "sent" : "saved"}` : "No files added yet"}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={locked ? "file-text" : "upload"}
                onClick={() => setDocsOpen(true)}
                full
              >
                {locked ? "View files" : count > 0 ? "Manage files" : "Add files"}
              </Button>
            </div>
          </div>
          {docsOpen && <SupportingDocumentsModal state={docs} readOnly={locked} onClose={closeDocs} />}
        </>
      )}
      {!locked && count > 0 && status === "rejected" && (
        <p className="text-[12px] text-slate-500 leading-[1.5] mt-2">
          Your files are saved for your next request. Remove any you don&apos;t want to send.
        </p>
      )}
    </div>
  );

  return (
    <Wrapper>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-[14px] font-light text-slate-800 tracking-tight">Get verified</h3>
        {status === "verified" && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: "var(--accent)" }}>
            <VerifiedTick size={16} /> Verified
          </span>
        )}
        {status === "pending" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider" style={{ background: "var(--accent-softer)", border: "1px solid var(--accent-line)", borderRadius: 999, color: "var(--accent)" }}>
            Under review
          </span>
        )}
      </div>

      {status === "verified" ? (
        <p className="text-[12.5px] text-slate-500 leading-[1.5]">
          Your account is verified. The badge shows next to your name across MatchTutor, and you rank higher in search.
        </p>
      ) : status === "pending" ? (
        <>
          <p className="text-[12.5px] text-slate-500 leading-[1.5] flex items-start gap-2">
            <span className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }}><Icon name="clock" size={14} /></span>
            Your request is in. An admin is reviewing your profile, and we'll email you the moment it's approved.
          </p>
          {documents}
        </>
      ) : (
        <>
          <p className="text-[12.5px] text-slate-500 leading-[1.5] mb-3">
            Verified tutors get a badge next to their name and rank higher in search. Request a review once your profile is ready.
          </p>
          {completionPct < 100 && (
            <p className="text-[12px] mb-3 flex items-start gap-1.5" style={{ color: "#B45309" }}>
              <span className="shrink-0 mt-0.5"><Icon name="alert-triangle" size={12} /></span>
              Recommended: complete your profile first ({completionPct}% done). A fuller profile is more likely to be approved.
            </p>
          )}
          {documents}
          <Button variant="primary" size="md" icon="shield-check" onClick={request} disabled={working || docs.busy} full>
            {working
              ? "Submitting…"
              : docs.busy
                ? "Uploading files…"
                : status === "rejected"
                  ? "Request another review"
                  : "Request verification"}
          </Button>
          {error && <p className="mt-2 text-[12px]" style={{ color: "#DC2626" }}>{error}</p>}
        </>
      )}
    </Wrapper>
  );
}

function Card({ children }) {
  return (
    <section className="bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 20 }}>
      {children}
    </section>
  );
}
