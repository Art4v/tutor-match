"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";

/**
 * The one modal shell (DESIGN.md §6, REDESIGN_DECISIONS.md items 16 and 17).
 *
 * White, 4px radius, the floating shadow, a 1px rule border, a plain 40% scrim
 * (`--scrim`), no blur, no icon tiles. Title 20px/600; `footer` renders the
 * actions bottom right (secondary first, then primary).
 *
 * `sheet`: below 640px the modal becomes a full-screen sheet. Use it for any
 * modal that contains a form (editor sections, report, review, bug report,
 * image crop). Short confirms and the consent gate leave it off and stay small
 * centred dialogs.
 *
 * `dismissable={false}` disables Escape and scrim clicks (the blocking consent
 * gate). Behaviour is otherwise the caller's: this renders only when mounted.
 */
export function Modal({
  title,
  children,
  footer,
  onClose,
  width = 480,
  sheet = false,
  dismissable = true,
  labelledBy,
  zIndex = 60,
}) {
  const autoId = useId();
  const titleId = labelledBy || (title ? `${autoId}-title` : undefined);
  const panelRef = useRef(null);
  // Callers usually pass an inline arrow, so `onClose` changes on every render.
  // Reading it through a ref keeps the mount effect below from re-running (which
  // would re-lock scroll and steal focus back to the first field mid-typing).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissRef = useRef(dismissable);
  dismissRef.current = dismissable;

  useEffect(() => {
    lockScroll();
    const onKey = (e) => {
      if (e.key === "Escape" && dismissRef.current && onCloseRef.current) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the dialog so keyboard users land inside it.
    const t = window.setTimeout(() => {
      // First VISIBLE, enabled control: a hidden file input (upload buttons wrap
      // one) must not take focus, or focus never lands in the dialog.
      const el = [
        ...(panelRef.current?.querySelectorAll(
          "input:not([type='hidden']), textarea, select, button:not([data-modal-close]), [href], [tabindex]:not([tabindex='-1'])"
        ) || []),
      ].find((n) => !n.disabled && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== "hidden");
      (el || panelRef.current)?.focus?.();
    }, 0);
    return () => {
      unlockScroll();
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex justify-center ${sheet ? "items-stretch sm:items-center sm:p-4" : "items-center p-4"}`}
      style={{ background: "var(--scrim)", zIndex }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissable && onClose) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex flex-col w-full bg-surface ${
          sheet ? "h-full sm:h-auto sm:max-h-[calc(100vh-32px)] sm:rounded sm:border sm:border-rule" : "max-h-[calc(100vh-32px)] rounded border border-rule"
        }`}
        style={{ maxWidth: width, boxShadow: "var(--shadow-float)" }}
      >
        {(title || (dismissable && onClose)) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
            {title ? (
              <h2 id={titleId} className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {dismissable && onClose && (
              <button
                type="button"
                data-modal-close
                onClick={onClose}
                aria-label="Close"
                className="-mr-3 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2"
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 pb-6 text-[14px] leading-5 text-[color:var(--text)]">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
