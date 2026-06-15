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
import { YEAR_LEVELS, yearLabel } from "@/lib/yearLevels";
import { EASE_OUT, DURATION_MED, makeJiggleVariants } from "@/lib/motion";

// Search button hover: same jiggle wobble + accent halo language as TutorCard.
const searchButtonVariants = makeJiggleVariants(
  "0 0 28px rgba(94,122,90,0.38), 0 0 10px rgba(94,122,90,0.24)"
);

/**
 * Single-viewport hero: an animated "neural network" constellation fills the
 * whole hero behind the centered headline + search. The search wiring
 * (`goBrowse`) is unchanged.
 */
export function HomeHero({ catalog, schoolCatalog = [] }) {
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
      className="relative z-10 flex flex-col items-center justify-center text-center px-6"
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

      {/* Centered overlay — headline + search + trust pills. z-20 keeps the
          search dropdowns above the section-level scroll indicator (z-10). */}
      <div className="relative z-20 w-full flex flex-col items-center py-20">
          <div className="w-full max-w-[960px] mx-auto flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="mb-4 sm:mb-6 text-[12px] sm:text-[20px]"
              style={{ color: "var(--ink-muted)", letterSpacing: "0.01em" }}
            >
              Australia&apos;s No.1 Tutor Platform
            </motion.div>

            {/* Cursive graphite headline — writes itself in on view. */}
            <HandwrittenHeading
              as="h1"
              lines={["Find the perfect", "tutor for you"]}
              size={116}
              className="flex flex-col items-center"
            />

            <motion.p
              className="text-[13.5px] sm:text-[16.5px] md:text-[18px] text-[color:var(--ink-muted)] mt-5 sm:mt-7 leading-[1.5] sm:leading-[1.55] max-w-[300px] sm:max-w-[620px]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.4 }}
            >
              Fully verified private tutors and the leading tutoring companies. Authentic reviews, proven results, and a commitment to helping every student find the right match.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.6 }}
              className="relative z-30 mt-9 w-full hidden sm:grid grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1.15fr)_auto] md:grid-cols-[0.8fr_1.1fr_1.3fr_auto] items-stretch bg-[color:var(--paper-card)] max-w-[920px] hero-search-glow"
              style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-card)" }}
            >
              <SearchField
                icon="graduation"
                label="Year"
                placeholder="Year 12"
                options={YEAR_LEVELS.map((o) => ({ label: o.label, value: o.value }))}
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
                <motion.div
                  initial="rest"
                  animate="rest"
                  whileHover="hover"
                  variants={searchButtonVariants}
                  className="w-full"
                  style={{ borderRadius: 10, willChange: "transform, box-shadow" }}
                >
                  <Button variant="primary" size="lg" icon="search" onClick={goBrowse} full>
                    {/* Icon-only on phones so all three segments fit one row. */}
                    <span className="hidden sm:inline">Search</span>
                  </Button>
                </motion.div>
              </div>
            </motion.div>

            {/* Phones: the inline Year/Subject bar is hidden; a single centered
                "Search Now" button takes its place, routing to /browse. */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 1.6 }}
              className="mt-7 flex sm:hidden justify-center"
            >
              <motion.div
                initial="rest"
                animate="rest"
                whileHover="hover"
                variants={searchButtonVariants}
                style={{ borderRadius: 10, willChange: "transform, box-shadow" }}
              >
                <Button variant="primary" size="lg" icon="search" onClick={goBrowse}>
                  Search Now
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 1.9 }}
              className="mt-6 flex items-center justify-center gap-x-6 gap-y-2 flex-wrap text-[13px]"
              style={{ color: "var(--ink-muted)", letterSpacing: "0.01em" }}
            >
              <TrustPill>Verified ATARs and marks</TrustPill>
              <TrustPill>Completely free browsing</TrustPill>
              <TrustPill>Private and group tutoring</TrustPill>
              <TrustPill>In-person and Online</TrustPill>
            </motion.div>
          </div>
        </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT, delay: 2.2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 text-[color:var(--sage)] pointer-events-none"
      >
        <span className="text-[11px] uppercase tracking-[0.18em]">Scroll</span>
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <Icon name="chevron-down" size={16} />
        </motion.div>
      </motion.div>
    </section>
  );
}

function TrustPill({ children }) {
  return <span className="whitespace-nowrap">{children}</span>;
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
