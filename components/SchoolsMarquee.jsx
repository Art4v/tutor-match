"use client";

/**
 * Seamless marquee of top Sydney selective high schools — social proof strip
 * between the hero and the featured tutors. Pure presentation: a static list
 * scrolled with a CSS keyframe (two identical halves, translateX -50%), edge
 * fades via `.marquee-mask`, paused under reduced-motion (see globals.css).
 */
// `name` is the full school name (used for the image `alt`); `short` is the
// compact display label; `logo` is the crest under /public/images/marquee
// (sourced from each school's Wikipedia infobox). A null `logo` falls back to
// text only, so the strip never breaks if a crest is ever missing.
const SCHOOLS = [
  { name: "James Ruse Agricultural High School", short: "James Ruse Agricultural HS", logo: "/images/marquee/james-ruse.png" },
  { name: "North Sydney Boys High School", short: "North Sydney Boys HS", logo: "/images/marquee/north-sydney-boys.jpg" },
  { name: "North Sydney Girls High School", short: "North Sydney Girls HS", logo: "/images/marquee/north-sydney-girls.png" },
  { name: "Sydney Boys High School", short: "Sydney Boys HS", logo: "/images/marquee/sydney-boys.svg" },
  { name: "Sydney Girls High School", short: "Sydney Girls HS", logo: "/images/marquee/sydney-girls.png" },
  { name: "Baulkham Hills High School", short: "Baulkham Hills HS", logo: "/images/marquee/baulkham-hills.png" },
  { name: "Hornsby Girls High School", short: "Hornsby Girls HS", logo: "/images/marquee/hornsby-girls.png" },
  { name: "Normanhurst Boys High School", short: "Normanhurst Boys HS", logo: "/images/marquee/normanhurst-boys.png" },
  { name: "Fort Street High School", short: "Fort Street HS", logo: "/images/marquee/fort-street.png" },
  { name: "Girraween High School", short: "Girraween HS", logo: "/images/marquee/girraween.png" },
  { name: "Penrith High School", short: "Penrith HS", logo: "/images/marquee/penrith.png" },
  { name: "St George Girls High School", short: "St George Girls HS", logo: "/images/marquee/st-george-girls.png" },
  { name: "Hurlstone Agricultural High School", short: "Hurlstone Agricultural HS", logo: "/images/marquee/hurlstone.png" },
  { name: "Sydney Grammar School", short: "Sydney Grammar", logo: "/images/marquee/sydney-grammar.png" },
  { name: "Abbotsleigh", short: "Abbotsleigh", logo: "/images/marquee/abbotsleigh.png" },
];

function Half({ ariaHidden }) {
  return (
    <div className="flex items-center shrink-0" aria-hidden={ariaHidden}>
      {SCHOOLS.map(({ name, short, logo }) => (
        <span key={name} className="flex items-center shrink-0">
          <span className="flex items-center gap-3.5 px-8">
            {logo && (
              // Fixed box + object-contain so every crest occupies an identical
              // footprint regardless of its native aspect ratio.
              <span
                className="flex items-center justify-center shrink-0"
                style={{ width: 58, height: 58 }}
              >
                <img
                  src={logo}
                  alt={`${name} crest`}
                  loading="lazy"
                  draggable={false}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                />
              </span>
            )}
            <span
              className="text-[15px] font-medium whitespace-nowrap"
              style={{ color: "var(--ink-graphite)" }}
            >
              {short || name}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

export function SchoolsMarquee() {
  return (
    <section
      className="border-y flex flex-col justify-center"
      style={{ background: "var(--paper-card)", borderColor: "var(--paper-line)", minHeight: "20vh" }}
      aria-label="Schools our students come from"
    >
      <div className="w-full px-6 pb-4 text-center">
        <span
          className="font-hand text-[22px]"
          style={{ color: "var(--ink-graphite)" }}
        >
          Trusted tutors from
        </span>
      </div>
      <div className="marquee-mask overflow-hidden py-4">
        <div className="marquee-track">
          <Half />
          <Half ariaHidden />
        </div>
      </div>
    </section>
  );
}

export default SchoolsMarquee;
