"use client";

/**
 * Seamless marquee of top NSW + VIC high schools, the social proof strip
 * between the hero and "How it works". Pure presentation: static lists scrolled
 * with a CSS keyframe (two identical halves, translateX -50%), edge fades via
 * `.marquee-mask`, paused under reduced-motion (see globals.css). Two rows
 * under the one heading: NSW scrolls left, VIC scrolls right
 * (`.marquee-track--reverse`).
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

// Top 10 Victorian schools by 2025 VCE performance (% of study scores 40+).
const VIC_SCHOOLS = [
  { name: "Ballarat Clarendon College", short: "Ballarat Clarendon College", logo: "/images/marquee/ballarat-clarendon.png" },
  { name: "Mac.Robertson Girls' High School", short: "Mac.Robertson Girls HS", logo: "/images/marquee/macrobertson-girls.png" },
  { name: "Bacchus Marsh Grammar", short: "Bacchus Marsh Grammar", logo: "/images/marquee/bacchus-marsh-grammar.svg" },
  { name: "Nossal High School", short: "Nossal HS", logo: "/images/marquee/nossal.png" },
  { name: "Haileybury", short: "Haileybury", logo: "/images/marquee/haileybury.svg" },
  { name: "Ruyton Girls' School", short: "Ruyton Girls' School", logo: "/images/marquee/ruyton-girls.svg" },
  { name: "Melbourne Girls Grammar", short: "Melbourne Girls Grammar", logo: "/images/marquee/melbourne-girls-grammar.png" },
  { name: "Melbourne High School", short: "Melbourne HS", logo: "/images/marquee/melbourne-high.png" },
  { name: "Melbourne Grammar School", short: "Melbourne Grammar", logo: "/images/marquee/melbourne-grammar.png" },
  { name: "Huntingtower School", short: "Huntingtower", logo: "/images/marquee/huntingtower.png" },
];

function Half({ schools, ariaHidden }) {
  return (
    <div className="flex items-center shrink-0" aria-hidden={ariaHidden}>
      {schools.map(({ name, short, logo }) => (
        <span key={name} className="flex items-center shrink-0">
          <span className="flex items-center gap-3.5 px-8">
            {logo && (
              // Fixed box + object-contain so every crest occupies an identical
              // footprint regardless of its native aspect ratio. Desaturated so
              // 25 different crest palettes read as one calm band.
              <span
                className="flex items-center justify-center shrink-0"
                style={{ width: 48, height: 48 }}
              >
                <img
                  src={logo}
                  alt={`${name} crest`}
                  loading="lazy"
                  draggable={false}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: "grayscale(1)", opacity: 0.65 }}
                />
              </span>
            )}
            <span
              className="text-[14px] font-medium whitespace-nowrap"
              style={{ color: "#5E7A78" }}
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
      style={{ background: "var(--desk-deep)", borderColor: "var(--line-soft)", padding: "48px 0" }}
      aria-label="Schools our students come from"
    >
      <div className="w-full px-6 pb-6 text-center">
        <span
          className="text-[13px] font-medium uppercase"
          style={{ color: "var(--sage)", letterSpacing: "0.1em" }}
        >
          Trusted tutors from
        </span>
      </div>
      <div className="marquee-mask overflow-hidden">
        <div className="marquee-track">
          <Half schools={SCHOOLS} />
          <Half schools={SCHOOLS} ariaHidden />
        </div>
      </div>
      {/* 22px between the two counter-scrolling rows. */}
      <div className="marquee-mask overflow-hidden" style={{ marginTop: 22 }}>
        <div className="marquee-track marquee-track--reverse">
          <Half schools={VIC_SCHOOLS} />
          <Half schools={VIC_SCHOOLS} ariaHidden />
        </div>
      </div>
    </section>
  );
}

export default SchoolsMarquee;
