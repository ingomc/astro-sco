import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel/static";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { astroImageTools } from "astro-imagetools";

import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: "https://www.sc-oberfuellbach.de/",
  integrations: [mdx(), sitemap(), tailwind(), astroImageTools],
  output: 'static',
  adapter: vercel({ webAnalytics: {
    enabled: true,
  },}),
});
