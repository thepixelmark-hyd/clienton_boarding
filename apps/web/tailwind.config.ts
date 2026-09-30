import type { Config } from "tailwindcss";

/** Maps semantic tokens (docs/design-system.md) to Tailwind utility classes,
 * e.g. `bg-background`, `text-text-secondary`, `border-border`. Every color
 * a component uses should come from this palette — never a raw hex value —
 * so light/dark mode and any future rebrand is a token edit, not a grep. */
const withOpacity = (variable: string) => `hsl(var(${variable}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.9375rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.375rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.75rem", { lineHeight: "2.25rem" }],
      },
      colors: {
        background: withOpacity("--background"),
        surface: withOpacity("--surface"),
        "surface-secondary": withOpacity("--surface-secondary"),
        border: withOpacity("--border"),
        "border-strong": withOpacity("--border-strong"),
        "text-primary": withOpacity("--text-primary"),
        "text-secondary": withOpacity("--text-secondary"),
        "text-muted": withOpacity("--text-muted"),
        accent: {
          DEFAULT: withOpacity("--accent"),
          foreground: withOpacity("--accent-foreground"),
        },
        success: {
          DEFAULT: withOpacity("--success"),
          foreground: withOpacity("--success-foreground"),
        },
        warning: {
          DEFAULT: withOpacity("--warning"),
          foreground: withOpacity("--warning-foreground"),
        },
        danger: {
          DEFAULT: withOpacity("--danger"),
          foreground: withOpacity("--danger-foreground"),
        },
        info: {
          DEFAULT: withOpacity("--info"),
          foreground: withOpacity("--info-foreground"),
        },
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        elevated: "0 4px 16px -4px rgb(0 0 0 / 0.10), 0 1px 2px 0 rgb(0 0 0 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
