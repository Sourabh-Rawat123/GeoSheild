/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* EXISTING — KEEP */
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
        },

        risk: {
          "very-low": "#10b981",
          low: "#3b82f6",
          moderate: "#f59e0b",
          high: "#ef4444",
          severe: "#991b1b",
        },

        /* 🔥 NEW — GLASS SYSTEM */
        glass: "rgba(255,255,255,0.06)",
        glassBorder: "rgba(255,255,255,0.12)",
        darkBg: "#05080f",
        glowBlue: "#4fc3f7",
      },

      backdropBlur: {
        glass: "12px",
      },

      boxShadow: {
        card: "0 8px 32px rgba(0,0,0,0.6)",
        glow: "0 0 40px rgba(79,195,247,0.25)",
        glowStrong: "0 0 60px rgba(79,195,247,0.45)",
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },

      /* KEEP YOUR ANIMATIONS */
      keyframes: {
        float: {
          "0%": { transform: "translateY(0)", opacity: "0.3" },
          "50%": { opacity: "0.6" },
          "100%": { transform: "translateY(-140px)", opacity: "0" },
        },
      },

      animation: {
        float: "float linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-slow": "bounce 2s infinite",
      },
    },
  },
  plugins: [],
};
