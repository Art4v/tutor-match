"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { EASE_OUT, DURATION_MED, STAGGER } from "@/lib/motion";

// Cards are static: no hover motion, no click-through. Everything a step needs
// to say is on its face.
const STEPS = [
  {
    n: "01",
    image: { src: "/images/editorial/step-browse.jpg", alt: "Browsing a grid of profiles on a laptop" },
    t: "Browse verified profiles",
    b: "Every tutor's ATAR, marks and identity are independently checked. Filter by subject, year, location and rate.",
  },
  {
    n: "02",
    image: { src: "/images/editorial/step-pick.jpg", alt: "A tutor working one-on-one with a student" },
    t: "Pick a tutor that fits",
    b: "Read bios, compare rates, and check availability. Save the ones you're considering so you can come back later.",
  },
  {
    n: "03",
    image: { src: "/images/editorial/step-lessons.jpg", alt: "A student in an online video lesson with their tutor" },
    t: "Lessons, reviews, switching",
    b: "Meet in person or over video, leave reviews to help other students, and switch tutors any time you want.",
  },
];

// ── "Growing tree" desktop canvas (Claude Design: How It Works Tree) ──
// Trunk/leaf colours are design-local like the rest of this file's inline
// palette; card surfaces keep the shared CSS variables.
const TRUNK_COLOR = "#0B6B67";
const LEAF_FILL = "#57B0AB";
const LEAF_STROKE = "#0B7571";
const DRAW_EASE = [0.45, 0.05, 0.2, 1];
const LEAF_POP_EASE = [0.3, 1.5, 0.5, 1];

const CANVAS_W = 1100;
const CANVAS_H = 1180;

const TRUNK_D =
  "M550 46 C 534 170 566 290 551 410 C 540 500 561 600 550 700 C 542 800 566 900 551 990 C 546 1020 550 1045 550 1058";
// Roots kept as separate paths so all three draw simultaneously.
const ROOT_DS = [
  "M550 1035 C 542 1080 486 1098 448 1130",
  "M550 1035 C 558 1082 620 1098 664 1132",
  "M550 1045 C 549 1090 550 1122 550 1146",
];
const BRANCH_DS = [
  "M551 270 C 504 282 478 300 492 318",
  "M550 520 C 596 532 590 560 604 580",
  "M551 770 C 506 782 486 812 512 830",
];
const LEAF_D = "M0 0 C 4 -8 15 -9 20 -1 C 15 6 4 5 0 0 Z";
// [x, y, rotate, scale] per leaf. Stage 0 is the crown (fires with the trunk);
// stages 1–3 fire with the matching card's branch.
const LEAF_STAGES = [
  [
    [552, 44, -35, 1.15],
    [562, 72, 22, 1.25],
    [534, 66, 206, 1.1],
    [548, 98, -72, 1],
    [568, 108, 58, 1],
    [532, 114, 150, 0.9],
  ],
  [
    [542, 410, 162, 0.85],
    [486, 312, 150, 1],
    [500, 330, 202, 1.05],
    [510, 300, 120, 0.9],
  ],
  [
    [556, 460, 40, 0.9],
    [612, 576, -20, 1],
    [600, 592, 32, 1.05],
    [620, 564, -58, 0.9],
  ],
  [
    [560, 700, 30, 0.9],
    [542, 770, 170, 0.85],
    [508, 826, 150, 1],
    [522, 842, 202, 1.05],
    [526, 816, 120, 0.9],
  ],
];
// Ambient leaves along the bare trunk stretches; delays roughly track the
// trunk draw (2.2s over y 46→1058) passing each one.
const AMBIENT_LEAVES = [
  [546, 638, 155, 0.85, 1.5],
  [560, 668, 28, 0.8, 1.65],
  [544, 892, 168, 0.85, 2.0],
  [562, 924, 22, 0.9, 2.15],
];
// Doodle outlines (cloud, grass tuft) share the tree's stroke style.
const CLOUD_D =
  "M14 26 C 4 26 0 16 8 11 C 6 3 16 -3 24 2 C 28 -8 44 -8 48 2 C 58 -3 68 5 63 12 C 71 16 67 26 58 26 Z";
const GRASS_D =
  "M0 0 C -1 -6 -5 -10 -9 -13 M2 0 C 3 -8 3 -14 1 -18 M4 0 C 6 -6 10 -10 13 -14";

// Card lefts keep each branch tip on the card's near edge: b1 → (492,318),
// b2 → (604,580), b3 → (512,830).
const CARD_W = 400;
const CARD_POS = [
  { left: 90, top: 140 },
  { left: 600, top: 420 },
  { left: 110, top: 700 },
];

