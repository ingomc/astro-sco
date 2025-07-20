import { defineConfig, devices } from '@playwright/test';

/**
 * Visual Regression Testing Configuration
 * Spezielle Config für optische Tests kritischer UI-Komponenten
 */
export default defineConfig({
  testDir: './tests/visual',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/visual-tests.xml' }]
  ],
  
  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:4321',
    
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'Desktop Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        // Ensure consistent rendering
        deviceScaleFactor: 1,
        hasTouch: false,
      },
    },
    
    {
      name: 'Desktop Firefox',
      use: { 
        ...devices['Desktop Firefox'],
        deviceScaleFactor: 1,
        hasTouch: false,
      },
    },
    
    {
      name: 'Desktop Safari',
      use: { 
        ...devices['Desktop Safari'],
        deviceScaleFactor: 1,
        hasTouch: false,
      },
    },
    
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
      },
    },
    
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  
  /* Visual comparison settings */
  expect: {
    // Global threshold for visual comparisons
    toHaveScreenshot: { 
      threshold: 0.2,
      animations: 'disabled',
    },
    toMatchSnapshot: { 
      threshold: 0.2,
    },
  },
});
