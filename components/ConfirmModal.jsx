"use client";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";

// Generic confirmation dialog on the shared Modal shell: a small centred dialog
// (no sheet, no icon tile). Scrim click + Escape cancel unless mid-action (busy).
//
// `icon` is still accepted so existing callers keep working, but it is no longer
// drawn (DESIGN.md: no icon tiles). `tone="danger"` gives the confirm button the
// destructive treatment; `tone="accent"` (positive, e.g. unblock) the primary one.
export function ConfirmModal({
  title,
  body,
  confirmLabel = "Confirm",
  confirmingLabel = "Working…",
  // eslint-disable-next-line no-unused-vars
  icon,
  tone = "danger", // "danger" | "accent"
  busy = false,
  onCancel,
  onConfirm,
}) {
  // Modal re-runs its effect when onClose changes identity; callers pass inline
  // arrows, so hand it a stable function that reads the latest onCancel.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const close = useCallback(() => cancelRef.current?.(), []);

  return (
    <Modal
      title={title}
      onClose={close}
      dismissable={!busy}
      width={420}
      zIndex={80}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone === "accent" ? "primary" : "danger"} onClick={onConfirm} disabled={busy}>
            {busy ? confirmingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">{body}</p>
    </Modal>
  );
}
