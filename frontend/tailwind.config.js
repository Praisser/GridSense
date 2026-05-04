/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Legacy aliases kept during component revamp — remove once all components
      // have been migrated to the @theme tokens in index.css
      colors: {
        primary: {
          DEFAULT: "#2563eb",
          dark: "#1d4ed8",
        },
      },
      borderRadius: {
        card:   "8px",
        btn:    "6px",
        pill:   "999px",
        modal:  "12px",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        micro:  "120",
        short:  "200",
        long:   "320",
      },
    },
  },
  plugins: [],
};
