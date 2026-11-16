/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f0ff",
          100: "#e9e5ff",
          200: "#d6cdff",
          300: "#b7a6ff",
          400: "#9b80ff",
          500: "#7c5cff",
          600: "#6a45f5",
          700: "#5a35dc",
          800: "#4a28b8",
          900: "#331a7a",
        },
        cyan: {
          glow: "#22d3ee",
        },
        ink: {
          900: "#0a0c14",
          850: "#0d1120",
          800: "#121728",
          700: "#1a2138",
          600: "#242c47",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro Display",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(124,92,255,0.25), 0 8px 30px rgba(124,92,255,0.15)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px rgba(2,4,12,0.45)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #7c5cff 0%, #6a45f5 45%, #22d3ee 120%)",
        "bg-aurora":
          "radial-gradient(1200px 600px at 15% -10%, rgba(124,92,255,0.18), transparent 55%), radial-gradient(1000px 500px at 90% 0%, rgba(34,211,238,0.12), transparent 55%)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "grow-x": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "grow-x": "grow-x 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};
