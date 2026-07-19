"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { TutorCard } from "@/components/TutorCard";
import { EASE_OUT, DURATION_MED } from "@/lib/motion";

/**
 * Featured tutors: two full-bleed rows of real tutor cards scrolling in
 * opposite directions (top row rightward, bottom leftward), between the schools
 * strip and "How it works". Replaces the shelved hero carousel.
 *
 * The cards are live — each is the same `TutorCard` /browse renders, so the
 * link, the bookmark and the verified tick all work. Hovering a row pauses it
 * (see `.marquee-row` in globals.css) so a moving card is still clickable.
 */

// Cards per row. The caller sends up to 12 verified tutors; a shorter list is
// repeated within its own row to reach this, so a row is never visibly short.
const PER_ROW = 6;

// Card geometry lives as literal Tailwind classes at the point of use — the JIT
// scans source statically and can't see a class built from a variable — so the
// numbers are recorded here instead of as constants.
//
//   width        w-[340px]   md:w-[620px]
//   spacing      mr-4        md:mr-6
//   md scale     (none)      md:scale-[0.85]     -> md:w-[117.65%] (= 1/0.85)
//   row height   h-[166px]   md:h-[240px]
//
// The row height is TutorCard's own height, scaled, PLUS room for its shadow.
// The card is its body band's min-height plus the subject strip plus 2px of
// border, and the strip is md-only (TutorCard.js:422), which is why the two
// breakpoints differ by more than the body band alone does:
//   phone  140 (min-h-[140px])         + 2 = 142, unscaled
//   md     200 (md:min-h-[200px]) + 56 + 2 = 258, x 0.85 = 219
//
// The row clips (it has to, for the marquee), and TutorCard's resting shadow is
// `0 18px 44px -20px` — it reaches roughly 20px BELOW the card and nothing
// above. At exactly the card height the clip would slice every shadow off in a
// straight line, so each row carries ~22px of extra bottom room; the track is
// `items-start`, so that surplus all lands under the cards where the shadow is.
// That built-in room is also why the two rows sit flush (no gap class) and
// still read as separated.
// If TutorCard's band, strip or shadow changes, re-derive these.

// Different durations so the two rows never settle into a visible lockstep.
const DURATION_TOP = "62s";
const DURATION_BOTTOM = "74s";

// Repeat `list` until it holds `n` items. A pool of 2 verified tutors becomes
// [a, b, a, b, a, b] rather than a two-card row that wraps every few seconds.
function fill(list, n) {
  if (!list.length) return [];
  const out = [];
  while (out.length < n) out.push(list[out.length % list.length]);
  return out;
}

