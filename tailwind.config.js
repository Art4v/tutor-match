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
      },
      colors: {
        accent: {
          DEFAULT: "#152764",
          hover: "#0C1840",
          soft: "#DBEAFE",
          softer: "#EFF6FF",
          line: "#BFDBFE",
        },
      },
      boxShadow: {
        "ring-accent": "0 0 0 3px rgba(21, 39, 100, 0.22)",
        "glow-accent": "0 0 0 4px rgba(21, 39, 100, 0.22)",
      },
    },
  },
  plugins: [],
};
