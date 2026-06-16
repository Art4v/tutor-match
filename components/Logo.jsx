/* MatchTutor — "Book + sprout" brand mark.
   An open book (two pages) with a seedling rising from the gutter:
   "learning makes you grow". Pure geometry so it recolors + scales cleanly.
   Ported from the Claude Design handoff (Concept C) and recolored to the
   live site tokens. Colors default to CSS variables so they stay token-local
   (the same inline-color philosophy the rest of the app uses). */

// A single pointed leaf. Tip is UP, base at local origin (0,0).
function Leaf({ fill, x = 0, y = 0, rot = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
      <path d="M0 0 C -15 -8 -16.5 -29 0 -46 C 16.5 -29 15 -8 0 0 Z" fill={fill} />
    </g>
  );
}

export function BookSproutMark({
  size = 28,
  accent = "var(--accent)",
  sage = "var(--sage)",
  seam = "var(--paper)",
  className,
  style,
}) {
  // viewBox is 130 x 120 — keep the aspect ratio when sizing.
  const height = size * (120 / 130);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 130 120"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {/* seedling */}
      <g transform="translate(5 -6)">
        <path
          d="M60 84 C 60 70 59 58 60 46"
          fill="none"
          stroke={accent}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <Leaf fill={sage} x={60} y={56} rot={36} scale={0.7} />
        <Leaf fill={accent} x={60} y={50} rot={-36} scale={0.7} />
      </g>
      {/* book — two open pages */}
      <g>
        <path d="M65 92 C 50 82 34 80 18 83 L18 104 C 34 101 50 103 65 112 Z" fill={accent} />
        <path d="M65 92 C 80 82 96 80 112 83 L112 104 C 96 101 80 103 65 112 Z" fill={sage} />
        <path d="M65 92 L65 112" stroke={seam} strokeWidth="2.4" />
      </g>
    </svg>
  );
}
