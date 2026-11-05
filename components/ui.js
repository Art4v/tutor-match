"use client";
import { Icon } from "./Icon";

// Design primitives (DESIGN.md §6). Every value here is a token; prefer
// extending these over new inline styles.

/** Initials from a display name: first letter of the first and last words. */
export function initialsFrom(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Kanishka Bhasin" → "Kanishka B." (DESIGN.md copy rule: names in rows and cards). */
export function shortName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// People are circles, companies are squares (DESIGN.md §4). `radius` stays as
// an override for the few callers that pass one; `shape="square"` is the
// company form. No photo: initials on --surface-2 (no icon, no tutor-picked
// colour). `ring` draws a white surround where the photo overlaps a banner.
export function Avatar({
  tutor,
  size = 64,
  ring = false,
  shape = "circle",
  radius,
  ringColor = "var(--surface)",
  ringWidth = 4,
}) {
  const img = tutor?.avatarImg || null;
  const initials = tutor?.initial || tutor?.initials || initialsFrom(tutor?.name);
  const r = radius ?? (shape === "square" ? "var(--radius)" : "50%");
  return (
    <div
      className="relative flex shrink-0 items-center justify-center select-none overflow-hidden"
      style={{
        width: size,
        height: size,
        // Longhand (not the `background` shorthand): assigning the shorthand on a
        // re-render resets background-size back to `auto`, which React then doesn't
        // re-apply, so a switched avatar rendered hyperzoomed until remount.
        backgroundColor: "var(--surface-2)",
        color: "var(--text-2)",
        borderRadius: r,
        boxShadow: ring ? `0 0 0 ${ringWidth}px ${ringColor}` : "none",
        backgroundImage: img ? `url(${img})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        fontWeight: 600,
        fontSize: Math.max(12, Math.round(size * 0.36)),
        lineHeight: 1,
      }}
      aria-hidden={img ? undefined : "true"}
    >
      {!img && initials}
    </div>
  );
}

// Small dark tooltip box (the verified explainer, the bookmark's "Save tutor").
// Box metrics only; positioning is up to the caller. It floats, so it carries
// the one floating shadow.
export const TOOLTIP_STYLE = {
  background: "var(--text)",
  color: "var(--surface)",
  fontSize: 12,
  lineHeight: "16px",
  padding: "4px 8px",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-float)",
};

// The verified mark: an --accent check (DESIGN.md §6), with the word "Verified"
// where space allows. `label` turns the word on; `labelClassName` lets a call
// site hide it responsively.
export function VerifiedTick({ size = 16, label = false, labelClassName = "" }) {
  return (
    <span className="inline-flex items-center align-middle" style={{ gap: label ? 4 : 0, color: "var(--accent)" }}>
      <svg width={size} height={size} viewBox="0 0 16 16" role="img" aria-label="Verified" className="shrink-0">
        <path
          fill="currentColor"
          d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.6 5.7-4.2 4.8a.75.75 0 0 1-1.1 0L4.4 8.6a.75.75 0 1 1 1.1-1l1.4 1.4 3.6-4.2a.75.75 0 1 1 1.1 1Z"
        />
      </svg>
      {label && (
        <span className={`text-[12px] font-semibold leading-4 whitespace-nowrap ${labelClassName}`} aria-hidden="true">
          Verified
        </span>
      )}
    </span>
  );
}

// Chips are for removable filter values and status labels only (DESIGN.md: no
// pills). 4px radius, neutral, 12px text. `radius` is accepted and ignored.
export function Chip({ children, tone = "grey", size = "md", icon, onClick, active, onRemove, disabled }) {
  const tones = {
    grey: active
      ? "bg-accent text-white border-accent"
      : "bg-surface-2 text-[color:var(--text)] border-transparent",
    line: "bg-surface text-[color:var(--text)] border-rule",
    cream: "bg-surface-2 text-[color:var(--text-2)] border-rule",
    accent: "bg-surface text-accent border-rule",
    pill: "bg-surface-2 text-[color:var(--text-2)] border-transparent",
  };
  const clickable = !!onClick && !disabled;
  const Tag = clickable ? "button" : "span";
  return (
    <Tag
      // A bare <button> inside a <form> defaults to type="submit"; chips are
      // never submit controls.
      type={clickable ? "button" : undefined}
      onClick={clickable ? onClick : undefined}
      className={`inline-flex items-center gap-1 border rounded text-[12px] leading-4 font-semibold ${
        size === "sm" ? "px-2 py-1" : "px-2 py-1"
      } ${tones[tone] || tones.grey} ${clickable ? "cursor-pointer hover:border-input" : ""} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      style={{ transition: "border-color 120ms ease-out, background-color 120ms ease-out" }}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
      {onRemove && !disabled && (
        <span
          role="button"
          aria-label="Remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onMouseDown={(e) => e.preventDefault()}
          className="inline-flex items-center justify-center -my-1 -mr-2 ml-0 w-6 h-6 cursor-pointer text-[color:var(--text-2)] hover:text-[color:var(--text)]"
        >
          <Icon name="x" size={10} strokeWidth={2.5} />
        </span>
      )}
    </Tag>
  );
}

// Buttons (DESIGN.md §6): 44px tall, 4px radius, 14px at 600, sentence case.
// Hover/press change colour only. Variants: primary (accent fill), outline
// (secondary: white + input border), ghost (text button in accent), danger.
// The old `soft` and `dark` variants map onto secondary and primary so existing
// call sites keep working. `size` only changes horizontal padding; `radius` is
// accepted and ignored.
export function Button({ children, variant = "primary", size = "md", icon, iconRight, onClick, full, type, disabled, ariaLabel }) {
  const variants = {
    primary: "bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover",
    dark: "bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover",
    outline: "bg-surface text-[color:var(--text)] border-input hover:bg-surface-2",
    soft: "bg-surface text-[color:var(--text)] border-input hover:bg-surface-2",
    ghost: "bg-transparent text-accent border-transparent hover:bg-surface-2",
    danger: "bg-surface text-error border-input hover:bg-surface-2",
  };
  const pad = { sm: "px-3", md: "px-4", lg: "px-5", xl: "px-6" };
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-2 h-11 border rounded text-[14px] leading-5 font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
        variants[variant] || variants.primary
      } ${pad[size] || pad.md} ${full ? "w-full" : ""}`}
      style={{ transition: "background-color 120ms ease-out, border-color 120ms ease-out" }}
    >
      {icon && <Icon name={icon} size={16} />}
      {children != null && children !== false && <span className="inline-flex items-center gap-1">{children}</span>}
      {iconRight && <Icon name={iconRight} size={16} />}
    </button>
  );
}
