/* MatchTutor — botanical mark system
   Motif: education nurtures growth. Primitives (Leaf, Sprout) compose into
   six concepts. Pure geometry so everything recolors + scales cleanly.
   Palette is sampled from the live site (cream paper, forest green, sage,
   dusty blush). Exported to window for the canvas. */

// ============================================================ PRIMITIVES ===

// A single pointed leaf. Tip is UP, base sits at local origin (0,0).
// Spans ~ x:[-15,15] y:[-46,0]. `vein` draws a center rib.
function Leaf({ fill, vein, veinColor, scale = 1, x = 0, y = 0, rot = 0, opacity = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`} opacity={opacity}>
      <path d="M0 0 C -15 -8 -16.5 -29 0 -46 C 16.5 -29 15 -8 0 0 Z" fill={fill} />
      {vein && (
        <path d="M0 -3 C -1.5 -16 -1 -30 0 -42" fill="none"
              stroke={veinColor || 'rgba(255,255,255,0.55)'} strokeWidth="2.2" strokeLinecap="round" />
      )}
    </g>
  );
}

// Seedling: a curved stem with two leaves. Drawn around a 120 box,
// rooted near (60,112), crown around (60,58).
function Sprout({ stem, leafA, leafB, vein, scale = 1, x = 0, y = 0, stemW = 7 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M60 114 C 60 96 59 80 60 64" fill="none" stroke={stem}
            strokeWidth={stemW} strokeLinecap="round" />
      <Leaf fill={leafB} vein={vein} x={60} y={70} rot={34} scale={0.92} />
      <Leaf fill={leafA} vein={vein} x={60} y={64} rot={-34} scale={0.92} />
    </g>
  );
}

// Rounded chat bubble (tip lower-left). Fill or stroke.
function BubbleRound({ fill, stroke, sw = 0, children }) {
  return (
    <g>
      <path d="M60 14 C32 14 12 32 12 56 C12 72 21 86 36 94
               C35 104 30 110 24 116 C38 114 49 108 57 100
               C58 100 59 100 60 100 C88 100 108 80 108 56 C108 32 88 14 60 14 Z"
            fill={fill || 'none'} stroke={stroke || 'none'} strokeWidth={sw} strokeLinejoin="round" />
      {children}
    </g>
  );
}

// =============================================================== MARKS =====
// Every mark: props { size, pal }. pal = {ink, primary, sage, accent, onPrimary, paper}

// A — Clean seedling (the classic). Two-tone leaves.
function MarkSprout({ size = 140, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Sprout stem={p.primary} leafA={p.primary} leafB={p.sage} vein={false} scale={0.96} x={2.4} y={2} />
    </svg>
  );
}

// B — Seedling inside a chat bubble: nurture + message/match. (recommended)
function MarkSproutBubble({ size = 140, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size} viewBox="0 0 120 124" fill="none">
      <BubbleRound fill={p.primary}>
        <g transform="translate(0 -6) scale(0.86) translate(8.5 12)">
          <path d="M60 110 C 60 94 59 80 60 66" fill="none" stroke={p.onPrimary}
                strokeWidth={7.5} strokeLinecap="round" />
          <Leaf fill={p.onPrimary} x={60} y={72} rot={34} scale={0.92} opacity={0.7} />
          <Leaf fill={p.onPrimary} x={60} y={66} rot={-34} scale={0.92} />
        </g>
      </BubbleRound>
    </svg>
  );
}

// C — Open book with a seedling rising from the gutter: education grows you.
function MarkBookSprout({ size = 150, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size} viewBox="0 0 130 120" fill="none">
      {/* seedling */}
      <g transform="translate(5 -6)">
        <path d="M60 84 C 60 70 59 58 60 46" fill="none" stroke={p.primary} strokeWidth={6} strokeLinecap="round" />
        <Leaf fill={p.sage} x={60} y={56} rot={36} scale={0.7} />
        <Leaf fill={p.primary} x={60} y={50} rot={-36} scale={0.7} />
      </g>
      {/* book — two open pages */}
      <g>
        <path d="M65 92 C 50 82 34 80 18 83 L18 104 C 34 101 50 103 65 112 Z" fill={p.primary} />
        <path d="M65 92 C 80 82 96 80 112 83 L112 104 C 96 101 80 103 65 112 Z" fill={p.sage} />
        <path d="M65 92 L65 112" stroke={p.paper} strokeWidth="2.4" />
      </g>
    </svg>
  );
}

// D — Two leaves meeting (a "match": two parties, shared growth).
function MarkTwoLeaves({ size = 150, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size} viewBox="0 0 130 120" fill="none">
      <path d="M65 110 C 65 92 64 78 65 60" fill="none" stroke={p.primary} strokeWidth="6.5" strokeLinecap="round" />
      <Leaf fill={p.sage}    vein veinColor="rgba(255,255,255,0.5)" x={65} y={78} rot={52}  scale={1.05} />
      <Leaf fill={p.primary} vein veinColor="rgba(255,255,255,0.5)" x={65} y={70} rot={-52} scale={1.05} />
    </svg>
  );
}

// E — Mortarboard with a sprout where the tassel button sits: academic + grow.
function MarkCapSprout({ size = 150, pal }) {
  const p = pal;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {/* cap base */}
      <path d="M41 64 L41 76 Q41 88 60 88 Q79 88 79 76 L79 64 Z" fill={p.primary} />
      {/* board */}
      <path d="M60 44 L99 61 L60 78 L21 61 Z" fill={p.primary} />
      {/* little sprout growing from the centre button */}
      <g transform="translate(0 -2)">
        <path d="M60 60 C 60 52 60 46 60 40" fill="none" stroke={p.sage} strokeWidth="4.4" strokeLinecap="round" />
        <Leaf fill={p.sage}    x={60} y={46} rot={38}  scale={0.5} />
        <Leaf fill={p.accent}  x={60} y={42} rot={-38} scale={0.5} />
      </g>
    </svg>
  );
}

// F — Canopy as a network of connected nodes: the matching graph, as a tree.
function MarkTreeNet({ size = 150, pal }) {
  const p = pal;
  const nodes = [ [60,30],[40,46],[80,46],[50,64],[72,62],[60,50] ];
  const edges = [ [0,1],[0,2],[1,3],[2,4],[1,5],[2,5],[5,3],[5,4] ];
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <path d="M60 108 C 60 92 60 80 60 66" fill="none" stroke={p.primary} strokeWidth="6.5" strokeLinecap="round" />
      {edges.map(([a,b],i)=>(
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
              stroke={p.sage} strokeWidth="2.4" />
      ))}
      {nodes.map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r={i===0?7:5.4} fill={i%2?p.primary:p.sage} />
      ))}
      <Leaf fill={p.accent} x={60} y={30} rot={0} scale={0.42} />
    </svg>
  );
}

// ============================================================ LOCKUPS ======
// Wordmark echoes the live site: "match" rounded (Baloo 2), "tutor" brush (Caveat).
function Wordmark({ pal, size = 40, reverse = false }) {
  const matchColor = reverse ? 'rgba(255,255,255,0.92)' : (pal.ink);
  const tutorColor = reverse ? '#ffffff' : pal.primary;
  return (
    <div style={{ display:'flex', alignItems:'baseline' }}>
      <span style={{ fontFamily:"'Baloo 2', system-ui", fontWeight:700, fontSize:size,
                     letterSpacing:'-0.01em', color: matchColor, lineHeight:1 }}>match</span>
      <span style={{ fontFamily:"'Caveat', cursive", fontWeight:700, fontSize:size*1.18,
                     color: tutorColor, lineHeight:1, marginLeft:size*0.02 }}>tutor</span>
    </div>
  );
}

function Lockup({ pal, height = 64, reverse = false, Mark = MarkSprout }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap: height*0.26 }}>
      <Mark pal={pal} size={height*1.42} />
      <Wordmark pal={pal} size={height*0.7} reverse={reverse} />
    </div>
  );
}

// Rounded-square app tile (mirrors the site's sprout tile).
function AppIcon({ pal, size = 96, radius = 0.26, bg, Mark = MarkSprout, markColor }) {
  const p = markColor ? { ...pal, primary:markColor, sage:markColor, onPrimary:markColor } : pal;
  return (
    <div style={{ width:size, height:size, borderRadius:size*radius, background: bg || pal.sage,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'inset 0 0 0 1px rgba(0,0,0,0.04)' }}>
      <Mark pal={{ ...p, primary: markColor||'#fff', sage: markColor||'rgba(255,255,255,0.78)', onPrimary: bg||pal.sage }} size={size*0.66} />
    </div>
  );
}

Object.assign(window, {
  Leaf, Sprout, BubbleRound,
  MarkSprout, MarkSproutBubble, MarkBookSprout, MarkTwoLeaves, MarkCapSprout, MarkTreeNet,
  Wordmark, Lockup, AppIcon,
});
