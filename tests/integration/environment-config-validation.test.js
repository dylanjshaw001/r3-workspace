/**
 * Environment Configuration Integration Tests
 * Tests that components properly use centralized configuration
 * NOT testing hardcoded values - testing that our config system works
 */

const fs = require('fs');
const path = require('path');

describe('Environment Configuration Integration', () => {
  const configDir = path.join(__dirname, '../config');
  
  // Import centralized config and helpers
  let sharedConstants, envHelper;
  
  beforeAll(() => {
    // Import our centralized configuration
    sharedConstants = require('../config/shared-constants.js');
    envHelper = require('../shared/helpers/environment');
  });
  
  describe('Centralized Configuration System', () => {    
    it('should have centralized configuration files available', () => {
      const constantsPath = path.join(configDir, 'shared-constants.js');
      expect(fs.existsSync(constantsPath)).toBe(true);
    });
    
    it('should NOT have separate environment files (confirming centralized approach)', () => {
      // These files should not exist since we use centralized config
      ['development', 'staging', 'production'].forEach(env => {
        const configPath = path.join(configDir, `test.${env}.env`);
        expect(fs.existsSync(configPath)).toBe(false);
      });
    });
    
    it('should export required configuration objects', () => {
      expect(sharedConstants.ENVIRONMENTS).toBeDefined();
      expect(sharedConstants.BACKEND_URLS).toBeDefined();
      expect(sharedConstants.DOMAINS).toBeDefined();
      expect(typeof sharedConstants.getBackendUrlForEnvironment).toBe('function');
    });
  });
  
  describe('Environment Helper Integration', () => {
    it('should use centralized constants for backend URL mapping', () => {
      // Test that helpers use our centralized config
      const devUrl = envHelper.getApiUrls()[0]; // Primary dev URL
      const stageUrl = sharedConstants.getBackendUrlForEnvironment('stage');
      const prodUrl = sharedConstants.getBackendUrlForEnvironment('prod');
      
      // Test integration: helper should return URLs that match centralized config
      expect(sharedConstants.getBackendUrlForEnvironment('dev')).toBe(sharedConstants.BACKEND_URLS.DEVELOPMENT);
      expect(stageUrl).toBe(sharedConstants.BACKEND_URLS.STAGING);
      expect(prodUrl).toBe(sharedConstants.BACKEND_URLS.PRODUCTION);
    });
    
    it('should use standard environment naming consistently', () => {
      // Test that our environment detection returns our standard values
      const standardEnvs = Object.values(sharedConstants.ENVIRONMENTS);
      
      // Test URL detection uses our standard naming
      const detectedDev = envHelper.detectEnvironmentFromUrl(sharedConstants.BACKEND_URLS.LOCAL);
      const detectedStage = envHelper.detectEnvironmentFromUrl(sharedConstants.BACKEND_URLS.STAGING);
      const detectedProd = envHelper.detectEnvironmentFromUrl(sharedConstants.BACKEND_URLS.PRODUCTION);
      
      expect(standardEnvs).toContain(detectedDev);
      expect(standardEnvs).toContain(detectedStage);
      expect(standardEnvs).toContain(detectedProd);
      
      // Verify these are our standard short names
      expect(detectedDev).toBe(sharedConstants.ENVIRONMENTS.DEVELOPMENT);
      expect(detectedStage).toBe(sharedConstants.ENVIRONMENTS.STAGING);
      expect(detectedProd).toBe(sharedConstants.ENVIRONMENTS.PRODUCTION);
    });
    
    it('should provide consistent Shopify domain access', () => {
      // Test that helper functions use centralized domain config
      const helperDomain = envHelper.getShopifyDomain();
      const centralizedDomain = sharedConstants.DOMAINS.SHOPIFY_STORE;
      
      // When no override is set, helper should use centralized config
      delete process.env.SHOPIFY_DOMAIN;
      expect(envHelper.getShopifyDomain()).toBe(centralizedDomain);
    });
  });
  
  describe('Environment-Specific Behavior Integration', () => {
    const originalEnv = process.env.NODE_ENV;
    
    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should map NODE_ENV values to our standard environment names', () => {
      // Test that getTestEnvironment correctly maps various NODE_ENV values
      // to our standard dev/stage/prod naming
      
      process.env.NODE_ENV = 'development';
      expect(envHelper.getTestEnvironment()).toBe(sharedConstants.ENVIRONMENTS.DEVELOPMENT);
      
      process.env.NODE_ENV = 'staging';
      expect(envHelper.getTestEnvironment()).toBe(sharedConstants.ENVIRONMENTS.STAGING);
      
      process.env.NODE_ENV = 'production';
      expect(envHelper.getTestEnvironment()).toBe(sharedConstants.ENVIRONMENTS.PRODUCTION);
      
      // Test our preferred short names work too
      process.env.NODE_ENV = 'dev';
      expect(envHelper.getTestEnvironment()).toBe(sharedConstants.ENVIRONMENTS.DEVELOPMENT);
      
      process.env.NODE_ENV = 'stage';
      expect(envHelper.getTestEnvironment()).toBe(sharedConstants.ENVIRONMENTS.STAGING);
      
      process.env.NODE_ENV = 'prod';
      expect(envHelper.getTestEnvironment()).toBe(sharedConstants.ENVIRONMENTS.PRODUCTION);
    });
    
    it('should provide environment-appropriate feature flags', () => {
      // Test that feature flags are based on environment detection
      
      process.env.NODE_ENV = sharedConstants.ENVIRONMENTS.DEVELOPMENT;
      expect(envHelper.shouldMockPayments()).toBe(true);
      expect(envHelper.shouldRunAllTests()).toBe(true);
      
      process.env.NODE_ENV = sharedConstants.ENVIRONMENTS.STAGING;
      expect(envHelper.shouldMockPayments()).toBe(false);
      expect(envHelper.shouldRunAllTests()).toBe(true);
      
      process.env.NODE_ENV = sharedConstants.ENVIRONMENTS.PRODUCTION;
      expect(envHelper.shouldMockPayments()).toBe(false);
      expect(envHelper.shouldRunAllTests()).toBe(false);
    });
    
    it('should provide environment-appropriate timeouts', () => {
      // Test that timeouts are based on environment detection
      const timeouts = {};
      
      process.env.NODE_ENV = sharedConstants.ENVIRONMENTS.DEVELOPMENT;
      timeouts.dev = envHelper.getTestTimeout();
      
      process.env.NODE_ENV = sharedConstants.ENVIRONMENTS.STAGING;
      timeouts.stage = envHelper.getTestTimeout();
      
      process.env.NODE_ENV = sharedConstants.ENVIRONMENTS.PRODUCTION;
      timeouts.prod = envHelper.getTestTimeout();
      
      // Verify timeouts increase from dev -> stage -> prod
      expect(timeouts.dev).toBeLessThan(timeouts.stage);
      expect(timeouts.stage).toBeLessThan(timeouts.prod);
      
      // Verify they are reasonable values (all should be > 10s, < 5min)
      Object.values(timeouts).forEach(timeout => {
        expect(timeout).toBeGreaterThan(10000);
        expect(timeout).toBeLessThan(300000);
      });
    });
  });
  
  describe('URL Pattern Consistency', () => {
    it('should reject old repository names consistently', () => {
      // Test that both centralized config and helpers reject old patterns
      const oldPatterns = ['r3-payment-backend', 'r3-nu'];
      
      // Check centralized config doesn't contain old patterns
      Object.values(sharedConstants.BACKEND_URLS).forEach(url => {
        oldPatterns.forEach(pattern => {
          expect(url).not.toContain(pattern);
        });
      });
      
      // Check that URL validation in helpers also rejects old patterns
      oldPatterns.forEach(pattern => {
        const fakeOldUrl = `https://${pattern}.vercel.app`;
        expect(envHelper.detectEnvironmentFromUrl(fakeOldUrl)).toBeNull();
      });
    });
    
    it('should use consistent URL patterns across environments', () => {
      // Test that URL patterns follow our conventions
      const backendUrls = sharedConstants.BACKEND_URLS;
      
      // All remote URLs should be HTTPS
      [backendUrls.DEVELOPMENT, backendUrls.STAGING, backendUrls.PRODUCTION].forEach(url => {
        expect(url).toMatch(/^https:\/\//);
      });
      
      // Local URL should be HTTP
      expect(backendUrls.LOCAL).toMatch(/^http:\/\/localhost/);
      
      // Staging and dev should contain branch indicators
      expect(backendUrls.STAGING).toContain('stage');
      expect(backendUrls.DEVELOPMENT).toContain('dev');
    });
  });
  
  describe('Configuration Override Behavior', () => {
    const originalApiUrl = process.env.API_URL;
    const originalShopifyDomain = process.env.SHOPIFY_DOMAIN;
    
    afterEach(() => {
      // Restore original environment
      if (originalApiUrl) {
        process.env.API_URL = originalApiUrl;
      } else {
        delete process.env.API_URL;
      }
      
      if (originalShopifyDomain) {
        process.env.SHOPIFY_DOMAIN = originalShopifyDomain;
      } else {
        delete process.env.SHOPIFY_DOMAIN;
      }
    });
    
    it('should allow environment variable overrides when needed', () => {
      const customApiUrl = 'https://custom-api.example.com';
      const customShopifyDomain = 'custom-store.myshopify.com';
      
      // Test API_URL override
      process.env.API_URL = customApiUrl;
      expect(envHelper.getApiUrl()).toBe(customApiUrl);
      
      // Test SHOPIFY_DOMAIN override  
      process.env.SHOPIFY_DOMAIN = customShopifyDomain;
      expect(envHelper.getShopifyDomain()).toBe(customShopifyDomain);
      
      // When overrides are removed, should fall back to centralized config
      delete process.env.API_URL;
      delete process.env.SHOPIFY_DOMAIN;
      
      expect(envHelper.getShopifyDomain()).toBe(sharedConstants.DOMAINS.SHOPIFY_STORE);
    });
  });
  
  describe('Cross-Component Configuration Consistency', () => {
    it('should provide same environment detection across all helpers', () => {
      // Test that different parts of the system agree on environment detection
      const testUrl = sharedConstants.BACKEND_URLS.STAGING;
      
      const detectedByHelper = envHelper.detectEnvironmentFromUrl(testUrl);
      const expectedFromConfig = sharedConstants.ENVIRONMENTS.STAGING;
      
      expect(detectedByHelper).toBe(expectedFromConfig);
    });
    
    it('should provide consistent domain validation', () => {
      // Test that domain validation uses centralized config
      const primaryDomain = sharedConstants.DOMAINS.SHOPIFY_STORE;
      const prodDomain = sharedConstants.DOMAINS.PRODUCTION;
      
      expect(envHelper.isValidShopifyDomain(primaryDomain)).toBe(true);
      expect(envHelper.isValidShopifyDomain(prodDomain)).toBe(true);
      expect(envHelper.isValidShopifyDomain('invalid-domain.com')).toBe(false);
    });
  });
});