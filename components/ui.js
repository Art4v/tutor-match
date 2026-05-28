"use client";
import { useState } from "react";
import { Icon } from "./Icon";

export function Avatar({ tutor, size = 64, ring = false }) {
  const img = tutor.avatarImg;
  return (
    <div
      className="relative flex items-center justify-center font-medium select-none overflow-hidden"
      style={{
        width: size,
        height: size,
        background: tutor.avatarBg,
        color: "#0F172A",
        borderRadius: "50%",
        fontSize: size * 0.34,
        letterSpacing: "-0.02em",
        boxShadow: ring ? "0 0 0 4px #fff" : "none",
        backgroundImage: img ? `url(${img})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!img && tutor.initial}
    </div>
  );
}

export function VerifiedTick({ size = 14 }) {
  return (
    <span
      className="inline-flex items-center justify-center align-middle"
      style={{ width: size, height: size, borderRadius: "50%", background: "#10B981", color: "#fff" }}
      title="Verified"
    >
      <Icon name="check" size={size * 0.7} strokeWidth={3} />
    </span>
  );
}

export function Chip({ children, tone = "grey", icon, onClick, active, onRemove, disabled }) {
  const tones = {
    grey: { bg: active ? "var(--accent)" : "#F3F4F6", color: active ? "#fff" : "#374151", border: active ? "var(--accent)" : "transparent" },
    line: { bg: "#fff", color: "#374151", border: "#E5E7EB" },
    cream: { bg: "#FAFAFA", color: "#475569", border: "#E5E7EB" },
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
      onClick={clickable ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12.5px] font-medium"
      style={{
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: 999,
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
            color: tone === "accent" || (accentHover && hover) ? "var(--accent)" : "#64748B",
          }}
        >
          <Icon name="x" size={10} strokeWidth={2.5} />
        </span>
      )}
    </Tag>
  );
}

export function Button({ children, variant = "primary", size = "md", icon, iconRight, onClick, full, type, disabled }) {
  const variants = {
    primary: { bg: "var(--accent)", color: "#fff", border: "var(--accent)", hoverBg: "var(--accent-hover)", hoverBorder: "var(--accent-hover)", hoverColor: "#fff" },
    outline: { bg: "#fff", color: "#1F2937", border: "#D1D5DB", hoverBg: "#fff", hoverBorder: "var(--accent)", hoverColor: "var(--accent)" },
    ghost:   { bg: "transparent", color: "#1F2937", border: "transparent", hoverBg: "var(--accent-softer)", hoverBorder: "transparent", hoverColor: "var(--accent)" },
    soft:    { bg: "var(--accent-softer)", color: "var(--accent)", border: "var(--accent-line)", hoverBg: "var(--accent-soft)", hoverBorder: "var(--accent-line)", hoverColor: "var(--accent)" },
    dark:    { bg: "#1F2937", color: "#fff", border: "#1F2937", hoverBg: "#111827", hoverBorder: "#111827", hoverColor: "#fff" },
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
        borderRadius: s.r,
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
