"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { TutorRow } from "@/components/TutorRow";
import { EASE_OUT, DURATION_MED } from "@/lib/motion";

/**
 * Featured tutors, between the schools strip and "How it works". Two
 * full-bleed lanes scrolling in opposite directions (top rightward, bottom
 * leftward) on a faded teal band. Tutors are ROWS (TutorRow variant="feature"),
 * never cards: a 1px vertical rule between tutors, no horizontal rules, and the
 * two lanes separated by space. Hovering a lane pauses it (`.marquee-row` in
 * globals.css) so a moving row is still clickable.
 */

// Tutors per lane. The caller sends up to 12 verified tutors; a shorter list is
// repeated within its own lane to reach this, so a lane is never visibly short.
const PER_ROW = 6;

// Tutors in the phone stack. Below md there is no marquee at all.
const STACK_COUNT = 5;

// Different durations so the two lanes never settle into a visible lockstep.
// Scaled with the 680px item width so the scroll speed stays the same.
const DURATION_TOP = "75s";
const DURATION_BOTTOM = "90s";

// Geometry lives as literal Tailwind classes at the point of use (the JIT scans
// source and can't see a class built from a variable), so the numbers that
// depend on each other are recorded here.
//
// The marquee runs from md up only; phones get a plain stack of five instead.
// The lane height is FIXED, close to the card band's (two 240px rows + 24px
// above the link): 228 lane + 32 gap + 228 lane + 48 above the link = 536.
//
// The spacing between tutors lives INSIDE each item (padding + a right border),
// never as a flex `gap`: with a gap the track measures 2W plus one extra gap
// between the two copies, a 50% translate lands half a gap off, and the wrap
// visibly jumps. Folding it into each item makes the two copies equal.

// Repeat `list` until it holds `n` items. A pool of 2 verified tutors becomes
// [a, b, a, b, a, b] rather than a two-item lane that wraps every few seconds.
function fill(list, n) {
  if (!list.length) return [];
  const out = [];
  while (out.length < n) out.push(list[out.length % list.length]);
  return out;
}

// One lane: a clipped viewport and the animated track. The track renders the
// lane TWICE; the keyframes translate exactly 50%, which is one copy, so the
// loop has no seam.
function MarqueeLane({ tutors, direction, duration }) {
  const items = (key, tabIndex) =>
    tutors.map((tutor, i) => (
      <div
        key={`${key}-${tutor.id ?? tutor.slug}-${i}`}
        className="shrink-0 h-full w-[680px] px-8 border-r border-[color:var(--accent-line)]"
      >
        <TutorRow tutor={tutor} variant="feature" tabIndex={tabIndex} />
      </div>
    ));

  return (
    <div className="marquee-row relative w-full overflow-hidden h-[228px]">
      <div
        className="marquee-track flex items-stretch w-max h-full"
        style={{
          animationName: direction === "right" ? "marquee-right" : "marquee-left",
          "--marquee-duration": duration,
        }}
      >
        <div className="flex items-stretch">{items("a", 0)}</div>
        {/* The second copy exists only to make the wrap seamless. Hidden from
            assistive tech, and its links get tabIndex -1, so a keyboard user
            meets each tutor once. NOT `inert`: inert also kills pointer events,
            and over a full cycle BOTH copies pass through the viewport, so an
            inert copy would make the lane unclickable for most of its loop. */}
        <div className="flex items-stretch" aria-hidden="true">
          {items("b", -1)}
        </div>
      </div>
    </div>
  );
}

export function FeaturedTutors({ tutors = [], tutorCount }) {
  if (!tutors.length) return null;

  // Alternate by index so both lanes carry a comparable slice of the ranking
  // rather than the top half landing entirely on the first lane.
  const top = fill(tutors.filter((_, i) => i % 2 === 0), PER_ROW);
  const bottom = fill(tutors.filter((_, i) => i % 2 === 1), PER_ROW);

  return (
    <section
      id="featured-tutors"
      className="relative overflow-hidden pt-10 pb-10 md:pt-12 md:pb-12"
      // Faded teal: HomeCta's 160deg gradient (#E7F2F1 -> #F5FAFA), softened.
      style={{ background: "linear-gradient(160deg, #EFF7F6 0%, #F9FCFC 100%)" }}
      aria-label="Featured tutors"
    >
      {/* Same three-part header treatment as HomeHowItWorks, centred. The
          bottom margin matches the section's top padding so the header sits
          optically centred above the first lane. Change one, change the other. */}
      <div className="max-w-6xl mx-auto px-6 flex flex-col items-center text-center mb-10 md:mb-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="font-hand text-[26px] mb-1.5"
          style={{ color: "var(--accent)", fontWeight: 400 }}
        >
          Featured tutors
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
          Meet your next tutor
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.1 }}
          className="text-[13px] sm:text-[15px] md:text-[16px] text-[color:var(--ink-muted)] mt-3 leading-[1.5] max-w-[520px]"
        >
          Every tutor here has had their ATAR, marks and identity checked by us.
        </motion.p>
      </div>

      {/* Phones: no marquee. The first five tutors stacked, a 1px rule between
          each (the list draws the rules, never the row). */}
      <ul className="md:hidden max-w-xl mx-auto px-5 divide-y divide-[color:var(--accent-line)]">
        {tutors.slice(0, STACK_COUNT).map((t) => (
          <li key={t.id ?? t.slug} className="py-4">
            <TutorRow tutor={t} variant="feature" />
          </li>
        ))}
      </ul>

      {/* md and up: the two marquee lanes. `hidden` below md also keeps the
          phone's tab order to the five stacked tutors. */}
      <div className="hidden md:flex flex-col gap-8">
        <MarqueeLane tutors={top} direction="right" duration={DURATION_TOP} />
        <MarqueeLane tutors={bottom} direction="left" duration={DURATION_BOTTOM} />
      </div>

      <div className="flex justify-center mt-6 md:mt-12 px-6">
        <BrowseAllTutorsLink tutorCount={tutorCount} />
      </div>
    </section>
  );
}

// "Browse all N tutors": the footer's link style (`.footer-link` in
// globals.css), muted teal with a colour change on hover, no underline or arrow.
function BrowseAllTutorsLink({ tutorCount }) {
  return (
    <Link href="/browse" className="footer-link text-[14px] font-medium whitespace-nowrap">
      Browse all{typeof tutorCount === "number" ? ` ${tutorCount}` : ""} tutors
    </Link>
  );
}

export default FeaturedTutors;
