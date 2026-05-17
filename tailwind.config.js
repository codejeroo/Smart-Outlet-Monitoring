export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1E293B",
        background: "#0F172A",
        accent: "#22C55E",
        textLight: "#F8FAFC",
      },
      fontFamily: {
        mono: ['"Fira Code"', 'monospace'],
        sans: ['"Fira Sans"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
