/**
 * Backend Configuration Constants
 * 
 * This file imports shared constants and adds backend-specific configuration.
 * Secrets are loaded from environment variables, all other values from shared constants.
 */

import sharedConstants from './shared-constants.js';

// Re-export all shared constants for easy access
export * from './shared-constants.js';

// Backend-specific configuration that combines shared constants with env secrets
export const CONFIG = {
  // Environment detection - branch takes precedence over NODE_ENV
  ENVIRONMENT: sharedConstants.getEnvironmentFromBranch(process.env.VERCEL_GIT_COMMIT_REF) ||
               process.env.NODE_ENV || 
               sharedConstants.ENVIRONMENTS.DEVELOPMENT,
  
  // Domains from shared constants
  DOMAINS: sharedConstants.DOMAINS,
  
  // Theme IDs from shared constants
  THEME_IDS: sharedConstants.THEME_IDS,
  
  // Ports from shared constants
  PORTS: sharedConstants.PORTS,
  
  // Backend URLs from shared constants
  BACKEND_URLS: sharedConstants.BACKEND_URLS,
  
  // API endpoints from shared constants
  API_ENDPOINTS: sharedConstants.API_ENDPOINTS,
  
  // Shopify API config from shared constants
  SHOPIFY_API: sharedConstants.SHOPIFY_API,
  
  // Session config from shared constants
  SESSION: sharedConstants.SESSION,
  
  // Rate limits from shared constants (with env override for testing)
  RATE_LIMITS: process.env.TESTING_HIGH_LIMITS === 'true' ? {
    API: {
      WINDOW_MS: 900000,
      MAX_REQUESTS: 1000 // High for testing
    },
    SESSION: {
      WINDOW_MS: 900000,
      MAX_REQUESTS: 500 // High for testing
    },
    PAYMENT: {
      WINDOW_MS: 300000,
      MAX_REQUESTS: 200 // High for testing
    },
    WEBHOOK: {
      WINDOW_MS: 60000,
      MAX_REQUESTS: 1000 // High for testing
    }
  } : sharedConstants.RATE_LIMITS,
  
  // Features from shared constants
  FEATURES: sharedConstants.FEATURES,
  
  // Shipping config from shared constants
  SHIPPING: sharedConstants.SHIPPING,
  
  // Order rules from shared constants
  ORDER_RULES: sharedConstants.ORDER_RULES,
  
  // Performance targets from shared constants
  PERFORMANCE: sharedConstants.PERFORMANCE,
  
  // External services from shared constants
  EXTERNAL_SERVICES: sharedConstants.EXTERNAL_SERVICES,
  
  // Vercel config from shared constants
  VERCEL: sharedConstants.VERCEL,
  
  // Secrets from environment variables (NOT in shared constants)
  SECRETS: {
    // Stripe
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    
    // Shopify
    SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    
    // Session
    SESSION_SECRET: process.env.SESSION_SECRET,
    CSRF_SECRET: process.env.CSRF_SECRET,
    
    // Vercel KV (Redis)
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    
    // Monitoring (optional)
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    
    // Vercel
    VERCEL_ACCESS_TOKEN: process.env.VERCEL_ACCESS_TOKEN
  }
};

// Helper function to get store configuration
export function getStoreConfig(domain) {
  // Remove protocol and trailing slashes
  const cleanDomain = domain?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  // For now, all domains use the same store
  return {
    shopifyDomain: CONFIG.DOMAINS.SHOPIFY_STORE,
    shopifyToken: CONFIG.SECRETS.SHOPIFY_ADMIN_ACCESS_TOKEN,
    storeName: 'R3 Store'
  };
}

// Helper function to get current environment
export function getCurrentEnvironment() {
  return CONFIG.ENVIRONMENT;
}

// Helper function to get allowed CORS origins
export function getAllowedOrigins() {
  const origins = [];
  
  // Always include production domains
  origins.push(
    `https://${CONFIG.DOMAINS.SHOPIFY_STORE}`,
    `https://${CONFIG.DOMAINS.PRODUCTION}`,
    `https://${CONFIG.DOMAINS.PRODUCTION_WWW}`,
    `https://${CONFIG.DOMAINS.ALTERNATE_1}`,
    `https://${CONFIG.DOMAINS.ALTERNATE_2}`
  );
  
  // Add environment-specific origins
  const env = getCurrentEnvironment();
  if (env === sharedConstants.ENVIRONMENTS.DEVELOPMENT) {
    origins.push(
      'http://localhost:9292',
      'https://localhost:9292',
      'http://127.0.0.1:9292'
    );
  }
  
  // Add Shopify preview domains
  origins.push('https://*.shopifypreview.com');
  
  return origins;
}

// Helper function to validate required secrets
export function validateSecrets() {
  const errors = [];
  const env = getCurrentEnvironment();
  
  // Check critical secrets for production
  if (env === sharedConstants.ENVIRONMENTS.PRODUCTION) {
    const requiredSecrets = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'SHOPIFY_ADMIN_ACCESS_TOKEN',
      'SESSION_SECRET',
      'CSRF_SECRET',
      'KV_REST_API_URL',
      'KV_REST_API_TOKEN'
    ];
    
    requiredSecrets.forEach(secretName => {
      if (!CONFIG.SECRETS[secretName]) {
        errors.push(`Missing required secret: ${secretName}`);
      }
    });
  }
  
  if (errors.length > 0) {
    throw new Error(`Secret validation failed:\n${errors.join('\n')}`);
  }
  
  return true;
}

// Export convenience functions from shared constants
export const {
  getEnvironmentFromBranch,
  getThemeIdForEnvironment,
  getBackendUrlForEnvironment,
  getApiEndpointUrl,
  getShopifyApiUrl
} = sharedConstants;

// Default export for easy importing
export default CONFIG;