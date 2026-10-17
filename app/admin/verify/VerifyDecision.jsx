"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

// Approve / Reject control for /admin/verify. POSTs the signed token to the
// approve or reject route (the GET page never mutates). Shows a success state in
// place so the admin gets immediate feedback without a redirect.
export function VerifyDecision({ token, tutorName, profileHref }) {
  const [state, setState] = useState("idle"); // idle | working | done | error
  const [action, setAction] = useState(null); // "approve" | "reject" — which one ran
  const [message, setMessage] = useState("");
  // Set when the route reports the request was no longer pending (a stale
  // link, the other button, or a withdrawal). The status it ended up in.
  const [decidedStatus, setDecidedStatus] = useState(null);

  const submit = async (which) => {
    setState("working");
    setAction(which);
    setMessage("");
    try {
      const res = await fetch(`/api/verification/${which}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data?.error || "Something went wrong. Please try again.");
        return;
      }
      if (data?.alreadyDecided) setDecidedStatus(data.status ?? "none");
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error. Please try again.");
    }
  };

  if (state === "done" && decidedStatus) {
    const text = {
      verified: `${tutorName} is already verified.`,
      rejected: `${tutorName}'s request was already rejected.`,
    }[decidedStatus] || `${tutorName} withdrew this request, so nothing was changed.`;
    return (
      <div
        className="flex items-center gap-2.5 text-[14px] font-medium"
        style={{ background: "var(--desk)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)", borderRadius: 12, padding: "14px 16px" }}
      >
        <Icon name="info" size={18} />
        <span>{text}</span>
      </div>
    );
  }

  if (state === "done") {
    const approved = action === "approve";
    return (
      <div
        className="flex items-center gap-2.5 text-[14px] font-medium"
        style={
          approved
            ? { background: "var(--accent-softer)", color: "var(--accent)", border: "1px solid var(--accent-line)", borderRadius: 12, padding: "14px 16px" }
            : { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 16px" }
        }
      >
        <Icon name={approved ? "shield-check" : "x"} size={18} />
        <span>{approved ? `${tutorName} is now verified.` : `${tutorName}'s request was rejected.`}</span>
        {approved && profileHref && (
          <a href={profileHref} className="ml-auto inline-flex items-center gap-1 underline underline-offset-2">
            View <Icon name="arrow-right" size={13} />
          </a>
        )}
      </div>
    );
  }

  const working = state === "working";

  return (
    <div>
      <div className="flex gap-3">
        <Button variant="primary" size="lg" icon="check" onClick={() => submit("approve")} disabled={working} full>
          {working && action === "approve" ? "Approving…" : "Approve"}
        </Button>
        <button
          type="button"
          onClick={() => submit("reject")}
          disabled={working}
          className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full"
          style={{
            background: "var(--paper-card)",
            color: "#DC2626",
            border: "1px solid #FECACA",
            padding: "11px 20px",
            fontSize: 15,
            height: 44,
            borderRadius: 10,
            cursor: working ? "not-allowed" : "pointer",
            letterSpacing: "-0.005em",
          }}
        >
          <Icon name="x" size={17} />
          {working && action === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {state === "error" && (
        <p className="mt-2.5 text-[13px]" style={{ color: "#DC2626" }}>{message}</p>
      )}
    </div>
  );
}
