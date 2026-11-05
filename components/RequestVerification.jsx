"use client";

import { Fragment, useState } from "react";
import { Button, VerifiedTick } from "./ui";

// Shared "Request verification" block. Used in the owner profile's right
// column and as the final /onboarding step. Owns its own status (seeded from
// `status`) so the UI updates immediately on request without touching parent
// editor state (which would spuriously flag unsaved changes). Verification is
// a recommendation, not a gate: an incomplete profile gets a soft note, never a
// disabled button.
//
// Props:
//   status         'none' | 'rejected' | 'pending' | 'verified'
//   completionPct  0 to 100, drives the "complete your profile first" hint
//   beforeRequest  optional async () => boolean, run before POSTing (onboarding
//                  saves the profile first); return false to abort
//   onRequested    optional (newStatus) => void, notify the parent
//   unstyled       render without the section wrapper (when the parent already
//                  supplies the heading and rules, e.g. the owner column)
//   showHeading    false hides the "Get verified" heading (the owner column
//                  renders its own one-line notice instead)
export function RequestVerification({
  status: initialStatus = "none",
  completionPct = 100,
  beforeRequest,
  onRequested,
  unstyled = false,
  showHeading = true,
}) {
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
        setError(data?.error || "Couldn't submit your request. Please try again.");
        setWorking(false);
        return;
      }
      const next = data?.status || "pending";
      setStatus(next);
      onRequested?.(next);
    } catch {
      setError("Network error. Please try again.");
    }
    setWorking(false);
  };

  const Wrapper = unstyled ? Fragment : Plain;

  return (
    <Wrapper>
      {showHeading && (
        <h3 className="mb-1 flex items-center gap-2 text-[16px] leading-6 font-semibold text-[color:var(--text)]">
          {status === "verified" ? (
            <>
              <VerifiedTick size={16} /> Verified
            </>
          ) : status === "pending" ? (
            "Verification under review"
          ) : (
            "Get verified"
          )}
        </h3>
      )}

      {status === "verified" ? (
        <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
          Your profile is verified. The mark shows next to your name across MatchTutor, and you rank higher in search.
        </p>
      ) : status === "pending" ? (
        <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
          Your request is in. An admin is reviewing your profile, and we&apos;ll email you once it&apos;s approved.
        </p>
      ) : (
        <>
          <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
            Verified tutors get a mark next to their name and rank higher in search. Request a review once your profile is ready.
          </p>
          {completionPct < 100 && (
            <p className="mt-2 text-[12px] leading-4 text-muted">
              Recommended: complete your profile first ({completionPct}% done). A fuller profile is more likely to be approved.
            </p>
          )}
          <div className="mt-4">
            <Button variant="primary" onClick={request} disabled={working}>
              {working ? "Submitting…" : status === "rejected" ? "Request another review" : "Request verification"}
            </Button>
          </div>
          {error && <p className="mt-2 text-[14px] leading-5 text-error">{error}</p>}
        </>
      )}
    </Wrapper>
  );
}

// Standalone use (onboarding): a flat block, no box (DESIGN.md §4).
function Plain({ children }) {
  return <section>{children}</section>;
}