export function HomeHowItWorks() {
  // Clean white band — the tree + sketched step cards carry this section, so it
  // deliberately skips the desk surface / stationery backdrop that /browse and
  // the tutor page use.
  return (
    // `z-0` is load-bearing: it gives this section its own stacking context so
    // the inner `z-10` column stays trapped inside it. Without it that column
    // competes directly with the hero's `z-10` in the root stacking context,
    // ties, and wins on DOM order — painting this section over the hero's
    // school/subject dropdowns.
    <section className="relative z-0 overflow-hidden min-h-screen flex items-center" style={{ background: "var(--paper)" }}>
      <div className="relative z-10 max-w-[1200px] w-full mx-auto px-6 py-12">
        <div className="max-w-[820px] mb-8 mx-auto text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="font-hand text-[26px] mb-1.5"
            style={{ color: "var(--accent)", fontWeight: 400 }}
          >
            How it works
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.05 }}
            style={{
              fontSize: "clamp(32px, 4vw, 44px)",
              fontWeight: 300,
              lineHeight: 1.12,
              letterSpacing: "-0.025em",
              color: "var(--ink-graphite)",
            }}
          >
            Finding the right tutor is easy
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.1 }}
            className="text-[13px] sm:text-[15px] md:text-[16px] text-[color:var(--ink-muted)] mt-3 leading-[1.5] max-w-[520px]"
          >
            Browsing, messaging and booking all done on one platform.
          </motion.p>
        </div>

        <DesktopTree />

        {/* Mobile keeps the original stacked cards — the tree canvas is desktop-only. */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10% 0px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: STAGGER, delayChildren: 0.15 } },
          }}
          className="md:hidden grid grid-cols-1 gap-5"
        >
          {STEPS.map((s, i) => (
            <HowItWorksCard key={s.n} step={s} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// Scattered resting tilts + tape angles so the three step cards read as notes
// taped to the wall (cycled by card index).
const CARD_TILT = [-1.1, 1, -0.8];
const TAPE_TILT = [-4, 3, -2];

// A leafy sprig tucked against the sketched frame where the branch meets the
// card: right edge for cards 1 & 3, left (mirrored) for card 2.
const SPRIGS = [
  { right: -20, top: 158, flip: false },
  { left: -20, top: 142, flip: true },
  { right: -22, top: 112, flip: false },
];

function CardSprig({ spec }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        zIndex: 4,
        pointerEvents: "none",
        top: spec.top,
        ...(spec.flip ? { left: spec.left, transform: "scaleX(-1)" } : { right: spec.right }),
      }}
    >
      <svg width="52" height="38" viewBox="0 0 52 38">
        <path d="M50 8 C 40 15 26 20 6 22" fill="none" stroke={TRUNK_COLOR} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M8 20 C 12 8 26 4 40 8 C 34 20 18 26 8 20 Z" fill={LEAF_FILL} stroke={LEAF_STROKE} strokeWidth="1.4" />
        <path d="M14 30 C 18 23 27 21 34 24 C 29 32 20 34 14 30 Z" fill={LEAF_FILL} stroke={LEAF_STROKE} strokeWidth="1.3" opacity="0.85" />
      </svg>
    </span>
  );
}

// Desktop-only tree canvas: the design is authored in fixed 1100×1180
// coordinates, so below that width the whole canvas (SVG + cards together) is
// uniformly scaled — rescaling only the SVG would detach branch tips from the
// absolutely-positioned cards.
function DesktopTree() {
  const outerRef = useRef(null);
  const canvasRef = useRef(null);
  const slot0 = useRef(null);
  const slot1 = useRef(null);
  const slot2 = useRef(null);
  const slotRefs = [slot0, slot1, slot2];
  const treeInView = useInView(canvasRef, { once: true, amount: 0.2 });
  const in0 = useInView(slot0, { once: true, amount: 0.22 });
  const in1 = useInView(slot1, { once: true, amount: 0.22 });
  const in2 = useInView(slot2, { once: true, amount: 0.22 });
  const cardInView = [in0, in1, in2];
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      // 0 while the md breakpoint keeps this layout display:none.
      if (w > 0) setScale(Math.min(1, w / CANVAS_W));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="hidden md:block relative mx-auto"
      style={{ maxWidth: CANVAS_W, marginTop: 28, height: CANVAS_H * scale }}
    >
      <div
        ref={canvasRef}
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <TreeSvg treeInView={treeInView} cardInView={cardInView} />
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            ref={slotRefs[i]}
            className="absolute"
            style={{ left: CARD_POS[i].left, top: CARD_POS[i].top, width: CARD_W, zIndex: 2 }}
            initial={{ opacity: 0, y: 30 }}
            animate={cardInView[i] ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 1, ease: EASE_OUT, delay: 0.3 }}
          >
            <HowItWorksCard step={s} index={i} inView={cardInView[i]} emphasized={i === 1} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function DrawPath({ d, strokeWidth, on, duration, delay = 0 }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={TRUNK_COLOR}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      // pathLength 0.001 + hidden opacity: a true 0 leaves a round-linecap
      // "dot" at the path start in Safari.
      initial={{ pathLength: 0.001, opacity: 0 }}
      animate={on ? { pathLength: 1, opacity: 1 } : undefined}
      transition={{
        pathLength: { duration, ease: DRAW_EASE, delay },
        opacity: { duration: 0.01, delay },
      }}
    />
  );
}

