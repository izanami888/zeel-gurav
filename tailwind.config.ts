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
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
