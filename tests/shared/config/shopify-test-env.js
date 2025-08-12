/**
 * Shopify Testing Environment Configuration
 * 
 * This file centralizes Shopify-specific testing configuration
 * for both local development and staging environments
 */

const environments = {
  development: {
    storeUrl: 'https://sqqpyb-yq.myshopify.com',
    themeId: '153047662834',
    previewParam: '?preview_theme_id=153047662834',
    backendUrl: 'https://r3-backend-git-dev-r3.vercel.app',
    useTestData: true,
    enableMockPayments: true
  },
  staging: {
    storeUrl: 'https://sqqpyb-yq.myshopify.com',
    themeId: '153047662834',
    previewParam: '?preview_theme_id=153047662834',
    backendUrl: 'https://r3-backend-git-stage-r3.vercel.app',
    useTestData: true,
    enableMockPayments: true
  },
  production: {
    storeUrl: 'https://rthree.io',
    themeId: 'live',
    previewParam: '',
    backendUrl: 'https://r3-backend.vercel.app',
    useTestData: false,
    enableMockPayments: false
  }
};

// Get current environment
function getCurrentEnvironment() {
  const env = process.env.NODE_ENV || 'development';
  return environments[env] || environments.development;
}

// Build test URLs
function buildTestUrls(baseConfig = null) {
  const config = baseConfig || getCurrentEnvironment();
  
  return {
    home: `${config.storeUrl}${config.previewParam}`,
    product: `${config.storeUrl}/products/fentanyl-test-strip-kit${config.previewParam}`,
    cart: `${config.storeUrl}/cart${config.previewParam}`,
    checkout: `${config.storeUrl}/pages/checkout${config.previewParam}`, // Changed from custom-checkout to checkout
    collection: `${config.storeUrl}/collections/all${config.previewParam}`,
    
    // Add rep parameter testing
    homeWithRep: `${config.storeUrl}/?rep=e2e-test-rep${config.previewParam ? '&' + config.previewParam.slice(1) : ''}`,
    productWithRep: `${config.storeUrl}/products/fentanyl-test-strip-kit?rep=e2e-test-rep${config.previewParam ? '&' + config.previewParam.slice(1) : ''}`
  };
}

// Test product configurations - Using real products from the store
const testProducts = {
  standard: {
    handle: 'fentanyl-test-strip-kit',
    title: 'Fentanyl Test Strip Kit',
    price: '$10.00',
    selector: '[data-product-id]',
    addToCartSelector: '[data-add-to-cart]'
  },
  onebox: {
    handle: 'one-fentanyl-detection-device-case',
    title: 'ONE Fentanyl Detection Device',
    price: '$50.00',
    selector: '[data-product-id*="onebox"]',
    addToCartSelector: '[data-add-to-cart]',
    tags: ['onebox']
  },
  naloxone: {
    handle: 'classic-naloxone-emergency-kit',
    title: 'Classic Naloxone Emergency Kit',
    price: '$75.00',
    selector: '[data-product-id]',
    addToCartSelector: '[data-add-to-cart]'
  },
  disposal: {
    handle: 'drug-disposal-pouch-case',
    title: 'Drug Disposal Pouch',
    price: '$15.00',
    selector: '[data-product-id]',
    addToCartSelector: '[data-add-to-cart]'
  }
};

// Cart testing configuration
const cartConfig = {
  selectors: {
    cartIcon: '[data-cart-drawer-toggle]',
    cartCount: '[data-cart-count]',
    cartDrawer: '[data-cart-drawer]',
    cartItems: '[data-cart-items]',
    cartItem: '[data-variant-id]',
    removeButton: '[data-remove-item]',
    quantityInput: '[data-quantity-input]',
    subtotal: '[data-cart-subtotal]',
    checkoutButton: '.cart-drawer__checkout'
  },
  animations: {
    drawerOpenDelay: 500,
    updateDelay: 1500 // Cart updates are throttled to 1.5s
  }
};

// Checkout page configuration
const checkoutConfig = {
  selectors: {
    sessionStatus: '[data-session-status]',
    customerForm: '[data-customer-form]',
    emailInput: '[data-customer-email]',
    shippingForm: '[data-shipping-form]',
    paymentTabs: '[data-payment-tabs]',
    cardTab: '[data-payment-card]',
    achTab: '[data-payment-ach]',
    cardForm: '[data-card-form]',
    achForm: '[data-ach-form]',
    submitButton: '[data-checkout-submit]',
    orderSummary: '[data-order-summary]',
    shippingCalculation: '[data-shipping-cost]'
  },
  timeouts: {
    sessionLoad: 10000,
    paymentProcessing: 30000,
    orderCreation: 15000
  }
};

// Rep parameter testing configuration
const repConfig = {
  testRepCode: 'e2e-test-rep',
  localStorage: {
    repKey: 'r3_rep_code',
    repInfoKey: 'r3_rep_info'
  },
  cartAttribute: 'rep_code',
  expectedBehavior: {
    persistsAcrossPages: true,
    savedInLocalStorage: true,
    addedToCartAttributes: true,
    showsInOrderData: true
  }
};

// Test data sets
const testData = {
  customers: [
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
  ],
  
  // Test card data for Stripe testing
  testCards: {
    visa: {
      number: '4242424242424242',
      exp: '12/34',
      cvc: '123'
    },
    visaDeclined: {
      number: '4000000000000002',
      exp: '12/34',
      cvc: '123'
    }
  },
  
  // Test ACH data
  testBankAccount: {
    routing: '110000000',
    account: '000123456789',
    accountType: 'checking'
  }
};

// Performance thresholds
const performanceThresholds = {
  pageLoad: 3000, // 3 seconds
  cartUpdate: 2000, // 2 seconds
  checkoutLoad: 5000, // 5 seconds
  paymentProcessing: 30000 // 30 seconds
};

module.exports = {
  environments,
  getCurrentEnvironment,
  buildTestUrls,
  testProducts,
  cartConfig,
  checkoutConfig,
  repConfig,
  testData,
  performanceThresholds
};