"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

const MAX_REASON = 500;

// Approve / Reject control for /admin/profile-revision. POSTs the signed token
// to the approve or reject route (the GET page never mutates). Reject asks for
// an optional reason first, which reaches the tutor in their notification and
// email. Mirrors app/admin/review/ReviewDecision.jsx.
export function RevisionDecision({ token, tutorName }) {
  const [state, setState] = useState("idle"); // idle | rejecting | working | done | error
  const [action, setAction] = useState(null); // "approve" | "reject"
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState(null); // route response on success

  const submit = async (which) => {
    setState("working");
    setAction(which);
    setMessage("");
    try {
      const res = await fetch(`/api/profile-revisions/${which}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(which === "reject" ? { token, reason } : { token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setOutcome(data);
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error. Please try again.");
    }
  };

  if (state === "done") {
    if (outcome?.alreadyDecided) {
      return (
        <Banner tone="neutral" icon="info">
          These changes were already dealt with ({outcome.status || "no longer pending"}), so nothing was changed.
        </Banner>
      );
    }
    const approved = action === "approve";
    return (
      <Banner tone={approved ? "ok" : "bad"} icon={approved ? "check-circle" : "x"}>
        <span>{approved ? `${tutorName}'s changes are live.` : `${tutorName}'s changes were not approved.`}</span>
        {approved && outcome?.profileHref && (
          <a href={outcome.profileHref} className="ml-auto inline-flex items-center gap-1 underline underline-offset-2">
            View <Icon name="arrow-right" size={13} />
          </a>
        )}
      </Banner>
    );
  }

  const working = state === "working";

  if (state === "rejecting" || (working && action === "reject") || (state === "error" && action === "reject")) {
    return (
      <div>
        <label className="block text-[13px] font-medium text-slate-700 mb-1.5" htmlFor="reject-reason">
          Reason for the tutor (optional)
        </label>
        <textarea
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
          rows={3}
          placeholder="For example: please remove the phone number from your About section."
          className="w-full px-3 py-2 text-[13.5px] text-slate-700"
          style={{ border: "1px solid var(--paper-line)", borderRadius: 10, outline: "none", resize: "vertical" }}
        />
        <div className="text-[11.5px] text-slate-400 text-right tabular-nums">{reason.length}/{MAX_REASON}</div>
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => { setState("idle"); setAction(null); setMessage(""); }}
            disabled={working}
            className="w-full font-medium disabled:opacity-50"
            style={{ background: "var(--paper-card)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)", height: 44, borderRadius: 10, fontSize: 15 }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => submit("reject")}
            disabled={working}
            className="w-full inline-flex items-center justify-center gap-2 font-medium disabled:opacity-50"
            style={{ background: "#DC2626", color: "#fff", height: 44, borderRadius: 10, fontSize: 15 }}
          >
            <Icon name="x" size={17} />
            {working ? "Rejecting…" : "Reject changes"}
          </button>
        </div>
        {state === "error" && <p className="mt-2.5 text-[13px]" style={{ color: "#DC2626" }}>{message}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-3">
        <Button variant="primary" size="lg" icon="check" onClick={() => submit("approve")} disabled={working} full>
          {working ? "Approving…" : "Approve"}
        </Button>
        <button
          type="button"
          onClick={() => { setState("rejecting"); setAction("reject"); setMessage(""); }}
          disabled={working}
          className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full"
          style={{ background: "var(--paper-card)", color: "#DC2626", border: "1px solid #FECACA", height: 44, borderRadius: 10, fontSize: 15 }}
        >
          <Icon name="x" size={17} />
          Reject
        </button>
      </div>
      {state === "error" && <p className="mt-2.5 text-[13px]" style={{ color: "#DC2626" }}>{message}</p>}
    </div>
  );
}

function Banner({ tone, icon, children }) {
  const style = {
    ok: { background: "var(--accent-softer)", color: "var(--accent)", border: "1px solid var(--accent-line)" },
    bad: { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" },
    neutral: { background: "var(--desk)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)" },
  }[tone];
  return (
    <div className="flex items-center gap-2.5 text-[14px] font-medium" style={{ ...style, borderRadius: 12, padding: "14px 16px" }}>
      <Icon name={icon} size={18} />
      {children}
    </div>
  );
}