function Leaf({ x, y, r, s, on, delay }) {
  // Static placement on the outer <g>; only the inner path animates scale,
  // about its own bounding box so leaves pop from their centres.
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <motion.path
        d={LEAF_D}
        fill={LEAF_FILL}
        stroke={LEAF_STROKE}
        strokeWidth={1.1}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={on ? { scale: 1, opacity: 1 } : undefined}
        transition={{
          scale: { duration: 0.65, ease: LEAF_POP_EASE, delay },
          opacity: { duration: 0.65, ease: "easeOut", delay },
        }}
      />
    </g>
  );
}

function TreeSvg({ treeInView, cardInView }) {
  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      width="100%"
      height="100%"
      aria-hidden="true"
      className="absolute inset-0"
      style={{ overflow: "visible", pointerEvents: "none", zIndex: 1 }}
    >
      <DrawPath d={TRUNK_D} strokeWidth={5} on={treeInView} duration={2.2} />
      {ROOT_DS.map((d) => (
        <DrawPath key={d} d={d} strokeWidth={3.4} on={treeInView} duration={1.15} delay={1.2} />
      ))}
      {BRANCH_DS.map((d, i) => (
        <DrawPath key={d} d={d} strokeWidth={3.6} on={cardInView[i]} duration={0.9} />
      ))}
      {LEAF_STAGES.map((stage, stageIdx) =>
        stage.map(([x, y, r, s], j) => (
          <Leaf
            key={`${stageIdx}-${j}`}
            x={x}
            y={y}
            r={r}
            s={s}
            on={stageIdx === 0 ? treeInView : cardInView[stageIdx - 1]}
            delay={(stageIdx === 0 ? 0.8 : 0.9) + j * 0.14}
          />
        )),
      )}
      {AMBIENT_LEAVES.map(([x, y, r, s, delay], i) => (
        <Leaf key={`amb-${i}`} x={x} y={y} r={r} s={s} on={treeInView} delay={delay} />
      ))}
      <SkyDoodles on={treeInView} />
      <GroundDoodles on={treeInView} />
      <FlyingBirds on={treeInView} />
      <FallingLeaf x={585} y={150} drop={880} on={treeInView} delay={3.2} dur={13} />
      <FallingLeaf x={628} y={575} drop={500} on={treeInView} delay={9} dur={10} />
    </svg>
  );
}

// Pop-in wrapper for doodle groups: static placement on the outer <g>, the
// inner group scales about its own bounding box (origin "bottom" makes grass
// grow up out of the ground).
function PopG({ x, y, s = 1, on, delay, origin = "center", children }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: origin === "bottom" ? "50% 100%" : "center" }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={on ? { scale: 1, opacity: 1 } : undefined}
        transition={{
          scale: { duration: 0.55, ease: LEAF_POP_EASE, delay },
          opacity: { duration: 0.45, ease: "easeOut", delay },
        }}
      >
        {children}
      </motion.g>
    </g>
  );
}

