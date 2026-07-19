"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { EASE_OUT, DURATION_MED } from "@/lib/motion";

// Cards are static: no hover motion, no click-through. Everything a step needs
// to say is on its face.
const STEPS = [
  {
    n: "01",
    image: { src: "/images/editorial/step-browse.jpg", alt: "Browsing a grid of profiles on a laptop" },
    t: "Browse Verified Profiles",
    b: "Every tutor's ATAR, marks and identity are independently checked. Filter by subject, year, location and rate.",
  },
  {
    n: "02",
    image: { src: "/images/editorial/step-pick.jpg", alt: "A tutor working one-on-one with a student" },
    t: "Pick a Tutor that Fits",
    b: "Read bios, compare rates, and check availability. Save the ones you're considering so you can come back later.",
  },
  {
    n: "03",
    image: { src: "/images/editorial/step-lessons.jpg", alt: "A student in an online video lesson with their tutor" },
    t: "Lessons and Reviews",
    b: "Meet in person or over video, leave reviews to help other students, and switch tutors any time you want.",
  },
];

// ── Vine canvas palette ──
// Vine/leaf colours are design-local like the rest of this file's inline
// palette; card surfaces keep the shared CSS variables.
const VINE_COLOR = "#0B6B67";
const LEAF_FILL = "#57B0AB";
const LEAF_STROKE = "#0B7571";
const DRAW_EASE = [0.45, 0.05, 0.2, 1];
const LEAF_POP_EASE = [0.3, 1.5, 0.5, 1];

// ── Timeline ──
// One scroll trigger per canvas; everything below is delay-driven off it, so
// the choreography is scripted rather than racing three separate inView flags
// (horizontally the three cards enter the viewport at nearly the same instant,
// which would collapse the sequencing entirely).
const T = {
  vineDraw: 1.2,
  sun: 0.9,
  clouds: [1.5, 1.7],
  birds: 1.6,
  // Per step: [stem start, card start]. Card lands 0.25s behind its stem tip.
  steps: [
    [1.0, 1.25],
    [1.7, 1.95],
    [2.4, 2.65],
  ],
  stemDraw: 0.5,
  fall: 3.4,
};

// Reduced motion collapses every entrance to its settled state (duration and
// delay both zero); the perpetual loops are dropped at their call sites.
function tm(reduced, duration, delay = 0) {
  return reduced ? { duration: 0, delay: 0 } : { duration, delay };
}

// ── Desktop canvas (1200 × 740) ──
// Authored in fixed coordinates and scaled as one unit (SVG + absolutely
// positioned cards together) so stem tips stay glued to card edges at every
// width. Bands: sky 0–190, vine ~200, stems 200–300, cards 300–600. Cards are
// content-height (~300), not the 440 the sketch frame is authored at, so the
// canvas floor sits just under them rather than leaving a dead band.
const D_W = 1200;
const D_H = 640;

const D_VINE_D =
  "M36 202 C 180 182 300 214 430 198 C 560 182 690 216 820 200 C 930 187 1060 212 1164 196";

// Stems drop from the vine at the card centres and run PAST the card's top
// edge (300), ending at 360 so the tail is hidden behind the card. The SVG is
// z-1 and the cards are z-2 with an opaque white sketch fill, so the stem
// simply disappears under the card. Stopping short of the edge instead left a
// visible gap between stem tip and card.
const D_STEM_DS = [
  "M220 198 C 214 240 228 300 220 360",
  "M600 200 C 606 242 592 302 600 360",
  "M980 200 C 974 240 988 300 980 360",
];

const LEAF_D = "M0 0 C 4 -8 15 -9 20 -1 C 15 6 4 5 0 0 Z";

// [x, y, rotate, scale, delay] — delays track the draw head sweeping left to
// right (1.2s over x 36→1164), so leaves pop as the line reaches them.
const D_VINE_LEAVES = [
  [110, 186, -40, 0.95, 0.32],
  [300, 212, 150, 0.9, 0.5],
  [470, 184, -30, 1.0, 0.65],
  [700, 214, 160, 0.95, 0.85],
  [880, 186, -46, 0.9, 1.0],
  [1090, 210, 146, 1.0, 1.18],
];

