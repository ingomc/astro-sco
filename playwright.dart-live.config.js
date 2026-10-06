import { defineConfig } from "@playwright/test";
import dartConfig from "./playwright.dart-open-play.config.js";

export default defineConfig({
  ...dartConfig,
  testMatch: ["darts.test.js", "dart-live.spec.js", "dart-live-model.test.ts"],
  workers: 2,
  webServer: {
    ...dartConfig.webServer,
    env: { ...dartConfig.webServer.env, STAGING: "1" },
  },
});
