"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { SubjectPicker } from "@/components/SubjectPicker";
import { TypewriterOnView } from "@/components/anim/TypewriterOnView";
import { YEAR_LEVELS, yearLabel } from "@/lib/yearLevels";
import { EASE_OUT, DURATION_MED } from "@/lib/motion";

/**
 * catalog: exam-scoped subject catalog from getSubjects(). The picker is
 * exam-first; the form submits the selected slug as ?subject= so /browse
 * matches the URL contract.
 */
export function HomeHero({ catalog }) {
  const router = useRouter();
  const [year, setYear] = useState("");
  const [subject, setSubject] = useState(null);

  // Clause chaining: h1 line 1 → h1 line 2 → subtitle → search bar
  const [clause1Done, setClause1Done] = useState(false);
  const [clause2Done, setClause2Done] = useState(false);
  const [subtitleDone, setSubtitleDone] = useState(false);

  const goBrowse = () => {
    const params = new URLSearchParams();
    if (subject?.slug) params.append("subject", subject.slug);
    if (year !== "" && year != null) params.set("year", String(year));
    const qs = params.toString();
    router.push(`/browse${qs ? `?${qs}` : ""}`);
  };

  return (
    <section
      className="snap-section relative overflow-hidden"
      style={{
        background:
          "radial-gradient(55% 55% at 22% 28%, rgba(30,58,138,0.08) 0%, rgba(255,255,255,0) 100%), radial-gradient(35% 35% at 78% 72%, rgba(30,58,138,0.07) 0%, rgba(255,255,255,0) 100%), #ffffff",
      }}
    >
      {/* Faint editorial grid texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.04) 1px, transparent 1px)",
          backgroundSize: "120px 100%",
        }}
      />

      {/* Top-anchored content (no vertical centering) so the hero doesn't
          jitter when fonts/text reflow. The padding pushes it visually toward
          the optical center. */}
      <div className="relative max-w-[1200px] w-full mx-auto px-6 pt-[12vh] pb-24">
        <div className="max-w-[880px]">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="inline-flex items-center gap-2 mb-7 px-3 py-1.5"
            style={{
              borderRadius: 999,
              border: "1px solid var(--accent-line)",
              background: "var(--accent-softer)",
              color: "var(--accent)",
              fontSize: 12.5,
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "var(--accent)",
                boxShadow: "0 0 0 4px rgba(30,58,138,0.15)",
              }}
            />
            Australia&apos;s tutor directory, rebuilt.
          </motion.div>

          <h1
            className="font-display text-[52px] sm:text-[60px] md:text-[76px] leading-[1.02] text-slate-900"
            style={{ fontWeight: 500 }}
          >
            <TypewriterOnView
              text="Find a tutor who's"
              speed={26}
              start={true}
              onDone={() => setClause1Done(true)}
              as="span"
              className="block"
            />
            <TypewriterOnView
              text="been where you're going."
              speed={28}
              start={clause1Done}
              onDone={() => setClause2Done(true)}
              as="span"
              className="block italic accent-shine"
              style={{ color: "var(--accent)" }}
            />
          </h1>

          <p className="text-[16.5px] md:text-[18px] text-slate-600 mt-7 leading-[1.55] max-w-[600px]">
            <TypewriterOnView
              text="High school students across Australia are using matchtutor to work with the country's strongest recent graduates — verified ATARs, real reviews, no agency markup."
              speed={10}
              delay={250}
              cursor={false}
              start={clause2Done}
              onDone={() => setSubtitleDone(true)}
            />
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={subtitleDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.15 }}
            className="mt-10 grid grid-cols-1 md:grid-cols-[1fr_1.4fr_auto] items-stretch bg-white max-w-[760px] hero-search-glow"
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 16,
            }}
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
            <SubjectPicker
              catalog={catalog}
              value={subject?.slug ?? null}
              onChange={(slug, sub) => setSubject(slug ? { slug, name: sub?.name, exam: sub?.exam } : null)}
              mode="single"
              variant="bar"
              label="Subject"
              placeholder="Mathematics Extension 1"
            />
            <div className="px-2 md:px-1.5 flex items-center">
              <Button variant="primary" size="lg" icon="search" onClick={goBrowse} full>Search</Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={subtitleDone ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.35 }}
            className="mt-6 flex items-center gap-x-5 gap-y-2 flex-wrap text-[12.5px] text-slate-500"
          >
            <TrustPill>ATAR-verified tutors</TrustPill>
            <TrustPill>In-person &amp; online</TrustPill>
            <TrustPill>No agency markup</TrustPill>
            <TrustPill>No messaging fee</TrustPill>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator — anchored within the visible viewport (snap-section
          is sized to 100vh - nav-h, so bottom-6 sits safely above the fold). */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={subtitleDone ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.6 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-slate-400 pointer-events-none"
      >
        <span className="text-[11px] uppercase tracking-[0.18em]">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon name="chevron-down" size={16} />
        </motion.div>
      </motion.div>
    </section>
  );
}

function TrustPill({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: "var(--accent)",
          flexShrink: 0,
        }}
      />
      <span className="accent-shine" style={{ color: "var(--accent)" }}>{children}</span>
    </span>
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
    <div ref={wrapRef} className="relative border-r last:border-r-0" style={{ borderColor: "#E5E7EB" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 h-[64px] text-left transition-colors hover:bg-[color:var(--accent-softer)]"
      >
        <Icon name={icon} size={16} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider leading-none">{label}</div>
          <div className={"text-[14px] mt-1.5 truncate leading-none " + (shownText ? "text-slate-900" : "text-slate-400")}>
            {shownText || placeholder}
          </div>
        </div>
        <Icon name="chevron-down" size={14} className="text-slate-400 shrink-0" />
      </button>
      {open && options.length > 0 && (
        <div
          className="absolute left-2 right-2 top-full mt-2 z-40 bg-white max-h-[260px] overflow-y-auto"
          style={{ border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 10px 24px -8px rgba(15,23,42,0.12)" }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt)}
              className="w-full text-left px-3 py-2 text-[13.5px] text-slate-700 transition-colors"
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
