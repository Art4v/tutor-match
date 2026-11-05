/* MatchTutor — "Book + sprout" brand mark.
   An open book (two pages) with a seedling rising from the gutter:
   "learning makes you grow". Pure geometry so it recolors + scales cleanly.
   Ported from the Claude Design handoff (Concept C) and recolored to the
   live site tokens. Colors default to CSS variables so they stay token-local
   (the same inline-color philosophy the rest of the app uses). */

/* The split-colour "MatchTutor" wordmark, drawn as SVG outlines traced once from
   General Sans 400 (HarfBuzz kerning, the nav's -0.01em tracking), so the logo
   keeps its face with no web font loaded (DESIGN.md: Source Sans 3 is the only
   web font). It scales with the surrounding font-size like the text it replaced:
   the box is the glyphs' height above the baseline (0.718em) and sits on
   the baseline, so it works both as the nav logo and inline in a sentence.
   Colours stay props because the footer still needs lighter tints on its dark
   band. `weight` and `wordClassName` are accepted and ignored (the outline has
   one weight). lib/email/send.js keeps its own text wordmark: mail cannot rely on
   inline SVG. To regenerate: shape "MatchTutor" in General Sans 400 (Fontshare)
   with HarfBuzz, export each glyph with fontTools' SVGPathPen (y flipped so the
   baseline is 0), and replace the two path strings and the viewBox below. */
const WORDMARK_VIEWBOX = "0 -718 5147 718";
const WORDMARK_MATCH =
  "M411.0 0 151.0 -609V0H81.0V-718H178.0L444.0 -92L712.0 -718H808.0V0H739.0V-609L477.0 0Z M1279.0 0V-96Q1256.0 -46 1209.5 -18.0Q1163.0 10 1102.0 10Q1020.0 10 971.0 -32.5Q922.0 -75 922.0 -146Q922.0 -303 1164.0 -303Q1194.0 -303 1272.0 -297V-341Q1272.0 -407 1238.5 -444.0Q1205.0 -481 1145.0 -481Q1080.0 -481 1042.5 -443.5Q1005.0 -406 1004.0 -342H940.0Q942.0 -430 998.0 -483.5Q1054.0 -537 1144.0 -537Q1236.0 -537 1287.5 -486.0Q1339.0 -435 1339.0 -343V0ZM989.0 -148Q989.0 -100 1023.0 -70.5Q1057.0 -41 1112.0 -41Q1185.0 -41 1228.5 -85.5Q1272.0 -130 1272.0 -204V-251Q1216.0 -256 1167.0 -256Q989.0 -256 989.0 -148Z M1744.0 -67V-5Q1707.0 10 1668.0 10Q1598.0 10 1556.0 -29.0Q1514.0 -68 1514.0 -149V-468H1390.0V-527H1514.0V-683H1584.0V-527H1749.0V-468H1584.0V-164Q1584.0 -54 1682.0 -54Q1712.0 -54 1744.0 -67Z M2025.0 11Q1921.0 11 1855.0 -66.0Q1789.0 -143 1789.0 -264Q1789.0 -384 1855.0 -460.5Q1921.0 -537 2025.0 -537Q2117.0 -537 2179.0 -479.5Q2241.0 -422 2257.0 -323H2186.0Q2174.0 -395 2131.5 -435.5Q2089.0 -476 2025.0 -476Q1951.0 -476 1905.5 -417.0Q1860.0 -358 1860.0 -264Q1860.0 -168 1905.5 -109.0Q1951.0 -50 2025.0 -50Q2090.0 -50 2132.0 -90.5Q2174.0 -131 2186.0 -204H2257.0Q2243.0 -104 2180.5 -46.5Q2118.0 11 2025.0 11Z M2430.0 -307V0H2360.0V-718H2430.0V-430Q2456.0 -479 2500.0 -508.0Q2544.0 -537 2599.0 -537Q2683.0 -537 2731.5 -486.0Q2780.0 -435 2780.0 -342V0H2710.0V-318Q2710.0 -394 2676.0 -435.0Q2642.0 -476 2578.0 -476Q2516.0 -476 2473.0 -428.0Q2430.0 -380 2430.0 -307Z";
const WORDMARK_TUTOR =
  "M3121.0 0H3047.0V-651H2806.0V-718H3362.0V-651H3121.0Z M3740.0 -213V-527H3809.0V0H3744.0V-95Q3723.0 -48 3678.0 -19.0Q3633.0 10 3576.0 10Q3493.0 10 3445.5 -38.5Q3398.0 -87 3398.0 -184V-527H3468.0V-199Q3468.0 -51 3595.0 -51Q3658.0 -51 3699.0 -97.0Q3740.0 -143 3740.0 -213Z M4222.0 -67V-5Q4185.0 10 4146.0 10Q4076.0 10 4034.0 -29.0Q3992.0 -68 3992.0 -149V-468H3868.0V-527H3992.0V-683H4062.0V-527H4227.0V-468H4062.0V-164Q4062.0 -54 4160.0 -54Q4190.0 -54 4222.0 -67Z M4267.0 -264Q4267.0 -382 4337.5 -459.0Q4408.0 -536 4517.0 -536.0Q4626.0 -536 4697.0 -459.5Q4768.0 -383 4768.0 -264.0Q4768.0 -145 4697.0 -67.5Q4626.0 10 4517.0 10.0Q4408.0 10 4337.5 -67.5Q4267.0 -145 4267.0 -264ZM4517.0 -51Q4596.0 -51 4646.5 -109.0Q4697.0 -167 4697.0 -264Q4697.0 -359 4646.5 -417.0Q4596.0 -475 4517.0 -475Q4439.0 -475 4388.5 -417.0Q4338.0 -359 4338.0 -264Q4338.0 -167 4388.5 -109.0Q4439.0 -51 4517.0 -51Z M4941.0 -282V0H4871.0V-527H4936.0V-407Q4963.0 -466 5017.5 -500.5Q5072.0 -535 5137.0 -535V-462Q5052.0 -465 4996.5 -416.0Q4941.0 -367 4941.0 -282Z";

export function Wordmark({
  matchColor = "var(--logo-ink)",
  tutorColor = "var(--accent)",
  className,
  style,
}) {
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      role="img"
      aria-label="MatchTutor"
      focusable="false"
      className={className}
      style={{
        display: "inline-block",
        height: "0.718em",
        width: "5.147em",
        verticalAlign: "baseline",
        overflow: "visible",
        ...style,
      }}
    >
      <path d={WORDMARK_MATCH} fill={matchColor} />
      <path d={WORDMARK_TUTOR} fill={tutorColor} />
    </svg>
  );
}

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
  sage = "var(--logo-leaf)",
  seam = "var(--surface)",
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
