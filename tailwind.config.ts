import type { Config } from "tailwindcss";

// Locked design tokens — MyNigerianGuide Product & Technical Brief v3.0, Section 18
// Do not change these values without updating the brief. They are the single
// source of truth for colour, type, radius, and shadow across the platform.
const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        green: {
          50: "#EDFAF3",
          400: "#1DBF7B",
          500: "#12A066",
          600: "#0E7A4F",
        },
        ink: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          300: "#9CA3AF",
          500: "#4B5563",
          700: "#1F2937",
          900: "#0D1117",
        },
        amber: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        display: ["var(--font-display)", "Plus Jakarta Sans", "sans-serif"],
        body: ["var(--font-body)", "Inter", "sans-serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
      },
      boxShadow: {
        sm: "0 1px 3px rgba(0,0,0,0.08)",
        md: "0 4px 16px rgba(0,0,0,0.08)",
        lg: "0 12px 40px rgba(0,0,0,0.10)",
      },
    },
  },
  plugins: [],
};
export default config;
