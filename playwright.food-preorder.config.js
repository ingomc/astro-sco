import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "food-preorder.spec.js",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:4329",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4329",
    reuseExistingServer: false,
    env: {
      CONTENT_SOURCE: "astro",
      FOOD_PREORDER_TEST_PAGE: "1",
      PUBLIC_FOOD_ORDERS_API_URL: "http://food-order-test.local/food-preorders",
      PORT: "4329",
    },
  },
});
