import { defineConfig } from "@playwright/test";
import dartConfig from "./playwright.dart-open-play.config.js";

export default defineConfig({
  ...dartConfig,
  testMatch: [
    "dart-open-play.spec.js",
    "food-preorder.spec.js",
    "visitor-services.spec.js",
  ],
  webServer: {
    ...dartConfig.webServer,
    env: {
      ...dartConfig.webServer.env,
      STAGING: "1",
      FOOD_PREORDER_TEST_PAGE: "1",
      PUBLIC_FOOD_ORDERS_API_URL: "http://food-order-test.local/food-preorders",
    },
  },
});
