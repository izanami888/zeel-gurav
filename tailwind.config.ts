import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./games/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Монгол сэдэвт өнгөний палит: гүн хөх + алт
        mongol: {
          blue: "#0B1F3A",
          "blue-light": "#13315C",
          gold: "#D4AF37",
          "gold-light": "#F1D57A",
        },
      },
      keyframes: {
        // "Чулуу таалцах": гар нээгдэх, чулуу гарч ирэх хөдөлгөөн.
        "fist-open": {
          "0%": { transform: "scale(0.5) rotate(-25deg)", opacity: "0" },
          "60%": { transform: "scale(1.2) rotate(6deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "fist-shake": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-10deg)" },
          "75%": { transform: "rotate(10deg)" },
        },
        "stone-pop": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "70%": { transform: "scale(1.3)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fist-open": "fist-open 0.5s ease-out both",
        "fist-shake": "fist-shake 0.35s ease-in-out 2",
        "stone-pop": "stone-pop 0.35s ease-out both",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