// One row: a clipped viewport with a mask fade at each edge, a scale wrapper,
// and the animated track. The track renders the row TWICE — the keyframes
// translate exactly 50%, which is one copy, so the loop has no seam.
//
// The card spacing is a right MARGIN on each card, never a flex `gap`. With a
// gap, the track measures 2W + one extra gap between the copies, so a 50%
// translate lands half a gap off and the wrap visibly jumps. A trailing margin
// folds the spacing into each copy, making the two exactly equal.
function MarqueeRow({ tutors, direction, duration }) {
  const cards = (key, tabIndex) =>
    tutors.map((tutor, i) => (
      <div
        key={`${key}-${tutor.id ?? tutor.slug}-${i}`}
        className="shrink-0 w-[340px] md:w-[620px] mr-4 md:mr-6"
      >
        <TutorCard tutor={tutor} tabIndex={tabIndex} />
      </div>
    ));

  return (
    // A transform doesn't affect layout size, so the scaled track would
    // otherwise reserve its FULL height and leave a bare strip underneath. The
    // viewport pins the SCALED height instead. Phones aren't scaled, so they
    // get the raw card height.
    // No edge mask: cards run hard to both viewport edges and are cut off
    // mid-card, which is what sells "there are more of these".
    <div className="marquee-row relative w-full overflow-hidden h-[166px] md:h-[240px]">
      {/* Scaled at md+ only. The width grows by 1/scale so the shrunk track
          still spans the full viewport rather than stopping short of the right
          edge. */}
      <div className="origin-top-left md:scale-[0.85] md:w-[117.65%]">
        <div
          className="marquee-track flex items-start w-max"
          style={{
            animationName: direction === "right" ? "marquee-right" : "marquee-left",
            "--marquee-duration": duration,
          }}
        >
          <div className="flex items-start">{cards("a", 0)}</div>
          {/* The second copy exists only to make the wrap seamless. It's hidden
              from assistive tech and its cards are given tabIndex -1, so a
              keyboard user meets each tutor once.
              NOT `inert`: inert also kills pointer events, and over a full cycle
              BOTH copies pass through the viewport — the right-moving row starts
              at -50%, which is copy B — so an inert copy makes the row
              unclickable for most of its loop. tabIndex -1 keeps the mouse
              working while staying out of the tab order. */}
          <div className="flex items-start" aria-hidden="true">
            {cards("b", -1)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturedTutors({ tutors = [], verifiedCount }) {
  if (!tutors.length) return null;

  // Alternate by index so both rows carry a comparable slice of the ranking
  // rather than the top half landing entirely on the first row.
  const top = fill(tutors.filter((_, i) => i % 2 === 0), PER_ROW);
  const bottom = fill(tutors.filter((_, i) => i % 2 === 1), PER_ROW);

  return (
    // Solid dark green (--ink-graphite-deep, the same deep teal family as the
    // footer). The white cards read as lit objects on it, which is the point of
    // the band. Every text colour in here is therefore an inverted one (light on
    // dark) rather than the usual ink tokens — see the notes at each. The white
    // page above and below does the separating, so no border.
    <section
      className="relative overflow-hidden pt-10 pb-10 md:pt-12 md:pb-12"
      style={{ background: "var(--ink-graphite-deep)" }}
      aria-label="Featured tutors"
    >
      {/* Same three-part header treatment as HomeHowItWorks, centred and
          inverted for the dark green. The bottom margin deliberately MATCHES the
          section's top padding, so the header block sits optically centred
          between the top of the band and the top of the first card row. Change
          one and change the other. */}
      <div className="max-w-6xl mx-auto px-6 flex flex-col items-center text-center mb-10 md:mb-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="font-hand text-[26px] mb-1.5"
          // The eyebrow is normally --accent; on the green that would vanish,
          // so it takes the pale accent tint instead.
          style={{ color: "var(--accent-soft)", fontWeight: 400 }}
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
            // Inverted from --ink-graphite. Stays weight 300 — the brand has no
            // bold, and light type holds up fine at this size on the green.
            color: "#FFFFFF",
          }}
        >
          Meet your next tutor
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.1 }}
          className="text-[13px] sm:text-[15px] md:text-[16px] mt-3 leading-[1.5] max-w-[520px]"
          // Inverted from --ink-muted: white held back so it sits under the
          // heading rather than competing with it.
          style={{ color: "rgba(255,255,255,0.78)" }}
        >
          Every tutor here has had their ATAR, marks and identity checked by us.
        </motion.p>
      </div>

      {/* No gap class: each row already reserves ~22px of shadow room below its
          cards, which is the separation. */}
      <div className="flex flex-col">
        <MarqueeRow tutors={top} direction="right" duration={DURATION_TOP} />
        <MarqueeRow tutors={bottom} direction="left" duration={DURATION_BOTTOM} />
      </div>

      <div className="flex justify-center mt-5 md:mt-6 px-6">
        <BrowseAllTutorsLink verifiedCount={verifiedCount} />
      </div>
    </section>
  );
}

// "Browse all N verified tutors" link with the animated underline — the same
// control
// that used to sit under the hero carousel, inverted to white for the green
// band. `relative` anchors the underline span to the link itself.
function BrowseAllTutorsLink({ verifiedCount }) {
  return (
    <Link
      href="/browse"
      className="group relative inline-flex items-center gap-2 text-[14px] font-medium whitespace-nowrap"
      style={{ color: "#FFFFFF" }}
    >
      Browse all{typeof verifiedCount === "number" ? ` ${verifiedCount}` : ""} verified tutors
      {/* No trailing arrow, so the underline runs the full width of the label
          (the original reserved right-[24px] for the icon). */}
      <span
        aria-hidden="true"
        className="absolute left-0 right-0 -bottom-0.5 h-px origin-left scale-x-0 group-hover:scale-x-100"
        style={{ background: "#FFFFFF", transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)" }}
      />
    </Link>
  );
}

export default FeaturedTutors;
