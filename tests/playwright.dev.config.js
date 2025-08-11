// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { DOMAINS } = require('./config/shared-constants');

/**
 * Fast Playwright Configuration for Development
 * 
 * Optimized for speed during development:
 * - Single browser (Chromium only)
 * - Reduced timeouts
 * - No media recording
 * - Simplified setup
 */

module.exports = defineConfig({
  testDir: './frontend/r3-frontend/e2e/playwright',
  
  /* Run tests sequentially to avoid rate limiting */
  fullyParallel: false,
  
  /* Retry once for flaky tests */
  retries: 1,
  
  /* Use single worker to avoid rate limiting on Shopify */
  workers: 1,
  
  /* Simple reporter for development */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/playwright-report', open: 'never' }]
  ],
  
  /* Shared settings optimized for speed */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.SHOPIFY_STORE_URL || `https://${DOMAINS.SHOPIFY_STORE}`,
    
    /* Minimal tracing for development */
    trace: 'off',
    
    /* No screenshots for speed */
    screenshot: 'off',
    
    /* No video recording for speed */
    video: 'off',
    
    /* Reduced timeouts for faster feedback */
    actionTimeout: 5000,
    navigationTimeout: 10000,
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* Custom user agent */
    userAgent: 'R3-E2E-Tests-Dev/1.0.0'
  },

  /* Single browser project for development speed */
  projects: [
    {
      name: 'chromium-dev',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    }
  ],

  /* Skip global setup/teardown for development speed */
  // globalSetup: undefined,
  // globalTeardown: undefined,

  /* Configure test environment */
  testMatch: [
    '**/playwright/**/*.spec.js',
    '**/e2e/**/*.playwright.js'
  ],

  /* Reduced timeout settings for faster feedback */
  timeout: 15000, // 15 seconds per test (down from 60)
  expect: {
    timeout: 3000 // 3 seconds for assertions (down from 5)
  },

  /* Output directories */
  outputDir: 'test-results/playwright-artifacts',
  
  /* No web server for development (use existing Shopify store) */
  webServer: undefined
});