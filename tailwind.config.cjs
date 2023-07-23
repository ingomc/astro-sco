/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
    theme: {
      extend: {
        typography: {
          DEFAULT: {
            css: {
              maxWidth: '120ch', // add required value here
            }
          }
        }
      },
    },
  plugins: [require("@tailwindcss/typography")],
};
