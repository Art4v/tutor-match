"use client";

import { Fragment, useState } from "react";
import { Icon } from "./Icon";
import { Button, VerifiedTick } from "./ui";

// Shared "Request verification" card. Used in the /settings sidebar and as the
// final /onboarding step. Owns its own status (seeded from `status`) so the UI
// updates immediately on request without touching parent editor state (which
// would spuriously flag unsaved changes). Verification is a recommendation, not
// a gate — an incomplete profile gets a soft note, never a disabled button.
//
// Props:
//   status         'none' | 'rejected' | 'pending' | 'verified'
//   completionPct  0–100 — drives the "complete your profile first" hint
//   beforeRequest  optional async () => boolean — run before POSTing (onboarding
//                  saves the profile first); return false to abort
//   onRequested    optional (newStatus) => void — notify the parent
//   unstyled       render without the bordered Card wrapper (when nested inside
//                  another card, e.g. the owner sidebar)
export function RequestVerification({ status: initialStatus = "none", completionPct = 100, beforeRequest, onRequested, unstyled = false }) {
  const [status, setStatus] = useState(initialStatus);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

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
        setError(data?.error || "Couldn't submit your request — please try again.");
        setWorking(false);
        return;
      }
      const next = data?.status || "pending";
      setStatus(next);
      onRequested?.(next);
    } catch {
      setError("Network error — please try again.");
    }
    setWorking(false);
  };

  const Wrapper = unstyled ? Fragment : Card;

  return (
    <Wrapper>
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-[14px] font-semibold text-slate-900 tracking-tight">Get verified</h3>
        {status === "verified" && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: "var(--accent)" }}>
            <VerifiedTick size={14} /> Verified
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
          Your account is verified — the badge shows next to your name across matchtutor, and you rank higher in search.
        </p>
      ) : status === "pending" ? (
        <p className="text-[12.5px] text-slate-500 leading-[1.5] flex items-start gap-2">
          <span className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }}><Icon name="clock" size={14} /></span>
          Your request is in — an admin is reviewing your profile. We'll email you the moment it's approved.
        </p>
      ) : (
        <>
          <p className="text-[12.5px] text-slate-500 leading-[1.5] mb-3">
            Verified tutors get a badge next to their name and rank higher in search. Request a review once your profile is ready.
          </p>
          {completionPct < 100 && (
            <p className="text-[12px] mb-3 flex items-start gap-1.5" style={{ color: "#B45309" }}>
              <span className="shrink-0 mt-0.5"><Icon name="alert-triangle" size={12} /></span>
              Recommended: complete your profile first ({completionPct}% done) — a fuller profile is more likely to be approved.
            </p>
          )}
          <Button variant="primary" size="md" icon="shield-check" onClick={request} disabled={working} full>
            {working ? "Submitting…" : status === "rejected" ? "Request another review" : "Request verification"}
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
