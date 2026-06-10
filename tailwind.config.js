/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        hand: ["Caveat", "Inter", "cursive"],
      },
      colors: {
        // Botanical study-journal palette (mirrors the :root tokens in
        // globals.css so utilities and inline styles can share names).
        accent: {
          DEFAULT: "#5E7A5A", // eucalyptus
          hover: "#4C6549",
          soft: "#DCE3D0", // moss
          softer: "#EAEFE1",
          line: "#C7D2BA",
        },
        ink: {
          DEFAULT: "#2A3A2E", // deepest green
          muted: "#3D5440",
        },
        paper: {
          DEFAULT: "#F5F0E4", // warm page base
          card: "#FBF7EC",
        },
        desk: "#E9E2CF", // section surface behind cards
        stamp: "#B05E3B", // rusty ink-stamp accent
        // Override Tailwind's default cool `slate` ramp with warm, green-tinted
        // neutrals so every existing `text-slate-*` / `bg-slate-*` /
        // `border-slate-*` utility across the site reads on-brand without
        // touching each file. Light end → warm paper/desk; dark end → ink green.
        slate: {
          50: "#F5F0E4",
          100: "#E9E2CF",
          200: "#DDD6C4",
          300: "#C9C0A8",
          400: "#8DA17E",
          500: "#6E7D64",
          600: "#51604A",
          700: "#3D5440",
          800: "#33493A",
          900: "#2A3A2E",
          950: "#1E2A22",
        },
      },
      boxShadow: {
        "ring-accent": "0 0 0 3px rgba(94, 122, 90, 0.25)",
        "glow-accent": "0 0 0 4px rgba(94, 122, 90, 0.25)",
      },
    },
  },
  plugins: [],
};
