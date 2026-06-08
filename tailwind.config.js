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
        accent: {
          DEFAULT: "#6E7A55",
          hover: "#565F41",
          soft: "#DCE3CB",
          softer: "#EEF1E7",
          line: "#CDD5BC",
        },
      },
      boxShadow: {
        "ring-accent": "0 0 0 3px rgba(110, 122, 85, 0.25)",
        "glow-accent": "0 0 0 4px rgba(110, 122, 85, 0.25)",
      },
    },
  },
  plugins: [],
};
