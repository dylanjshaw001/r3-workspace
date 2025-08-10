/**
 * Authentication setup helpers for staging/production API testing
 */

const fetch = require('node-fetch');
const { createTestCustomer, createTestCart } = require('./test-helpers');

/**
 * Create a test session for staging/production environments
 * @param {string} apiUrl - The API base URL
 * @param {Object} options - Session options
 * @returns {Promise<Object>} Session data with tokens
 */
async function createAuthenticatedSession(apiUrl, options = {}) {
  const customer = createTestCustomer(options.customer);
  const cart = createTestCart(options.cart);
  
  try {
    // Create session
    const sessionResponse = await fetch(`${apiUrl}/api/checkout/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': options.origin || 'https://sqqpyb-yq.myshopify.com',
        'User-Agent': 'test-runner/1.0.0'
      },
      body: JSON.stringify({
        cartToken: cart.token,
        cartTotal: cart.total_price,
        domain: options.domain || 'sqqpyb-yq.myshopify.com'
      })
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.text();
      throw new Error(`Session creation failed: ${sessionResponse.status} ${error}`);
    }

    const sessionData = await sessionResponse.json();

    // Get CSRF token
    const csrfResponse = await fetch(`${apiUrl}/api/checkout/csrf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionData.sessionToken}`,
        'Origin': options.origin || 'https://sqqpyb-yq.myshopify.com'
      }
    });

    if (!csrfResponse.ok) {
      throw new Error(`CSRF token fetch failed: ${csrfResponse.status}`);
    }

    const csrfData = await csrfResponse.json();

    return {
      sessionToken: sessionData.sessionToken,
      csrfToken: csrfData.csrfToken,
      customer,
      cart,
      apiUrl,
      headers: {
        'Authorization': `Bearer ${sessionData.sessionToken}`,
        'X-CSRF-Token': csrfData.csrfToken,
        'Content-Type': 'application/json',
        'Origin': options.origin || 'https://sqqpyb-yq.myshopify.com'
      }
    };
  } catch (error) {
    console.warn(`⚠️  Authentication setup failed: ${error.message}`);
    return null;
  }
}

/**
 * Make authenticated API request
 * @param {Object} session - Session data from createAuthenticatedSession
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Request options
 * @returns {Promise<Response>} Fetch response
 */
async function authenticatedRequest(session, endpoint, options = {}) {
  if (!session) {
    throw new Error('No valid session available');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${session.apiUrl}${endpoint}`;
  
  return fetch(url, {
    method: options.method || 'GET',
    headers: {
      ...session.headers,
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    ...options
  });
}

/**
 * Check if API server is available
 * @param {string} apiUrl - The API base URL
 * @param {number} timeout - Request timeout in ms
 * @returns {Promise<boolean>} True if server is available
 */
async function checkServerAvailability(apiUrl, timeout = 5000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Setup test environment authentication
 * @param {string} environment - Environment name (development, staging, production)
 * @returns {Promise<Object|null>} Authentication session or null if not available
 */
async function setupTestAuth(environment = null) {
  const env = environment || global.environment?.getTestEnvironment() || 'development';
  const apiUrl = global.environment?.getApiUrl();
  
  console.log(`🔐 Setting up authentication for ${env} environment...`);
  
  // Skip authentication setup for development (uses mocks)
  if (env === 'development') {
    console.log('📝 Development environment - using mocks');
    return null;
  }
  
  // Check if server is available
  const serverAvailable = await checkServerAvailability(apiUrl);
  if (!serverAvailable) {
    console.warn(`⚠️  API server not available at ${apiUrl}`);
    return null;
  }
  
  // Create authenticated session for staging/production
  const session = await createAuthenticatedSession(apiUrl, {
    origin: env === 'production' ? 'https://sqqpyb-yq.myshopify.com' : 'https://sqqpyb-yq.myshopify.com',
    domain: 'sqqpyb-yq.myshopify.com'
  });
  
  if (session) {
    console.log(`✅ Authentication setup complete for ${env}`);
  } else {
    console.warn(`❌ Authentication setup failed for ${env}`);
  }
  
  return session;
}

/**
 * Global test session storage
 */
let globalTestSession = null;

/**
 * Get or create global test session
 * @returns {Promise<Object|null>} Global test session
 */
async function getGlobalTestSession() {
  if (!globalTestSession) {
    globalTestSession = await setupTestAuth();
  }
  return globalTestSession;
}

/**
 * Clear global test session
 */
function clearGlobalTestSession() {
  globalTestSession = null;
}

module.exports = {
  createAuthenticatedSession,
  authenticatedRequest,
  checkServerAvailability,
  setupTestAuth,
  getGlobalTestSession,
  clearGlobalTestSession
};