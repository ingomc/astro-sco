import { defineConfig } from "@playwright/test";
import dartConfig from "./playwright.dart-open-play.config.js";

export default defineConfig({
  ...dartConfig,
  testMatch: ["dart-open-play.spec.js", "visitor-services.spec.js"],
  webServer: {
    ...dartConfig.webServer,
    env: {
      ...dartConfig.webServer.env,
      STAGING: "1",
      VISITOR_SERVICES_TEST_PAGE: "1",
    },
  },
});
