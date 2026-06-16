/* MatchTutor — logo mark system
   Building blocks: GradCap + speech bubbles, composed into mark concepts.
   All marks are pure geometry (diamond + trapezoid + arcs) so they stay
   crisp at any size and recolor cleanly. Exported to window for the canvas. */

// ---- Graduation cap -------------------------------------------------------
// Drawn around a 120x120 canonical box, board centered ~ (60,52).
// `fill` colors the cap; `tassel` optionally overrides the tassel color.
function GradCap({ fill = '#1d1d22', tassel, board, scale = 1, x = 0, y = 0 }) {
  const t = tassel || fill;
  const b = board || fill;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {/* cap base / headband — sits under the board (top edge hidden) */}
      <path d="M41 58 L41 70 Q41 82 60 82 Q79 82 79 70 L79 58 Z" fill={fill} />
      {/* mortarboard (flat diamond) */}
      <path d="M60 36 L99 53 L60 70 L21 53 Z" fill={b} />
      {/* button */}
      <circle cx="60" cy="53" r="4.6" fill={t} />
      {/* tassel: cord drapes from button to right edge, then hangs with a weight */}
      <path d="M60 53 L95 53 L95 72" stroke={t} strokeWidth="3.6" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
      <rect x="91.4" y="71" width="7.2" height="11" rx="3" fill={t} />
    </g>
  );
}

// ---- Round chat bubble (reference left) -----------------------------------
function BubbleRound({ fill, stroke, sw = 0, children }) {
  return (
    <g>
      <path
        d="M60 14
           C32 14 12 32 12 56
           C12 72 21 86 36 94
           C35 104 30 110 24 116
           C38 114 49 108 57 100
           C58 100 59 100 60 100
           C88 100 108 80 108 56
           C108 32 88 14 60 14 Z"
        fill={fill || 'none'} stroke={stroke || 'none'} strokeWidth={sw} strokeLinejoin="round" />
      {children}
    </g>
  );
}

// ---- Rounded-rect bubble with downward tail (reference right) -------------
function BubbleRect({ fill, stroke, sw = 0, children }) {
  return (
    <g>
      <path
        d="M28 16 H92 Q108 16 108 32 V72 Q108 88 92 88 H72
           L60 104 L48 88 H28 Q12 88 12 72 V32 Q12 16 28 16 Z"
        fill={fill || 'none'} stroke={stroke || 'none'} strokeWidth={sw} strokeLinejoin="round" />
      {children}
    </g>
  );
}

// =====================  MARK CONCEPTS  =====================================
// Each returns an <svg>. Props: { size, pal } where pal = {ink, primary, accent, onPrimary, bg}

// A — Cap inside a solid round chat bubble (filled, like ref left)
function MarkBubbleCap({ size = 132, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size} viewBox="0 0 120 130" fill="none">
      <BubbleRound fill={p.primary}>
        <g>
          <GradCap fill={p.onPrimary} board={p.onPrimary} tassel={p.accent} scale={0.92} x={6} y={2} />
        </g>
      </BubbleRound>
    </svg>
  );
}

// B — Cap inside an outlined rounded bubble with tail node (like ref right)
function MarkRectCap({ size = 132, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size} viewBox="0 0 120 130" fill="none">
      <BubbleRect stroke={p.primary} sw={6}>
        <GradCap fill={p.primary} board={p.primary} tassel={p.accent} scale={0.78} x={13} y={6} />
      </BubbleRect>
    </svg>
  );
}

// C — Solid bubble + cap, cap colored two-tone
function MarkBubbleDuo({ size = 132, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size} viewBox="0 0 120 130" fill="none">
      <BubbleRound fill={p.accent}>
        <GradCap fill={p.onPrimary} board={p.onPrimary} tassel={p.primary} scale={0.92} x={6} y={2} />
      </BubbleRound>
    </svg>
  );
}

// D — Outline (line-art) cap inside outline round bubble — light/minimal
function MarkLine({ size = 132, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size} viewBox="0 0 120 130" fill="none">
      <BubbleRound stroke={p.primary} sw={6}>
        <GradCap fill={p.primary} board={p.primary} tassel={p.accent} scale={0.78} x={13} y={2} />
      </BubbleRound>
    </svg>
  );
}

// E — Two overlapping chat bubbles (a "match" / conversation) with cap
function MarkTwoBubbles({ size = 150, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size * 0.92} viewBox="0 0 150 138" fill="none">
      {/* back bubble (accent) */}
      <path d="M96 30 C120 30 138 45 138 66 C138 87 120 102 96 102
               C92 102 89 101 86 100 C92 108 100 110 106 111
               C97 115 86 112 79 106 C66 102 56 90 56 78 C56 56 73 30 96 30 Z"
            fill={p.accent} opacity="0.9" />
      {/* front bubble (primary) with cap */}
      <path d="M52 14 C26 14 8 31 8 54 C8 70 17 83 31 91
               C30 100 25 106 19 111 C32 109 43 104 51 97
               C52 97 53 97 54 97 C80 97 98 80 98 56 C98 32 78 14 52 14 Z"
            fill={p.primary} />
      <GradCap fill={p.onPrimary} board={p.onPrimary} tassel={p.accent} scale={0.74} x={9} y={-4} />
    </svg>
  );
}

// F — MT monogram with a cap perched on top
function MarkMonogram({ size = 168, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size * 0.86} viewBox="0 0 180 156" fill="none">
      <g transform="rotate(-9 60 34)">
        <GradCap fill={p.primary} board={p.primary} tassel={p.accent} scale={0.66} x={4} y={-16} />
      </g>
      <text x="90" y="138" textAnchor="middle"
            fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="800"
            fontSize="92" letterSpacing="-3" fill={p.ink}>M<tspan fill={p.primary}>T</tspan></text>
    </svg>
  );
}

// ---- Wordmark lockup (horizontal: icon + MatchTutor) ----------------------
function Lockup({ pal, height = 64, reverse = false, mark = 'bubble' }) {
  const p = pal;
  const Icon = mark === 'rect' ? MarkRectCap : MarkBubbleCap;
  const matchColor = reverse ? '#fff' : p.primary;
  const tutorColor = reverse ? 'rgba(255,255,255,0.92)' : p.ink;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: height * 0.22 }}>
      <Icon pal={p} size={height * 1.18} />
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800,
                    fontSize: height * 0.62, letterSpacing: '-0.03em', lineHeight: 1 }}>
        <span style={{ color: matchColor }}>Match</span><span style={{ color: tutorColor }}>Tutor</span>
      </div>
    </div>
  );
}

// ---- App icon (rounded-square tile) ---------------------------------------
function AppIcon({ pal, size = 96, radius = 0.235, bg, cap }) {
  const p = pal;
  const r = size * radius;
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: bg || p.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size * 0.66} height={size * 0.66} viewBox="20 30 80 60" fill="none">
        <GradCap fill={cap || p.onPrimary} board={cap || p.onPrimary} tassel={p.accent} />
      </svg>
    </div>
  );
}

Object.assign(window, {
  GradCap, BubbleRound, BubbleRect,
  MarkBubbleCap, MarkRectCap, MarkBubbleDuo,
  MarkLine, MarkTwoBubbles, MarkMonogram,
  Lockup, AppIcon,
});
