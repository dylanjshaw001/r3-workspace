/**
 * Environment Configuration Validation Tests
 * Ensures environment configs are consistent and properly configured
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

describe('Environment Configuration Validation', () => {
  const environments = ['development', 'staging', 'production'];
  const configDir = path.join(__dirname, '../config');
  
  describe('Environment Files Exist', () => {
    environments.forEach(env => {
      it(`should have config file for ${env} environment`, () => {
        const configPath = path.join(configDir, `test.${env}.env`);
        expect(fs.existsSync(configPath)).toBe(true);
      });
    });
    
    it('should have base test.env file', () => {
      const configPath = path.join(configDir, 'test.env');
      expect(fs.existsSync(configPath)).toBe(true);
    });
    
    it('should have .env.example file', () => {
      const examplePath = path.join(__dirname, '../.env.example');
      expect(fs.existsSync(examplePath)).toBe(true);
    });
  });
  
  describe('Required Variables Present', () => {
    const requiredVars = [
      'NODE_ENV',
      'API_URL',
      'SHOPIFY_DOMAIN',
      'STRIPE_PUBLIC_KEY_TEST',
      'TEST_TIMEOUT',
      'ENABLE_MOCK_PAYMENTS',
      'ENABLE_WEBHOOK_MOCKING',
      'SKIP_RATE_LIMITING',
      'ENABLE_ALL_TESTS'
    ];
    
    environments.forEach(env => {
      it(`should have all required variables in ${env} config`, () => {
        const configPath = path.join(configDir, `test.${env}.env`);
        const config = dotenv.parse(fs.readFileSync(configPath));
        
        requiredVars.forEach(varName => {
          expect(config[varName]).toBeDefined();
        });
      });
    });
  });
  
  describe('URL Consistency', () => {
    it('should use consistent URL patterns', () => {
      environments.forEach(env => {
        const configPath = path.join(configDir, `test.${env}.env`);
        const config = dotenv.parse(fs.readFileSync(configPath));
        
        const apiUrl = config.API_URL;
        const backendUrl = config.BACKEND_URL;
        
        // Backend URL should match API URL
        if (backendUrl) {
          expect(backendUrl).toBe(apiUrl);
        }
        
        // Check URL formats
        if (env === 'development') {
          expect(apiUrl).toMatch(/^http:\/\/localhost:\d+$/);
        } else {
          expect(apiUrl).toMatch(/^https:\/\//);
          expect(apiUrl).toContain('r3-backend');
          expect(apiUrl).not.toContain('r3-payment-backend'); // Old name check
        }
      });
    });
    
    it('should not contain old repository names', () => {
      environments.forEach(env => {
        const configPath = path.join(configDir, `test.${env}.env`);
        const content = fs.readFileSync(configPath, 'utf8');
        
        expect(content).not.toContain('r3-payment-backend');
        expect(content).not.toContain('r3-nu');
      });
    });
  });
  
  describe('Feature Flag Consistency', () => {
    it('should have appropriate feature flags per environment', () => {
      const devConfig = dotenv.parse(
        fs.readFileSync(path.join(configDir, 'test.development.env'))
      );
      const stagingConfig = dotenv.parse(
        fs.readFileSync(path.join(configDir, 'test.staging.env'))
      );
      const prodConfig = dotenv.parse(
        fs.readFileSync(path.join(configDir, 'test.production.env'))
      );
      
      // Development should have all mocking enabled
      expect(devConfig.ENABLE_MOCK_PAYMENTS).toBe('true');
      expect(devConfig.ENABLE_WEBHOOK_MOCKING).toBe('true');
      expect(devConfig.ENABLE_ALL_TESTS).toBe('true');
      expect(devConfig.ENABLE_DEBUG_LOGGING).toBe('true');
      
      // Staging should have no mocking but all tests
      expect(stagingConfig.ENABLE_MOCK_PAYMENTS).toBe('false');
      expect(stagingConfig.ENABLE_WEBHOOK_MOCKING).toBe('false');
      expect(stagingConfig.ENABLE_ALL_TESTS).toBe('true');
      expect(stagingConfig.ENABLE_DEBUG_LOGGING).toBe('false');
      
      // Production should be most restrictive
      expect(prodConfig.ENABLE_MOCK_PAYMENTS).toBe('false');
      expect(prodConfig.ENABLE_WEBHOOK_MOCKING).toBe('false');
      expect(prodConfig.ENABLE_ALL_TESTS).toBe('false');
      expect(prodConfig.ENABLE_DEBUG_LOGGING).toBe('false');
      expect(prodConfig.SKIP_RATE_LIMITING).toBe('false');
    });
  });
  
  describe('Timeout Configuration', () => {
    it('should have appropriate timeouts per environment', () => {
      const configs = environments.map(env => {
        const configPath = path.join(configDir, `test.${env}.env`);
        return dotenv.parse(fs.readFileSync(configPath));
      });
      
      expect(parseInt(configs[0].TEST_TIMEOUT)).toBe(30000); // dev
      expect(parseInt(configs[1].TEST_TIMEOUT)).toBe(45000); // staging
      expect(parseInt(configs[2].TEST_TIMEOUT)).toBe(60000); // production
    });
  });
  
  describe('Shopify Domain Consistency', () => {
    it('should use consistent Shopify domain across environments', () => {
      environments.forEach(env => {
        const configPath = path.join(configDir, `test.${env}.env`);
        const config = dotenv.parse(fs.readFileSync(configPath));
        
        // All environments currently use same Shopify domain
        expect(config.SHOPIFY_DOMAIN).toBe('sqqpyb-yq.myshopify.com');
      });
    });
  });
  
  describe('Security Validation', () => {
    it('should not contain real secret keys', () => {
      const examplePath = path.join(__dirname, '../.env.example');
      const exampleContent = fs.readFileSync(examplePath, 'utf8');
      
      // Check that example file uses placeholders
      expect(exampleContent).toContain('<get-from-vault>');
      expect(exampleContent).not.toMatch(/sk_live_[a-zA-Z0-9]+/); // No live keys
      expect(exampleContent).not.toMatch(/whsec_[a-zA-Z0-9]{32,}/); // No real webhook secrets
    });
    
    it('should use test keys in all environment configs', () => {
      environments.forEach(env => {
        const configPath = path.join(configDir, `test.${env}.env`);
        const config = dotenv.parse(fs.readFileSync(configPath));
        
        // Should use test keys even in production tests
        expect(config.STRIPE_PUBLIC_KEY_TEST).toMatch(/^pk_test_/);
        expect(config.STRIPE_SECRET_KEY_TEST).toMatch(/^sk_test_/);
      });
    });
  });
  
  describe('Environment Helper Functions', () => {
    const envHelper = require('../../shared/helpers/environment');
    
    it('should correctly detect environment from URLs', () => {
      expect(envHelper.detectEnvironmentFromUrl('http://localhost:3000')).toBe('development');
      expect(envHelper.detectEnvironmentFromUrl('https://r3-backend-git-stage-r3.vercel.app')).toBe('staging');
      expect(envHelper.detectEnvironmentFromUrl('https://r3-backend.vercel.app')).toBe('production');
    });
    
    it('should return correct feature flags per environment', () => {
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'development';
      expect(envHelper.shouldMockPayments()).toBe(true);
      expect(envHelper.shouldRunAllTests()).toBe(true);
      
      process.env.NODE_ENV = 'staging';
      expect(envHelper.shouldMockPayments()).toBe(false);
      expect(envHelper.shouldRunAllTests()).toBe(true);
      
      process.env.NODE_ENV = 'production';
      expect(envHelper.shouldMockPayments()).toBe(false);
      expect(envHelper.shouldRunAllTests()).toBe(false);
      
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should return correct timeouts per environment', () => {
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'development';
      expect(envHelper.getTestTimeout()).toBe(30000);
      
      process.env.NODE_ENV = 'staging';
      expect(envHelper.getTestTimeout()).toBe(45000);
      
      process.env.NODE_ENV = 'production';
      expect(envHelper.getTestTimeout()).toBe(60000);
      
      process.env.NODE_ENV = originalEnv;
    });
  });
  
  describe('Package.json Scripts', () => {
    const packageJson = require('../package.json');
    
    it('should have environment-specific test scripts', () => {
      expect(packageJson.scripts['test:env:dev']).toBeDefined();
      expect(packageJson.scripts['test:env:staging']).toBeDefined();
      expect(packageJson.scripts['test:env:prod']).toBeDefined();
    });
    
    it('should limit production tests to happy path', () => {
      expect(packageJson.scripts['test:env:prod']).toContain("'Happy Path'");
      expect(packageJson.scripts['test:backend:prod']).toContain("'Happy Path'");
      expect(packageJson.scripts['test:frontend:prod']).toContain("'Happy Path'");
    });
  });
});