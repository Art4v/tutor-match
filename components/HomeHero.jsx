"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { SubjectPicker } from "@/components/SubjectPicker";
import { SchoolPicker } from "@/components/SchoolPicker";
import { TypewriterWord } from "@/components/TypewriterWord";
import { ParticleNetwork } from "@/components/ParticleNetwork";
import { EASE_OUT, DURATION_MED } from "@/lib/motion";

// Fixed word list for the cycling headline — hero copy, deliberately not tied
// to the DB subject catalog.
const TYPEWRITER_WORDS = [
  "Maths",
  "English",
  "Chemistry",
  "Physics",
  "Biology",
  "Art",
  "Music",
  "Languages",
  "History",
  "Geography",
];

/**
 * Hero at 90svh: an animated "neural network" constellation fills the
 * whole hero behind one centred column — eyebrow, headline, feature bullets,
 * search bar, scroll cue. The search wiring (`goBrowse`) filters by school +
 * subject.
 *
 * A stacked tutor-card carousel (`components/HeroTutorStack.jsx`) used to sit
 * in a right-hand column; it is shelved, not deleted. To restore it, pass
 * `showcaseTutors` from `app/page.js` again and re-add the column here.
 */
export function HomeHero({ catalog, schoolCatalog = [] }) {
  const router = useRouter();
  const [school, setSchool] = useState(null);
  const [subject, setSubject] = useState(null);

  const goBrowse = () => {
    const params = new URLSearchParams();
    if (subject?.slug) params.append("subject", subject.slug);
    if (school?.slug) params.append("school", school.slug);
    const qs = params.toString();
    router.push(`/browse${qs ? `?${qs}` : ""}`);
  };

  return (
    <section
      className="relative z-10 flex flex-col px-6"
      style={{
        minHeight: "90svh",
        marginTop: "calc(-1 * var(--nav-h))",
        background: "linear-gradient(180deg, var(--bg-soft) 0%, var(--paper) 78%)",
        borderBottom: "1px solid var(--line-soft)",
      }}
    >
      {/* Backdrop layers live in their own clip so the section can stay
          overflow-visible — that lets the search dropdowns spill below the
          hero and paint over the marquee (the section's z-10 beats it),
          while the constellation/leaves never bleed past the hero. */}
      <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
        {/* Neural-network constellation backdrop — fills the whole hero. */}
        <div className="absolute inset-0">
          <ParticleNetwork />
        </div>

        {/* Soft teal glow centred on the top edge, behind the constellation. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(1,103,100,0.07) 0%, rgba(1,103,100,0) 100%)" }}
        />

        {/* Slow-swaying botanical sprigs in the corners — a pressed-leaf accent
            that rocks a few degrees on a long, eased loop (see .leaf-sway).
            Drawn in the same faint-teal hairline language as the CTA's tree
            (accent at a low opacity, stroke 1.1) so they read as watermarks
            behind the constellation rather than competing with it. */}
        <div className="absolute left-4 sm:left-10 top-8 pointer-events-none leaf-sway hidden sm:block" style={{ color: "var(--accent)", opacity: 0.14 }}>
          <Icon name="sprig" size={132} strokeWidth={1.1} />
        </div>
        <div className="absolute right-4 sm:right-12 bottom-16 pointer-events-none leaf-sway hidden sm:block" style={{ color: "var(--accent)", opacity: 0.12, animationDelay: "-3s" }}>
          <Icon name="leaf" size={150} strokeWidth={1.1} />
        </div>
      </div>

      {/* Overlay — the centred content column. z-20 keeps the search dropdowns
          above the backdrop. */}
      <div className="relative z-20 flex-1 w-full max-w-[1200px] mx-auto flex flex-col">
        {/* Upper region: one centred column, vertically centred in the hero. */}
        <div className="flex-1 flex items-center py-16 lg:py-0">
          <div className="w-full flex justify-center">
            {/* Eyebrow + headline + search bar + trust bullets, centred at
                every breakpoint. Deliberately uncapped: the headline is two
                explicit lines and the search bar carries its own max-width, so
                the only element that wants the full 1200px is the bullet row,
                which must stay on one line. */}
            <div className="relative flex flex-col items-center text-center w-full">
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
                className="mb-4"
              >
                <span
                  className="uppercase text-[9px] sm:text-[12px] font-medium"
                  style={{ color: "var(--accent)", letterSpacing: "0.14em" }}
                >
                  Australia&apos;s Most Trusted Tutor Network
                </span>
              </motion.div>

              {/* Light General Sans headline; only the cycling subject word is
                  Caveat. `aria-label` carries the settled sentence so the
                  typewriter's churn never reaches screen readers. */}
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
                aria-label="Trust your next tutor"
                className="flex flex-col items-center"
                style={{
                  fontSize: "clamp(44px, 5vw, 68px)",
                  fontWeight: 300,
                  lineHeight: 1.08,
                  letterSpacing: "-0.025em",
                  color: "var(--ink-graphite)",
                }}
              >
                <span aria-hidden="true">Trust your next</span>
                <span aria-hidden="true">
                  <TypewriterWord
                    words={TYPEWRITER_WORDS}
                    className="font-hand"
                    style={{ fontSize: "1.14em" }}
                  />{" "}
                  tutor
                </span>
              </motion.h1>

              {/* Compact search bar (School · Subject · Search) — centred
                  directly beneath the headline. */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.35 }}
                className="relative z-30 mt-8 w-full max-w-[720px] mx-auto hidden sm:grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] items-stretch hero-search-glow"
                style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 13, padding: 5 }}
              >
                <SchoolPicker
                  catalog={schoolCatalog}
                  value={school?.slug ?? null}
                  onChange={(slug, s) => setSchool(slug ? { slug, name: s?.name } : null)}
                  mode="single"
                  variant="bar"
                  label="School"
                  placeholder="Any school"
                />
                <SubjectPicker
                  catalog={catalog}
                  value={subject?.slug ?? null}
                  onChange={(slug, sub) => setSubject(slug ? { slug, name: sub?.name, exam: sub?.exam } : null)}
                  mode="single"
                  variant="bar"
                  label="Subject"
                  placeholder="Any subject"
                />
                {/* Icon-only search button, inset from the bar's edge. */}
                <div className="px-1.5 flex items-center">
                  <Button variant="primary" size="md" onClick={goBrowse} full radius={14} ariaLabel="Search">
                    <Icon name="search" size={17} />
                  </Button>
                </div>
              </motion.div>

              {/* Phones: a single "Search Now" button routes to /browse. */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.35 }}
                className="mt-8 flex sm:hidden"
              >
                <Button variant="primary" size="lg" icon="search" onClick={goBrowse}>
                  Search Now
                </Button>
              </motion.div>

              {/* Feature bullets — one row at every width. Phones get the
                  four-column stacked variant (icon over a terse label), sm+ a
                  nowrap horizontal row. */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.5 }}
                className="mt-8 grid w-full grid-cols-4 gap-2 sm:mt-9 sm:flex sm:w-auto sm:flex-nowrap sm:justify-center sm:gap-x-5 lg:gap-x-8"
              >
                <FeatureBullet icon="check" short="Verified ATARs">Verified ATARs and marks</FeatureBullet>
                <FeatureBullet icon="shield" short="Free browsing">Completely free browsing</FeatureBullet>
                <FeatureBullet icon="graduation" short="Private & group">Private and group tutoring</FeatureBullet>
                <FeatureBullet icon="globe" short="In-person & online">In-person and Online</FeatureBullet>
              </motion.div>

            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue at the bottom of the hero viewport. z-10 sits above the
          backdrop but below the z-20 content overlay. */}
      <ScrollPrompt className="flex absolute bottom-6 left-1/2 -translate-x-1/2 z-10" />
    </section>
  );
}

