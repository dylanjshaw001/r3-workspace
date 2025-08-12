// ACH Payment Method Configuration per Environment
// These configuration IDs are created in Stripe Dashboard for each environment

export const ACH_CONFIGS = {
  dev: {
    // Test mode configuration for development
    // NOTE: Do not use live payment method configuration IDs in test mode
    paymentMethodConfigId: process.env.ACH_CONFIG_ID_DEV || null,
    verificationMethod: 'automatic',
    permissions: ['payment_method', 'balances'],
    mandateNotificationMethod: 'email'
  },
  stage: {
    // Test mode configuration for staging
    // NOTE: Do not use live payment method configuration IDs in test mode
    paymentMethodConfigId: process.env.ACH_CONFIG_ID_STAGE || null,
    verificationMethod: 'automatic',
    permissions: ['payment_method', 'balances'],
    mandateNotificationMethod: 'email'
  },
  prod: {
    // Live mode configuration for production
    // This is the only environment that should use a live payment method configuration
    paymentMethodConfigId: process.env.ACH_CONFIG_ID_PROD || 'pmc_1Rpctk2MiCAheYVMW1bJhNXc',
    verificationMethod: 'automatic',
    permissions: ['payment_method', 'balances'],
    mandateNotificationMethod: 'email'
  }
};

// Get current environment from git branch
export function getCurrentEnvironment() {
  const gitBranch = process.env.VERCEL_GIT_COMMIT_REF;
  
  const branchEnvMap = {
    'prod': 'prod',
    'stage': 'stage',
    'dev': 'dev',
    // Legacy branch names
    'main': 'prod',
    'r3-prod': 'prod',
    'r3-stage': 'stage',
    'r3-dev': 'dev'
  };
  
  return branchEnvMap[gitBranch] || 'prod';
}

// Get ACH configuration for current environment
export function getACHConfig() {
  const environment = getCurrentEnvironment();
  const config = ACH_CONFIGS[environment];
  
  if (!config) {
    throw new Error(`No ACH configuration found for environment: ${environment}`);
  }
  
  // Validate configuration and prevent mode mismatches
  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env[`STRIPE_SECRET_KEY_${environment.toUpperCase()}`];
  const isTestMode = !stripeKey || stripeKey.includes('sk_test_');
  const isLiveConfig = config.paymentMethodConfigId && config.paymentMethodConfigId.startsWith('pmc_') && !config.paymentMethodConfigId.includes('test');
  
  // Critical: Prevent using live payment method configurations with test keys
  if (isTestMode && isLiveConfig) {
    console.error(`CRITICAL: Attempting to use live payment method configuration (${config.paymentMethodConfigId}) with test Stripe keys in ${environment} environment`);
    return {
      ...config,
      paymentMethodConfigId: null, // Force default ACH for safety
      isDefault: true,
      modeError: 'live_config_with_test_keys'
    };
  }
  
  // In non-production, null/missing config is acceptable
  if (!config.paymentMethodConfigId && environment !== 'production') {
    console.info(`Using default ACH configuration for ${environment} environment`);
    return {
      ...config,
      paymentMethodConfigId: null,
      isDefault: true
    };
  }
  
  // In production, we must have proper config
  if (!config.paymentMethodConfigId && environment === 'production') {
    throw new Error('ACH configuration is required for production environment');
  }
  
  return config;
}

// Validate ACH is properly configured
export function validateACHConfiguration() {
  const environment = getCurrentEnvironment();
  const config = ACH_CONFIGS[environment];
  
  const issues = [];
  
  if (!config.paymentMethodConfigId || config.paymentMethodConfigId.includes('placeholder')) {
    issues.push(`Missing ACH_CONFIG_ID_${environment.toUpperCase()} environment variable`);
  }
  
  if (environment === 'production' && !config.paymentMethodConfigId.startsWith('pmc_')) {
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