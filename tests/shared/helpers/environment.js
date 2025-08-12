/**
 * Environment detection and configuration utilities for tests
 * Uses centralized configuration from shared-constants.js
 */

// Import centralized configuration (CommonJS version for tests)
const { 
  ENVIRONMENTS, 
  BACKEND_URLS, 
  DOMAINS,
  getBackendUrlForEnvironment,
  getEnvironmentFromBranch 
} = require('../../config/shared-constants.js');

// Additional domains for flexibility (using centralized config as base)
const ADDITIONAL_SHOPIFY_DOMAINS = {
  dev: [
    'localhost:3000',           // Local frontend dev
    'localhost:9292',           // From domains.js
    '127.0.0.1:3000',
    /.*\.shopifypreview\.com$/,  // Shopify preview domains
    /.*\.ngrok\.io$/,           // ngrok tunnels for mobile testing  
    /.*\.loca\.lt$/             // localtunnel for testing
  ],
  stage: [
    'r3-stage.myshopify.com',   // Staging-specific store (if exists)
    'staging.rthree.io'         // Future staging domain
  ],
  prod: [
    'shop.rapidriskreduction.com', // Shop subdomain
    'www.rapidriskreduction.com'   // Business domain with www
  ]
};

/**
 * Get the current test environment
 * @returns {string} The environment: 'dev', 'stage', or 'prod'
 */
function getTestEnvironment() {
  // Check NODE_ENV first
  const nodeEnv = process.env.NODE_ENV;
  
  // Map NODE_ENV values to our test environments
  switch (nodeEnv) {
    case 'development':
    case 'dev':
      return 'dev';
    case 'staging':
    case 'stage':
      return 'stage';
    case 'production':
    case 'prod':
      return 'prod';
    case 'test':
    default:
      // Default to dev for test environment
      return 'dev';
  }
}

/**
 * Get the environment configuration file path
 * @param {string} env - The environment name
 * @returns {string} The path to the environment config file (now just returns generic test.env)
 */
function getEnvConfigPath(env = null) {
  // All environments now use the same base configuration
  // Specific settings are determined by environment variables and centralized config
  return `./config/test.env`;
}

/**
 * Get environment-specific API URLs (all possible)
 * @returns {string[]} Array of possible API URLs for current environment
 */
function getApiUrls() {
  const env = getTestEnvironment();
  
  // Get primary URL from centralized config
  const primaryUrl = getBackendUrlForEnvironment(env);
  
  // Include additional URLs for flexibility/fallback
  const additionalUrls = [];
  
  if (env === 'dev') {
    additionalUrls.push(
      BACKEND_URLS.LOCAL,
      'http://localhost:3001',
      'http://localhost:9292',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:9292'
    );
  }
  
  return [primaryUrl, ...additionalUrls];
}

/**
 * Get primary API URL for current environment (for backwards compatibility)
 * @returns {string} The primary API URL for current environment
 */
function getApiUrl() {
  // Check if API_URL is explicitly set in environment
  if (process.env.API_URL) {
    return process.env.API_URL;
  }
  
  // Use centralized configuration
  const env = getTestEnvironment();
  return getBackendUrlForEnvironment(env);
}

/**
 * Get environment-specific Shopify domains (all possible)
 * @returns {Array} Array of possible Shopify domains for current environment
 */
function getShopifyDomains() {
  const env = getTestEnvironment();
  
  // Get primary domains from centralized config
  const primaryDomains = [
    DOMAINS.SHOPIFY_STORE, // Primary store for all environments
    DOMAINS.PRODUCTION,    // Future production domain
    DOMAINS.PRODUCTION_WWW, // With www
    DOMAINS.ALTERNATE_1,   // Business domain
    DOMAINS.ALTERNATE_2    // Shop subdomain
  ];
  
  // Add additional domains for flexibility
  const additionalDomains = ADDITIONAL_SHOPIFY_DOMAINS[env] || [];
  
  return [...primaryDomains, ...additionalDomains];
}

/**
 * Get primary Shopify domain for current environment (for backwards compatibility)
 * @returns {string} The primary Shopify domain for current environment
 */
function getShopifyDomain() {
  // Check if SHOPIFY_DOMAIN is explicitly set in environment
  if (process.env.SHOPIFY_DOMAIN) {
    return process.env.SHOPIFY_DOMAIN;
  }
  
  // Use centralized configuration - primary store for all environments
  return DOMAINS.SHOPIFY_STORE;
}

/**
 * Check if a URL is valid for the current environment
 * @param {string} url - The URL to validate
 * @returns {boolean} True if URL is valid for current environment
 */
function isValidApiUrl(url) {
  const validUrls = getApiUrls();
  
  return validUrls.some(validUrl => {
    if (validUrl instanceof RegExp) {
      return validUrl.test(url);
    }
    return validUrl === url;
  });
}

/**
 * Check if a Shopify domain is valid for the current environment
 * @param {string} domain - The domain to validate
 * @returns {boolean} True if domain is valid for current environment
 */
function isValidShopifyDomain(domain) {
  const validDomains = getShopifyDomains();
  
  return validDomains.some(validDomain => {
    if (validDomain instanceof RegExp) {
      return validDomain.test(domain);
    }
    return validDomain === domain;
  });
}

/**
 * Detect environment based on API URL
 * @param {string} url - The API URL to analyze
 * @returns {string|null} The detected environment or null if unknown
 */
function detectEnvironmentFromUrl(url) {
  // Check against centralized backend URLs - return our standard values
  if (url === BACKEND_URLS.PRODUCTION) return 'prod';
  if (url === BACKEND_URLS.STAGING) return 'stage';  
  if (url === BACKEND_URLS.DEVELOPMENT) return 'dev';
  if (url === BACKEND_URLS.LOCAL) return 'dev';
  
  // Check additional patterns
  if (url.includes('localhost') || url.includes('127.0.0.1')) return 'dev';
  if (url.includes('git-dev-r3.vercel.app')) return 'dev';
  if (url.includes('git-stage-r3.vercel.app')) return 'stage';
  if (url.includes('git-prod-r3.vercel.app')) return 'prod';
  if (url.includes('r3-backend.vercel.app')) return 'prod';
  if (url.includes('rthree.io')) return 'prod';
  
  return null;
}

/**
 * Check if we should run all tests in current environment
 * @returns {boolean} True if all tests should run
 */
function shouldRunAllTests() {
  const env = getTestEnvironment();
  return env !== 'prod';
}

/**
 * Check if we should use mocked payments
 * @returns {boolean} True if payments should be mocked
 */
function shouldMockPayments() {
  const env = getTestEnvironment();
  return env === 'dev';
}

/**
 * Get test timeout for current environment
 * @returns {number} Timeout in milliseconds
 */
function getTestTimeout() {
  const env = getTestEnvironment();
  
  switch (env) {
    case 'dev':
      return 30000; // 30 seconds
    case 'stage':
      return 45000; // 45 seconds
    case 'prod':
      return 60000; // 60 seconds
    default:
      return 30000;
  }
}

module.exports = {
  getTestEnvironment,
  getEnvConfigPath,
  getApiUrl,
  getApiUrls,
  getShopifyDomain,
  getShopifyDomains,
  isValidApiUrl,
  isValidShopifyDomain,
  detectEnvironmentFromUrl,
  shouldRunAllTests,
  shouldMockPayments,
  getTestTimeout,
  // Export centralized constants for compatibility
  BACKEND_URLS,
  DOMAINS,
  ADDITIONAL_SHOPIFY_DOMAINS
};