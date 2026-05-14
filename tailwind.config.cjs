/** @type {import('tailwindcss').Config} */
const themeVar = (tokenName) => `var(${tokenName})`;

module.exports = {
  darkMode: false,
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        brand: {
          100: themeVar("--color-brand-100"),
          600: themeVar("--color-brand-600"),
          700: themeVar("--color-brand-700"),
          800: themeVar("--color-brand-800"),
        },
        surface: {
          page: themeVar("--color-surface-page"),
          muted: themeVar("--color-surface-muted"),
          raised: themeVar("--color-surface-raised"),
        },
        text: {
          primary: themeVar("--color-text-primary"),
          secondary: themeVar("--color-text-secondary"),
          muted: themeVar("--color-text-muted"),
        },
        border: {
          default: themeVar("--color-border-default"),
          strong: themeVar("--color-border-strong"),
        },
        success: {
          bg: themeVar("--color-success-bg"),
          border: themeVar("--color-success-border"),
          text: themeVar("--color-success-text"),
        },
        focus: themeVar("--color-focus-ring"),
      },
      borderRadius: {
        "ds-sm": themeVar("--radius-sm"),
        "ds-md": themeVar("--radius-md"),
        "ds-lg": themeVar("--radius-lg"),
        "ds-xl": themeVar("--radius-xl"),
        "ds-pill": themeVar("--radius-pill"),
      },
      boxShadow: {
        "ds-sm": themeVar("--shadow-sm"),
        "ds-md": themeVar("--shadow-md"),
        "ds-lg": themeVar("--shadow-lg"),
      },
      zIndex: {
        base: themeVar("--z-base"),
        content: themeVar("--z-content"),
        header: themeVar("--z-header"),
        overlay: themeVar("--z-overlay"),
        skiplink: themeVar("--z-skiplink"),
      },
      transitionDuration: {
        fast: themeVar("--duration-fast"),
        normal: themeVar("--duration-normal"),
        slow: themeVar("--duration-slow"),
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "80ch", // add required value here
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
