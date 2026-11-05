"use client";

import { Icon } from "@/components/Icon";
import { PASSWORD_RULES } from "@/lib/password";

/**
 * Live password-requirement checklist shared by every place that lets a user
 * set a password (signup, /reset-password, /account). Each rule turns the success colour
 * with a check the moment the typed password satisfies it. Backed by the single
 * source of truth in `lib/password.js`.
 *
 * `show` lets the caller gate visibility (e.g. only after a blur or first
 * keystroke); when false the component renders nothing.
 */
export function PasswordChecklist({ password = "", show = true, className = "mt-2 space-y-1" }) {
  if (!show) return null;
  return (
    <ul className={className}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-2 text-[12px] leading-4 ${ok ? "text-success" : "text-muted"}`}
            style={{ transition: "color 120ms ease-out" }}
          >
            <Icon name={ok ? "check" : "x"} size={16} />
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
