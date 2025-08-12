/**
 * Playwright Global Setup
 * 
 * Runs before all tests to:
 * - Set up test environment
 * - Seed test data
 * - Configure authentication
 * - Initialize backend connections
 */

const { chromium } = require('@playwright/test');
const path = require('path');

async function globalSetup(config) {
  console.log('🚀 Setting up Playwright test environment...');
  
  // Get environment variables
  const testEnv = process.env.NODE_ENV || 'development';
  const shopifyUrl = process.env.SHOPIFY_STORE_URL || 'https://sqqpyb-yq.myshopify.com';
  const backendUrl = process.env.API_URL || 'https://r3-backend-git-dev-r3.vercel.app';
  
  console.log(`📍 Environment: ${testEnv}`);
  console.log(`🏪 Shopify Store: ${shopifyUrl}`);
  console.log(`🔌 Backend API: ${backendUrl}`);
  
  // Launch browser for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // 1. Verify Shopify store accessibility
    console.log('🔍 Verifying Shopify store accessibility...');
    const shopifyResponse = await page.goto(shopifyUrl);
    if (!shopifyResponse.ok()) {
      throw new Error(`Shopify store not accessible: ${shopifyResponse.status()}`);
    }
    console.log('✅ Shopify store accessible');
    
    // 2. Verify backend API connectivity
    console.log('🔍 Verifying backend API connectivity...');
    const backendResponse = await page.request.get(`${backendUrl}/health`);
    if (!backendResponse.ok()) {
      throw new Error(`Backend API not accessible: ${backendResponse.status()}`);
    }
    const healthData = await backendResponse.json();
    console.log(`✅ Backend API accessible (Environment: ${healthData.environment})`);
    
    // 3. Set up test data
    console.log('📦 Setting up test data...');
    await setupTestData(page, backendUrl);
    console.log('✅ Test data configured');
    
    // 4. Clear any existing sessions
    console.log('🧹 Clearing existing test sessions...');
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    console.log('✅ Sessions cleared');
    
    // 5. Pre-authenticate if needed for admin operations
    if (process.env.SHOPIFY_ADMIN_TOKEN) {
      console.log('🔑 Setting up admin authentication...');
      // Store admin token for use in tests
      process.env.TEST_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
      console.log('✅ Admin authentication configured');
    }
    
  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('🎉 Playwright setup completed successfully!');
}

async function setupTestData(page, backendUrl) {
  // Create test products if needed
  const testProducts = [
    {
      id: 'fentanyl-test-strip-kit',
      title: 'Fentanyl Test Strip Kit',
      price: 1000, // $10.00
      available: true
    },
    {
      id: 'flex-naloxone-emergency-kit',
      title: 'Flex Naloxone Emergency Kit',
      price: 5000, // $50.00
      available: true,
      tags: ['onebox']
    }
  ];
  
  // Store test data in environment for use in tests
  process.env.TEST_PRODUCTS = JSON.stringify(testProducts);
  
  // Create test customers data
  const testCustomers = [
    {
      email: 'e2e-test@example.com',
      firstName: 'E2E',
      lastName: 'Tester',
      phone: '555-0123',
      address: {
        address1: '123 Test Street',
        city: 'New York',
        province: 'NY',
        zip: '10001',
        country: 'US'
      }
    }
  ];
  
  process.env.TEST_CUSTOMERS = JSON.stringify(testCustomers);
  
  // Set up rep tracking data
  const testReps = [
    {
      repCode: 'e2e-test-rep',
      name: 'E2E Test Rep',
      email: 'rep-e2e-test@example.com'
    }
  ];
  
  process.env.TEST_REPS = JSON.stringify(testReps);
}

module.exports = globalSetup;