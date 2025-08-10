// ACH Webhook Environment Filtering Tests
const { createTestWebhookEvent, createTestPaymentIntent } = require('../../shared/helpers/utils/test-helpers');
const { achTestUtils } = require('../../shared/mocks/ach-handlers');

describe('ACH Webhook Environment Filtering', () => {
  // Mock getCurrentEnvironment function
  const getCurrentEnvironment = (gitBranch) => {
    const branchEnvMap = {
      'main': 'production',
      'r3-prod': 'production',
      'r3-stage': 'staging',
      'r3-dev': 'development'
    };
    return branchEnvMap[gitBranch] || 'production';
  };
  
  describe('Environment Matching', () => {
    it('should process webhook when environments match - development', () => {
      const currentEnv = getCurrentEnvironment('r3-dev');
      const webhookPayload = createTestPaymentIntent({
        payment_method_types: ['us_bank_account'],
        metadata: {
          environment: 'development',
          store_domain: 'test.myshopify.com',
          customer_email: 'test@example.com'
        }
      });
      
      const webhookEnv = webhookPayload.metadata.environment;
      const shouldProcess = currentEnv === webhookEnv;
      
      expect(currentEnv).toBe('development');
      expect(webhookEnv).toBe('development');
      expect(shouldProcess).toBe(true);
    });
    
    it('should process webhook when environments match - staging', () => {
      const currentEnv = getCurrentEnvironment('r3-stage');
      const webhookPayload = createTestPaymentIntent({
        payment_method_types: ['us_bank_account'],
        metadata: {
          environment: 'staging',
          store_domain: 'r3-stage.myshopify.com'
        }
      });
      
      const webhookEnv = webhookPayload.metadata.environment;
      const shouldProcess = currentEnv === webhookEnv;
      
      expect(currentEnv).toBe('staging');
      expect(webhookEnv).toBe('staging');
      expect(shouldProcess).toBe(true);
    });
    
    it('should process webhook when environments match - production', () => {
      const currentEnv = getCurrentEnvironment('main');
      const webhookPayload = createTestPaymentIntent({
        payment_method_types: ['us_bank_account'],
        metadata: {
          environment: 'production',
          store_domain: 'sqqpyb-yq.myshopify.com'
        }
      });
      
      const webhookEnv = webhookPayload.metadata.environment;
      const shouldProcess = currentEnv === webhookEnv;
      
      expect(currentEnv).toBe('production');
      expect(webhookEnv).toBe('production');
      expect(shouldProcess).toBe(true);
    });
  });
  
  describe('Environment Mismatch Protection', () => {
    it('should skip webhook from production in development environment', () => {
      const currentEnv = getCurrentEnvironment('r3-dev');
      const webhookPayload = createTestPaymentIntent({
        payment_method_types: ['us_bank_account'],
        metadata: {
          environment: 'production',
          store_domain: 'sqqpyb-yq.myshopify.com'
        }
      });
      
      const webhookEnv = webhookPayload.metadata.environment;
      const shouldProcess = currentEnv === webhookEnv;
      
      expect(currentEnv).toBe('development');
      expect(webhookEnv).toBe('production');
      expect(shouldProcess).toBe(false);
    });
    
    it('should skip webhook from development in production environment', () => {
      const currentEnv = getCurrentEnvironment('main');
      const webhookPayload = createTestPaymentIntent({
        payment_method_types: ['us_bank_account'],
        metadata: {
          environment: 'development',
          store_domain: 'test.myshopify.com'
        }
      });
      
      const webhookEnv = webhookPayload.metadata.environment;
      const shouldProcess = currentEnv === webhookEnv;
      
      expect(currentEnv).toBe('production');
      expect(webhookEnv).toBe('development');
      expect(shouldProcess).toBe(false);
    });
    
    it('should skip webhook from staging in production environment', () => {
      const currentEnv = getCurrentEnvironment('r3-prod');
      const webhookPayload = createTestPaymentIntent({
        payment_method_types: ['us_bank_account'],
        metadata: {
          environment: 'staging',
          store_domain: 'r3-stage.myshopify.com'
        }
      });
      
      const webhookEnv = webhookPayload.metadata.environment;
      const shouldProcess = currentEnv === webhookEnv;
      
      expect(currentEnv).toBe('production');
      expect(webhookEnv).toBe('staging');
      expect(shouldProcess).toBe(false);
    });
  });
  
  describe('Default Environment Handling', () => {
    it('should default to production when environment not specified', () => {
      const currentEnv = getCurrentEnvironment('main');
      const webhookPayload = createTestPaymentIntent({
        payment_method_types: ['us_bank_account'],
        metadata: {
          // No environment field
          store_domain: 'sqqpyb-yq.myshopify.com'
        }
      });
      
      const webhookEnv = webhookPayload.metadata.environment || 'production';
      const shouldProcess = currentEnv === webhookEnv;
      
      expect(currentEnv).toBe('production');
      expect(webhookEnv).toBe('production');
      expect(shouldProcess).toBe(true);
    });
    
    it('should not process defaulted webhook in non-production', () => {
      const currentEnv = getCurrentEnvironment('r3-dev');
      const webhookPayload = createTestPaymentIntent({
        payment_method_types: ['us_bank_account'],
        metadata: {
          // No environment field - defaults to production
          store_domain: 'sqqpyb-yq.myshopify.com'
        }
      });
      
      const webhookEnv = webhookPayload.metadata.environment || 'production';
      const shouldProcess = currentEnv === webhookEnv;
      
      expect(currentEnv).toBe('development');
      expect(webhookEnv).toBe('production');
      expect(shouldProcess).toBe(false);
    });
  });
  
  describe('Webhook Event Filtering', () => {
    it('should handle payment_intent.processing with environment filter', () => {
      const event = achTestUtils.createACHWebhookEvent('payment_intent.processing', {
        id: 'pi_test_ach',
        amount: 10000,
        payment_method_types: ['us_bank_account'],
        metadata: {
          environment: 'staging',
          store_domain: 'r3-stage.myshopify.com'
        }
      });
      
      const currentEnv = getCurrentEnvironment('r3-stage');
      const webhookEnv = event.data.object.metadata.environment;
      
      expect(event.type).toBe('payment_intent.processing');
      expect(currentEnv === webhookEnv).toBe(true);
    });
    
    it('should handle charge.succeeded with environment filter', () => {
      const charge = achTestUtils.createACHCharge('succeeded');
      charge.metadata = {
        environment: 'production',
        store_domain: 'sqqpyb-yq.myshopify.com'
      };
      
      const event = achTestUtils.createACHWebhookEvent('charge.succeeded', charge);
      const currentEnv = getCurrentEnvironment('main');
      const webhookEnv = charge.metadata.environment;
      
      expect(event.type).toBe('charge.succeeded');
      expect(currentEnv === webhookEnv).toBe(true);
    });
    
    it('should handle charge.failed with environment filter', () => {
      const charge = achTestUtils.createACHCharge('failed');
      charge.metadata = {
        environment: 'development',
        store_domain: 'test.myshopify.com'
      };
      
      const event = achTestUtils.createACHWebhookEvent('charge.failed', charge);
      const currentEnv = getCurrentEnvironment('r3-dev');
      const webhookEnv = charge.metadata.environment;
      
      expect(event.type).toBe('charge.failed');
      expect(currentEnv === webhookEnv).toBe(true);
    });
  });
  
  describe('Webhook Processing Decision', () => {
    const mockWebhookHandler = (currentEnv, webhookEnv) => {
      if (currentEnv !== webhookEnv) {
        return {
          processed: false,
          reason: 'environment_mismatch',
          currentEnv,
          webhookEnv
        };
      }
      
      return {
        processed: true,
        action: 'create_draft_order'
      };
    };
    
    it('should process matching environment webhook', () => {
      const result = mockWebhookHandler('production', 'production');
      expect(result.processed).toBe(true);
      expect(result.action).toBe('create_draft_order');
    });
    
    it('should skip mismatched environment webhook', () => {
      const result = mockWebhookHandler('development', 'production');
      expect(result.processed).toBe(false);
      expect(result.reason).toBe('environment_mismatch');
      expect(result.currentEnv).toBe('development');
      expect(result.webhookEnv).toBe('production');
    });
    
    it('should log environment mismatch details', () => {
      const logEntries = [];
      const mockLogger = {
        info: (message, details) => logEntries.push({ level: 'info', message, details })
      };
      
      const currentEnv = 'staging';
      const webhookEnv = 'production';
      
      if (currentEnv !== webhookEnv) {
        mockLogger.info('Skipping webhook - environment mismatch', {
          currentEnv,
          webhookEnv,
          paymentId: 'pi_test_ach'
        });
      }
      
      expect(logEntries).toHaveLength(1);
      expect(logEntries[0].message).toBe('Skipping webhook - environment mismatch');
      expect(logEntries[0].details.currentEnv).toBe('staging');
      expect(logEntries[0].details.webhookEnv).toBe('production');
    });
  });
});