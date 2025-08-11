/**
 * Shared Constants for Tests (CommonJS version)
 * 
 * This is a CommonJS version of the main shared-constants.js file
 * for use in the Jest test environment.
 */

// Environment names - our standard naming convention
const ENVIRONMENTS = {
  DEVELOPMENT: 'dev',
  STAGING: 'stage', 
  PRODUCTION: 'prod'
};

// Shopify store domains
const DOMAINS = {
  SHOPIFY_STORE: 'sqqpyb-yq.myshopify.com',
  PRODUCTION: 'rthree.io',
  PRODUCTION_WWW: 'www.rthree.io',
  ALTERNATE_1: 'rapidriskreduction.com',
  ALTERNATE_2: 'shop.rapidriskreduction.com'
};

// Backend deployment URLs
const BACKEND_URLS = {
  PRODUCTION: 'https://r3-backend.vercel.app',
  STAGING: 'https://r3-backend-git-stage-r3.vercel.app',
  DEVELOPMENT: 'https://r3-backend-git-dev-r3.vercel.app',
  LOCAL: 'http://localhost:3000'
};

// Get backend URL for environment
function getBackendUrlForEnvironment(env) {
  switch (env) {
    case ENVIRONMENTS.PRODUCTION:
      return BACKEND_URLS.PRODUCTION;
    case ENVIRONMENTS.STAGING:
      return BACKEND_URLS.STAGING;
    case ENVIRONMENTS.DEVELOPMENT:
      return BACKEND_URLS.DEVELOPMENT;
    default:
      return BACKEND_URLS.LOCAL;
  }
}

// Get environment from branch name
function getEnvironmentFromBranch(branch) {
  const branchLower = branch?.toLowerCase();
  
  if (branchLower === 'prod' || branchLower === 'main') {
    return ENVIRONMENTS.PRODUCTION;
  }
  if (branchLower === 'stage') {
    return ENVIRONMENTS.STAGING;
  }
  if (branchLower === 'dev') {
    return ENVIRONMENTS.DEVELOPMENT;
  }
  
  // Default to development for unknown branches
  return ENVIRONMENTS.DEVELOPMENT;
}

module.exports = {
  ENVIRONMENTS,
  DOMAINS,
  BACKEND_URLS,
  getBackendUrlForEnvironment,
  getEnvironmentFromBranch
};