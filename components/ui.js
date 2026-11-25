"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

/** Initials from a display name: first letter of the first and last words. */
export function initialsFrom(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "Kanishka Bhasin" -> "Kanishka B.". Rows and cards use it; the profile page shows the full name. */
export function shortName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// Optional overrides, all defaulted so existing callers (TopNav chip, profile
// header, similar-tutor minis) render exactly as before:
//   radius     — the frame shape; the tutor card uses a rounded square
//   ringColor / ringWidth — the surround; the card uses a solid white border
// No image → a graduation cap on the tutor's avatarBg colour.
export function Avatar({
  tutor,
  size = 64,
  ring = false,
  radius = "50%",
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
        boxShadow: ring ? `0 0 0 ${ringWidth}px ${ringColor}` : "none",
        backgroundImage: img ? `url(${img})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!img && <Icon name="grad-cap" size={Math.round(size * 0.5)} />}
    </div>
  );
}

// Scalloped "verified badge" rosette (the familiar social-media seal shape) in
// deep teal, with the check knocked out in white. The hover tooltip is
// state-driven (not a native `title`) so it shows reliably even while the
// surrounding card runs its own hover animation — a moving element resets the
// native tooltip timer, so it would otherwise never appear on the card.
// Shared visual treatment for the small dark hover tooltips (the verified-tick
// explainer, the bookmark's "Save tutor"). Box metrics only — POSITIONING is up
// to the caller, since one sits absolutely above its trigger and the other is
// portalled to `position: fixed` to escape the card's overflow. Kept in one
// place because the two drifted apart once already (3px/7px/r6 vs 5px/9px/r7),
// which reads as a mistake when both can be on screen at the same time.
export const TOOLTIP_STYLE = {
  background: "var(--ink)",
  color: "var(--paper-card)",
  fontSize: 11.5,
  lineHeight: 1.25,
  padding: "5px 9px",
  borderRadius: 7,
  letterSpacing: "0.01em",
  boxShadow: "0 6px 16px -6px rgba(0,49,47,0.5)",
};

// Hover hints for the two badges. Like SaveTutorButton's tooltip, this one is
// portalled to <body> at position: fixed, because the tutor rows and the home
// marquee lanes clip overflow and a tooltip inside them would be cut off. It
// sits centred above the badge, wraps at 240px, is clamped inside the viewport,
// and hides on scroll (a fixed tooltip would otherwise stay put while the badge
// scrolls away). Mouse only: the badges sit inside row links, which can't hold
// another focusable element, and each icon already has an aria-label.
const VERIFIED_HINT = "This tutor has been reviewed by hand by MatchTutor.";
const MARKS_SEAL_HINT = "This tutor provided supporting documentation ensuring all their marks are accurate.";
const BADGE_TIP_MAX = 240;

function useBadgeTip(text) {
  const ref = useRef(null);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!coords) return;
    const hide = () => setCoords(null);
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [coords]);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const half = BADGE_TIP_MAX / 2 + 8;
    const centre = Math.min(Math.max(r.left + r.width / 2, half), window.innerWidth - half);
    setCoords({ top: r.top - 6, left: centre });
  };
  const hide = () => setCoords(null);

  const node =
    coords && typeof document !== "undefined"
      ? createPortal(
          <span
            role="tooltip"
            className="pointer-events-none font-medium"
            style={{
              ...TOOLTIP_STYLE,
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform: "translate(-50%, -100%)",
              width: "max-content",
              maxWidth: BADGE_TIP_MAX,
              textAlign: "center",
              zIndex: 1000,
            }}
          >
            {text}
          </span>,
          document.body
        )
      : null;

  return { ref, show, hide, node };
}

// The scalloped rosette and its check (24-unit box), shared by VerifiedTick and
// MarksSeal so the two badges are exactly the same shape and size; only their
// colours differ.
const ROSETTE_PATH =
  "M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z";
const CHECK_PATH = "M9.8 17.3l-4.2-4.1L7 11.8l2.8 2.7L17 7.4l1.4 1.4-8.6 8.5z";
const CHECK_TRANSFORM = "translate(12 12) scale(0.78) translate(-12 -12)";

// `label` renders the handwritten "verified by hand" script inline beside the
// tick (dark green, sized off the surrounding name text). Off by default so the
// compact call sites (message list, similar-tutor mini, the "Verified" pill)
// stay tick-only. `labelClassName` lets a call site hide the script responsively
// (a `display:none` label isn't a flex item, so the gap collapses with it).
export function VerifiedTick({ size = 16, label = false, labelClassName = "" }) {
  const tip = useBadgeTip(VERIFIED_HINT);
  return (
    <span
      ref={tip.ref}
      className="inline-flex items-center align-middle"
      style={{ gap: label ? "0.28em" : 0 }}
      onMouseEnter={tip.show}
      onMouseLeave={tip.hide}
    >
      <span
        className="inline-flex"
        // Nudged down so the icon's centre lands on the centre of the script
        // label's x-height (Caveat sits low in its line box, so a plain flex
        // centre reads high by about 1px at 16px). Measured, not guessed: keep
        // MarksSeal's nudge identical. In `em`, so it scales at every call site.
        style={{ lineHeight: 0, position: "relative", top: "0.12em" }}
      >
        {/* The original verified badge: a scalloped rosette in the brand teal
            with a white check. */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          role="img"
          aria-label="Verified by hand"
        >
          <path
            fill="var(--ink-graphite)"
            d={ROSETTE_PATH}
          />
          <path
            fill="#fff"
            transform={CHECK_TRANSFORM}
            d={CHECK_PATH}
          />
        </svg>
      </span>
      {label && (
        // Caveat script (the design's .font-hand accent), dark green, sized
        // relative to the name it sits beside. aria-hidden: the tick's svg
        // already announces "Verified by hand" to screen readers.
        <span
          className={`font-hand whitespace-nowrap ${labelClassName}`}
          style={{ color: "var(--ink-graphite)", fontSize: "1em", lineHeight: 1 }}
          aria-hidden="true"
        >
          verified by hand
        </span>
      )}
      {tip.node}
    </span>
  );
}

// The seal's colours: a red rosette with its check in a lighter red. They
// belong to this one component, the only deliberate non-teal element of the
// brand, so they stay out of the palette.
const SEAL_RED = "#902434";
const SEAL_CHECK = "#db7683";

// The "marks verified" seal (0083): VerifiedTick's rosette, same shape and
// size, in red. Shown BESIDE (and before) the tick for a tutor whose marks
// MatchTutor can fully support. Same API and same script-label format as
// VerifiedTick on purpose, so the two read as a pair at every call site.
// Hovering shows MARKS_SEAL_HINT.
export function MarksSeal({ size = 16, label = false, labelClassName = "" }) {
  const tip = useBadgeTip(MARKS_SEAL_HINT);
  return (
    <span
      ref={tip.ref}
      className="inline-flex items-center align-middle"
      style={{ gap: label ? "0.28em" : 0 }}
      onMouseEnter={tip.show}
      onMouseLeave={tip.hide}
    >
      {/* Same nudge as VerifiedTick, so the two icons and both labels share one centre line. */}
      <span className="inline-flex" style={{ lineHeight: 0, position: "relative", top: "0.12em" }}>
        <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Marks verified">
          <path fill={SEAL_RED} d={ROSETTE_PATH} />
          <path fill={SEAL_CHECK} transform={CHECK_TRANSFORM} d={CHECK_PATH} />
        </svg>
      </span>
      {label && (
        // aria-hidden: the svg already announces "Marks verified".
        <span
          className={`font-hand whitespace-nowrap ${labelClassName}`}
          style={{ color: SEAL_RED, fontSize: "1em", lineHeight: 1 }}
          aria-hidden="true"
        >
          marks verified
        </span>
      )}
      {tip.node}
    </span>
  );
}

export function Chip({ children, tone = "grey", size = "md", icon, onClick, active, onRemove, disabled, radius = 999 }) {
  const tones = {
    grey: { bg: active ? "var(--accent)" : "var(--desk)", color: active ? "#fff" : "var(--ink)", border: active ? "var(--accent)" : "transparent" },
    line: { bg: "var(--paper-card)", color: "var(--ink)", border: "var(--paper-line)" },
    cream: { bg: "var(--bg-soft)", color: "var(--ink-muted)", border: "var(--paper-line)" },
    accent: { bg: "var(--accent-softer)", color: "var(--accent)", border: "var(--accent-line)" },
    pill: { bg: "var(--pill)", color: "var(--pill-ink)", border: "var(--chip-line)" },
  };
  const sizes = {
    md: "gap-1.5 px-2.5 py-1 text-[12.5px]",
    sm: "gap-[5px] px-[9px] py-1 text-[12px]",
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
      className={`inline-flex items-center font-medium ${sizes[size] || sizes.md}`}
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

// Buttons are deliberately static on hover: no colour/border/ring shift and no
// iconRight nudge. The only pointer feedback is the press-scale below, which is
// click feedback rather than a hover animation.
export function Button({ children, variant = "primary", size = "md", icon, iconRight, onClick, full, type, disabled, radius, ariaLabel }) {
  const variants = {
    primary: { bg: "var(--accent)", color: "#fff", border: "var(--accent)" },
    outline: { bg: "var(--paper-card)", color: "var(--ink)", border: "var(--line-strong)" },
    ghost:   { bg: "transparent", color: "var(--ink)", border: "transparent" },
    soft:    { bg: "var(--accent-softer)", color: "var(--accent)", border: "var(--accent-line)" },
    dark:    { bg: "var(--ink)", color: "#fff", border: "var(--ink)" },
  };
  const sizes = {
    sm: { pad: "6px 12px", fs: 13, h: 32, r: 8 },
    md: { pad: "8px 16px", fs: 14, h: 38, r: 9 },
    lg: { pad: "11px 20px", fs: 15, h: 44, r: 10 },
    // Profile-page primary CTA (the sidebar "Message" button).
    xl: { pad: "13px 20px", fs: 15, h: 48, r: 11 },
  };
  const v = variants[variant] || variants.primary;
  const s = sizes[size];
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      onMouseLeave={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className="inline-flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        padding: s.pad,
        fontSize: s.fs,
        height: s.h,
        borderRadius: radius ?? s.r,
        width: full ? "100%" : "auto",
        cursor: disabled ? "not-allowed" : "pointer",
        letterSpacing: "-0.005em",
        transform: pressed && !disabled ? "scale(0.98)" : "scale(1)",
        transition: "transform 120ms ease-out",
      }}
    >
      {icon && <Icon name={icon} size={s.fs + 2} />}
      <span className="inline-flex items-center gap-1.5">
        {children}
      </span>
      {iconRight && (
        <span style={{ display: "inline-flex" }}>
          <Icon name={iconRight} size={s.fs + 2} />
        </span>
      )}
    </button>
  );
}