function SkyDoodles({ on }) {
  return (
    <g style={{ opacity: 0.5 }}>
      {/* Sketch sun, top-right */}
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={on ? { scale: 1, opacity: 1 } : undefined}
        transition={{ duration: 0.8, ease: EASE_OUT, delay: 1.4 }}
      >
        <circle cx={950} cy={110} r={30} fill="none" stroke={TRUNK_COLOR} strokeWidth={2.4} />
        {[...Array(8)].map((_, i) => {
          const a = (i * Math.PI) / 4 + 0.2;
          return (
            <line
              key={i}
              x1={950 + Math.cos(a) * 40}
              y1={110 + Math.sin(a) * 40}
              x2={950 + Math.cos(a) * 52}
              y2={110 + Math.sin(a) * 52}
              stroke={TRUNK_COLOR}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        })}
      </motion.g>
      {/* Doodle clouds, top-left, with a slow horizontal drift */}
      <Cloud x={175} y={70} s={1} on={on} delay={1.7} drift={14} dur={9} />
      <Cloud x={320} y={100} s={0.65} on={on} delay={1.95} drift={-10} dur={12} />
    </g>
  );
}

function Cloud({ x, y, s, on, delay, drift, dur }) {
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={on ? { opacity: 1, x: [0, drift, 0] } : undefined}
      transition={{
        opacity: { duration: 0.9, ease: "easeOut", delay },
        x: { duration: dur, repeat: Infinity, ease: "easeInOut", delay },
      }}
    >
      <path
        transform={`translate(${x} ${y}) scale(${s})`}
        d={CLOUD_D}
        fill="none"
        stroke={TRUNK_COLOR}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.g>
  );
}

function GroundDoodles({ on }) {
  const grass = [
    [398, 1126, 1],
    [492, 1144, 0.85],
    [612, 1140, 0.9],
    [702, 1124, 1.05],
  ];
  const pebbles = [
    [462, 1148, 7, 4],
    [646, 1150, 5, 3.2],
    [538, 1157, 4, 2.8],
  ];
  return (
    <g style={{ opacity: 0.75 }}>
      {grass.map(([x, y, s], i) => (
        <PopG key={`g-${i}`} x={x} y={y} s={s} on={on} delay={2.1 + i * 0.12} origin="bottom">
          <path d={GRASS_D} fill="none" stroke={TRUNK_COLOR} strokeWidth={2} strokeLinecap="round" />
        </PopG>
      ))}
      {pebbles.map(([x, y, rx, ry], i) => (
        <PopG key={`p-${i}`} x={x} y={y} on={on} delay={2.35 + i * 0.12}>
          <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="none" stroke={TRUNK_COLOR} strokeWidth={1.8} />
        </PopG>
      ))}
      {/* Mushroom — cap gets a faint wash of the washi-tape rust */}
      <PopG x={420} y={1146} s={1.1} on={on} delay={2.55} origin="bottom">
        <path
          d="M-2 0 C -2 -5 -2 -8 -1 -10 M2 0 C 2 -5 2 -8 1 -10"
          fill="none"
          stroke={TRUNK_COLOR}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <path
          d="M-8 -9 C -8 -17 8 -17 8 -9 Z"
          fill="rgba(1,103,100,0.28)"
          stroke={TRUNK_COLOR}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      </PopG>
    </g>
  );
}

// Sketch birds (two-arc gull doodles) drifting near the sun, with a slow bob.
const BIRD_D = "M0 0 C 3 -5 8 -5 10 -1 C 12 -5 17 -5 20 0";
const BIRDS = [
  [820, 172, 1, -6, 2.0],
  [884, 142, 0.8, 4, 2.15],
  [768, 204, 0.62, 0, 2.3],
];
function FlyingBirds({ on }) {
  return (
    <g style={{ opacity: 0.55 }}>
      {BIRDS.map(([x, y, s, r, delay], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
          <motion.g
            initial={{ opacity: 0, y: 6 }}
            animate={on ? { opacity: 1, y: [6, 0, 3, 0] } : undefined}
            transition={{
              opacity: { duration: 0.8, ease: "easeOut", delay },
              y: { duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay },
            }}
          >
            <path d={BIRD_D} fill="none" stroke={TRUNK_COLOR} strokeWidth={2.2} strokeLinecap="round" />
          </motion.g>
        </g>
      ))}
    </g>
  );
}

// A leaf that breaks loose and tumbles down past the trunk on a loop.
function FallingLeaf({ x, y, drop, on, delay, dur }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.path
        d={LEAF_D}
        fill={LEAF_FILL}
        stroke={LEAF_STROKE}
        strokeWidth={1.1}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={{ opacity: 0 }}
        animate={
          on
            ? {
                y: [0, drop * 0.25, drop * 0.5, drop * 0.75, drop],
                x: [0, -26, 14, -20, 0],
                rotate: [0, 140, 40, 200, 120],
                opacity: [0, 0.9, 0.9, 0.9, 0],
              }
            : undefined
        }
        transition={{ duration: dur, repeat: Infinity, repeatDelay: 5, ease: "easeInOut", delay }}
      />
    </g>
  );
}

