"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Icon } from "./Icon";
import { TOOLTIP_STYLE } from "./ui";
import { useSavedTutors } from "./SavedTutorsProvider";

// Bookmark control shown on every TutorCard and the tutor profile banner. For a
// logged-in student it toggles the save; for a logged-out
// visitor it's a decoy that routes to /signup, with a hover tooltip explaining
// it's a student feature. For a signed-in tutor it renders nothing — saving is a
// student-only feature, so the control is hidden entirely.
//
// The tooltip renders in a portal (position: fixed) so it escapes the card's
// `overflow: hidden` — otherwise it gets clipped and the text squishes into a
// narrow column inside the card. Its right edge anchors to the button so it
// grows leftward and stays on screen.
//
// `variant` only tunes size/offset: "card" (sits in the tutor card's corner) vs
// "banner" (larger, the 140px profile banner corner).
//
// `className` overrides the placement: pass Tailwind positioning classes (e.g.
// "top-2 right-[96px] md:top-3 md:right-[218px]") and the variant's fixed
// top/right offset is dropped so they take effect. The row card needs this
// because its bookmark anchors to the stat rail's divider, which sits at a
// different offset per breakpoint — a responsive position an inline style
// can't express.
// `tabIndex` is passed straight to the interactive element. The marquee's
// duplicated cards (components/FeaturedTutors.jsx) set -1 so the copy stays
// mouse-clickable but never lands in the tab order twice.
export function SaveTutorButton({ tutorId, variant = "card", disabled = false, className = "", tabIndex = 0 }) {
  const { isStudent, isLoggedIn, ready, isSaved, toggleSave } = useSavedTutors();
  const [hover, setHover] = useState(false);
  const [coords, setCoords] = useState(null);
  const wrapRef = useRef(null);

  const size = variant === "banner" ? 40 : 38;
  const iconSize = variant === "banner" ? 18 : 16;
  const offset = variant === "banner" ? 16 : 14;

  const saved = isStudent && isSaved(tutorId);

  // Shared circular translucent pill — reads on both banner images and solid
  // banner colours.
  const pill = {
    width: size,
    height: size,
    borderRadius: 999,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    boxShadow: "0 2px 8px rgba(0,30,30,0.10)",
    color: saved ? "var(--accent)" : "var(--ink-graphite)",
    transition: "color 160ms ease-out, background 160ms ease-out",
  };

  const tooltipText = isStudent
    ? disabled
      ? "Unblock to save this tutor"
      : saved
        ? "Saved"
        : "Save tutor"
    : "Sign up now to save this tutor!";

  // Measure the button relative to the viewport so the fixed-position tooltip
  // can anchor to it from outside the clipping card.
  const showTip = () => {
    const el = wrapRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setCoords({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setHover(true);
  };
  const hideTip = () => setHover(false);

  const tip =
    hover && coords && typeof document !== "undefined"
      ? createPortal(
          // Plain span, not a motion element: the tooltip is meant to appear
          // instantly on hover, with no fade or slide in.
          <span
            role="tooltip"
            className="pointer-events-none font-medium"
            style={{
              ...TOOLTIP_STYLE,
              position: "fixed",
              top: coords.top,
              right: coords.right,
              whiteSpace: "nowrap",
              zIndex: 1000,
            }}
          >
            {tooltipText}
          </span>,
          document.body
        )
      : null;

  // When the caller supplies positioning classes, leave top/right to them.
  const wrapStyle = {
    position: "absolute",
    ...(className ? null : { top: offset, right: offset }),
    zIndex: 10,
    lineHeight: 0,
  };
  const wrapClass = `inline-flex ${className}`;

  // Until the session/role resolves, show a neutral, non-interactive bookmark so
  // a logged-in student never briefly sees (or clicks) the signup decoy.
  if (!ready) {
    return (
      <span style={wrapStyle} className={wrapClass}>
        <span className="inline-flex items-center justify-center" style={{ ...pill, boxShadow: "none", background: "rgba(255,255,255,0.7)" }}>
          <Icon name="bookmark" size={iconSize} />
        </span>
      </span>
    );
  }

  // Signed-in non-student (a tutor): saving is a student-only feature, so hide
  // the control entirely rather than showing the signup decoy.
  if (isLoggedIn && !isStudent) {
    return null;
  }

  if (isStudent) {
    return (
      <span
        ref={wrapRef}
        style={wrapStyle}
        className={wrapClass}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
      >
        <button
          type="button"
          disabled={disabled}
          tabIndex={tabIndex}
          aria-pressed={saved}
          aria-label={disabled ? "Unblock to save this tutor" : saved ? "Remove from saved tutors" : "Save tutor"}
          onClick={(e) => {
            // The card variant overlays a full-card <Link>; keep the click from
            // navigating.
            e.preventDefault();
            e.stopPropagation();
            if (disabled) return;
            toggleSave(tutorId);
          }}
          className="inline-flex items-center justify-center disabled:cursor-not-allowed"
          style={{ ...pill, opacity: disabled ? 0.5 : 1 }}
        >
          <Icon name={saved ? "bookmark-fill" : "bookmark"} size={iconSize} />
        </button>
        {tip}
      </span>
    );
  }

  // Non-student / logged-out: decoy → signup. Rendered as a sibling of the card
  // <Link> (never nested), so a plain <Link> here is valid.
  return (
    <span
      ref={wrapRef}
      style={wrapStyle}
      className={wrapClass}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
    >
      <Link
        href="/signup"
        tabIndex={tabIndex}
        aria-label="Sign up to save tutors"
        className="inline-flex items-center justify-center"
        style={pill}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon name="bookmark" size={iconSize} />
      </Link>
      {tip}
    </span>
  );
}