// Leaf pairs at each stem's shoulder; fire with their stem.
const D_STEM_LEAVES = [
  [
    [206, 240, 168, 0.9],
    [236, 262, 20, 0.85],
  ],
  [
    [586, 244, 166, 0.9],
    [616, 266, 24, 0.85],
  ],
  [
    [966, 242, 170, 0.9],
    [996, 264, 18, 0.85],
  ],
];

const CARD_W = 340;
const CARD_TOP = 300;
const CARD_LEFTS = [50, 430, 810];

// Sun sits up in the sky band, level with the birds and clouds, clear of the
// vine at y ~200. It no longer tucks behind a card. Sitting high and far right
// puts it just clear of the heading copy's 820px block, so it flanks the
// heading rather than sitting under the text.
const SUN = { cx: 1060, cy: 60, r: 34, rayIn: 44, rayOut: 58 };

// Cloud doodle outline shares the vine's stroke style.
const CLOUD_D =
  "M14 26 C 4 26 0 16 8 11 C 6 3 16 -3 24 2 C 28 -8 44 -8 48 2 C 58 -3 68 5 63 12 C 71 16 67 26 58 26 Z";

// ── Mobile canvas (340 × 1060) ──
// The vertical trunk from the old tree survives here: at a uniform 0.98× it is
// ~992 units tall and ~31 wide, a close fit for a three-card stack in a narrow
// left gutter, so it needs no re-authoring. Its old branches and leaf stages
// do NOT survive the move (branch 1 pointed left, off-canvas; several leaves
// landed at negative x), so those are re-authored below. Mobile carries no
// undergrowth: the band read as a disconnected strip under a tall stack.
const M_W = 340;
const M_H = 1060;
const M_CARD_W = 252;
const M_CARD_LEFT = 72;
const M_CARD_TOPS = [40, 380, 720];

const TRUNK_D =
  "M550 46 C 534 170 566 290 551 410 C 540 500 561 600 550 700 C 542 800 566 900 551 990 C 546 1020 550 1045 550 1058";
// scale first, then translate: x 534–566 → ~9–41, y 46–1058 → ~45–1037.
const M_TRUNK_TRANSFORM = "translate(-514 0) scale(0.98)";

// Stems reach right off the trunk and run PAST each card's left edge (72),
// ending at 130 so the tail is hidden behind the card, same as desktop.
const M_STEM_DS = [
  "M27 95 C 50 90 90 100 130 99",
  "M27 435 C 50 430 90 440 130 439",
  "M27 775 C 50 770 90 780 130 779",
];

// [x, y, rotate, scale, delay] — delays track the trunk draw (1.8s over
// y 45→1037).
const M_VINE_LEAVES = [
  [40, 120, -40, 0.85, 0.3],
  [16, 200, 160, 0.8, 0.45],
  [42, 290, -34, 0.85, 0.58],
  [16, 360, 158, 0.8, 0.68],
  [42, 500, -40, 0.85, 0.88],
  [16, 580, 162, 0.8, 1.0],
  [42, 680, -30, 0.85, 1.12],
  [16, 830, 160, 0.8, 1.35],
  [42, 920, -38, 0.85, 1.5],
];

const M_STEPS_T = [
  [0.5, 0.75],
  [1.0, 1.25],
  [1.5, 1.75],
];

export function HomeHowItWorks() {
  // Clean white band — the vine + sketched step cards carry this section, so it
  // deliberately skips the desk surface / stationery backdrop that /browse and
  // the tutor page use.
  return (
    // `z-0` is load-bearing: it gives this section its own stacking context so
    // the inner `z-10` column stays trapped inside it. Without it that column
    // competes directly with the hero's `z-10` in the root stacking context,
    // ties, and wins on DOM order — painting this section over the hero's
    // school/subject dropdowns.
    <section id="how-it-works" className="relative z-0 overflow-hidden min-h-[90vh] flex items-center" style={{ background: "var(--paper)" }}>
      <div className="relative z-10 max-w-[1200px] w-full mx-auto px-6 pt-12 pb-4">
        {/* `relative z-10` lifts the heading above the canvas below it, which is
            pulled up underneath by a negative margin so the sky doodles drift
            around and behind this copy instead of starting below it. */}
        <div className="max-w-[820px] mb-2 mx-auto text-center flex flex-col items-center relative z-10">
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

        <DesktopVine />
        <MobileVine />
      </div>
    </section>
  );
}