function HowItWorksCard({ step, index, inView, emphasized = false }) {
  const tilt = CARD_TILT[index % CARD_TILT.length];
  const tapeTilt = TAPE_TILT[index % TAPE_TILT.length];
  // Mobile stack (no inView prop): entrance via the parent grid's stagger
  // variants, as before. Desktop tree: the slot wrapper animates the entrance,
  // so the card root only carries its resting tilt.
  const treeMode = inView !== undefined;
  const entrance =
    !treeMode
      ? {
          variants: {
            hidden: { opacity: 0, y: 18, rotate: tilt },
            show: { opacity: 1, y: 0, rotate: tilt, transition: { duration: DURATION_MED, ease: EASE_OUT } },
          },
        }
      : { initial: { rotate: tilt } };

  return (
    <motion.div
      {...entrance}
      style={{
        position: "relative",
        // Cards are framed by a hand-sketched SVG path (below) that supplies both
        // the outline and the white fill, so they carry no CSS
        // border/background/shadow of their own. A rectangular box behind the
        // wobbly outline is exactly what the design rules out.
      }}
    >
      {/* Sketched frame on both layouts. Tree cards hang a sprig off the edge
          where the branch meets them; the mobile stack has no branch to answer
          to, so it keeps the washi tape pinning the note to the wall. */}
      <SketchFrame emphasized={emphasized} />
      {treeMode ? (
        <CardSprig spec={SPRIGS[index % SPRIGS.length]} />
      ) : (
        <span
          aria-hidden="true"
          className="washi-tape"
          style={{ top: -9, left: "50%", transform: `translateX(-50%) rotate(${tapeTilt}deg)`, zIndex: 5 }}
        />
      )}
      <div
        className={`${treeMode ? "" : "p-6 overflow-hidden"} block relative text-left w-full`}
        style={{
          borderRadius: "var(--radius-card)",
          // Tree cards use the design's asymmetric padding inside the sketched
          // frame; the mobile stack keeps its uniform p-6.
          ...(treeMode ? { padding: "34px 32px 38px" } : {}),
        }}
      >
        <CardFrontInner step={step} emphasized={emphasized} tall={treeMode} />
      </div>
    </motion.div>
  );
}

// Hand-sketched card frame: a deliberately wobbly rounded rectangle drawn as one
// SVG path, filled white and stroked in the tree's ink. `preserveAspectRatio
// ="none"` stretches the 400x460 path to whatever box the card occupies, and the
// drop-shadow filters follow the sketched silhouette (a CSS box-shadow would
// betray the rectangle the outline is pretending not to be).
const SKETCH_D =
  "M14 22 C 80 14 180 18 386 16 C 392 120 388 300 390 440 C 280 448 120 444 12 446 C 8 320 12 140 14 22 Z";

function SketchFrame({ emphasized = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 460"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        filter: "drop-shadow(0 2px 4px rgba(0,30,30,0.05)) drop-shadow(0 18px 28px rgba(0,49,47,0.10))",
      }}
    >
      <path
        d={SKETCH_D}
        fill={emphasized ? "var(--accent-softer)" : "#FFFFFF"}
        stroke={TRUNK_COLOR}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeOpacity={0.55}
      />
    </svg>
  );
}

function CardFrontInner({ step, tall = false }) {
  return (
    <>
      {step.image && (
        <div
          className="relative overflow-hidden"
          style={{ borderRadius: 10, height: tall ? 140 : 88 }}
        >
          <img
            src={step.image.src}
            alt={step.image.alt}
            loading="lazy"
            draggable={false}
            className="w-full h-full object-cover"
          />
          {/* Faint accent wash so the photo reads as part of the card. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(1,103,100,0.05) 0%, rgba(1,103,100,0.12) 100%)",
            }}
          />
        </div>
      )}
      {/* Caveat step number sits on the title's baseline, per the design. The
          icon tile the old card carried is gone: the design pairs the number
          with the title and nothing else. */}
      <div className="flex items-baseline gap-3" style={{ marginTop: step.image ? 18 : 0 }}>
        <span
          className="font-hand"
          style={{ fontSize: 40, lineHeight: 1, fontWeight: 400, color: "var(--accent)" }}
        >
          {step.n}.
        </span>
        <span
          style={{ fontSize: 19, fontWeight: 400, color: "var(--ink-graphite)", letterSpacing: "-0.015em" }}
        >
          {step.t}
        </span>
      </div>
      <p style={{ fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.55, margin: "10px 0 0" }}>{step.b}</p>
    </>
  );
}
