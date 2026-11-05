"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

const MAX_REASON = 500; // must match the admin_actions CHECK (0074)

const TONES = {
  primary: "bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover",
  danger: "bg-error text-white border-error",
  "danger-outline": "bg-surface text-error border-input hover:bg-surface-2",
  neutral: "bg-surface text-[color:var(--text)] border-input hover:bg-surface-2",
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
    const color = { ok: "text-success", bad: "text-error", neutral: "text-[color:var(--text-2)]" }[result.tone];
    return (
      <div role="status" className={`flex items-start gap-2 bg-surface-2 rounded p-4 text-[14px] leading-5 font-semibold ${color}`}>
        <span className="shrink-0 mt-0.5">
          <Icon name={result.tone === "ok" ? "check-circle" : "info"} size={16} />
        </span>
        <span>{result.text}</span>
      </div>
    );
  }

  const busy = running !== null;
  const armedAction = actions.find((a) => a.key === armed);

  return (
    <div>
      <label className="block mb-1 text-[14px] leading-5 font-semibold text-[color:var(--text)]" htmlFor="admin-reason">
        {reasonLabel}
      </label>
      <textarea
        id="admin-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
        rows={2}
        aria-describedby="admin-reason-hint"
        className="block w-full px-3 py-2 rounded border border-input bg-surface text-[14px] leading-5 text-[color:var(--text)]"
        style={{ resize: "vertical", minHeight: 44 }}
      />
      <div id="admin-reason-hint" className="flex justify-between gap-3 mt-1 text-[12px] leading-4 text-muted">
        <span>{reasonHint || "Recorded in History with your decision."}</span>
        <span className="tabular-nums">
          {reason.length}/{MAX_REASON}
        </span>
      </div>

      {armedAction ? (
        <div className="mt-4 bg-surface-2 rounded p-4">
          <label className="block mb-2 text-[14px] leading-5 text-[color:var(--text)]" htmlFor="admin-confirm">
            Type <span className="font-semibold">{armedAction.confirmWord}</span> to confirm. This can&apos;t be undone.
          </label>
          <input
            id="admin-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="block w-full h-11 px-3 rounded border border-input bg-surface text-[14px] leading-5 text-[color:var(--text)]"
          />
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <ActionButton tone="neutral" onClick={() => setArmed(null)} disabled={busy}>
              Cancel
            </ActionButton>
            <ActionButton
              tone="danger"
              onClick={() => run(armedAction)}
              disabled={busy || typed.trim() !== armedAction.confirmWord}
            >
              {running === armedAction.key ? armedAction.busyLabel || "Working…" : armedAction.label}
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className={`mt-4 flex gap-2 ${layout === "column" ? "flex-col sm:items-start" : "flex-col sm:flex-row"}`}>
          {actions.map((action) => (
            <ActionButton key={action.key} tone={action.tone} onClick={() => run(action)} disabled={busy}>
              {running === action.key ? action.busyLabel || "Working…" : action.label}
            </ActionButton>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-[14px] leading-5 text-error">{error}</p>}
    </div>
  );
}

// DESIGN.md: buttons carry no icons unless icon-only, so an action's `icon`
// is accepted and not drawn.
function ActionButton({ tone = "neutral", onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center w-full sm:w-auto h-11 px-4 rounded border text-[14px] leading-5 font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
        TONES[tone] || TONES.neutral
      }`}
      style={{ transition: "background-color 120ms ease-out, border-color 120ms ease-out" }}
    >
      {children}
    </button>
  );
}
