/**
 * Frontend Configuration Constants
 * 
 * This file contains all configuration constants for the frontend.
 * Since this runs in the browser, we can't import from r3-workspace,
 * so values are duplicated here. Keep in sync with r3-workspace/config/shared-constants.js
 * 
 * IMPORTANT: This file should ONLY contain non-sensitive configuration.
 * Never put secrets or API keys (except public Stripe keys) in this file.
 */

// Environment names
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production'
};

// Git branch names
export const BRANCHES = {
  DEVELOPMENT: 'dev',
  STAGING: 'stage',
  PRODUCTION: 'prod',
  MAIN: 'main'
};

// Shopify store domains
export const DOMAINS = {
  SHOPIFY_STORE: 'sqqpyb-yq.myshopify.com',
  PRODUCTION: 'rthree.io',
  PRODUCTION_WWW: 'www.rthree.io',
  ALTERNATE_1: 'rapidriskreduction.com',
  ALTERNATE_2: 'shop.rapidriskreduction.com'
};

// Shopify theme IDs
export const THEME_IDS = {
  DEVELOPMENT: 'development',
  STAGING: '153047662834',
  PRODUCTION: '152848597234'
};

// Server ports
export const PORTS = {
  BACKEND: 3000,
  FRONTEND_DEV: 9292
};

// Backend deployment URLs
export const BACKEND_URLS = {
  PRODUCTION: 'https://r3-backend.vercel.app',
  STAGING: 'https://r3-backend-git-stage-r3.vercel.app',
  DEVELOPMENT: 'https://r3-backend-git-dev-r3.vercel.app',
  LOCAL: 'http://localhost:3000'
};

// API endpoint paths (relative to backend URL)
export const API_ENDPOINTS = {
  // Stripe
  CREATE_PAYMENT_INTENT: '/api/stripe/create-payment-intent',
  CREATE_CUSTOMER: '/api/stripe/create-customer',
  
  // Checkout
  CREATE_SESSION: '/api/checkout/session',
  GET_CSRF: '/api/checkout/csrf',
  
  // Shopify
  CREATE_ORDER: '/api/shopify/create-order',
  
  // Calculations
  CALCULATE_SHIPPING: '/api/calculate-shipping',
  CALCULATE_TAX: '/api/calculate-tax'
};

// Shopify Cart API endpoints
export const SHOPIFY_CART_API = {
  GET: '/cart.js',
  UPDATE: '/cart/update.js',
  CLEAR: '/cart/clear.js',
  ADD: '/cart/add.js',
  CHANGE: '/cart/change.js'
};

// Stripe public keys (safe to expose in frontend)
export const STRIPE_PUBLIC_KEYS = {
  TEST: 'pk_test_51QfuVo2MiCAheYVMWMHg8qhGhCLRnLhOrnZupzJxppag93BnJhMFCCwg1xC2X4aH9vzonCpcpf8z3avoYINOvzaI00u9n0Xx7F',
  LIVE: 'pk_live_51QfuVo2MiCAheYVMxmfB8eGf3OSMZRPvsH2dcFC579LoJTaSBYDiX78vuagKKjLZh0PN5ZIn4vvyilhbXZosV2tY00vPGMZQk8'
};

// External service URLs
export const EXTERNAL_SERVICES = {
  STRIPE_JS: 'https://js.stripe.com/v3/',
  PAYPAL_SDK: 'https://www.paypal.com/sdk/js',
  GOOGLE_PAY_JS: 'https://pay.google.com/gp/p/js/pay.js'
};

// Session configuration
export const SESSION = {
  TTL_MS: 1800000, // 30 minutes
  STORAGE_KEY: 'checkout_session',
  CART_ATTRIBUTE_KEY: 'checkout_session'
};

// Feature flags
export const FEATURES = {
  // Payment methods
  STRIPE_ENABLED: true,
  ACH_ENABLED: true,
  PAYPAL_ENABLED: false,
  APPLE_PAY_ENABLED: false,
  GOOGLE_PAY_ENABLED: false,
  
  // UI features
  CART_DRAWER_ENABLED: true,
  QUICK_SHOP_ENABLED: true,
  PRODUCT_RECOMMENDATIONS_ENABLED: true,
  
  // Checkout features
  GUEST_CHECKOUT_ENABLED: true,
  EXPRESS_CHECKOUT_ENABLED: true,
  ORDER_NOTES_ENABLED: true
};

