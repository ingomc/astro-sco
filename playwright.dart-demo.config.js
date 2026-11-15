import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "dart-demo.spec.js",
  workers: 1,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4331", trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "pnpm run dev --host 127.0.0.1 --port 4331",
    url: "http://127.0.0.1:4331/__dart-demo/",
    reuseExistingServer: false,
    env: { CONTENT_SOURCE: "astro", STAGING: "1", PUBLIC_DART_LIVE_DEMO: "1" },
  },
});
