"use client";

import { Icon } from "@/components/Icon";
import { PASSWORD_RULES } from "@/lib/password";

/**
 * Live password-requirement checklist shared by every place that lets a user
 * set a password (signup, /reset-password, /account). Each rule turns green
 * with a check the moment the typed password satisfies it. Backed by the single
 * source of truth in `lib/password.js`.
 *
 * `show` lets the caller gate visibility (e.g. only after a blur or first
 * keystroke); when false the component renders nothing.
 */
export function PasswordChecklist({ password = "", show = true, className = "mt-2.5 space-y-1.5" }) {
  if (!show) return null;
  return (
    <ul className={className}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.id}
            className="flex items-center gap-1.5 text-[12.5px] leading-none transition-colors"
            style={{ color: ok ? "#16A34A" : "#94A3B8" }}
          >
            <Icon name={ok ? "check" : "x"} size={13} strokeWidth={2.25} />
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