// Performance configuration
export const PERFORMANCE = {
  CART_UPDATE_THROTTLE: 1500, // 1.5 seconds
  API_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 second
};

// Shipping configuration
export const SHIPPING = {
  ONEBOX: {
    UNIT_PRICE: 500, // $5.00 in cents
    CASE_PRICE: 2500, // $25.00 in cents
    UNITS_PER_CASE: 10
  },
  STANDARD: {
    PRICE: 0 // Free shipping
  }
};

/**
 * Helper Functions
 */

// Get current environment based on URL and context
export function getCurrentEnvironment() {
  const hostname = window.location.hostname;
  const href = window.location.href;
  
  // Local development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return ENVIRONMENTS.DEVELOPMENT;
  }
  
  // Check if we're in preview mode (staging)
  if (href.includes('preview_theme_id=' + THEME_IDS.STAGING)) {
    return ENVIRONMENTS.STAGING;
  }
  
  // Check if we're on production domain
  if (hostname === DOMAINS.PRODUCTION || 
      hostname === DOMAINS.PRODUCTION_WWW ||
      hostname === DOMAINS.ALTERNATE_1 ||
      hostname === DOMAINS.ALTERNATE_2) {
    return ENVIRONMENTS.PRODUCTION;
  }
  
  // Default to production for safety
  return ENVIRONMENTS.PRODUCTION;
}

// Get backend URL for current environment
export function getBackendUrl() {
  // Check if we have an override from theme settings
  if (window.R3_BACKEND_URL) {
    return window.R3_BACKEND_URL;
  }
  
  const env = getCurrentEnvironment();
  
  switch (env) {
    case ENVIRONMENTS.DEVELOPMENT:
      return BACKEND_URLS.LOCAL;
    case ENVIRONMENTS.STAGING:
      return BACKEND_URLS.STAGING;
    case ENVIRONMENTS.PRODUCTION:
    default:
      return BACKEND_URLS.PRODUCTION;
  }
}

// Get full API endpoint URL
export function getApiEndpointUrl(endpoint) {
  const baseUrl = getBackendUrl();
  const endpointPath = API_ENDPOINTS[endpoint];
  
  if (!endpointPath) {
    console.error(`Unknown API endpoint: ${endpoint}`);
    return null;
  }
  
  return `${baseUrl}${endpointPath}`;
}

// Get Stripe public key for current environment
export function getStripePublicKey() {
  // Check for override from theme settings
  if (window.STRIPE_PUBLIC_KEY_OVERRIDE) {
    return window.STRIPE_PUBLIC_KEY_OVERRIDE;
  }
  
  const env = getCurrentEnvironment();
  
  // Use test key for development and staging
  if (env === ENVIRONMENTS.DEVELOPMENT || env === ENVIRONMENTS.STAGING) {
    return STRIPE_PUBLIC_KEYS.TEST;
  }
  
  // Use live key for production
  return STRIPE_PUBLIC_KEYS.LIVE;
}

// Get theme ID for current environment
export function getThemeId() {
  const env = getCurrentEnvironment();
  
  switch (env) {
    case ENVIRONMENTS.DEVELOPMENT:
      return THEME_IDS.DEVELOPMENT;
    case ENVIRONMENTS.STAGING:
      return THEME_IDS.STAGING;
    case ENVIRONMENTS.PRODUCTION:
    default:
      return THEME_IDS.PRODUCTION;
  }
}

// Check if a feature is enabled
export function isFeatureEnabled(featureName) {
  return FEATURES[featureName] === true;
}

// Export configuration object for convenience
const CONFIG = {
  ENVIRONMENTS,
  BRANCHES,
  DOMAINS,
  THEME_IDS,
  PORTS,
  BACKEND_URLS,
  API_ENDPOINTS,
  SHOPIFY_CART_API,
  STRIPE_PUBLIC_KEYS,
  EXTERNAL_SERVICES,
  SESSION,
  FEATURES,
  PERFORMANCE,
  SHIPPING,
  
  // Helper functions
  getCurrentEnvironment,
  getBackendUrl,
  getApiEndpointUrl,
  getStripePublicKey,
  getThemeId,
  isFeatureEnabled
};

// Export for use in browser
if (typeof window !== 'undefined') {
  window.R3_CONFIG = CONFIG;
}

export default CONFIG;