"use client";
import { useState } from "react";
import { Icon } from "./Icon";

// Optional overrides, all defaulted so existing callers (TopNav chip, profile
// header, similar-tutor minis) render exactly as before:
//   radius     — the frame shape; the tutor card uses a rounded square
//   fontScale  — placeholder initial size, as a fraction of `size`
//   weight     — placeholder initial weight; the tutor card wants a light 300
//   ringColor / ringWidth — the surround; the card uses a solid white border
export function Avatar({
  tutor,
  size = 64,
  ring = false,
  radius = "50%",
  fontScale = 0.34,
  weight = 500,
  ringColor = "var(--paper-card)",
  ringWidth = 4,
}) {
  const img = tutor.avatarImg;
  return (
    <div
      className="relative flex items-center justify-center select-none overflow-hidden"
      style={{
        width: size,
        height: size,
        // Longhand (not the `background` shorthand): assigning the shorthand on a
        // re-render resets background-size back to `auto`, which React then doesn't
        // re-apply — so a switched avatar rendered hyperzoomed until remount.
        backgroundColor: tutor.avatarBg,
        color: "var(--ink-graphite)",
        borderRadius: radius,
        fontSize: size * fontScale,
        fontWeight: weight,
        letterSpacing: "-0.02em",
        boxShadow: ring ? `0 0 0 ${ringWidth}px ${ringColor}` : "none",
        backgroundImage: img ? `url(${img})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!img && tutor.initial}
    </div>
  );
}

// Scalloped "verified badge" rosette (the familiar social-media seal shape) in
// deep teal, with the check knocked out in white. The hover tooltip is
// state-driven (not a native `title`) so it shows reliably even while the
// surrounding card runs its own hover animation — a moving element resets the
// native tooltip timer, so it would otherwise never appear on the card.
export function VerifiedTick({ size = 14 }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex align-middle"
      // Nudged down a touch: flex `items-center` centres the tick on the name's
      // LINE box, whose ascender/descender padding sits above the glyphs, so an
      // untouched tick reads high. The offset is in `em`, so it inherits the
      // name's font size and stays proportional at every call site.
      style={{ lineHeight: 0, top: "0.06em" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        role="img"
        aria-label="Verified by hand"
      >
        <path
          fill="var(--ink-graphite)"
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
        />
        <path
          fill="#fff"
          transform="translate(12 12) scale(0.78) translate(-12 -12)"
          d="M9.8 17.3l-4.2-4.1L7 11.8l2.8 2.7L17 7.4l1.4 1.4-8.6 8.5z"
        />
      </svg>
      {show && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 whitespace-nowrap font-medium"
          style={{
            background: "var(--ink)",
            color: "var(--paper-card)",
            fontSize: 11,
            lineHeight: 1.2,
            padding: "3px 7px",
            borderRadius: 6,
            letterSpacing: "0.01em",
            zIndex: 50,
            boxShadow: "0 4px 12px -4px rgba(0,49,47,0.45)",
          }}
        >
          Verified by hand
        </span>
      )}
    </span>
  );
}

export function Chip({ children, tone = "grey", icon, onClick, active, onRemove, disabled, radius = 999 }) {
  const tones = {
    grey: { bg: active ? "var(--accent)" : "var(--desk)", color: active ? "#fff" : "var(--ink)", border: active ? "var(--accent)" : "transparent" },
    line: { bg: "var(--paper-card)", color: "var(--ink)", border: "var(--paper-line)" },
    cream: { bg: "var(--bg-soft)", color: "var(--ink-muted)", border: "var(--paper-line)" },
    accent: { bg: "var(--accent-softer)", color: "var(--accent)", border: "var(--accent-line)" },
  };
  const t = tones[tone];
  const clickable = !!onClick && !disabled;
  const Tag = clickable ? "button" : "span";
  const [hover, setHover] = useState(false);

  // Subtle accent hover on neutral line/cream chips that are clickable
  const accentHover = clickable && (tone === "line" || tone === "cream");
  const bg = accentHover && hover ? "var(--accent-softer)" : t.bg;
  const color = accentHover && hover ? "var(--accent)" : t.color;
  const border = accentHover && hover ? "var(--accent-line)" : t.border;

  return (
    <Tag
      // A bare <button> inside a <form> defaults to type="submit" — chips are
      // never submit controls.
      type={clickable ? "button" : undefined}
      onClick={clickable ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12.5px] font-medium"
      style={{
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: radius,
        lineHeight: 1.2,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : clickable ? "pointer" : undefined,
        transition: "background-color 180ms ease-out, color 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out",
      }}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
      {onRemove && !disabled && (
        <span
          role="button"
          aria-label="Remove"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onMouseDown={(e) => e.preventDefault()}
          className="inline-flex items-center justify-center -mr-1 ml-0.5 hover:text-slate-900"
          style={{
            width: 16,
            height: 16,
            borderRadius: 999,
            cursor: "pointer",
            color: tone === "accent" || (accentHover && hover) ? "var(--accent)" : "var(--ink-muted)",
          }}
        >
          <Icon name="x" size={10} strokeWidth={2.5} />
        </span>
      )}
    </Tag>
  );
}

export function Button({ children, variant = "primary", size = "md", icon, iconRight, onClick, full, type, disabled, radius, ariaLabel }) {
  const variants = {
    primary: { bg: "var(--accent)", color: "#fff", border: "var(--accent)", hoverBg: "var(--accent-hover)", hoverBorder: "var(--accent-hover)", hoverColor: "#fff" },
    outline: { bg: "var(--paper-card)", color: "var(--ink)", border: "var(--line-strong)", hoverBg: "var(--paper-card)", hoverBorder: "var(--accent)", hoverColor: "var(--accent)" },
    ghost:   { bg: "transparent", color: "var(--ink)", border: "transparent", hoverBg: "var(--accent-softer)", hoverBorder: "transparent", hoverColor: "var(--accent)" },
    soft:    { bg: "var(--accent-softer)", color: "var(--accent)", border: "var(--accent-line)", hoverBg: "var(--accent-soft)", hoverBorder: "var(--accent-line)", hoverColor: "var(--accent)" },
    dark:    { bg: "var(--ink)", color: "#fff", border: "var(--ink)", hoverBg: "var(--ink-graphite-deep)", hoverBorder: "var(--ink-graphite-deep)", hoverColor: "#fff" },
  };
  const sizes = {
    sm: { pad: "6px 12px", fs: 13, h: 32, r: 8 },
    md: { pad: "8px 16px", fs: 14, h: 38, r: 9 },
    lg: { pad: "11px 20px", fs: 15, h: 44, r: 10 },
  };
  const v = variants[variant] || variants.primary;
  const s = sizes[size];
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isHover = hover && !disabled;

  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: isHover ? v.hoverBg : v.bg,
        color: isHover ? v.hoverColor : v.color,
        border: `1px solid ${isHover ? v.hoverBorder : v.border}`,
        padding: s.pad,
        fontSize: s.fs,
        height: s.h,
        borderRadius: radius ?? s.r,
        width: full ? "100%" : "auto",
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: "-0.005em",
        transform: pressed && !disabled ? "scale(0.98)" : "scale(1)",
        boxShadow: isHover && (variant === "primary" || variant === "dark") ? "0 0 0 4px var(--accent-ring)" : "none",
        transition: "background-color 180ms ease-out, color 180ms ease-out, border-color 180ms ease-out, box-shadow 180ms ease-out, transform 120ms ease-out",
      }}
    >
      {icon && <Icon name={icon} size={s.fs + 2} />}
      <span className="inline-flex items-center gap-1.5">
        {children}
      </span>
      {iconRight && (
        <span
          style={{
            display: "inline-flex",
            transition: "transform 220ms cubic-bezier(0.22,1,0.36,1)",
            transform: isHover ? "translateX(3px)" : "translateX(0)",
          }}
        >
          <Icon name={iconRight} size={s.fs + 2} />
        </span>
      )}
    </button>
  );
}
