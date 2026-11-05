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
        sans: ["Source Sans 3", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Source Sans 3", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      // Transitional (Phase 3): DESIGN.md allows only 400 and 600. Existing
      // screens still say `font-light` (headings) and `font-medium` (labels,
      // buttons); mapping them here gives the right weights before each screen
      // is rebuilt. Delete these two lines once neither class is used.
      fontWeight: {
        light: "400",
        medium: "600",
      },
      colors: {
        // DESIGN.md tokens. Every value is a CSS variable from app/globals.css,
        // so the hex lives in exactly one place. (No theme colour is used with an
        // opacity modifier such as `bg-accent/50`, which variables would break.)
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)", // legacy name, now --surface-2
          softer: "var(--accent-softer)", // legacy name, now --surface-2
          line: "var(--accent-line)", // legacy name, now --rule
        },
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        rule: "var(--rule)",
        muted: "var(--muted)",
        placeholder: "var(--placeholder)",
        input: "var(--border-input)",
        error: "var(--error)",
        warning: "var(--warning)",
        success: "var(--success)",
        // Legacy names still used by un-rebuilt screens (see globals.css).
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
        },
        paper: {
          DEFAULT: "var(--paper)",
          card: "var(--paper-card)",
        },
        desk: "var(--desk)",
        line: {
          soft: "var(--line-soft)",
        },
        pill: {
          DEFAULT: "var(--pill)",
          ink: "var(--pill-ink)",
        },
        chip: {
          line: "var(--chip-line)",
        },
        stamp: "var(--stamp)",
        // Override Tailwind's `slate` ramp with NEUTRAL greys (DESIGN.md: no hue in
        // neutrals), so every existing `text-slate-*` / `bg-slate-*` /
        // `border-slate-*` utility follows without touching each file. 400 and up
        // pass 4.5:1 on white, since several screens use slate-400 for text.
        slate: {
          50: "#FAFAFA",
          100: "#F5F5F5",
          200: "#E3E3E3",
          300: "#CFCFCF",
          400: "#707070",
          500: "#666666",
          600: "#4A4A4A",
          700: "#3A3A3A",
          800: "#1A1A1A",
          900: "#141414",
          950: "#0A0A0A",
        },
      },
      boxShadow: {
        float: "var(--shadow-float)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
    },
  },
  plugins: [],
};
