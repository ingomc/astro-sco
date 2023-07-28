import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import image from "@astrojs/image";
import { astroImageTools } from "astro-imagetools";
import NetlifyCMS from "astro-netlify-cms";

import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: "https://example.com",
  integrations: [
    mdx(),
    sitemap(),
    image(),
    tailwind(),
    astroImageTools,
    NetlifyCMS({
      config: {
        backend: {
          squash_merges: true,
          name: "git-gateway",
          branch: "main",
        },
        locale: "de",
        collections: [
          {
            name: "start",
            label: "Startseite",
            folder: "src/content/start",
            create: true,
            slug: "{{slug}}",
            fields: [
              { label: "Title", name: "title", widget: "string" },
              { label: "Reihenfolge", name: "order", widget: "number" },
              { label: "Body", name: "body", widget: "markdown" },
            ],
          },
        ],
      },
    }),
  ],
});
