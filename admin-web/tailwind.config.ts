import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class", // Explicitly keep locked to light theme
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        canvas: "#F8FAFC", // Low-glare Slate-50 canvas
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F1F5F9", // Slate-100
        },
        border: {
          subtle: "#E2E8F0", // Slate-200
          strong: "#CBD5E1", // Slate-300
        },
        primary: {
          DEFAULT: "#1D4ED8", // Academic Blue-700
          hover: "#1E40AF",   // Blue-800
          light: "#EFF6FF",   // Blue-50
        },
        success: {
          DEFAULT: "#047857", // Emerald-700
          bg: "#ECFDF5",      // Emerald-50
          border: "#059669",  // Emerald-600
        },
        warning: {
          DEFAULT: "#B45309", // Amber-700
          bg: "#FFFBEB",      // Amber-50
          border: "#D97706",  // Amber-600
        },
        danger: {
          DEFAULT: "#B91C1C", // Red-700
          bg: "#FEF2F2",      // Red-50
          border: "#DC2626",  // Red-600
        },
      },
    },
  },
  plugins: [],
};

export default config;
