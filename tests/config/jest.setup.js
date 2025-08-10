// Jest setup file - runs before each test suite

// Load environment-specific configuration
const { getEnvConfigPath, getTestTimeout, shouldMockPayments } = require('../shared/helpers/environment');
require('dotenv').config({ path: getEnvConfigPath() });

// Set environment-specific timeout
const testTimeout = getTestTimeout();
jest.setTimeout(testTimeout);

// Global test utilities
global.testUtils = require('@helpers/utils/test-helpers');
global.fixtures = require('@fixtures');

// Global environment helpers
global.environment = require('../shared/helpers/environment');

// Mock console methods to reduce noise
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render')
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

// Environment-specific MSW setup
const shouldMock = shouldMockPayments();

// Setup fetch for Node environment
global.fetch = require('node-fetch');

// Setup authentication helpers
const authSetup = require('../shared/helpers/auth-setup');
global.authSetup = authSetup;

// Setup MSW for API mocking (only in development environment)
let server;
if (shouldMock) {
  const { setupServer } = require('msw/node');
  const { handlers } = require('@helpers/utils/mock-handlers');
  
  server = setupServer(...handlers);
  
  beforeAll(async () => {
    server.listen({ 
      onUnhandledRequest: 'warn'
    });
    console.log(`🧪 Test environment: ${global.environment.getTestEnvironment()}`);
    console.log(`🔗 API URL: ${global.environment.getApiUrl()}`);
    console.log(`🛍️  Shopify Domain: ${global.environment.getShopifyDomain()}`);
    console.log(`🔒 Mock Payments: ENABLED`);
  });
  
  afterEach(() => {
    server.resetHandlers();
    // Clear rate limiting state between tests
    const { clearTestSessions, resetRateLimiting } = require('@helpers/utils/mock-handlers');
    clearTestSessions();
    resetRateLimiting();
  });
  
  afterAll(() => {
    server.close();
  });
} else {
  beforeAll(async () => {
    console.log(`🧪 Test environment: ${global.environment.getTestEnvironment()}`);
    console.log(`🔗 API URL: ${global.environment.getApiUrl()}`);
    console.log(`🛍️  Shopify Domain: ${global.environment.getShopifyDomain()}`);
    console.log(`🔒 Mock Payments: DISABLED`);
    
    // Setup authentication for staging/production
    const session = await authSetup.setupTestAuth();
    global.testSession = session;
    
    if (!session) {
      console.warn('⚠️  No authentication session available - some tests may be skipped');
    }
  });
  
  afterAll(() => {
    authSetup.clearGlobalTestSession();
  });
}

// Custom matchers
expect.extend({
  toBeValidSession(received) {
    const pass = Boolean(
      received &&
      typeof received === 'object' &&
      received.sessionToken &&
      received.csrfToken &&
      received.expiresAt
    );
    
    return {
      pass,
      message: () => 
        pass
          ? `expected ${JSON.stringify(received)} not to be a valid session`
          : `expected ${JSON.stringify(received)} to be a valid session with sessionToken, csrfToken, and expiresAt`
    };
  },
  
  toBeValidPaymentIntent(received) {
    const pass = Boolean(
      received &&
      typeof received === 'object' &&
      received.id &&
      received.id.startsWith('pi_') &&
      received.client_secret
    );
    
    return {
      pass,
      message: () => 
        pass
          ? `expected ${JSON.stringify(received)} not to be a valid payment intent`
          : `expected ${JSON.stringify(received)} to be a valid payment intent with id and client_secret`
    };
  }
});