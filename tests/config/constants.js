/**
 * Test Configuration Constants
 * 
 * This file imports shared constants and adds test-specific configuration.
 * Used by all test suites to ensure consistent configuration.
 */

import sharedConstants from '../../config/shared-constants.js';

// Re-export all shared constants for easy access
export * from '../../config/shared-constants.js';

// Test-specific configuration
export const TEST_CONFIG = {
  // Import base test config from shared constants
  ...sharedConstants.TEST_CONFIG,
  
  // Test environment URLs
  URLS: {
    BACKEND: process.env.TEST_BACKEND_URL || 'http://localhost:3000',
    FRONTEND: process.env.TEST_FRONTEND_URL || 'http://localhost:9292'
  },
  
  // Test store configuration
  STORE: {
    DOMAIN: sharedConstants.DOMAINS.SHOPIFY_STORE,
    STAGING_THEME_ID: sharedConstants.THEME_IDS.STAGING,
    PRODUCTION_THEME_ID: sharedConstants.THEME_IDS.PRODUCTION
  },
  
  // Test API endpoints (from shared constants)
  API_ENDPOINTS: sharedConstants.API_ENDPOINTS,
  
  // Test Stripe keys (public only)
  STRIPE: {
    PUBLIC_KEY_TEST: sharedConstants.STRIPE_PUBLIC_KEYS.TEST,
    TEST_CARD_NUMBER: sharedConstants.TEST_CONFIG.TEST_CARD_NUMBER,
    TEST_CARD_CVC: sharedConstants.TEST_CONFIG.TEST_CARD_CVC,
    TEST_CARD_ZIP: sharedConstants.TEST_CONFIG.TEST_CARD_ZIP
  },
  
  // Test ACH configuration
  ACH: {
    ROUTING_NUMBER: sharedConstants.TEST_CONFIG.TEST_ACH_ROUTING,
    ACCOUNT_NUMBER: sharedConstants.TEST_CONFIG.TEST_ACH_ACCOUNT,
    TEST_BANK_NAME: 'Test Bank',
    TEST_ACCOUNT_HOLDER: 'Test User'
  },
  
  // Test user data
  USER: {
    EMAIL: sharedConstants.TEST_CONFIG.TEST_EMAIL,
    FIRST_NAME: 'Test',
    LAST_NAME: 'User',
    PHONE: '555-0123',
    ADDRESS: {
      address1: '123 Test St',
      address2: 'Apt 4',
      city: 'New York',
      province: 'NY',
      zip: '10001',
      country: 'United States'
    }
  },
  
  // Test product data
  PRODUCTS: {
    ONEBOX_VARIANT_ID: process.env.TEST_ONEBOX_VARIANT_ID || '12345',
    STANDARD_VARIANT_ID: process.env.TEST_STANDARD_VARIANT_ID || '67890',
    ONEBOX_PRICE: 1000, // $10.00 in cents
    STANDARD_PRICE: 2000 // $20.00 in cents
  },
  
  // Test session configuration
  SESSION: {
    ...sharedConstants.SESSION,
    TEST_TOKEN: 'test-session-token-123',
    TEST_CSRF: 'test-csrf-token-456'
  },
  
  // Jest configuration
  JEST: {
    TIMEOUT: sharedConstants.TEST_CONFIG.TIMEOUT,
    RETRIES: sharedConstants.TEST_CONFIG.RETRIES,
    COVERAGE_THRESHOLD: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  },
  
  // Playwright configuration
  PLAYWRIGHT: {
    HEADLESS: sharedConstants.TEST_CONFIG.HEADLESS,
    TIMEOUT: sharedConstants.TEST_CONFIG.TIMEOUT,
    VIEWPORT: {
      width: 1280,
      height: 720
    },
    DEVICES: ['Desktop Chrome', 'iPhone 12', 'iPad Pro']
  },
  
  // Mock server configuration
  MOCK_SERVER: {
    PORT: 3001,
    DELAY: 100, // ms delay for simulating network latency
    ERROR_RATE: 0 // Percentage of requests that should fail (0-100)
  }
};

// Helper function to get test environment
export function getTestEnvironment() {
  return process.env.TEST_ENV || sharedConstants.ENVIRONMENTS.DEVELOPMENT;
}

// Helper function to get appropriate backend URL for testing
export function getTestBackendUrl() {
  const env = getTestEnvironment();
  
  if (env === sharedConstants.ENVIRONMENTS.DEVELOPMENT) {
    return TEST_CONFIG.URLS.BACKEND;
  }
  
  return sharedConstants.getBackendUrlForEnvironment(env);
}

// Helper function to get appropriate frontend URL for testing
export function getTestFrontendUrl() {
  const env = getTestEnvironment();
  
  if (env === sharedConstants.ENVIRONMENTS.DEVELOPMENT) {
    return TEST_CONFIG.URLS.FRONTEND;
  }
  
  return `https://${TEST_CONFIG.STORE.DOMAIN}`;
}

// Helper function to generate test cart data
export function generateTestCart(options = {}) {
  const {
    includeOnebox = true,
    includeStandard = true,
    oneboxQuantity = 13,
    standardQuantity = 2
  } = options;
  
  const items = [];
  
  if (includeOnebox) {
    items.push({
      variant_id: TEST_CONFIG.PRODUCTS.ONEBOX_VARIANT_ID,
      quantity: oneboxQuantity,
      price: TEST_CONFIG.PRODUCTS.ONEBOX_PRICE,
      product_title: 'ONEbox Product',
      is_onebox: true
    });
  }
  
  if (includeStandard) {
    items.push({
      variant_id: TEST_CONFIG.PRODUCTS.STANDARD_VARIANT_ID,
      quantity: standardQuantity,
      price: TEST_CONFIG.PRODUCTS.STANDARD_PRICE,
      product_title: 'Standard Product',
      is_onebox: false
    });
  }
  
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  return {
    items,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    total_price: subtotal,
    currency: 'USD',
    token: 'test-cart-token-' + Date.now()
  };
}

// Helper function to generate test payment intent metadata
export function generateTestPaymentMetadata(cart, user) {
  return {
    store_domain: TEST_CONFIG.STORE.DOMAIN,
    environment: getTestEnvironment(),
    items: JSON.stringify(cart.items),
    customer_email: user.EMAIL,
    customer_first_name: user.FIRST_NAME,
    customer_last_name: user.LAST_NAME,
    shipping_address: JSON.stringify(user.ADDRESS),
    shipping_method: 'Standard Shipping',
    shipping_price: '0',
    rep: 'test-rep'
  };
}

// Export configuration object
export default {
  ...TEST_CONFIG,
  getTestEnvironment,
  getTestBackendUrl,
  getTestFrontendUrl,
  generateTestCart,
  generateTestPaymentMetadata
};