// "Scroll" cue: label + bouncing chevron (restored from the pre-rework hero).
// Caller supplies the display class (`flex` / `hidden sm:flex`) + positioning.
function ScrollPrompt({ className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay: 1.1 }}
      className={`flex-col items-center gap-1.5 text-[color:var(--sage)] pointer-events-none ${className}`}
    >
      <span className="text-[11px] uppercase tracking-[0.18em]">Scroll</span>
      <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
        <Icon name="chevron-down" size={16} />
      </motion.div>
    </motion.div>
  );
}

// One trust bullet: a bare teal icon + label (no badge — the design calls for
// the icon to sit directly against the text). Phones stack the icon over the
// label so all four fit one grid row; sm+ is the icon-beside-text row.
//
// The row must never wrap, so the label shortens as space tightens: the terse
// `short` text up to lg, the full sentence only at lg+ where the four long
// labels actually fit side by side.
function FeatureBullet({ icon, short, children }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-2 sm:text-left">
      <span className="inline-flex items-center justify-center shrink-0" style={{ color: "var(--accent)" }}>
        <Icon name={icon} size={13} />
      </span>
      <span
        className="text-[10px] leading-tight font-medium sm:text-[12px] sm:font-normal sm:whitespace-nowrap lg:text-[13px]"
        style={{ color: "var(--ink)" }}
      >
        <span className="lg:hidden">{short ?? children}</span>
        <span className="hidden lg:inline">{children}</span>
      </span>
    </div>
  );
}
