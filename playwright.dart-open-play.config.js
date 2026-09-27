import { defineConfig, devices } from "@playwright/test";

const apiOrigin = "http://dart-open-play-test.local";

export default defineConfig({
  testDir: "./tests",
  testMatch: "dart-open-play.spec.js",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:4330",
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
    command: "pnpm run dev",
    url: "http://localhost:4330",
    reuseExistingServer: false,
    env: {
      CONTENT_SOURCE: "astro",
      PUBLIC_DART_OPEN_PLAY_API_URL: `${apiOrigin}/dart-open-play`,
      PORT: "4330",
    },
  },
});