// Scattered resting tilts so the three step cards read as notes pinned to the
// wall (cycled by card index).
const CARD_TILT = [-1.1, 1, -0.8];

// Shared canvas wrapper: the design is authored in fixed coordinates, so below
// that width the whole canvas (SVG + cards together) is uniformly scaled —
// rescaling only the SVG would detach stem tips from the absolutely positioned
// cards. Children get the canvas's single "in view" flag via render prop.
function ScaledCanvas({ w, h, className, style, children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const on = useInView(innerRef, { once: true, amount: 0.2 });

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.offsetWidth;
      // 0 while the breakpoint keeps this layout display:none.
      if (width > 0) setScale(Math.min(1, width / w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  return (
    <div ref={outerRef} className={className} style={{ maxWidth: w, height: h * scale, ...style }}>
      <div
        ref={innerRef}
        style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {children(on)}
      </div>
    </div>
  );
}

function DesktopVine() {
  const reduced = useReducedMotion();
  return (
    <ScaledCanvas
      w={D_W}
      h={D_H}
      className="hidden md:block relative mx-auto"
      // Negative margin slides the sky band up around the heading; zIndex 0
      // keeps the whole canvas (and its cards) behind that copy.
      style={{ marginTop: -130, zIndex: 0 }}
    >
      {(on) => (
        <>
          <DesktopVineSvg on={on} reduced={reduced} />
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              className="absolute"
              style={{ left: CARD_LEFTS[i], top: CARD_TOP, width: CARD_W, zIndex: 2 }}
              initial={{ opacity: 0, y: 26, rotate: CARD_TILT[i] }}
              animate={on ? { opacity: 1, y: 0, rotate: CARD_TILT[i] } : undefined}
              transition={{ ...tm(reduced, 0.8, T.steps[i][1]), ease: EASE_OUT }}
            >
              <HowItWorksCard step={s} emphasized={i === 1} imgH={130} />
            </motion.div>
          ))}
        </>
      )}
    </ScaledCanvas>
  );
}

function MobileVine() {
  const reduced = useReducedMotion();
  return (
    <ScaledCanvas w={M_W} h={M_H} className="md:hidden relative mx-auto" style={{ marginTop: 8 }}>
      {(on) => (
        <>
          <MobileVineSvg on={on} reduced={reduced} />
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              className="absolute"
              style={{ left: M_CARD_LEFT, top: M_CARD_TOPS[i], width: M_CARD_W, zIndex: 2 }}
              initial={{ opacity: 0, y: 22, rotate: CARD_TILT[i] }}
              animate={on ? { opacity: 1, y: 0, rotate: CARD_TILT[i] } : undefined}
              transition={{ ...tm(reduced, 0.8, M_STEPS_T[i][1]), ease: EASE_OUT }}
            >
              <HowItWorksCard step={s} emphasized={i === 1} imgH={110} compact />
            </motion.div>
          ))}
        </>
      )}
    </ScaledCanvas>
  );
}

function DrawPath({ d, strokeWidth, on, duration, delay = 0, reduced }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={VINE_COLOR}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      // pathLength 0.001 + hidden opacity: a true 0 leaves a round-linecap
      // "dot" at the path start in Safari.
      initial={{ pathLength: 0.001, opacity: 0 }}
      animate={on ? { pathLength: 1, opacity: 1 } : undefined}
      transition={{
        pathLength: reduced ? { duration: 0 } : { duration, ease: DRAW_EASE, delay },
        opacity: reduced ? { duration: 0 } : { duration: 0.01, delay },
      }}
    />
  );
}

function Leaf({ x, y, r, s, on, delay, reduced }) {
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
          scale: { ...tm(reduced, 0.65, delay), ease: LEAF_POP_EASE },
          opacity: { ...tm(reduced, 0.65, delay), ease: "easeOut" },
        }}
      />
    </g>
  );
}

