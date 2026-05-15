import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./sidepanel.html", "./dashboard.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Geist", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "SFMono-Regular"]
      },
      colors: {
        oc: {
          bg: "rgb(var(--oc-bg) / <alpha-value>)",
          surface: "rgb(var(--oc-surface) / <alpha-value>)",
          elevated: "rgb(var(--oc-elevated) / <alpha-value>)",
          border: "rgb(var(--oc-border) / <alpha-value>)",
          text: "rgb(var(--oc-text) / <alpha-value>)",
          muted: "rgb(var(--oc-muted) / <alpha-value>)",
          blue: "rgb(var(--oc-blue) / <alpha-value>)",
          cyan: "rgb(var(--oc-cyan) / <alpha-value>)",
          success: "rgb(var(--oc-success) / <alpha-value>)",
          warning: "rgb(var(--oc-warning) / <alpha-value>)",
          critical: "rgb(var(--oc-critical) / <alpha-value>)"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--oc-blue) / 0.24), 0 20px 80px rgb(0 0 0 / 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
