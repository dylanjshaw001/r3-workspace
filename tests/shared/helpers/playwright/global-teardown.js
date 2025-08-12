/**
 * Playwright Global Teardown
 * 
 * Runs after all tests to:
 * - Clean up test data
 * - Clear test sessions
 * - Generate test reports
 * - Clean up resources
 */

const { chromium } = require('@playwright/test');

async function globalTeardown(config) {
  console.log('🧹 Cleaning up Playwright test environment...');
  
  // Get environment variables
  const backendUrl = process.env.API_URL || 'https://r3-backend-git-dev-r3.vercel.app';
  
  // Launch browser for cleanup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // 1. Clean up test sessions
    console.log('🗑️  Clearing test sessions...');
    await cleanupTestSessions(page, backendUrl);
    console.log('✅ Test sessions cleared');
    
    // 2. Clean up test data (if in test environment)
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.log('🗑️  Cleaning up test data...');
      await cleanupTestData(page, backendUrl);
      console.log('✅ Test data cleaned up');
    }
    
    // 3. Generate summary report
    console.log('📊 Generating test summary...');
    await generateTestSummary();
    console.log('✅ Test summary generated');
    
  } catch (error) {
    console.error('⚠️  Cleanup warning:', error.message);
    // Don't fail the build on cleanup errors
  } finally {
    await browser.close();
  }
  
  console.log('🎯 Playwright cleanup completed!');
}

async function cleanupTestSessions(page, backendUrl) {
  try {
    // Clear any sessions created during testing
    await page.request.post(`${backendUrl}/api/test/cleanup-sessions`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        testRun: process.env.TEST_RUN_ID || Date.now().toString()
      }
    });
  } catch (error) {
    // Ignore if cleanup endpoint doesn't exist
    console.log('ℹ️  Session cleanup endpoint not available');
  }
}

async function cleanupTestData(page, backendUrl) {
  // Clean up any test-specific data that was created
  // This is mainly for local development testing
  
  try {
    // Clear test localStorage patterns
    await page.evaluate(() => {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('e2e-test') || key.includes('test-')) {
          localStorage.removeItem(key);
        }
      });
    });
    
    // Clear test cookies
    const cookies = await page.context().cookies();
    const testCookies = cookies.filter(cookie => 
      cookie.name.includes('test') || 
      cookie.value.includes('e2e-test')
    );
    
    if (testCookies.length > 0) {
      await page.context().clearCookies();
    }
    
  } catch (error) {
    console.log('ℹ️  Test data cleanup completed with warnings');
  }
}

async function generateTestSummary() {
  // Generate a simple test run summary
  const summary = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    shopifyUrl: process.env.SHOPIFY_STORE_URL || 'https://sqqpyb-yq.myshopify.com',
    backendUrl: process.env.API_URL || 'https://r3-backend-git-dev-r3.vercel.app',
    testRunId: process.env.TEST_RUN_ID || Date.now().toString(),
    userAgent: 'R3-E2E-Tests/1.0.0'
  };
  
  // Store summary for CI/CD reporting
  process.env.PLAYWRIGHT_TEST_SUMMARY = JSON.stringify(summary);
  
  console.log('📋 Test Summary:');
  console.log(`   Environment: ${summary.environment}`);
  console.log(`   Store URL: ${summary.shopifyUrl}`);
  console.log(`   Backend: ${summary.backendUrl}`);
  console.log(`   Run ID: ${summary.testRunId}`);
}

module.exports = globalTeardown;