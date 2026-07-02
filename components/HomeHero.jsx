"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { SubjectPicker } from "@/components/SubjectPicker";
import { SchoolPicker } from "@/components/SchoolPicker";
import { HandwrittenHeading } from "@/components/HandwrittenHeading";
import { ParticleNetwork } from "@/components/ParticleNetwork";
import { HeroTutorStack } from "@/components/HeroTutorStack";
import { YEAR_LEVELS_DESC, yearLabel } from "@/lib/yearLevels";
import { EASE_OUT, DURATION_MED } from "@/lib/motion";

/**
 * Single-viewport hero: an animated "neural network" constellation fills the
 * whole hero behind a two-column layout — headline + feature bullets on the
 * left, a stacked tutor-card carousel on the right — with a full-width search
 * bar pinned near the bottom. The search wiring (`goBrowse`) is unchanged.
 */
export function HomeHero({ catalog, schoolCatalog = [], showcaseTutors = [] }) {
  const router = useRouter();
  const [year, setYear] = useState("");
  const [school, setSchool] = useState(null);
  const [subject, setSubject] = useState(null);

  const goBrowse = () => {
    const params = new URLSearchParams();
    if (subject?.slug) params.append("subject", subject.slug);
    if (school?.slug) params.append("school", school.slug);
    if (year !== "" && year != null) params.set("year", String(year));
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
            {/* LEFT — eyebrow + handwritten headline + feature bullets. */}
            <div className="flex flex-col items-start text-left">
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
                className="mb-4 flex items-center gap-2"
              >
                <Icon name="leaf" size={16} className="text-[color:var(--sage)] shrink-0" />
                <span
                  className="uppercase text-[12px] sm:text-[13px] font-semibold"
                  style={{ color: "var(--ink-muted)", letterSpacing: "0.14em" }}
                >
                  Australia&apos;s No.1 Tutor Platform
                </span>
              </motion.div>

              {/* Cursive graphite headline — writes itself in on view. */}
              <HandwrittenHeading
                as="h1"
                lines={["Find the perfect", "tutor for you"]}
                size={96}
                className="flex flex-col items-start"
              />

              {/* Feature bullets — replace the old prose + trust pills. */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.4 }}
                className="mt-8 flex flex-col gap-4"
              >
                <FeatureBullet icon="check">Verified ATARs and marks</FeatureBullet>
                <FeatureBullet icon="leaf">Completely free browsing</FeatureBullet>
                <FeatureBullet icon="graduation">Private and group tutoring</FeatureBullet>
                <FeatureBullet icon="globe">In-person and Online</FeatureBullet>
              </motion.div>
            </div>

            {/* RIGHT — stacked tutor-card carousel (omitted when no verified
                tutors exist). On mobile this drops below the bullets. */}
            {showcaseTutors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.4 }}
                className="w-full flex justify-center lg:justify-end"
              >
                <HeroTutorStack tutors={showcaseTutors} />
              </motion.div>
            )}
          </div>
        </div>

        {/* Bottom region: full-width search bar. */}
        <div className="pb-8 lg:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.6 }}
            className="relative z-30 w-full hidden sm:grid grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1.15fr)_auto] md:grid-cols-[0.8fr_1.1fr_1.3fr_auto] items-stretch bg-[color:var(--paper-card)] max-w-[1200px] hero-search-glow"
            style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-card)" }}
          >
            <SearchField
              icon="graduation"
              label="Year"
              placeholder="Year 12"
              options={YEAR_LEVELS_DESC.map((o) => ({ label: o.label, value: o.value }))}
              value={year}
              displayValue={year !== "" ? yearLabel(year) : ""}
              onChange={setYear}
            />
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
              placeholder="Mathematics Extension 1"
            />
            <div className="px-1.5 sm:px-2 md:px-1.5 flex items-center">
              <div className="w-full">
                <Button variant="primary" size="lg" icon="search" onClick={goBrowse} full>
                  {/* Icon-only on phones so all three segments fit one row. */}
                  <span className="hidden sm:inline">Search</span>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Phones: the inline Year/Subject bar is hidden; a single centered
              "Search Now" button takes its place, routing to /browse. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.6 }}
            className="flex sm:hidden justify-center"
          >
            <Button variant="primary" size="lg" icon="search" onClick={goBrowse}>
              Search Now
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// One feature bullet: a circular sage-on-soft badge + label. Replaces the old
// centered "trust pill" row.
function FeatureBullet({ icon, children }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="w-9 h-9 rounded-full inline-flex items-center justify-center shrink-0"
        style={{ background: "var(--accent-softer)" }}
      >
        <Icon name={icon} size={18} className="text-[color:var(--sage)]" />
      </span>
      <span className="text-[15px] sm:text-[16px] font-medium" style={{ color: "var(--ink)" }}>
        {children}
      </span>
    </div>
  );
}

function SearchField({ icon, label, placeholder, value, onChange, options = [], displayValue }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const select = (opt) => {
    onChange && onChange(opt.value, opt.label);
    setOpen(false);
  };

  const shownText = displayValue ?? value;

  return (
    <div ref={wrapRef} className="relative border-r last:border-r-0" style={{ borderColor: "var(--line)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-[56px] sm:h-[64px] text-left transition-colors hover:bg-[color:var(--accent-softer)] rounded-l-[9px]"
      >
        <Icon name={icon} size={16} className="text-[color:var(--sage)] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-[11px] font-medium text-[color:var(--ink-muted)] uppercase tracking-wider leading-none">{label}</div>
          <div className={"text-[13px] sm:text-[14px] mt-1.5 truncate leading-none " + (shownText ? "text-[color:var(--ink)]" : "text-[color:var(--sage)]")}>
            {shownText || placeholder}
          </div>
        </div>
        <Icon name="chevron-down" size={14} className="text-[color:var(--sage)] shrink-0 hidden sm:block" />
      </button>
      {open && options.length > 0 && (
        <div
          className="absolute left-2 right-2 top-full mt-2 z-40 bg-[color:var(--paper-card)] max-h-[260px] overflow-y-auto overscroll-contain"
          style={{ border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 10px 24px -8px rgba(15,23,42,0.12)" }}
          data-lenis-prevent
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt)}
              className="w-full text-left px-3 py-2 text-[13.5px] text-[color:var(--ink-muted)] transition-colors"
              style={{ background: value === opt.value ? "var(--accent-softer)" : "transparent" }}
              onMouseEnter={(e) => { if (value !== opt.value) e.currentTarget.style.background = "var(--accent-softer)"; }}
              onMouseLeave={(e) => { if (value !== opt.value) e.currentTarget.style.background = "transparent"; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
