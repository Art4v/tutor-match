"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { SubjectPicker } from "@/components/SubjectPicker";
import { SchoolPicker } from "@/components/SchoolPicker";
import { HandwrittenHeading } from "@/components/HandwrittenHeading";
import { TypewriterWord } from "@/components/TypewriterWord";
import { ParticleNetwork } from "@/components/ParticleNetwork";
import { HeroTutorStack } from "@/components/HeroTutorStack";
import { TutorCard } from "@/components/TutorCard";
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
 * Single-viewport hero: an animated "neural network" constellation fills the
 * whole hero behind a two-column layout — a compact headline + feature bullets
 * + search bar on the left, a stacked tutor-card carousel on the right. The
 * search wiring (`goBrowse`) filters by school + subject.
 */
export function HomeHero({ catalog, schoolCatalog = [], showcaseTutors = [], verifiedCount }) {
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
      style={{ minHeight: "100svh", marginTop: "calc(-1 * var(--nav-h))", background: "var(--paper)" }}
    >
      {/* Backdrop layers live in their own clip so the section can stay
          overflow-visible — that lets the search dropdowns spill below the
          hero and paint over the marquee (the section's z-10 beats it),
          while the constellation/grain/leaves never bleed past the hero. */}
      <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
        {/* Neural-network constellation backdrop — fills the whole hero. */}
        <div className="absolute inset-0">
          <ParticleNetwork />
        </div>

        {/* Faint paper grain for a sketched-page feel. */}
        <div className="absolute inset-0 pointer-events-none paper-grain opacity-[0.5]" />

        {/* Slow-swaying botanical sprigs in the corners — a pressed-leaf accent
            that rocks a few degrees on a long, eased loop (see .leaf-sway). */}
        <div className="absolute left-4 sm:left-10 top-8 pointer-events-none leaf-sway hidden sm:block" style={{ color: "var(--sage)", opacity: 0.35 }}>
          <Icon name="sprig" size={132} strokeWidth={1.3} />
        </div>
        <div className="absolute right-4 sm:right-12 bottom-16 pointer-events-none leaf-sway hidden sm:block" style={{ color: "var(--sage)", opacity: 0.28, animationDelay: "-3s" }}>
          <Icon name="leaf" size={150} strokeWidth={1.2} />
        </div>
      </div>

      {/* Overlay — two-column content up top, full-width search bar pinned near
          the bottom. z-20 keeps the search dropdowns above the backdrop. */}
      <div className="relative z-20 flex-1 w-full max-w-[1200px] mx-auto flex flex-col">
        {/* Upper region: bullets/headline left, tutor carousel right. */}
        <div className="flex-1 flex items-center py-16 lg:py-0">
          <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* LEFT — eyebrow + handwritten headline + feature bullets.
                Phones (<sm) centre everything and stretch to the first screen
                height (100svh minus the wrapper's py-16 top padding) so the
                text block owns the viewport and the cards sit below the fold;
                sm+ keeps the left alignment and natural height. */}
            <div className="relative flex flex-col items-center justify-center text-center min-h-[calc(100svh-4rem)] sm:min-h-0 sm:justify-start sm:items-start sm:text-left">
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
                className="mb-4"
              >
                <span
                  className="uppercase text-[9px] sm:text-[13px] font-semibold"
                  style={{ color: "var(--ink-muted)", letterSpacing: "0.14em" }}
                >
                  Australia&apos;s Most Trusted Tutor Network
                </span>
              </motion.div>

              {/* Cursive graphite headline — writes itself in on view, then a
                  sage subject word types/erases in front of "tutor"
                  (TypewriterWord waits out the clip-wipe via startDelay). */}
              <HandwrittenHeading
                as="h1"
                lines={[
                  "Trust your next",
                  {
                    label: "tutor",
                    content: (
                      <>
                        <TypewriterWord words={TYPEWRITER_WORDS} /> tutor
                      </>
                    ),
                  },
                ]}
                size={80}
                minSize={44}
                className="flex flex-col items-center sm:items-start"
              />

              {/* Feature bullets — replace the old prose + trust pills. */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.4 }}
                className="mt-6 grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto sm:flex-col sm:gap-2.5"
              >
                <FeatureBullet icon="check" short="Verified ATARs">Verified ATARs and marks</FeatureBullet>
                <FeatureBullet icon="leaf" short="Free browsing">Completely free browsing</FeatureBullet>
                <FeatureBullet icon="graduation" short="Private & group">Private and group tutoring</FeatureBullet>
                <FeatureBullet icon="globe" short="In-person & online">In-person and Online</FeatureBullet>
              </motion.div>

              {/* Compact search bar (School · Subject · Search) — sits within the
                  left column beneath the bullets. */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.6 }}
                className="relative z-30 mt-7 w-full max-w-[560px] hidden sm:grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] items-stretch bg-[color:var(--paper-card)] hero-search-glow"
                style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-card)" }}
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
                <div className="px-1.5 flex items-center">
                  <Button variant="primary" size="lg" onClick={goBrowse} full radius={16} ariaLabel="Search">
                    <Icon name="search" size={18} />
                  </Button>
                </div>
              </motion.div>

              {/* Phones: a single "Search Now" button routes to /browse. */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.6 }}
                className="mt-6 flex sm:hidden"
              >
                <Button variant="primary" size="lg" icon="search" onClick={goBrowse}>
                  Search Now
                </Button>
              </motion.div>

              {/* Phones: scroll cue pinned to the bottom of the first-screen
                  text column (the column ends exactly at the fold). */}
              <ScrollPrompt className="flex sm:hidden absolute bottom-8 left-1/2 -translate-x-1/2" />
            </div>

            {/* RIGHT — stacked tutor-card carousel (omitted when no verified
                tutors exist). Phones (<sm) swap the carousel for three plain
                cards in normal page flow, so you scroll past them to the
                "See all" link; sm+ is unchanged. */}
            {showcaseTutors.length > 0 && (
              <>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.4 }}
                  className="w-full hidden sm:flex justify-center"
                >
                  {/* The stack is the only element in the centering flow (the link
                      is absolutely positioned below it), so the card's vertical
                      centre lines up with the left column's text. The lg nudge
                      re-centres it visually within the right column. */}
                  <div className="relative w-full max-w-[460px] lg:translate-x-8">
                    <HeroTutorStack tutors={showcaseTutors} />
                    <SeeAllTutorsLink
                      verifiedCount={verifiedCount}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-5"
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.4 }}
                  className="sm:hidden w-full max-w-[340px] mx-auto flex flex-col gap-6"
                >
                  {showcaseTutors.slice(0, 3).map((tutor) => (
                    <TutorCard key={tutor.id ?? tutor.slug} tutor={tutor} />
                  ))}
                  <div className="flex justify-center">
                    {/* `relative` anchors the underline span (desktop's variant
                        is `absolute`, which does the same job there). */}
                    <SeeAllTutorsLink verifiedCount={verifiedCount} className="relative" />
                  </div>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* sm+ (tablet/desktop): scroll cue at the bottom of the hero viewport.
          z-10 sits above the backdrop but below the z-20 content overlay. */}
      <ScrollPrompt className="hidden sm:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-10" />
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
      transition={{ duration: 0.6, ease: EASE_OUT, delay: 2.2 }}
      className={`flex-col items-center gap-1.5 text-[color:var(--sage)] pointer-events-none ${className}`}
    >
      <span className="text-[11px] uppercase tracking-[0.18em]">Scroll</span>
      <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
        <Icon name="chevron-down" size={16} />
      </motion.div>
    </motion.div>
  );
}

