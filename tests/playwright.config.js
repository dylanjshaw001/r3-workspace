// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { DOMAINS } = require('./config/shared-constants');

/**
 * Playwright Configuration for R3 E2E Testing
 * 
 * This configuration supports:
 * - Cross-browser testing (Chromium, Firefox, Safari)
 * - Mobile device emulation
 * - Visual regression testing
 * - Performance testing
 * - Accessibility testing
 */

module.exports = defineConfig({
  testDir: './frontend/r3-frontend/e2e/playwright',
  
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
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['list']
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.SHOPIFY_STORE_URL || `https://${DOMAINS.SHOPIFY_STORE}`,
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Global timeout for actions */
    actionTimeout: 10000,
    
    /* Global timeout for navigations */
    navigationTimeout: 30000,
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* Custom user agent */
    userAgent: 'R3-E2E-Tests/1.0.0',
    
    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    }
  },

  /* Configure projects for major browsers and devices */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Override viewport for better testing
        viewport: { width: 1280, height: 720 }
      },
    },

    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },

    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
    },

    /* Mobile Testing */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Tablet Testing */
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
    },

    /* Performance Testing Profile */
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        // Slow 3G network simulation for performance testing
        contextOptions: {
          // Simulate slower network
          offline: false,
          // Add custom metrics collection
          recordVideo: false, // Disable video for performance tests
        }
      },
      testMatch: '**/*.performance.spec.js'
    },

    /* Accessibility Testing Profile */
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        // Configure for accessibility testing
        reducedMotion: 'reduce',
        forcedColors: 'none',
        colorScheme: 'light'
      },
      testMatch: '**/*.accessibility.spec.js'
    }
  ],

  /* Global setup and teardown */
  globalSetup: require.resolve('./shared/helpers/playwright/global-setup.js'),
  globalTeardown: require.resolve('./shared/helpers/playwright/global-teardown.js'),

  /* Configure test environment */
  testMatch: [
    '**/playwright/**/*.spec.js',
    '**/e2e/**/*.playwright.js'
  ],

  /* Timeout settings */
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 5000 // 5 seconds for assertions
  },

  /* Output directories */
  outputDir: 'test-results/playwright-artifacts',
  
  /* Web Server configuration for local development */
  webServer: process.env.NODE_ENV === 'development' ? {
    command: 'npm run dev:shopify',
    url: 'http://localhost:9292',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
  } : undefined,
});