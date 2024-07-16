import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel/static";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import tailwind from "@astrojs/tailwind";

const deployTarget = process.env.DEPLOY_TARGET;

console.log("Deploy Target: " + deployTarget);

const deployadapter = () => {
  if (deployTarget === "netlify") {
    return undefined;
  }
  return vercel({
    webAnalytics: {
      enabled: true,
    },
    speedInsights: {
      enabled: true,
    },
  });
};

// https://astro.build/config
export default defineConfig({
  site: "https://www.sc-oberfuellbach.de/",
  integrations: [mdx(), sitemap(), tailwind()],
  output: "static",
  adapter: deployadapter(),
});
