"use client";

// Shared form pieces for the auth screens (DESIGN.md §6 "Inputs" and
// REDESIGN_DECISIONS.md item 8): a plain heading, labels above 44px inputs,
// checkbox rows, and status lines without boxes. Presentational only; every
// screen keeps its own state and submit logic.

import { useState } from "react";
import { Icon } from "@/components/Icon";

export function AuthHeading({ title, children }) {
  return (
    <div className="mb-6">
      <h1 className="text-[24px] leading-8 font-semibold text-[color:var(--text)]">{title}</h1>
      {children && <p className="text-[14px] leading-5 text-[color:var(--text-2)] mt-2">{children}</p>}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-[14px] leading-5 font-semibold text-[color:var(--text)] mb-2">{label}</span>
      {children}
      {hint && <span className="block text-[12px] leading-4 text-muted mt-2">{hint}</span>}
    </label>
  );
}

export const INPUT_CLASS =
  "w-full h-11 px-3 text-[14px] leading-5 text-[color:var(--text)] bg-surface border border-input rounded " +
  "placeholder:text-placeholder outline-none focus:border-accent aria-[invalid=true]:border-error";

export function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`${INPUT_CLASS} ${className}`}
      style={{ transition: "border-color 120ms ease-out" }}
    />
  );
}

// Password input with a show/hide button. Pass `shown` + `onToggle` to share
// one toggle between a password and its confirmation; otherwise it keeps its own.
export function PasswordInput({ shown, onToggle, ...props }) {
  const [ownShown, setOwnShown] = useState(false);
  const isShown = shown ?? ownShown;
  const toggle = onToggle ?? (() => setOwnShown((v) => !v));
  return (
    <div className="relative">
      <Input {...props} type={isShown ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={toggle}
        aria-label={isShown ? "Hide password" : "Show password"}
        aria-pressed={isShown}
        className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-muted hover:text-[color:var(--text)]"
        style={{ transition: "color 120ms ease-out" }}
      >
        <Icon name={isShown ? "eye-off" : "eye"} size={16} />
      </button>
    </div>
  );
}

export function FieldError({ children }) {
  return <p className="mt-2 text-[14px] leading-5 text-error">{children}</p>;
}

// Checkbox row: the whole row is the label, at least 44px tall.
export function Check({ checked, onChange, children, hint }) {
  return (
    <label className="flex items-start gap-3 min-h-11 py-2 cursor-pointer">
      <span className="h-5 flex items-center shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 cursor-pointer"
          style={{ accentColor: "var(--accent)" }}
        />
      </span>
      <span className="text-[14px] leading-5 text-[color:var(--text)]">
        {children}
        {hint && <span className="block text-[12px] leading-4 text-muted mt-1">{hint}</span>}
      </span>
    </label>
  );
}

// A form-level status line. No box: an icon in the status colour beside text
// that says the same thing.
export function StatusLine({ tone = "error", children, className = "" }) {
  const map = {
    error: { cls: "text-error", icon: "alert-triangle" },
    success: { cls: "text-success", icon: "check-circle" },
  };
  const t = map[tone] || map.error;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 text-[14px] leading-5 ${t.cls} ${className}`}
    >
      <span className="h-5 flex items-center shrink-0">
        <Icon name={t.icon} size={16} />
      </span>
      <span>{children}</span>
    </div>
  );
}

// Plain informational paragraph (sent confirmations, "already managed", ...).
export function Notice({ children }) {
  return <div className="text-[14px] leading-5 text-[color:var(--text)]">{children}</div>;
}

// Small centred footer line under a form ("Don't have an account? Sign up").
export function AuthFootnote({ children }) {
  return <div className="text-[14px] leading-5 text-[color:var(--text-2)] mt-8 text-center">{children}</div>;
}

export const LINK_CLASS = "font-semibold text-accent hover:text-accent-hover";
