"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";

// Generic destructive-action confirmation dialog. Mirrors the messaging
// UnsendConfirmModal / account-deletion modal styling (red accent, alert icon).
// Backdrop click + Escape cancel unless mid-action (busy).
export function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  confirmingLabel = "Working…",
  icon = "alert-triangle",
  tone = "danger", // "danger" (red) | "accent" (positive, e.g. unblock)
  busy = false,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const palette =
    tone === "accent"
      ? { chipBg: "var(--accent-softer)", chipFg: "var(--accent)", title: "var(--ink)", btnBg: "var(--accent)", btnBorder: "var(--accent)" }
      : { chipBg: "#FEE2E2", chipFg: "#DC2626", title: "#B91C1C", btnBg: "#DC2626", btnBorder: "#DC2626" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,30,30,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full"
        style={{ maxWidth: 420, borderRadius: "var(--radius-card)", padding: 24, boxShadow: "0 24px 60px rgba(0,30,30,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex items-center justify-center shrink-0"
            style={{ width: 36, height: 36, borderRadius: 999, background: palette.chipBg, color: palette.chipFg }}
          >
            <Icon name={icon} size={18} />
          </span>
          <div>
            <h2 id="confirm-modal-title" className="text-[17px] font-light tracking-tight" style={{ color: palette.title }}>
              {title}
            </h2>
            <p className="text-[13.5px] text-slate-600 mt-1.5">{body}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <Button variant="outline" size="md" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: palette.btnBg,
              color: "#fff",
              border: `1px solid ${palette.btnBorder}`,
              padding: "9px 16px",
              fontSize: 14,
              height: 40,
              borderRadius: 10,
              cursor: busy ? "not-allowed" : "pointer",
              letterSpacing: "-0.005em",
            }}
          >
            <Icon name={icon} size={14} />
            {busy ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
