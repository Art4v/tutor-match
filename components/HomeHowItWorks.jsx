"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "@/components/Icon";
import { HandwrittenHeading } from "@/components/HandwrittenHeading";
import { DeskBackdrop } from "@/components/DeskBackdrop";
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

export function HomeHowItWorks() {
  const [openIndex, setOpenIndex] = useState(null);
  const [hiddenIndex, setHiddenIndex] = useState(null);
  const [sourceRect, setSourceRect] = useState(null);
  const [closeSignal, setCloseSignal] = useState(0);
  const cardRefs = useRef([]);

  const openCard = (i) => {
    const el = cardRefs.current[i];
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

  return (
    <section className="relative overflow-hidden min-h-[60vh] flex items-center desk-surface">
      {/* Same cream desk + floating stationery backdrop the featured section used. */}
      <DeskBackdrop />
      <div className="relative z-10 max-w-[1200px] w-full mx-auto px-6 py-24">
        <div className="max-w-[820px] mb-14 mx-auto text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="font-hand text-[24px] mb-2"
            style={{ color: "var(--accent)", fontWeight: 600 }}
          >
            How it works
          </motion.div>
          <HandwrittenHeading
            as="h2"
            lines={["Finding the right", "tutor is easy"]}
            size={68}
            className="flex flex-col items-center"
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-15% 0px" }}
            transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.1 }}
            className="text-[13.5px] sm:text-[16.5px] md:text-[18px] text-[color:var(--ink-muted)] mt-6 leading-[1.5] sm:leading-[1.55] max-w-[560px]"
          >
            Browsing, messaging and booking all done on one platform.
          </motion.p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10% 0px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: STAGGER, delayChildren: 0.15 } },
          }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {STEPS.map((s, i) => (
            <HowItWorksCard
              key={s.n}
              step={s}
              index={i}
              isOpen={openIndex === i}
              isHidden={hiddenIndex === i}
              onOpen={() => openCard(i)}
              cardRef={(el) => (cardRefs.current[i] = el)}
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
const CARD_TILT = [-2, 1.5, -1];
const TAPE_TILT = [-4, 3, -2];

const cardShakeHover = {
  y: -4,
  rotate: [0, -0.9, 0.9, -0.45, 0.2, 0],
  boxShadow: "0 18px 40px -24px rgba(60,55,45,0.28), 0 0 28px rgba(94,122,90,0.22), 0 0 10px rgba(94,122,90,0.16)",
  borderColor: "var(--accent-line)",
  backgroundColor: "var(--accent-softer)",
  transition: {
    y: { duration: 0.42, ease: EASE_OUT },
    rotate: {
      duration: 0.62,
      ease: "easeOut",
      times: [0, 0.18, 0.4, 0.62, 0.82, 1],
    },
    boxShadow: { duration: 0.42, ease: EASE_OUT },
    borderColor: { duration: 0.3, ease: EASE_OUT },
    backgroundColor: { duration: 0.3, ease: EASE_OUT },
  },
};

function HowItWorksCard({ step, index, isOpen, isHidden, onOpen, cardRef }) {
  const [hover, setHover] = useState(false);
  const tilt = CARD_TILT[index % CARD_TILT.length];
  const tapeTilt = TAPE_TILT[index % TAPE_TILT.length];
  // Wobble around the resting tilt (so hover doesn't snap the card straight).
  const hoverAnim = { ...cardShakeHover, rotate: cardShakeHover.rotate.map((r) => tilt + r) };

  return (
    <motion.div
      ref={cardRef}
      variants={{
        hidden: { opacity: 0, y: 18, rotate: tilt },
        show: { opacity: 1, y: 0, rotate: tilt, transition: { duration: DURATION_MED, ease: EASE_OUT } },
      }}
      whileHover={isOpen || isHidden ? undefined : hoverAnim}
      onHoverStart={() => !isOpen && setHover(true)}
      onHoverEnd={() => setHover(false)}
      style={{
        position: "relative",
        border: "1px solid var(--paper-line)",
        background: "var(--paper-card)",
        boxShadow: "var(--card-shadow)",
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? "none" : "auto",
        willChange: "transform, box-shadow",
      }}
    >
      {/* Washi tape pinning the note to the wall. */}
      <span
        aria-hidden="true"
        className="washi-tape"
        style={{ top: -9, left: "50%", transform: `translateX(-50%) rotate(${tapeTilt}deg)`, zIndex: 5 }}
      />
      <button
        type="button"
        onClick={isOpen ? undefined : onOpen}
        className="p-8 block relative overflow-hidden text-left w-full focus:outline-none bg-transparent"
        style={{
          borderRadius: "var(--radius-card)",
          cursor: isOpen ? "default" : "pointer",
        }}
      >
        <CardFrontInner step={step} hover={hover} />
        <div
          className="font-display italic text-[13px] mt-6"
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

function CardFrontInner({ step, hover = true }) {
  return (
    <>
      {step.image && (
        <div
          className="relative mb-7 overflow-hidden"
          style={{ borderRadius: 12, height: 118, border: "1px solid var(--accent-line)" }}
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
              background: "linear-gradient(180deg, rgba(94,122,90,0.05) 0%, rgba(94,122,90,0.12) 100%)",
              opacity: hover ? 0 : 1,
              transition: "opacity 360ms ease-out",
            }}
          />
        </div>
      )}
      <div className="flex items-start justify-between mb-8">
        <div
          className="font-display tabular-nums"
          style={{
            fontSize: 52,
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
            background: hover ? "var(--accent)" : "var(--accent-softer)",
            color: hover ? "#FBF7EC" : "var(--accent)",
            border: "1px solid var(--accent-line)",
            transition: "background-color 220ms ease-out, color 220ms ease-out",
          }}
        >
          <Icon name={step.icon} size={16} />
        </div>
      </div>
      <div className="text-[19px] font-semibold text-[color:var(--ink)] mb-2.5 tracking-tight">
        {step.t}
      </div>
      <p className="text-[14.5px] text-[color:var(--ink-muted)] leading-[1.6]">{step.b}</p>
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
            style={{ background: "rgba(40, 38, 34, 0.55)", backdropFilter: "blur(2px)" }}
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
    boxShadow: "0 40px 80px -30px rgba(40,38,34,0.45)",
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
                  color: "#FBF7EC",
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
                  color: "#FBF7EC",
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
