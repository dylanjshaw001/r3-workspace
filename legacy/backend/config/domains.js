// Domain configuration for multi-store support
import { CONFIG, getStoreConfig as getConfigStore } from './constants.js';
import { URLS } from './urls.js';

// Helper function to get environment variable with fallbacks
function getEnvVar(baseVarName) {
  // Determine environment based on Vercel Git branch
  // VERCEL_GIT_COMMIT_REF contains the branch name
  const gitBranch = process.env.VERCEL_GIT_COMMIT_REF;
  
  // Map branches to their environment suffixes
  const branchSuffixMap = {
    'prod': 'PROD',
    'stage': 'STAGE',
    'dev': 'DEV',
    // Legacy branch names (can be removed later)
    'main': 'PROD',
    'r3-prod': 'PROD',
    'r3-stage': 'STAGE',
    'r3-dev': 'DEV'
  };
  
  // Get the appropriate suffix for this branch
  const suffix = branchSuffixMap[gitBranch];
  
  // Check for branch-specific variable first
  if (suffix && process.env[`${baseVarName}_${suffix}`]) {
    return process.env[`${baseVarName}_${suffix}`];
  }
  
  // For STRIPE_SECRET_KEY, also check the TEST variant for all non-production branches
  if (baseVarName === 'STRIPE_SECRET_KEY' && !['prod', 'main', 'r3-prod'].includes(gitBranch) && process.env[`${baseVarName}_TEST`]) {
    return process.env[`${baseVarName}_TEST`];
  }
  
  // For SHOPIFY_ADMIN_ACCESS_TOKEN, check if there's a TEST variant
  if (baseVarName === 'SHOPIFY_ADMIN_ACCESS_TOKEN' && !['prod', 'main', 'r3-prod'].includes(gitBranch) && process.env[`${baseVarName}_TEST`]) {
    return process.env[`${baseVarName}_TEST`];
  }
  
  // Fallback to base name
  return process.env[baseVarName];
}

// Get values from constants
const SHOPIFY_STORE_DOMAIN = CONFIG.DOMAINS.SHOPIFY_STORE;
const DOMAIN_PRODUCTION = CONFIG.DOMAINS.PRODUCTION;
const DEV_PORT_FRONTEND = CONFIG.PORTS.FRONTEND_DEV;

export const STORE_CONFIG = {
  // Current testing domain (Shopify temporary domain)
  [SHOPIFY_STORE_DOMAIN]: {
    shopifyDomain: SHOPIFY_STORE_DOMAIN,
    shopifyToken: getEnvVar('SHOPIFY_ADMIN_ACCESS_TOKEN'),
    storeName: 'R3 Store (Testing)'
  },

  // Local development
  [`localhost:${DEV_PORT_FRONTEND}`]: {
    shopifyDomain: SHOPIFY_STORE_DOMAIN,
    shopifyToken: getEnvVar('SHOPIFY_ADMIN_ACCESS_TOKEN'),
    storeName: 'R3 Store (Local Dev)'
  },

  // Staging environment (using same store with different theme)
  // Environment is detected via Git branch, not domain

  // Future production domain (after migration from Webflow)
  [DOMAIN_PRODUCTION]: {
    shopifyDomain: SHOPIFY_STORE_DOMAIN,
    shopifyToken: getEnvVar('SHOPIFY_ADMIN_ACCESS_TOKEN'),
    storeName: 'R3 Store (Production)'
  },

  // Also support www subdomain
  [`www.${DOMAIN_PRODUCTION}`]: {
    shopifyDomain: SHOPIFY_STORE_DOMAIN,
    shopifyToken: getEnvVar('SHOPIFY_ADMIN_ACCESS_TOKEN'),
    storeName: 'R3 Store (Production)'
  },

  // Default configuration for unknown domains
  'default': {
    shopifyDomain: SHOPIFY_STORE_DOMAIN,
    shopifyToken: getEnvVar('SHOPIFY_ADMIN_ACCESS_TOKEN'),
    storeName: 'R3 Store'
  }
};

export function getStoreConfig(domain) {
  // Remove protocol and trailing slashes
  const cleanDomain = domain?.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return STORE_CONFIG[cleanDomain] || STORE_CONFIG['default'];
}
