import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A2A23",
        ink2: "#14463A",
        sea: {
          DEFAULT: "#17805F",
          soft: "#E2F4EB",
          dark: "#0F5C44",
        },
        saffron: {
          DEFAULT: "#FF9A1F",
          soft: "#FFF1DC",
          dark: "#E6820B",
        },
        mint: {
          DEFAULT: "#1FA97F",
          soft: "#DDF5EA",
          dark: "#148360",
        },
        line: "#D9E6DE",
        mute: "#566B61",
        text: "#10261D",
        bg: "#F3F7F4",
      },
      fontFamily: {
        display: ["'Bricolage Grotesque'", "'Segoe UI'", "system-ui", "sans-serif"],
        body: ["'Instrument Sans'", "'Segoe UI'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "Consolas", "monospace"],
      },
      borderRadius: {
        "r-lg": "22px",
        "r-md": "14px",
        "r-sm": "9px",
      },
    },
  },
  plugins: [],
};

export default config;
