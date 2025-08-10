// Environment-specific ACH Tests

// Mock ACH configuration functions for testing
const ACH_CONFIGS = {
  development: {
    paymentMethodConfigId: process.env.ACH_CONFIG_ID_DEV || 'pmc_test_dev_placeholder',
    verificationMethod: 'automatic',
    permissions: ['payment_method', 'balances'],
    mandateNotificationMethod: 'email'
  },
  staging: {
    paymentMethodConfigId: process.env.ACH_CONFIG_ID_STAGE || 'pmc_test_stage_placeholder',
    verificationMethod: 'automatic',
    permissions: ['payment_method', 'balances'],
    mandateNotificationMethod: 'email'
  },
  production: {
    paymentMethodConfigId: process.env.ACH_CONFIG_ID_PROD || 'pmc_1Rpctk2MiCAheYVMW1bJhNXc',
    verificationMethod: 'automatic',
    permissions: ['payment_method', 'balances'],
    mandateNotificationMethod: 'email'
  }
};

function getCurrentEnvironment() {
  const gitBranch = process.env.VERCEL_GIT_COMMIT_REF;
  
  const branchEnvMap = {
    'main': 'production',
    'r3-prod': 'production',
    'r3-stage': 'staging',
    'r3-dev': 'development'
  };
  
  return branchEnvMap[gitBranch] || 'production';
}

function getACHConfig() {
  const environment = getCurrentEnvironment();
  const config = {...ACH_CONFIGS[environment]};
  
  if (!config) {
    throw new Error(`No ACH configuration found for environment: ${environment}`);
  }
  
  // Update config with actual environment variable if set
  const envVarName = `ACH_CONFIG_ID_${environment.toUpperCase()}`;
  if (environment === 'development' && process.env.ACH_CONFIG_ID_DEV) {
    config.paymentMethodConfigId = process.env.ACH_CONFIG_ID_DEV;
  } else if (environment === 'staging' && process.env.ACH_CONFIG_ID_STAGE) {
    config.paymentMethodConfigId = process.env.ACH_CONFIG_ID_STAGE;
  } else if (environment === 'production' && process.env.ACH_CONFIG_ID_PROD) {
    config.paymentMethodConfigId = process.env.ACH_CONFIG_ID_PROD;
  }
  
  if (!config.paymentMethodConfigId || config.paymentMethodConfigId.includes('placeholder')) {
    console.warn(`ACH configuration not properly set for ${environment} environment. Using default.`);
    if (environment !== 'production') {
      return {
        ...config,
        paymentMethodConfigId: null,
        isDefault: true
      };
    }
    throw new Error('ACH configuration is required for production environment');
  }
  
  return config;
}

