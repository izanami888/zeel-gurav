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
        // "Морь уралдуулах": шагай хаях, буух, морь харайх, дөрвөн бэрхийн баяр.
        "shagai-toss": {
          "0%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-16px) rotate(180deg)" },
          "100%": { transform: "translateY(0) rotate(360deg)" },
        },
        "shagai-land": {
          "0%": { transform: "translateY(-14px) scale(0.6) rotate(-18deg)", opacity: "0" },
          "70%": { transform: "translateY(2px) scale(1.08) rotate(4deg)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1) rotate(0deg)", opacity: "1" },
        },
        "horse-hop": {
          "0%, 100%": { transform: "translateY(0)" },
          "45%": { transform: "translateY(-7px)" },
        },
        "berkh-fade": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "berkh-pop": {
          "0%": { transform: "scale(0.3) rotate(-8deg)", opacity: "0" },
          "55%": { transform: "scale(1.12) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "berkh-confetti": {
          "0%": { transform: "translate(0, 0) rotate(0deg) scale(0.4)", opacity: "1" },
          "100%": {
            transform: "translate(var(--dx), var(--dy)) rotate(540deg) scale(1)",
            opacity: "0",
          },
        },
      },
      animation: {
        "fist-open": "fist-open 0.5s ease-out both",
        "fist-shake": "fist-shake 0.35s ease-in-out 2",
        "stone-pop": "stone-pop 0.35s ease-out both",
        "shagai-toss": "shagai-toss 0.45s ease-in-out infinite",
        "shagai-land": "shagai-land 0.4s ease-out both",
        "horse-hop": "horse-hop 0.28s ease-out",
        // Баяр нь 4 шагай бууж дууссаны дараа (0.5с) гарч ирнэ.
        "berkh-fade": "berkh-fade 0.2s ease-out 0.5s both",
        "berkh-pop": "berkh-pop 0.6s ease-out 0.5s both",
        "berkh-confetti": "berkh-confetti 1.4s ease-out both",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
