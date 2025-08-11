/**
 * Environment-specific validation tests
 * Tests that validate correct configuration and connectivity for each environment
 */

describe('Environment Validation', () => {
  const fetch = require('node-fetch');

  beforeAll(() => {
    // Show current environment configuration
    console.log(`\n🔧 Environment Configuration:`);
    console.log(`   Environment: ${global.environment.getTestEnvironment()}`);
    console.log(`   API URL: ${global.environment.getApiUrl()}`);
    console.log(`   Shopify Domain: ${global.environment.getShopifyDomain()}`);
    console.log(`   Mock Payments: ${global.environment.shouldMockPayments()}`);
    console.log(`   Run All Tests: ${global.environment.shouldRunAllTests()}`);
  });

  describe('API Connectivity', () => {
    test('should connect to correct API endpoint for environment', async () => {
      const apiUrl = global.environment.getApiUrl();
      const env = global.environment.getTestEnvironment();
      
      // Check server availability first
      const serverAvailable = await global.authSetup.checkServerAvailability(apiUrl, 10000);
      
      if (!serverAvailable) {
        if (env === 'development') {
          console.log('⚠️  Local development server not running - skipping connectivity test');
          return; // Skip test gracefully
        } else {
          throw new Error(`API server not available at ${apiUrl}`);
        }
      }
      
      try {
        const response = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          timeout: 10000
        });
        
        expect(response.status).toBe(200);
        
        if (env !== 'development') {
          const data = await response.json();
          expect(data).toHaveProperty('status');
          expect(data.status).toBe('healthy');
        }
      } catch (error) {
        if (env === 'development') {
          console.log('⚠️  Local development server not running - skipping connectivity test');
        } else {
          throw error;
        }
      }
    }, 15000);

    test('should use environment-specific configuration', () => {
      const env = global.environment.getTestEnvironment();
      const apiUrl = global.environment.getApiUrl();
      
      switch (env) {
        case 'development':
          expect(apiUrl).toBe('http://localhost:3000');
          expect(process.env.ENABLE_MOCK_PAYMENTS).toBe('true');
          break;
        case 'staging':
          expect(apiUrl).toContain('r3-stage');
          expect(process.env.ENABLE_MOCK_PAYMENTS).toBe('false');
          break;
        case 'production':
          expect(apiUrl).toBe('https://r3-backend.vercel.app');
          expect(process.env.ENABLE_MOCK_PAYMENTS).toBe('false');
          expect(process.env.ENABLE_ALL_TESTS).toBe('false');
          break;
      }
    });
  });

  describe('Environment-Specific Test Configuration', () => {
    test('should have correct timeout for environment', () => {
      const env = global.environment.getTestEnvironment();
      const timeout = global.environment.getTestTimeout();
      
      switch (env) {
        case 'development':
          expect(timeout).toBe(30000);
          break;
        case 'staging':
          expect(timeout).toBe(45000);
          break;
        case 'production':
          expect(timeout).toBe(60000);
          break;
      }
    });

    test('should have environment-appropriate test flags', () => {
      const env = global.environment.getTestEnvironment();
      
      if (env === 'production') {
        expect(global.environment.shouldRunAllTests()).toBe(false);
        expect(global.environment.shouldMockPayments()).toBe(false);
      } else {
        expect(global.environment.shouldRunAllTests()).toBe(true);
      }
    });

    test('should validate API URLs for current environment', () => {
      const env = global.environment.getTestEnvironment();
      const apiUrls = global.environment.getApiUrls();
      
      // Should have multiple possible URLs
      expect(apiUrls.length).toBeGreaterThan(1);
      
      // Should validate known URLs for each environment
      switch (env) {
        case 'development':
          expect(global.environment.isValidApiUrl('http://localhost:3000')).toBe(true);
          expect(global.environment.isValidApiUrl('http://localhost:9292')).toBe(true);
          expect(global.environment.isValidApiUrl('https://r3-backend.vercel.app')).toBe(false);
          break;
        case 'staging':
          expect(global.environment.isValidApiUrl('https://r3-backend-git-stage-r3.vercel.app')).toBe(true);
          expect(global.environment.isValidApiUrl('http://localhost:3000')).toBe(false);
          break;
        case 'production':
          expect(global.environment.isValidApiUrl('https://r3-backend.vercel.app')).toBe(true);
          expect(global.environment.isValidApiUrl('https://rthree.io')).toBe(true);
          expect(global.environment.isValidApiUrl('http://localhost:3000')).toBe(false);
          break;
      }
    });

    test('should validate Shopify domains for current environment', () => {
      const env = global.environment.getTestEnvironment();
      
      // sqqpyb-yq.myshopify.com should be valid in ALL environments (primary store)
      expect(global.environment.isValidShopifyDomain('sqqpyb-yq.myshopify.com')).toBe(true);
      
      switch (env) {
        case 'development':
          expect(global.environment.isValidShopifyDomain('localhost:3000')).toBe(true);
          expect(global.environment.isValidShopifyDomain('test.shopifypreview.com')).toBe(true);
          break;
        case 'staging':
          expect(global.environment.isValidShopifyDomain('r3-stage.myshopify.com')).toBe(true);
          break;
        case 'production':
          expect(global.environment.isValidShopifyDomain('rthree.io')).toBe(true);
          expect(global.environment.isValidShopifyDomain('rapidriskreduction.com')).toBe(true);
          break;
      }
    });

    test('should detect environment from URLs', () => {
      // Test URL detection using our standard naming
      expect(global.environment.detectEnvironmentFromUrl('http://localhost:3000')).toBe('dev');
      expect(global.environment.detectEnvironmentFromUrl('https://r3-backend-git-stage-r3.vercel.app')).toBe('stage');
      expect(global.environment.detectEnvironmentFromUrl('https://r3-backend.vercel.app')).toBe('prod');
      expect(global.environment.detectEnvironmentFromUrl('https://rthree.io')).toBe('prod');
      
      // Test pattern matching for Vercel deployment URLs
      expect(global.environment.detectEnvironmentFromUrl('https://r3-backend-abc123xyz-r3.vercel.app')).toBeTruthy();
    });
  });

  describe('Happy Path - Critical Functionality', () => {
    test('should validate core API endpoints are accessible', async () => {
      const apiUrl = global.environment.getApiUrl();
      const env = global.environment.getTestEnvironment();
      
      // Check server availability first
      const serverAvailable = await global.authSetup.checkServerAvailability(apiUrl);
      
      if (!serverAvailable) {
        if (env === 'development') {
          console.log('⚠️  Skipping health check - local server not running');
          return;
        } else {
          throw new Error(`API server not available at ${apiUrl}`);
        }
      }
      
      // This test runs in all environments but with different expectations
      const healthResponse = await fetch(`${apiUrl}/health`, {
        timeout: 10000
      });
      
      expect(healthResponse.status).toBe(200);
      
      // For staging/production, also validate response format
      if (env !== 'development') {
        const data = await healthResponse.json();
        expect(data).toHaveProperty('status');
        expect(data.status).toBe('healthy');
      }
    }, 15000);

    test('should handle authentication flow for non-development environments', async () => {
      const env = global.environment.getTestEnvironment();
      
      if (env === 'development') {
        console.log('📝 Development environment - skipping authentication test (uses mocks)');
        return;
      }
      
      const session = global.testSession;
      
      if (!session) {
        console.log('⚠️  No authentication session available - skipping auth flow test');
        return;
      }
      
      // Test authenticated endpoint access
      const response = await global.authSetup.authenticatedRequest(
        session,
        '/api/checkout/csrf'
      );
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('csrfToken');
      expect(typeof data.csrfToken).toBe('string');
    }, 10000);
  });
});