/**
 * Environment detection and configuration utilities for tests
 */

// All possible API URLs for each environment
const ENVIRONMENT_API_URLS = {
  development: [
    // Local development servers (common ports)
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:9292',  // From domains.js config
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001', 
    'http://127.0.0.1:9292',
    // Vercel dev branch deployments (if testing against deployed dev)
    'https://r3-backend-git-dev-r3.vercel.app',
    // Pattern for any Vercel dev deployment
    /^https:\/\/r3-backend-[a-z0-9]+-r3\.vercel\.app$/,
    // ngrok or tunnel URLs for webhook testing (pattern)
    /^https:\/\/[a-z0-9-]+\.ngrok\.io$/,
    /^https:\/\/[a-z0-9-]+\.loca\.lt$/
  ],
  staging: [
    // Vercel staging branch deployments (from your examples)
    'https://r3-backend-git-stage-r3.vercel.app',
    'https://r3-backend-oormkr1d8-r3.vercel.app',
    // Pattern for any Vercel staging deployment
    /^https:\/\/r3-backend-[a-z0-9]+-r3\.vercel\.app$/
  ],
  production: [
    // Primary Vercel domain
    'https://r3-backend.vercel.app',
    // Vercel prod branch deployments  
    'https://r3-backend-git-prod-r3.vercel.app',
    'https://r3-backend-dizzuoiq6-r3.vercel.app',
    // Future primary domain (when API moves there)
    'https://api.rthree.io',
    'https://rthree.io',
    'https://www.rthree.io',
    // Alternative business domains
    'https://rapidriskreduction.com',
    'https://api.rapidriskreduction.com',
    // Pattern for any Vercel production deployment
    /^https:\/\/r3-backend-[a-z0-9]+-r3\.vercel\.app$/
  ]
};

// All possible Shopify/Frontend domains for each environment  
const ENVIRONMENT_SHOPIFY_DOMAINS = {
  development: [
    'sqqpyb-yq.myshopify.com',  // Primary store (current)
    'localhost:3000',           // Local frontend dev
    'localhost:9292',           // From domains.js
    '127.0.0.1:3000',
    /.*\.shopifypreview\.com$/,  // Shopify preview domains
    /.*\.ngrok\.io$/,           // ngrok tunnels for mobile testing  
    /.*\.loca\.lt$/             // localtunnel for testing
  ],
  staging: [
    'sqqpyb-yq.myshopify.com',  // Primary store (current)
    'r3-stage.myshopify.com',   // Staging-specific store (if exists)
    'staging.rthree.io'         // Future staging domain
  ],
  production: [
    'sqqpyb-yq.myshopify.com',    // Primary store (current)
    'rthree.io',                  // Future primary domain  
    'www.rthree.io',              // Future primary with www
    'rapidriskreduction.com',     // Business domain
    'shop.rapidriskreduction.com', // Shop subdomain
    'www.rapidriskreduction.com'   // Business domain with www
  ]
};

/**
 * Get the current test environment
 * @returns {string} The environment: 'development', 'staging', or 'production'
 */
function getTestEnvironment() {
  // Check NODE_ENV first
  const nodeEnv = process.env.NODE_ENV;
  
  // Map NODE_ENV values to our test environments
  switch (nodeEnv) {
    case 'development':
    case 'dev':
      return 'development';
    case 'staging':
    case 'stage':
      return 'staging';
    case 'production':
    case 'prod':
      return 'production';
    case 'test':
    default:
      // Default to development for test environment
      return 'development';
  }
}

/**
 * Get the environment configuration file path
 * @param {string} env - The environment name
 * @returns {string} The path to the environment config file
 */
function getEnvConfigPath(env = null) {
  const environment = env || getTestEnvironment();
  return `./config/test.${environment}.env`;
}

/**
 * Get environment-specific API URLs (all possible)
 * @returns {string[]} Array of possible API URLs for current environment
 */
function getApiUrls() {
  const env = getTestEnvironment();
  return ENVIRONMENT_API_URLS[env] || ENVIRONMENT_API_URLS.development;
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
  
  const urls = getApiUrls();
  return urls[0]; // Return the first (primary) URL
}

/**
 * Get environment-specific Shopify domains (all possible)
 * @returns {Array} Array of possible Shopify domains for current environment
 */
function getShopifyDomains() {
  const env = getTestEnvironment();
  return ENVIRONMENT_SHOPIFY_DOMAINS[env] || ENVIRONMENT_SHOPIFY_DOMAINS.development;
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
  
  const domains = getShopifyDomains();
  return domains[0]; // Return the first (primary) domain
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
  for (const [env, urls] of Object.entries(ENVIRONMENT_API_URLS)) {
    const isMatch = urls.some(validUrl => {
      if (validUrl instanceof RegExp) {
        return validUrl.test(url);
      }
      return validUrl === url;
    });
    
    if (isMatch) {
      return env;
    }
  }
  return null;
}

/**
 * Check if we should run all tests in current environment
 * @returns {boolean} True if all tests should run
 */
function shouldRunAllTests() {
  const env = getTestEnvironment();
  return env !== 'production';
}

/**
 * Check if we should use mocked payments
 * @returns {boolean} True if payments should be mocked
 */
function shouldMockPayments() {
  const env = getTestEnvironment();
  return env === 'development';
}

/**
 * Get test timeout for current environment
 * @returns {number} Timeout in milliseconds
 */
function getTestTimeout() {
  const env = getTestEnvironment();
  
  switch (env) {
    case 'development':
      return 30000; // 30 seconds
    case 'staging':
      return 45000; // 45 seconds
    case 'production':
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
  ENVIRONMENT_API_URLS,
  ENVIRONMENT_SHOPIFY_DOMAINS
};