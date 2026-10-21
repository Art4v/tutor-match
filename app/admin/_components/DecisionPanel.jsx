"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

const MAX_REASON = 500; // must match the admin_actions CHECK (0074)

const TONES = {
  primary: { background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)" },
  danger: { background: "#DC2626", color: "#fff", border: "1px solid #DC2626" },
  "danger-outline": { background: "var(--paper-card)", color: "#DC2626", border: "1px solid #FECACA" },
  neutral: { background: "var(--paper-card)", color: "var(--ink-graphite)", border: "1px solid var(--paper-line)" },
};

/**
 * The one decision control every /admin page uses: a set of action buttons,
 * an optional note (always logged to History; emailed to the user where the
 * route sends an email), and an in-place result.
 *
 * Each action POSTs `{ ...body, ...action.body, reason }` to `endpoint`, or to
 * `endpoint/<action.path>` when the action names one.
 * A response with `alreadyDecided` means another admin got there first; it is
 * shown as such rather than as a success. On success the page is refreshed so
 * the server re-renders the item in its decided state.
 *
 * action: { key, label, busyLabel, doneText, tone, icon, body, path?,
 *           confirmWord? (must be typed before it runs) }
 */
export function DecisionPanel({ endpoint, body = {}, actions, reasonLabel = "Note (optional)", reasonHint, layout = "row" }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState(null); // action key
  const [armed, setArmed] = useState(null); // action key awaiting its confirm word
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null); // { tone, text }
  const [error, setError] = useState("");

  const run = async (action) => {
    if (action.confirmWord && armed !== action.key) {
      setArmed(action.key);
      setTyped("");
      return;
    }
    setRunning(action.key);
    setError("");
    try {
      const res = await fetch(action.path ? `${endpoint}/${action.path}` : endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, ...action.body, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        setRunning(null);
        return;
      }
      if (data?.alreadyDecided) {
        const who = data.decided ? ` by ${data.decided.by}` : "";
        setResult({ tone: "neutral", text: `Already decided${who}, so nothing was changed.` });
      } else if (data?.applied === false) {
        setResult({ tone: "neutral", text: "Nothing to change: it was already in that state." });
      } else {
        setResult({ tone: action.tone === "primary" || action.tone === "neutral" ? "ok" : "bad", text: action.doneText });
      }
      setRunning(null);
      setArmed(null);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setRunning(null);
    }
  };

  if (result) {
    const style = {
      ok: { background: "var(--accent-softer)", color: "var(--accent)", border: "1px solid var(--accent-line)" },
      bad: { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" },
      neutral: { background: "var(--desk)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)" },
    }[result.tone];
    return (
      <div className="flex items-center gap-2.5 text-[14px] font-medium" style={{ ...style, borderRadius: 12, padding: "14px 16px" }}>
        <Icon name={result.tone === "ok" ? "check-circle" : "info"} size={18} />
        <span>{result.text}</span>
      </div>
    );
  }

  const busy = running !== null;
  const armedAction = actions.find((a) => a.key === armed);

  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-700 mb-1.5" htmlFor="admin-reason">
        {reasonLabel}
      </label>
      <textarea
        id="admin-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
        rows={2}
        placeholder="Recorded in History with your decision."
        className="w-full px-3 py-2 text-[13.5px] text-slate-700"
        style={{ border: "1px solid var(--paper-line)", borderRadius: 10, outline: "none", resize: "vertical" }}
      />
      <div className="flex justify-between gap-3 text-[11.5px] text-slate-400">
        <span>{reasonHint}</span>
        <span className="tabular-nums">
          {reason.length}/{MAX_REASON}
        </span>
      </div>

      {armedAction ? (
        <div className="mt-3" style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 14 }}>
          <label className="block text-[13px] text-slate-700 mb-2" htmlFor="admin-confirm">
            Type <span className="font-medium">{armedAction.confirmWord}</span> to confirm. This can&apos;t be undone.
          </label>
          <input
            id="admin-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="w-full px-3 text-[14px]"
            style={{ height: 40, border: "1px solid #FECACA", borderRadius: 10, outline: "none", background: "var(--paper-card)" }}
          />
          <div className="flex gap-2.5 mt-3">
            <ActionButton tone="neutral" onClick={() => setArmed(null)} disabled={busy}>
              Cancel
            </ActionButton>
            <ActionButton
              tone="danger"
              icon={armedAction.icon}
              onClick={() => run(armedAction)}
              disabled={busy || typed.trim() !== armedAction.confirmWord}
            >
              {running === armedAction.key ? armedAction.busyLabel || "Working…" : armedAction.label}
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className={`mt-3 flex gap-2.5 ${layout === "column" ? "flex-col" : "flex-col sm:flex-row"}`}>
          {actions.map((action) => (
            <ActionButton key={action.key} tone={action.tone} icon={action.icon} onClick={() => run(action)} disabled={busy}>
              {running === action.key ? action.busyLabel || "Working…" : action.label}
            </ActionButton>
          ))}
        </div>
      )}

      {error && <p className="mt-2.5 text-[13px]" style={{ color: "#DC2626" }}>{error}</p>}
    </div>
  );
}

function ActionButton({ tone = "neutral", icon, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full"
      style={{ ...TONES[tone], height: 44, padding: "0 18px", borderRadius: 10, fontSize: 15, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}
