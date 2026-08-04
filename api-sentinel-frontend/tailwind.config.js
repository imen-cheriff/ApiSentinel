/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // add these two blocks in here, alongside whatever's already there
      fontFamily: {
        display: ['"Space Grotesk"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      keyframes: {
        sweep: {
          "0%": { top: "-60px" },
          "100%": { top: "100%" },
        },
      },
    },
  },
  plugins: [],
};