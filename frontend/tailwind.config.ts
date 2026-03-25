import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#090b15",
        panel: "#0f1322",
        panelAlt: "#15192c",
        accent: "#ff66d6",
        gold: "#8f7cff",
        mist: "#ececff",
      },
      boxShadow: {
        glow: "0 28px 120px rgba(187, 76, 255, 0.18)",
      },
      fontFamily: {
        display: ["Space Grotesk", "Bahnschrift", "Segoe UI", "sans-serif"],
        body: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