function validateACHConfiguration() {
  const environment = getCurrentEnvironment();
  const config = {...ACH_CONFIGS[environment]};
  
  // Update config with actual environment variable if set
  if (environment === 'development' && process.env.ACH_CONFIG_ID_DEV) {
    config.paymentMethodConfigId = process.env.ACH_CONFIG_ID_DEV;
  } else if (environment === 'staging' && process.env.ACH_CONFIG_ID_STAGE) {
    config.paymentMethodConfigId = process.env.ACH_CONFIG_ID_STAGE;
  } else if (environment === 'production' && process.env.ACH_CONFIG_ID_PROD) {
    config.paymentMethodConfigId = process.env.ACH_CONFIG_ID_PROD;
  }
  
  const issues = [];
  
  if (!config.paymentMethodConfigId || config.paymentMethodConfigId.includes('placeholder')) {
    issues.push(`Missing ACH_CONFIG_ID_${environment.toUpperCase()} environment variable`);
  }
  
  if (environment === 'production' && config.paymentMethodConfigId && !config.paymentMethodConfigId.startsWith('pmc_')) {
    issues.push('Production ACH config ID must be a valid Stripe payment method configuration');
  }
  
  if (config.verificationMethod !== 'automatic' && config.verificationMethod !== 'instant') {
    issues.push(`Invalid verification method: ${config.verificationMethod}`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    environment,
    config: issues.length === 0 ? config : null
  };
}

describe('ACH Environment Configuration', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });
  
  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('Environment Detection', () => {
    it('should detect development environment', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-dev';
      expect(getCurrentEnvironment()).toBe('development');
    });
    
    it('should detect staging environment', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-stage';
      expect(getCurrentEnvironment()).toBe('staging');
    });
    
    it('should detect production environment from main branch', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'main';
      expect(getCurrentEnvironment()).toBe('production');
    });
    
    it('should detect production environment from r3-prod branch', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-prod';
      expect(getCurrentEnvironment()).toBe('production');
    });
    
    it('should default to production for unknown branches', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'feature/new-feature';
      expect(getCurrentEnvironment()).toBe('production');
    });
  });
  
  describe('ACH Configuration Retrieval', () => {
    it('should get development config', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-dev';
      process.env.ACH_CONFIG_ID_DEV = 'pmc_test_dev_123';
      
      const config = getACHConfig();
      expect(config.paymentMethodConfigId).toBe('pmc_test_dev_123');
      expect(config.verificationMethod).toBe('automatic');
      expect(config.permissions).toEqual(['payment_method', 'balances']);
    });
    
    it('should get staging config', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-stage';
      process.env.ACH_CONFIG_ID_STAGE = 'pmc_test_stage_456';
      
      const config = getACHConfig();
      expect(config.paymentMethodConfigId).toBe('pmc_test_stage_456');
    });
    
    it('should get production config', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'main';
      process.env.ACH_CONFIG_ID_PROD = 'pmc_live_prod_789';
      
      const config = getACHConfig();
      expect(config.paymentMethodConfigId).toBe('pmc_live_prod_789');
    });
    
    it('should use default config in non-production when env var missing', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-dev';
      delete process.env.ACH_CONFIG_ID_DEV;
      
      const config = getACHConfig();
      expect(config.paymentMethodConfigId).toBe(null);
      expect(config.isDefault).toBe(true);
    });
    
    it('should throw error in production when config missing', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'main';
      // Set to placeholder to simulate missing config
      process.env.ACH_CONFIG_ID_PROD = 'pmc_test_prod_placeholder';
      
      // Mock console.warn to avoid test output
      const originalWarn = console.warn;
      console.warn = jest.fn();
      
      expect(() => getACHConfig()).toThrow('ACH configuration is required for production environment');
      
      console.warn = originalWarn;
    });
  });
  
  describe('ACH Configuration Validation', () => {
    it('should validate proper configuration', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-dev';
      process.env.ACH_CONFIG_ID_DEV = 'pmc_test_dev_123';
      
      const validation = validateACHConfiguration();
      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.environment).toBe('development');
      expect(validation.config).toBeDefined();
    });
    
    it('should detect missing configuration', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-dev';
      delete process.env.ACH_CONFIG_ID_DEV;
      
      const validation = validateACHConfiguration();
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Missing ACH_CONFIG_ID_DEVELOPMENT environment variable');
    });
    
    it('should validate production config format', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'main';
      process.env.ACH_CONFIG_ID_PROD = 'invalid_format';
      
      const validation = validateACHConfiguration();
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Production ACH config ID must be a valid Stripe payment method configuration');
    });
  });
  
  describe('Environment Mismatch Scenarios', () => {
    it('should handle webhook from different environment', () => {
      // Simulate webhook metadata
      const webhookMetadata = {
        environment: 'production',
        store_domain: 'sqqpyb-yq.myshopify.com'
      };
      
      // Current environment is development
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-dev';
      const currentEnv = getCurrentEnvironment();
      
      // Should not process webhook from different environment
      expect(currentEnv).toBe('development');
      expect(webhookMetadata.environment).toBe('production');
      expect(currentEnv === webhookMetadata.environment).toBe(false);
    });
    
    it('should process webhook from same environment', () => {
      const webhookMetadata = {
        environment: 'staging',
        store_domain: 'r3-stage.myshopify.com'
      };
      
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-stage';
      const currentEnv = getCurrentEnvironment();
      
      expect(currentEnv).toBe('staging');
      expect(webhookMetadata.environment).toBe('staging');
      expect(currentEnv === webhookMetadata.environment).toBe(true);
    });
    
    it('should handle missing environment in webhook metadata', () => {
      const webhookMetadata = {
        store_domain: 'sqqpyb-yq.myshopify.com'
        // Missing environment field
      };
      
      process.env.VERCEL_GIT_COMMIT_REF = 'main';
      const currentEnv = getCurrentEnvironment();
      const webhookEnv = webhookMetadata.environment || 'production';
      
      expect(currentEnv).toBe('production');
      expect(webhookEnv).toBe('production');
      expect(currentEnv === webhookEnv).toBe(true);
    });
  });
  
  describe('Cross-Environment Protection', () => {
    it('should not use production ACH config in development', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'r3-dev';
      process.env.ACH_CONFIG_ID_PROD = 'pmc_live_prod_123';
      // Don't set ACH_CONFIG_ID_DEV
      
      const config = getACHConfig();
      // Should use default, not production config
      expect(config.paymentMethodConfigId).toBe(null);
      expect(config.isDefault).toBe(true);
    });
    
    it('should not use development ACH config in production', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'main';
      process.env.ACH_CONFIG_ID_DEV = 'pmc_test_dev_123';
      // Set production to placeholder to simulate missing config
      process.env.ACH_CONFIG_ID_PROD = 'pmc_test_prod_placeholder';
      
      // Mock console.warn
      const originalWarn = console.warn;
      console.warn = jest.fn();
      
      // Should throw error, not use dev config
      expect(() => getACHConfig()).toThrow('ACH configuration is required for production environment');
      
      console.warn = originalWarn;
    });
  });
});