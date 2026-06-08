"use client";

/**
 * Seamless marquee of top Sydney selective high schools — social proof strip
 * between the hero and the featured tutors. Pure presentation: a static list
 * scrolled with a CSS keyframe (two identical halves, translateX -50%), edge
 * fades via `.marquee-mask`, paused under reduced-motion (see globals.css).
 */
const SCHOOLS = [
  "James Ruse Agricultural High School",
  "North Sydney Boys High School",
  "North Sydney Girls High School",
  "Sydney Boys High School",
  "Sydney Girls High School",
  "Baulkham Hills High School",
  "Hornsby Girls High School",
  "Normanhurst Boys High School",
  "Fort Street High School",
  "Girraween High School",
  "Penrith High School",
  "Caringbah High School",
  "St George Girls High School",
  "Hurlstone Agricultural High School",
];

function Half({ ariaHidden }) {
  return (
    <div className="flex items-center shrink-0" aria-hidden={ariaHidden}>
      {SCHOOLS.map((name) => (
        <span key={name} className="flex items-center shrink-0">
          <span
            className="px-7 text-[14.5px] font-medium whitespace-nowrap"
            style={{ color: "var(--ink-graphite)" }}
          >
            {name}
          </span>
          <span
            aria-hidden="true"
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: "var(--accent)",
              flexShrink: 0,
            }}
          />
        </span>
      ))}
    </div>
  );
}

export function SchoolsMarquee() {
  return (
    <section
      className="bg-white border-y"
      style={{ borderColor: "var(--line)" }}
      aria-label="Schools our students come from"
    >
      <div className="max-w-[1200px] mx-auto px-6 pt-8 pb-2 text-center">
        <span
          className="font-hand text-[22px]"
          style={{ color: "var(--ink-graphite)" }}
        >
          Trusted by students from
        </span>
      </div>
      <div className="marquee-mask overflow-hidden py-5">
        <div className="marquee-track">
          <Half />
          <Half ariaHidden />
        </div>
      </div>
    </section>
  );
}

export default SchoolsMarquee;
