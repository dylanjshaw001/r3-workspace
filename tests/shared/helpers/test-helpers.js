// Test helper utilities - consolidated from utils/test-helpers.js

const crypto = require('crypto');

/**
 * Generate a random session token for testing
 */
function generateTestSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a valid CSRF token for testing
 */
function generateTestCSRFToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create a test cart object
 */
function createTestCart(options = {}) {
  const defaults = {
    token: generateTestSessionToken(),
    note: null,
    attributes: {
      rep: options.rep || null,
      checkout_session: options.sessionToken || null
    },
    original_total_price: 10000,
    total_price: 10000,
    total_discount: 0,
    total_weight: 1000,
    item_count: 1,
    items: [
      {
        id: 40000000000,
        properties: {},
        quantity: 1,
        variant_id: 40000000000,
        key: '40000000000:1',
        title: 'Test Product',
        price: 10000,
        original_price: 10000,
        discounted_price: 10000,
        line_price: 10000,
        original_line_price: 10000,
        total_discount: 0,
        discounts: [],
        sku: 'TEST-001',
        grams: 1000,
        vendor: 'Test Vendor',
        taxable: true,
        product_id: 7000000000,
        product_has_only_default_variant: true,
        gift_card: false,
        final_price: 10000,
        final_line_price: 10000,
        url: '/products/test-product',
        featured_image: {
          aspect_ratio: 1,
          alt: 'Test Product',
          height: 1000,
          url: 'https://cdn.shopify.com/test.jpg',
          width: 1000
        },
        image: 'https://cdn.shopify.com/test.jpg',
        handle: 'test-product',
        requires_shipping: true,
        product_type: 'Test Type',
        product_title: 'Test Product',
        product_description: 'Test product description',
        variant_title: null,
        variant_options: ['Default Title'],
        options_with_values: [{name: 'Title', value: 'Default Title'}],
        line_level_discount_allocations: [],
        line_level_total_discount: 0
      }
    ],
    requires_shipping: true,
    currency: 'USD',
    items_subtotal_price: 10000,
    cart_level_discount_applications: []
  };

  return { ...defaults, ...options };
}

/**
 * Create test customer data
 */
function createTestCustomer(options = {}) {
  const defaults = {
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'Customer',
    phone: '555-1234',
    address1: '123 Test Street',
    address2: 'Apt 4B',
    city: 'New York',
    province: 'NY',
    zip: '10001',
    country: 'US'
  };

  return { ...defaults, ...options };
}

/**
 * Create a test payment intent
 */
function createTestPaymentIntent(options = {}) {
  const defaults = {
    id: `pi_test_${Date.now()}`,
    object: 'payment_intent',
    amount: 10000,
    amount_capturable: 0,
    amount_received: 10000,
    application: null,
    application_fee_amount: null,
    canceled_at: null,
    cancellation_reason: null,
    capture_method: 'automatic',
    charges: {
      object: 'list',
      data: [],
      has_more: false,
      url: '/v1/charges?payment_intent=pi_test'
    },
    client_secret: `pi_test_${Date.now()}_secret_test`,
    confirmation_method: 'automatic',
    created: Math.floor(Date.now() / 1000),
    currency: 'usd',
    customer: null,
    description: null,
    invoice: null,
    last_payment_error: null,
    livemode: false,
    metadata: {},
    next_action: null,
    on_behalf_of: null,
    payment_method: 'pm_test',
    payment_method_options: {},
    payment_method_types: ['card'],
    receipt_email: null,
    review: null,
    setup_future_usage: null,
    shipping: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    status: 'succeeded',
    transfer_data: null,
    transfer_group: null
  };

  return { ...defaults, ...options };
}

/**
 * Create a test webhook event
 */
function createTestWebhookEvent(type = 'payment_intent.succeeded', data = {}) {
  const event = {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: data
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null
    },
    type: type
  };

  return event;
}

/**
 * Wait for a condition to be true
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Mock successful API response
 */
function mockSuccessResponse(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

/**
 * Mock error API response
 */
function mockErrorResponse(error, status = 400) {
  return {
    ok: false,
    status: status,
    json: async () => ({ error }),
    text: async () => JSON.stringify({ error })
  };
}

/**
 * Create test session data
 */
function createTestSession(options = {}) {
  const now = Date.now();
  const defaults = {
    sessionId: generateTestSessionToken(),
    csrfToken: generateTestCSRFToken(),
    cartToken: options.cartToken || generateTestSessionToken(),
    domain: 'test-store.myshopify.com',
    createdAt: now,
    expiresAt: now + (30 * 60 * 1000), // 30 minutes
    lastActivity: now,
    requestCount: 0,
    fingerprint: 'test-fingerprint',
    userAgent: 'test-user-agent',
    ipAddress: '127.0.0.1'
  };

  return { ...defaults, ...options };
}

/**
 * Extract environment from various sources
 */
function getTestEnvironment(themeSettings = {}, gitBranch = null) {
  // First check theme settings
  if (themeSettings.environment) {
    return themeSettings.environment;
  }
  
  // Fallback to git branch
  const branchEnvMap = {
    'main': 'production',
    'r3-prod': 'production',
    'r3-stage': 'staging',
    'r3-dev': 'development'
  };
  
  return branchEnvMap[gitBranch] || 'production';
}

module.exports = {
  generateTestSessionToken,
  generateTestCSRFToken,
  createTestCart,
  createTestCustomer,
  createTestPaymentIntent,
  createTestWebhookEvent,
  waitFor,
  mockSuccessResponse,
  mockErrorResponse,
  createTestSession,
  getTestEnvironment
};