"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/**
 * The one toast (DESIGN.md §6; replaces five hand-rolled copies).
 *
 *   const [toast, showToast] = useToast();
 *   showToast("success" | "error" | "info", "Saved.", ms?);
 *   ...
 *   <Toast toast={toast} />
 *
 * `showToast` has the same (kind, text, ms = 3500) signature the old copies
 * used, so call sites only swap their local state for the hook. White, floating
 * shadow, 4px radius, bottom centre, 14px text, a status icon in its colour.
 */
export function useToast() {
  const [toast, setToast] = useState(null); // { kind, text }
  const timer = useRef(null);
  const showToast = useCallback((kind, text, ms = 3500) => {
    setToast({ kind, text });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [toast, showToast, () => setToast(null)];
}

const KINDS = {
  success: { icon: "check", color: "var(--success)" },
  error: { icon: "alert-triangle", color: "var(--error)" },
  warning: { icon: "alert-triangle", color: "var(--warning)" },
  info: { icon: null, color: "var(--text)" },
};

export function Toast({ toast }) {
  if (!toast) return null;
  const k = KINDS[toast.kind] || KINDS.info;
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 inline-flex max-w-[calc(100vw-32px)] items-center gap-2 rounded border border-rule bg-surface px-4 py-3 text-[14px] leading-5 text-[color:var(--text)]"
      style={{ boxShadow: "var(--shadow-float)" }}
    >
      {k.icon && (
        <span className="inline-flex shrink-0" style={{ color: k.color }}>
          <Icon name={k.icon} size={16} />
        </span>
      )}
      <span>{toast.text}</span>
    </div>
  );
}
