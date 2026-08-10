/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    // There was a "./content/**" glob here while article bodies were JSX files.
    // Bodies are jsonb rows now (0061) and Tailwind cannot scan a database, so
    // every class an article body renders MUST appear as a literal string in
    // app/blog/[slug]/ArticleBody.jsx. That is why spacing there is applied
    // mechanically by the renderer rather than stored per node: a className
    // living only in jsonb would never be generated, and the copy would render
    // unstyled with no build error to warn you.
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["General Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["General Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        hand: ["Caveat", "General Sans", "cursive"],
      },
      colors: {
        // Cool teal-on-white palette (mirrors the :root tokens in globals.css so
        // utilities and inline styles can share names).
        accent: {
          DEFAULT: "#016764", // teal
          hover: "#005958",
          soft: "#E9F3F2",
          softer: "#F3F8F8",
          line: "#CCE2E0",
        },
        ink: {
          DEFAULT: "#001E1E", // near-black teal
          muted: "#33514F",
        },
        paper: {
          DEFAULT: "#FFFFFF", // white page base
          card: "#FFFFFF",
        },
        desk: "#F7FBFB", // section surface behind cards
        line: {
          soft: "#EEF2F2", // lighter hairline: hero base, search bar, marquee band
        },
        pill: {
          DEFAULT: "#F0F6F6", // subject-pill fill
          ink: "#015F5C", // subject-pill text
        },
        chip: {
          line: "#DDE9E8", // accent-tone chip / stat-tile border
        },
        stamp: "#016764", // retired rust accent — folded into teal
        // Override Tailwind's default `slate` ramp with cool, teal-tinted
        // neutrals so every existing `text-slate-*` / `bg-slate-*` /
        // `border-slate-*` utility across the site reads on-brand without
        // touching each file. Light end → white/teal-tint; dark end → teal ink.
        slate: {
          50: "#F7FBFB",
          100: "#F0F6F6",
          200: "#E3EAEA",
          300: "#CCE2E0",
          400: "#8FA9A7",
          500: "#6B8A88",
          600: "#4E6E6C",
          700: "#33514F",
          800: "#014848",
          900: "#012E2D",
          950: "#001E1E",
        },
      },
      boxShadow: {
        "ring-accent": "0 0 0 3px rgba(1, 103, 100, 0.15)",
        "glow-accent": "0 0 0 4px rgba(1, 103, 100, 0.15)",
      },
    },
  },
  plugins: [],
};
