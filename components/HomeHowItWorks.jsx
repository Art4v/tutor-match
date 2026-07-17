"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence, useInView } from "motion/react";
import { Icon } from "@/components/Icon";
import { EASE_OUT, DURATION_MED, STAGGER } from "@/lib/motion";

const STEPS = [
  {
    n: "01",
    icon: "search",
    image: { src: "/images/editorial/step-browse.jpg", alt: "Browsing a grid of profiles on a laptop" },
    t: "Browse verified profiles",
    b: "Every tutor's ATAR, marks and identity are independently checked. Filter by subject, year, location and rate.",
    backTitle: "Browse, the way you'd want to",
    backLead:
      "We verify every tutor's ATAR, subject marks and identity before they appear in search. You see the people who actually have the receipts.",
    bullets: [
      "Every tutor independently verified. ATAR, marks, identity.",
      "Filter by subject, year level, suburb, hourly rate, in-person or online.",
      "Free to browse. No account needed until you want to reach out.",
    ],
    cta: { label: "Start browsing", href: "/browse" },
  },
  {
    n: "02",
    icon: "user",
    image: { src: "/images/editorial/step-pick.jpg", alt: "A tutor working one-on-one with a student" },
    t: "Pick a tutor that fits",
    b: "Read bios, compare rates, and check availability. Save the ones you're considering so you can come back later.",
    backTitle: "Reach out directly. No agency in the middle",
    backLead:
      "When you've found someone who fits, sign up as a student (free) and email them directly. We don't take a cut, and there's no platform fee on top of the tutor's rate.",
    bullets: [
      "Sign up free as a student. Takes about a minute.",
      "Contact tutors directly by email. No agency, no booking fee.",
      "Pick the tutor's flat hourly rate, or choose one of their listed packages.",
    ],
    cta: { label: "Create a free account", href: "/signup" },
  },
  {
    n: "03",
    icon: "globe",
    image: { src: "/images/editorial/step-lessons.jpg", alt: "A student in an online video lesson with their tutor" },
    t: "Lessons, reviews, switching",
    b: "Meet in person or over video, leave reviews to help other students, and switch tutors any time you want.",
    backTitle: "Lessons on your terms",
    backLead:
      "Meet in person or over video. Whatever suits the subject. After sessions, leave a review so the next student knows what they're getting. Not the right fit? Switch tutors, no questions asked.",
    bullets: [
      "Lessons in person or over video. Your call, their availability.",
      "Leave a review after sessions so other students can choose well.",
      "Switch tutors any time. You're never locked into anyone.",
    ],
    cta: { label: "Find your tutor", href: "/browse" },
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
  const [openIndex, setOpenIndex] = useState(null);
  const [hiddenIndex, setHiddenIndex] = useState(null);
  const [sourceRect, setSourceRect] = useState(null);
  const [closeSignal, setCloseSignal] = useState(0);
  // Desktop tree and mobile stack both render card i (one is display:none),
  // so refs are keyed `d${i}` / `m${i}` and openCard measures the visible one.
  const cardRefs = useRef({});
  const registerEl = (key) => (el) => {
    cardRefs.current[key] = el;
  };

  const openCard = (i) => {
    const el = [cardRefs.current[`d${i}`], cardRefs.current[`m${i}`]].find(
      (n) => n && n.getBoundingClientRect().width > 0,
    );
    if (el) {
      const r = el.getBoundingClientRect();
      setSourceRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    setHiddenIndex(i);
    setOpenIndex(i);
  };

  const requestClose = () => setCloseSignal((n) => n + 1);
  const finalClose = () => setOpenIndex(null);
  const onExitDone = () => setHiddenIndex(null);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [openIndex]);

  // Clean white band — the tree + sketched step cards carry this section, so it
  // deliberately skips the desk surface / stationery backdrop that /browse and
  // the tutor page use.
  return (
    <section className="relative overflow-hidden min-h-screen flex items-center" style={{ background: "var(--paper)" }}>
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

        <DesktopTree
          openIndex={openIndex}
          hiddenIndex={hiddenIndex}
          onOpen={openCard}
          registerEl={registerEl}
        />

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
            <HowItWorksCard
              key={s.n}
              step={s}
              index={i}
              isOpen={openIndex === i}
              isHidden={hiddenIndex === i}
              onOpen={() => openCard(i)}
              cardRef={registerEl(`m${i}`)}
            />
          ))}
        </motion.div>
      </div>

      <ExpandedOverlay
        openIndex={openIndex}
        sourceRect={sourceRect}
        onRequestClose={requestClose}
        onClose={finalClose}
        onExitDone={onExitDone}
        closeSignal={closeSignal}
      />
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
function DesktopTree({ openIndex, hiddenIndex, onOpen, registerEl }) {
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
            <HowItWorksCard
              step={s}
              index={i}
              isOpen={openIndex === i}
              isHidden={hiddenIndex === i}
              onOpen={() => onOpen(i)}
              cardRef={registerEl(`d${i}`)}
              inView={cardInView[i]}
              emphasized={i === 1}
            />
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

// Shared hover motion: a -4px lift plus the little settle-wobble.
const CARD_LIFT = {
  y: -4,
  rotate: [0, -0.9, 0.9, -0.45, 0.2, 0],
};
const CARD_LIFT_TRANSITION = {
  y: { duration: 0.42, ease: EASE_OUT },
  rotate: {
    duration: 0.62,
    ease: "easeOut",
    times: [0, 0.18, 0.4, 0.62, 0.82, 1],
  },
};

// Tree cards are framed by the sketched SVG path, so hover is lift + wobble
// ONLY. Animating boxShadow/borderColor/backgroundColor here would paint the
// rectangle the sketched outline exists to avoid.
const cardShakeHoverSketch = {
  ...CARD_LIFT,
  transition: { ...CARD_LIFT_TRANSITION },
};

// The mobile stack is a real bordered card, so it keeps the full treatment.
const cardShakeHover = {
  ...CARD_LIFT,
  boxShadow: "0 18px 40px -24px rgba(0,49,47,0.28), 0 0 28px rgba(1,103,100,0.22), 0 0 10px rgba(1,103,100,0.16)",
  borderColor: "var(--accent-line)",
  backgroundColor: "var(--accent-softer)",
  transition: {
    ...CARD_LIFT_TRANSITION,
    boxShadow: { duration: 0.42, ease: EASE_OUT },
    borderColor: { duration: 0.3, ease: EASE_OUT },
    backgroundColor: { duration: 0.3, ease: EASE_OUT },
  },
};

function HowItWorksCard({ step, index, isOpen, isHidden, onOpen, cardRef, inView, emphasized = false }) {
  const [hover, setHover] = useState(false);
  const tilt = CARD_TILT[index % CARD_TILT.length];
  const tapeTilt = TAPE_TILT[index % TAPE_TILT.length];
  // Mobile stack (no inView prop): entrance via the parent grid's stagger
  // variants, as before. Desktop tree: the slot wrapper animates the entrance,
  // so the card root only carries its resting tilt.
  const treeMode = inView !== undefined;
  // Wobble around the resting tilt (so hover doesn't snap the card straight).
  const baseHover = treeMode ? cardShakeHoverSketch : cardShakeHover;
  const hoverAnim = { ...baseHover, rotate: baseHover.rotate.map((r) => tilt + r) };
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
      ref={cardRef}
      {...entrance}
      whileHover={isOpen || isHidden ? undefined : hoverAnim}
      onHoverStart={() => !isOpen && setHover(true)}
      onHoverEnd={() => setHover(false)}
      style={{
        position: "relative",
        // The tree cards are framed by a hand-sketched SVG path (below), so they
        // carry no CSS border/background/shadow of their own — a rectangular box
        // behind the wobbly outline is exactly what the design rules out. The
        // mobile stack keeps the plain card.
        ...(treeMode
          ? {}
          : {
              border: "1px solid var(--paper-line)",
              background: emphasized ? "var(--accent-softer)" : "var(--paper-card)",
              boxShadow: "var(--card-shadow)",
            }),
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? "none" : "auto",
        willChange: "transform, box-shadow",
      }}
    >
      {/* Tree cards: sketched frame + a sprig overlapping its edge, per the
          design. The mobile stack (not covered by the handoff) keeps the washi
          tape pinning the note to the wall. */}
      {treeMode ? (
        <>
          <SketchFrame emphasized={emphasized} />
          <CardSprig spec={SPRIGS[index % SPRIGS.length]} />
        </>
      ) : (
        <span
          aria-hidden="true"
          className="washi-tape"
          style={{ top: -9, left: "50%", transform: `translateX(-50%) rotate(${tapeTilt}deg)`, zIndex: 5 }}
        />
      )}
      <button
        type="button"
        onClick={isOpen ? undefined : onOpen}
        className={`${treeMode ? "" : "p-6 overflow-hidden"} block relative text-left w-full focus:outline-none bg-transparent`}
        style={{
          borderRadius: "var(--radius-card)",
          cursor: isOpen ? "default" : "pointer",
          // Tree cards use the design's asymmetric padding inside the sketched
          // frame; the mobile stack keeps its uniform p-6.
          ...(treeMode ? { padding: "34px 32px 38px" } : {}),
        }}
      >
        <CardFrontInner step={step} hover={hover} emphasized={emphasized} tall={treeMode} />
        <div
          className="font-display italic text-[12px] mt-4"
          style={{
            color: "var(--accent)",
            fontWeight: 500,
            opacity: hover ? 1 : 0.55,
            transition: "opacity 220ms ease-out",
          }}
        >
          Click to learn more →
        </div>
      </button>
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

function CardFrontInner({ step, hover = true, emphasized = false, tall = false }) {
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
            style={{
              // Lightly muted at rest, lifting to full colour on hover — same
              // hover language as the icon tile below.
              filter: hover ? "grayscale(0) saturate(1.05)" : "grayscale(0.32) saturate(0.92)",
              transform: hover ? "scale(1.04)" : "scale(1)",
              transition:
                "filter 360ms ease-out, transform 600ms cubic-bezier(0.22,1,0.36,1)",
            }}
          />
          {/* keep a faint accent wash at rest so it reads as part of the card */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(1,103,100,0.05) 0%, rgba(1,103,100,0.12) 100%)",
              opacity: hover ? 0 : 1,
              transition: "opacity 360ms ease-out",
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

function ExpandedOverlay({ openIndex, sourceRect, onRequestClose, onClose, onExitDone, closeSignal }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const step = openIndex === null ? null : STEPS[openIndex];

  return createPortal(
    <AnimatePresence onExitComplete={onExitDone}>
      {step && (
        <motion.div
          key="how-overlay"
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 1 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: "rgba(0, 30, 30, 0.55)", backdropFilter: "blur(2px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            onClick={onRequestClose}
          />
          <ExpandedCard
            step={step}
            sourceRect={sourceRect}
            onRequestClose={onRequestClose}
            onClose={onClose}
            closeSignal={closeSignal}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function getTargetRect() {
  if (typeof window === "undefined") return { width: 720, height: 560, top: 100, left: 100 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(720, vw * 0.92);
  const height = Math.min(560, vh * 0.82);
  return {
    width,
    height,
    top: (vh - height) / 2,
    left: (vw - width) / 2,
  };
}

function ExpandedCard({ step, sourceRect, onRequestClose, onClose, closeSignal }) {
  const [flipped, setFlipped] = useState(false);
  const [target, setTarget] = useState(() => getTargetRect());
  // Snapshot the closeSignal at mount time. closeSignal is a monotonically
  // increasing counter shared across opens, so on the 2nd open it's already
  // > 0 — without this baseline, the effect below would fire immediately on
  // mount and close the card right after it opened.
  const baselineSignalRef = useRef(closeSignal);

  useEffect(() => {
    const onResize = () => setTarget(getTargetRect());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 320);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (closeSignal === baselineSignalRef.current) return;
    setFlipped(false);
    const t = setTimeout(() => onClose(), 360);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeSignal]);

  const src = sourceRect || target;

  const faceStyle = {
    position: "absolute",
    inset: 0,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    background: "var(--paper-card)",
    border: "1px solid var(--paper-line)",
    boxShadow: "0 40px 80px -30px rgba(0,30,30,0.45)",
    overflow: "hidden",
  };

  return (
    <motion.div
      initial={{ top: src.top, left: src.left, width: src.width, height: src.height }}
      animate={{ top: target.top, left: target.left, width: target.width, height: target.height }}
      exit={{ top: src.top, left: src.left, width: src.width, height: src.height, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="absolute"
      style={{
        borderRadius: "var(--radius-card)",
        perspective: 1600,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
        }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        {/* Front face */}
        <div style={faceStyle} className="p-10">
          <CardFrontInner step={step} hover={true} />
        </div>

        {/* Back face */}
        <div
          style={{
            ...faceStyle,
            transform: "rotateY(180deg)",
            background: "linear-gradient(180deg, var(--paper-card) 0%, var(--accent-softer) 100%)",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequestClose();
            }}
            aria-label="Close"
            className="absolute top-4 right-4 flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "var(--paper-card)",
              border: "1px solid var(--accent-line)",
              color: "var(--accent)",
              cursor: "pointer",
              zIndex: 2,
            }}
          >
            <Icon name="x" size={16} />
          </button>

          <div className="h-full w-full p-8 sm:p-10 flex flex-col overflow-auto">
            <div className="flex items-start justify-between mb-6 pr-12">
              <div
                className="font-display tabular-nums"
                style={{
                  fontSize: 44,
                  lineHeight: 1,
                  fontWeight: 500,
                  color: "var(--accent)",
                  letterSpacing: "-0.04em",
                }}
              >
                {step.n}
              </div>
              <div
                className="flex items-center justify-center"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "var(--accent)",
                  color: "#fff",
                  border: "1px solid var(--accent-line)",
                }}
              >
                <Icon name={step.icon} size={16} />
              </div>
            </div>

            {step.image && (
              <div
                className="relative mb-6 overflow-hidden"
                style={{ borderRadius: 12, height: 132, border: "1px solid var(--accent-line)" }}
              >
                <img
                  src={step.image.src}
                  alt={step.image.alt}
                  draggable={false}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <h3
              className="font-display text-[26px] sm:text-[30px] text-[color:var(--ink)] leading-[1.15] mb-3"
              style={{ fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              {step.backTitle}
            </h3>
            <p className="text-[15px] sm:text-[15.5px] text-[color:var(--ink-muted)] leading-[1.6] mb-5 max-w-[58ch]">
              {step.backLead}
            </p>

            <ul className="space-y-2.5 mb-6">
              {step.bullets.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: "var(--accent-softer)",
                      color: "var(--accent)",
                      border: "1px solid var(--accent-line)",
                      marginTop: 2,
                    }}
                  >
                    <Icon name="check" size={12} />
                  </span>
                  <span className="text-[14.5px] text-[color:var(--ink-muted)] leading-[1.55]">{line}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-2">
              <Link
                href={step.cta.href}
                onClick={onRequestClose}
                className="inline-flex items-center gap-2 font-display"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  padding: "12px 18px",
                  borderRadius: 12,
                  fontWeight: 500,
                  fontSize: 15,
                  letterSpacing: "-0.01em",
                }}
              >
                {step.cta.label}
                <Icon name="arrow-right" size={16} />
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