// "See all N verified tutors" link with the animated underline. Positioning is
// the caller's job: desktop hangs it off the carousel absolutely, phones drop
// it in flow under the card list.
function SeeAllTutorsLink({ verifiedCount, className = "" }) {
  return (
    <Link
      href="/browse"
      className={`group inline-flex items-center gap-2 text-[14px] font-medium whitespace-nowrap ${className}`}
      style={{ color: "var(--accent)" }}
    >
      See all{typeof verifiedCount === "number" ? ` ${verifiedCount}` : ""} verified tutors
      <Icon name="arrow-right" size={14} />
      <span
        aria-hidden="true"
        className="absolute left-0 right-[24px] -bottom-0.5 h-px origin-left scale-x-0 group-hover:scale-x-100"
        style={{ background: "var(--accent)", transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)" }}
      />
    </Link>
  );
}

// One feature bullet: a circular sage-on-soft badge + label. On phones the four
// render as an app-store-style strip — badge on top, tiny label under (`short`
// text); sm+ keeps the icon-beside-text row.
function FeatureBullet({ icon, short, children }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-2.5 sm:text-left">
      <span
        className="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0"
        style={{ background: "var(--accent-softer)" }}
      >
        <Icon name={icon} size={16} className="text-[color:var(--sage)]" />
      </span>
      <span className="text-[11px] leading-tight sm:text-[15px] font-medium" style={{ color: "var(--ink)" }}>
        <span className="sm:hidden">{short ?? children}</span>
        <span className="hidden sm:inline">{children}</span>
      </span>
    </div>
  );
}