function DesktopVineSvg({ on, reduced }) {
  return (
    <svg
      viewBox={`0 0 ${D_W} ${D_H}`}
      width="100%"
      height="100%"
      aria-hidden="true"
      className="absolute inset-0"
      style={{ overflow: "visible", pointerEvents: "none", zIndex: 1 }}
    >
      <Sky on={on} reduced={reduced} />
      {/* Sibling of Sky, not a child: nesting it inside Sky's opacity 0.5 group
          compounded with the birds' own 0.55 and rendered them at 0.275. */}
      <FlyingBirds on={on} reduced={reduced} />
      <DrawPath d={D_VINE_D} strokeWidth={4.6} on={on} duration={T.vineDraw} reduced={reduced} />
      {D_VINE_LEAVES.map(([x, y, r, s, delay], i) => (
        <Leaf key={`vl-${i}`} x={x} y={y} r={r} s={s} on={on} delay={delay} reduced={reduced} />
      ))}
      {D_STEM_DS.map((d, i) => (
        <DrawPath
          key={d}
          d={d}
          strokeWidth={3.4}
          on={on}
          duration={T.stemDraw}
          delay={T.steps[i][0]}
          reduced={reduced}
        />
      ))}
      {D_STEM_LEAVES.map((cluster, i) =>
        cluster.map(([x, y, r, s], j) => (
          <Leaf
            key={`sl-${i}-${j}`}
            x={x}
            y={y}
            r={r}
            s={s}
            on={on}
            delay={T.steps[i][0] + 0.3 + j * 0.12}
            reduced={reduced}
          />
        )),
      )}
      <FallingLeaf x={300} y={215} drop={400} on={on} delay={T.fall} dur={13} reduced={reduced} />
      <FallingLeaf x={640} y={220} drop={380} on={on} delay={T.fall + 5} dur={11} reduced={reduced} />
    </svg>
  );
}

function MobileVineSvg({ on, reduced }) {
  return (
    <svg
      viewBox={`0 0 ${M_W} ${M_H}`}
      width="100%"
      height="100%"
      aria-hidden="true"
      className="absolute inset-0"
      style={{ overflow: "visible", pointerEvents: "none", zIndex: 1 }}
    >
      <g transform={M_TRUNK_TRANSFORM}>
        <DrawPath d={TRUNK_D} strokeWidth={3.4} on={on} duration={1.8} reduced={reduced} />
      </g>
      {M_VINE_LEAVES.map(([x, y, r, s, delay], i) => (
        <Leaf key={`ml-${i}`} x={x} y={y} r={r} s={s} on={on} delay={delay} reduced={reduced} />
      ))}
      {M_STEM_DS.map((d, i) => (
        <DrawPath
          key={d}
          d={d}
          strokeWidth={2.8}
          on={on}
          duration={0.4}
          delay={M_STEPS_T[i][0]}
          reduced={reduced}
        />
      ))}
    </svg>
  );
}

function Sky({ on, reduced }) {
  return (
    <g style={{ opacity: 0.5 }}>
      {/* Sketch sun, cropped by card 3's top edge */}
      <motion.g
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={on ? { scale: 1, opacity: 1 } : undefined}
        transition={{ ...tm(reduced, 0.8, T.sun), ease: EASE_OUT }}
      >
        <circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} fill="none" stroke={VINE_COLOR} strokeWidth={2.4} />
        {[...Array(8)].map((_, i) => {
          const a = (i * Math.PI) / 4 + 0.2;
          return (
            <line
              key={i}
              x1={SUN.cx + Math.cos(a) * SUN.rayIn}
              y1={SUN.cy + Math.sin(a) * SUN.rayIn}
              x2={SUN.cx + Math.cos(a) * SUN.rayOut}
              y2={SUN.cy + Math.sin(a) * SUN.rayOut}
              stroke={VINE_COLOR}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          );
        })}
      </motion.g>
      <Cloud x={60} y={30} s={1} on={on} delay={T.clouds[0]} drift={14} dur={9} reduced={reduced} />
      <Cloud x={215} y={100} s={0.65} on={on} delay={T.clouds[1]} drift={-10} dur={12} reduced={reduced} />
    </g>
  );
}

function Cloud({ x, y, s, on, delay, drift, dur, reduced }) {
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={on ? (reduced ? { opacity: 1 } : { opacity: 1, x: [0, drift, 0] }) : undefined}
      transition={{
        opacity: { ...tm(reduced, 0.9, delay), ease: "easeOut" },
        x: { duration: dur, repeat: Infinity, ease: "easeInOut", delay },
      }}
    >
      <path
        transform={`translate(${x} ${y}) scale(${s})`}
        d={CLOUD_D}
        fill="none"
        stroke={VINE_COLOR}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.g>
  );
}

