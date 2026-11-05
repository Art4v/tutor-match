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
        className="-mr-3 -mt-3 inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2"
        style={{ transition: "background-color 120ms ease-out" }}
      >
        <Icon name="more" size={16} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[176px] rounded border border-rule bg-surface py-1 shadow-float"
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
      className={`flex h-11 w-full items-center justify-between gap-4 px-4 text-[14px] leading-5 hover:bg-surface-2 ${
        danger ? "text-error" : "text-[color:var(--text)]"
      }`}
      style={{ transition: "background-color 120ms ease-out" }}
    >
      {label}
      <Icon name={icon} size={16} />
    </button>
  );
}
