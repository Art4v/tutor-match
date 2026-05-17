"use client";
import { useState } from "react";
import { Icon } from "./Icon";

export function Avatar({ tutor, size = 64, ring = false }) {
  return (
    <div
      className="relative flex items-center justify-center font-medium select-none"
      style={{
        width: size,
        height: size,
        background: tutor.avatarBg,
        color: "#0F172A",
        borderRadius: "50%",
        fontSize: size * 0.34,
        letterSpacing: "-0.02em",
        boxShadow: ring ? "0 0 0 4px #fff" : "none",
      }}
    >
      {tutor.initial}
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

export function OnlineDot({ size = 8 }) {
  return (
    <span
      className="inline-block align-middle"
      style={{ width: size, height: size, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 0 2px #fff" }}
      title="Online now"
    />
  );
}

export function Chip({ children, tone = "grey", icon, onClick, active, onRemove, disabled }) {
  const tones = {
    grey: { bg: active ? "#1F2937" : "#F3F4F6", color: active ? "#fff" : "#374151", border: active ? "#1F2937" : "transparent" },
    line: { bg: "#fff", color: "#374151", border: "#E5E7EB" },
    cream: { bg: "#FAFAFA", color: "#475569", border: "#E5E7EB" },
  };
  const t = tones[tone];
  const clickable = !!onClick && !disabled;
  const Tag = clickable ? "button" : "span";
  return (
    <Tag
      onClick={clickable ? onClick : undefined}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12.5px] font-medium transition-colors"
      style={{
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        lineHeight: 1.2,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : clickable ? "pointer" : undefined,
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
          className="inline-flex items-center justify-center -mr-1 ml-0.5 text-slate-500 hover:text-slate-900"
          style={{ width: 16, height: 16, borderRadius: 999, cursor: "pointer" }}
        >
          <Icon name="x" size={10} strokeWidth={2.5} />
        </span>
      )}
    </Tag>
  );
}

export function Button({ children, variant = "primary", size = "md", icon, iconRight, onClick, full, type, disabled }) {
  const variants = {
    primary: { bg: "#1F2937", color: "#fff", border: "#1F2937", hover: "#111827" },
    outline: { bg: "#fff", color: "#1F2937", border: "#D1D5DB", hover: "#F9FAFB" },
    ghost:   { bg: "transparent", color: "#1F2937", border: "transparent", hover: "#F3F4F6" },
    soft:    { bg: "#F3F4F6", color: "#1F2937", border: "transparent", hover: "#E5E7EB" },
  };
  const sizes = {
    sm: { pad: "6px 12px", fs: 13, h: 32, r: 8 },
    md: { pad: "8px 16px", fs: 14, h: 38, r: 9 },
    lg: { pad: "11px 20px", fs: 15, h: 44, r: 10 },
  };
  const v = variants[variant];
  const s = sizes[size];
  const [hover, setHover] = useState(false);
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: hover && !disabled ? v.hover : v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        padding: s.pad,
        fontSize: s.fs,
        height: s.h,
        borderRadius: s.r,
        width: full ? "100%" : "auto",
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: "-0.005em",
      }}
    >
      {icon && <Icon name={icon} size={s.fs + 2} />}
      {children}
      {iconRight && <Icon name={iconRight} size={s.fs + 2} />}
    </button>
  );
}
