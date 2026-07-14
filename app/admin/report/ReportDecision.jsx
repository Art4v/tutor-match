"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

// Decision control for /admin/report. POSTs the signed token + chosen action to
// the resolve route (the GET page never mutates). Shows a success state in place
// so the admin gets immediate feedback without a redirect.
export function ReportDecision({ token, reporterName, reportedName }) {
  const [state, setState] = useState("idle"); // idle | working | done | error
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState("");

  const submit = async (which) => {
    setState("working");
    setAction(which);
    setMessage("");
    try {
      const res = await fetch("/api/reports/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: which }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setMessage(data?.error || "Something went wrong — please try again.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMessage("Network error — please try again.");
    }
  };

  if (state === "done") {
    const label =
      action === "disable_reported"
        ? `${reportedName}'s account has been disabled.`
        : action === "disable_reporter"
        ? `${reporterName}'s account has been disabled.`
        : "The report was dismissed. No accounts were changed.";
    const danger = action !== "dismiss";
    return (
      <div
        className="flex items-center gap-2.5 text-[14px] font-medium"
        style={
          danger
            ? { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 16px" }
            : { background: "var(--desk)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)", borderRadius: 12, padding: "14px 16px" }
        }
      >
        <Icon name={danger ? "ban" : "check-circle"} size={18} />
        <span>{label}</span>
      </div>
    );
  }

  const working = state === "working";

  return (
    <div>
      <div className="flex flex-col gap-2.5">
        <DangerButton onClick={() => submit("disable_reported")} disabled={working} busy={working && action === "disable_reported"}>
          Disable {reportedName} (reported)
        </DangerButton>
        <DangerButton onClick={() => submit("disable_reporter")} disabled={working} busy={working && action === "disable_reporter"}>
          Disable {reporterName} (reporter)
        </DangerButton>
        <button
          type="button"
          onClick={() => submit("dismiss")}
          disabled={working}
          className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full"
          style={{
            background: "var(--paper-card)",
            color: "var(--ink-graphite)",
            border: "1px solid var(--paper-line)",
            padding: "11px 20px",
            fontSize: 15,
            height: 44,
            borderRadius: 10,
            cursor: working ? "not-allowed" : "pointer",
          }}
        >
          {working && action === "dismiss" ? "Dismissing…" : "Dismiss report"}
        </button>
      </div>
      {state === "error" && <p className="mt-2.5 text-[13px]" style={{ color: "#DC2626" }}>{message}</p>}
    </div>
  );
}

function DangerButton({ onClick, disabled, busy, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full"
      style={{
        background: "#DC2626",
        color: "#fff",
        border: "1px solid #DC2626",
        padding: "11px 20px",
        fontSize: 15,
        height: 44,
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <Icon name="ban" size={16} />
      {busy ? "Disabling…" : children}
    </button>
  );
}
