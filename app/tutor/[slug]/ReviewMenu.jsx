"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

// Per-review kebab menu. Chrome copied from the conversation-header menu in
// app/messages/MessagesClient.jsx — that file's MenuItem is a local helper
// rather than a shared export, so this is a deliberate copy rather than a
// cross-feature import.
//
// Scoping lives with the caller: it decides which items a given viewer gets, and
// renders nothing at all when there are none (a guest, or someone else's review
// before reporting ships).
//
// `items` is [{ icon, label, onClick, danger }].
export function ReviewMenu({ items = [], label = "Review options" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        style={{ width: 28, height: 28, borderRadius: 999 }}
      >
        <Icon name="more" size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-30 py-1 min-w-[170px]"
          style={{
            background: "var(--paper-card)",
            border: "1px solid var(--paper-line)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,30,30,0.18)",
          }}
        >
          {items.map((item) => (
            <MenuItem
              key={item.label}
              {...item}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 px-3.5 py-2 text-[13.5px] transition-colors hover:bg-slate-50"
      style={{ color: danger ? "#dc2626" : "var(--ink)" }}
    >
      {label}
      <Icon name={icon} size={15} />
    </button>
  );
}
