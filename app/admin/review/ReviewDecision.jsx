"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

// Approve / Reject control for /admin/review. POSTs the signed token to the
// approve or reject route (the GET page never mutates). Shows a success state in
// place so the admin gets immediate feedback without a redirect. Mirrors
// app/admin/verify/VerifyDecision.jsx.
export function ReviewDecision({ token, studentName, tutorName, profileHref }) {
  const [state, setState] = useState("idle"); // idle | working | done | error
  const [action, setAction] = useState(null); // "approve" | "reject" — which one ran
  const [message, setMessage] = useState("");

  const submit = async (which) => {
    setState("working");
    setAction(which);
    setMessage("");
    try {
      const res = await fetch(`/api/reviews/${which}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data?.error || "Something went wrong, please try again.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error, please try again.");
    }
  };

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
        <Icon name={approved ? "check-circle" : "x"} size={18} />
        <span>
          {approved
            ? `Published on ${tutorName}'s profile.`
            : `${studentName}'s review was rejected.`}
        </span>
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