// Sketch birds (two-arc gull doodles) scattered above and between the cards,
// with a slow bob. They sit on the same z-1 layer as the sun, so any that
// overlap a card pass behind it.
const BIRD_D = "M0 0 C 3 -5 8 -5 10 -1 C 12 -5 17 -5 20 0";
const BIRDS = [
  [880, 44, 1, -6],
  [955, 124, 0.8, 4],
  [300, 36, 0.62, 0],
  [540, 152, 0.7, -4],
];
function FlyingBirds({ on, reduced }) {
  return (
    <g style={{ opacity: 0.55 }}>
      {BIRDS.map(([x, y, s, r], i) => {
        const delay = T.birds + i * 0.15;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
            <motion.g
              initial={{ opacity: 0, y: 6 }}
              animate={on ? (reduced ? { opacity: 1, y: 0 } : { opacity: 1, y: [6, 0, 3, 0] }) : undefined}
              transition={{
                opacity: { ...tm(reduced, 0.8, delay), ease: "easeOut" },
                y: reduced
                  ? { duration: 0 }
                  : { duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay },
              }}
            >
              <path d={BIRD_D} fill="none" stroke={VINE_COLOR} strokeWidth={2.2} strokeLinecap="round" />
            </motion.g>
          </g>
        );
      })}
    </g>
  );
}

// A leaf that breaks loose and tumbles down past the cards on a loop. Under
// reduced motion it stays in the tree but never becomes visible: a perpetual
// fall has no settled state to snap to, and a frozen mid-air leaf reads as a
// bug. It must NOT be conditionally rendered — useReducedMotion() is false on
// the server and reads the media query on the client, so branching the tree on
// it fails hydration.
function FallingLeaf({ x, y, drop, on, delay, dur, reduced }) {
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
          on && !reduced
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

function HowItWorksCard({ step, emphasized = false, imgH = 130, compact = false }) {
  // Both layouts are canvas-based now, so the card root only carries its
  // surface: the entrance and resting tilt are owned by the slot wrapper.
  return (
    <div style={{ position: "relative" }}>
      {/* Cards are framed by a hand-sketched SVG path that supplies both the
          outline and the white fill, so they carry no CSS
          border/background/shadow of their own. A rectangular box behind the
          wobbly outline is exactly what the design rules out. */}
      <SketchFrame emphasized={emphasized} />
      <div
        className="block relative text-left w-full"
        style={{
          borderRadius: "var(--radius-card)",
          padding: compact ? "26px 22px 30px" : "32px 28px 36px",
        }}
      >
        <CardFrontInner step={step} imgH={imgH} compact={compact} />
      </div>
    </div>
  );
}

// Hand-sketched card frame: a deliberately wobbly rounded rectangle drawn as one
// SVG path, filled white and stroked in the vine's ink. `preserveAspectRatio
// ="none"` stretches the 340x440 path to whatever box the card occupies, and the
// drop-shadow filters follow the sketched silhouette (a CSS box-shadow would
// betray the rectangle the outline is pretending not to be).
const SKETCH_D =
  "M12 20 C 70 12 155 16 328 14 C 334 110 330 280 332 422 C 238 430 102 426 10 428 C 6 300 10 130 12 20 Z";

function SketchFrame({ emphasized = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 340 440"
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
        stroke={VINE_COLOR}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeOpacity={0.55}
      />
    </svg>
  );
}

function CardFrontInner({ step, imgH, compact }) {
  return (
    <>
      {step.image && (
        <div className="relative overflow-hidden" style={{ borderRadius: 10, height: imgH }}>
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
      <div className="flex items-baseline gap-3" style={{ marginTop: step.image ? 16 : 0 }}>
        <span
          className="font-hand"
          style={{ fontSize: compact ? 32 : 38, lineHeight: 1, fontWeight: 400, color: "var(--accent)" }}
        >
          {step.n}.
        </span>
        <span
          style={{
            fontSize: compact ? 17 : 18,
            fontWeight: 400,
            color: "var(--ink-graphite)",
            letterSpacing: "-0.015em",
          }}
        >
          {step.t}
        </span>
      </div>
      <p style={{ fontSize: compact ? 13 : 14, color: "var(--ink-muted)", lineHeight: 1.55, margin: "10px 0 0" }}>
        {step.b}
      </p>
    </>
  );
}
