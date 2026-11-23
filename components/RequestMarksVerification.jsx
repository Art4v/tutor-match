"use client";

import { useCallback, useState } from "react";
import { Icon } from "./Icon";
import { Button, MarksSeal } from "./ui";
import { SupportingDocumentsModal, useSupportingDocs } from "./SupportingDocuments";

// The "marks verified" seal block (0083), shown inside RequestVerification
// once a tutor is verified. A verified tutor attaches private supporting
// documents (the 0079 flow, reopened for them) and asks for the seal; an admin
// grants or declines. Owns its own status, like RequestVerification, so a
// request never touches the editor's draft state.
//
// status: 'none' | 'declined' (can ask) | 'pending' (locked, can withdraw) |
//         'verified' (holds the seal)
export function RequestMarksVerification({ status: initialStatus = "none" }) {
  const [status, setStatus] = useState(initialStatus);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [docsOpen, setDocsOpen] = useState(false);
  const closeDocs = useCallback(() => setDocsOpen(false), []);

  const held = status === "verified";
  const locked = status === "pending";
  const docs = useSupportingDocs(!held);
  const count = docs.docs.length;
  const fileWord = `${count} ${count === 1 ? "file" : "files"}`;

  const send = async (method, fallback) => {
    setWorking(true);
    setError("");
    try {
      const res = await fetch("/api/verification/marks", { method });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || fallback);
      } else {
        setDocsOpen(false);
        setStatus(data?.status || (method === "POST" ? "pending" : "none"));
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setWorking(false);
  };

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--desk)" }}>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-[14px] font-light text-slate-800 tracking-tight">Marks verified seal</h3>
        {held && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: "var(--accent)" }}>
            <MarksSeal size={16} /> Held
          </span>
        )}
        {locked && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider" style={{ background: "var(--accent-softer)", border: "1px solid var(--accent-line)", borderRadius: 999, color: "var(--accent)" }}>
            Under review
          </span>
        )}
      </div>

      {held ? (
        <p className="text-[12.5px] text-slate-500 leading-[1.5]">
          We have checked the marks on your profile. The seal shows beside your verified badge, and you rank at the top of search.
        </p>
      ) : (
        <>
          <p className="text-[12.5px] text-slate-500 leading-[1.5] mb-3">
            {locked
              ? "Your request is in. An admin is checking your documents against the marks on your profile, and we'll email you the decision. Your profile stays listed as normal."
              : status === "declined"
                ? "We couldn't confirm your marks last time. Add clearer documents, such as your ATAR notice or results, and ask again whenever you're ready."
                : "Send documents that prove the marks on your profile, such as your ATAR notice or results. Tutors with the seal show it beside their verified badge and rank at the top of search."}
          </p>

          {!docs.loading && (!locked || count > 0) && (
            <div className="mb-3" style={{ background: "var(--accent-softer)", border: "1px solid var(--accent-line)", borderRadius: 10, padding: 14 }}>
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
                      : "Only MatchTutor admins can see these, and they're deleted once your marks are verified."}
                  </p>
                  <p className="text-[12px] font-medium mt-1.5" style={{ color: count > 0 || docs.busy ? "var(--accent)" : "var(--ink-graphite)" }}>
                    {docs.busy ? "Uploading…" : count > 0 ? `${fileWord} ${locked ? "sent" : "saved"}` : "No files added yet"}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" icon={locked ? "file-text" : "upload"} onClick={() => setDocsOpen(true)} full>
                  {locked ? "View files" : count > 0 ? "Manage files" : "Add files"}
                </Button>
              </div>
            </div>
          )}
          {docsOpen && (
            <SupportingDocumentsModal
              state={docs}
              readOnly={locked}
              onClose={closeDocs}
              note="Only MatchTutor admins can see these. They're deleted once your marks are verified."
            />
          )}

          {locked ? (
            <Button variant="outline" size="md" onClick={() => send("DELETE", "Couldn't withdraw your request. Please try again.")} disabled={working} full>
              {working ? "Withdrawing…" : "Withdraw request"}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              icon="shield-check"
              onClick={() => send("POST", "Couldn't submit your request. Please try again.")}
              disabled={working || docs.busy}
              full
            >
              {working
                ? "Submitting…"
                : docs.busy
                  ? "Uploading files…"
                  : status === "declined"
                    ? "Request another review"
                    : "Request marks verification"}
            </Button>
          )}
          {!locked && !docs.loading && count === 0 && (
            <p className="mt-2 text-[12px] text-slate-500 leading-[1.5]">
              Documents are highly recommended. A request without them is unlikely to be approved.
            </p>
          )}
          {error && <p className="mt-2 text-[12px]" style={{ color: "#DC2626" }}>{error}</p>}
        </>
      )}
    </div>
  );
}
