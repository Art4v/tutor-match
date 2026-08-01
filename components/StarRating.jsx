"use client";
import { useId, useState } from "react";
import { Icon } from "./Icon";

// Five-star rating, in two modes, because the summary, each review row and the
// write-a-review form all need stars and they must look identical.
//
//   <StarRating value={4.4} />              read-only, supports fractions
//   <StarRating value={n} onChange={fn} />  input, whole stars only
//
// Read-only mode draws the empty row, then overlays a filled row clipped to a
// percentage width — that's what allows a genuine 4.4 (an 80%-filled 5th star)
// rather than rounding to the nearest whole star. The overlay's inner row is
// `width: max-content` + `shrink-0` so the stars keep full size while the
// clipping wrapper narrows around them.
//
// Input mode is built on real <input type="radio"> elements (visually hidden
// behind each star) rather than buttons, so arrow-key navigation, grouping and
// focus behaviour are the browser's rather than something re-implemented here.

const FILLED = "var(--accent)";
const EMPTY = "var(--accent-line)";

function StarRow({ count = 5, size, gap, color }) {
  return (
    <span className="inline-flex items-center shrink-0" style={{ gap, color, width: "max-content" }}>
      {Array.from({ length: count }, (_, i) => (
        <Icon key={i} name="star" size={size} className="shrink-0" />
      ))}
    </span>
  );
}

export function StarRating({
  value = 0,
  onChange,
  size = 16,
  gap = 2,
  label,          // overrides the generated aria-label
  className = "",
}) {
  const name = useId();
  const [hover, setHover] = useState(0);

  // ---- Input mode ----------------------------------------------------------
  if (onChange) {
    // Hovering previews that many stars without committing; leaving restores the
    // real value.
    const shown = hover || value;
    return (
      <span
        role="radiogroup"
        aria-label={label || "Your rating, out of 5 stars"}
        className={`inline-flex items-center ${className}`}
        style={{ gap }}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="inline-flex cursor-pointer"
            style={{ lineHeight: 0, color: n <= shown ? FILLED : EMPTY, transition: "color 120ms ease-out" }}
            onMouseEnter={() => setHover(n)}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <Icon name="star" size={size} />
          </label>
        ))}
      </span>
    );
  }

  // ---- Read-only mode -----------------------------------------------------
  const clamped = Math.max(0, Math.min(5, Number(value) || 0));
  const pct = (clamped / 5) * 100;

  return (
    <span
      role="img"
      aria-label={label || `${clamped} out of 5 stars`}
      className={`relative inline-flex ${className}`}
      style={{ lineHeight: 0 }}
    >
      <StarRow size={size} gap={gap} color={EMPTY} />
      {pct > 0 && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${pct}%`, lineHeight: 0 }}
        >
          <StarRow size={size} gap={gap} color={FILLED} />
        </span>
      )}
    </span>
  );
}
