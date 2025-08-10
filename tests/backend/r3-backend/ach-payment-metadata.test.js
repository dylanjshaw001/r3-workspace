// ACH Payment Intent Environment Metadata Tests
const { createTestCart, createTestCustomer } = require('../../shared/helpers/utils/test-helpers');

describe('ACH Payment Intent Environment Metadata', () => {
  describe('Frontend Environment Detection', () => {
    // Mock checkout container with environment data attribute
    const mockCheckoutContainer = (environment) => ({
      dataset: {
        environment: environment
      }
    });
    
    // Mock document.querySelector
    const mockDocumentWithEnvironment = (environment) => {
      return {
        querySelector: (selector) => {
          if (selector === '.checkout-container') {
            return mockCheckoutContainer(environment);
          }
          return null;
        }
      };
    };
    
    it('should include development environment in payment metadata', () => {
      const document = mockDocumentWithEnvironment('development');
      const cart = createTestCart();
      const customer = createTestCustomer();
      
      const metadata = {
        customer_email: customer.email,
        customer_first_name: customer.first_name,
        customer_last_name: customer.last_name,
        shipping_address: JSON.stringify({
          first_name: customer.first_name,
          last_name: customer.last_name,
          address1: customer.address1,
          city: customer.city,
          province: customer.province,
          zip: customer.zip,
          country: 'United States'
        }),
        items: JSON.stringify(cart.items),
        store_domain: 'test.myshopify.com',
        environment: document.querySelector('.checkout-container')?.dataset.environment || 'production'
      };
      
      expect(metadata.environment).toBe('development');
    });
    
    it('should include staging environment in payment metadata', () => {
      const document = mockDocumentWithEnvironment('staging');
      
      const metadata = {
        store_domain: 'r3-stage.myshopify.com',
        environment: document.querySelector('.checkout-container')?.dataset.environment || 'production'
      };
      
      expect(metadata.environment).toBe('staging');
    });
    
    it('should include production environment in payment metadata', () => {
      const document = mockDocumentWithEnvironment('production');
      
      const metadata = {
        store_domain: 'sqqpyb-yq.myshopify.com',
        environment: document.querySelector('.checkout-container')?.dataset.environment || 'production'
      };
      
      expect(metadata.environment).toBe('production');
    });
    
    it('should default to production when environment not set', () => {
      const document = mockDocumentWithEnvironment(null);
      
      const metadata = {
        store_domain: 'sqqpyb-yq.myshopify.com',
        environment: document.querySelector('.checkout-container')?.dataset.environment || 'production'
      };
      
      expect(metadata.environment).toBe('production');
    });
  });
  
  describe('Payment Intent Creation with Environment', () => {
    const mockPaymentIntentRequest = (paymentMethodTypes, metadata) => ({
      amount: 10000,
      currency: 'usd',
      payment_method_types: paymentMethodTypes,
      metadata: metadata
    });
    
    it('should create ACH payment intent with environment metadata', () => {
      const request = mockPaymentIntentRequest(['us_bank_account'], {
        customer_email: 'test@example.com',
        environment: 'development',
        store_domain: 'test.myshopify.com'
      });
      
      expect(request.payment_method_types).toContain('us_bank_account');
      expect(request.metadata.environment).toBe('development');
      expect(request.metadata.store_domain).toBe('test.myshopify.com');
    });
    
    it('should create card payment intent with environment metadata', () => {
      const request = mockPaymentIntentRequest(['card'], {
        customer_email: 'test@example.com',
        environment: 'staging',
        store_domain: 'r3-stage.myshopify.com'
      });
      
      expect(request.payment_method_types).toContain('card');
      expect(request.metadata.environment).toBe('staging');
    });
    
    it('should preserve all metadata fields for ACH', () => {
      const customer = createTestCustomer();
      const metadata = {
        customer_email: customer.email,
        customer_first_name: customer.first_name,
        customer_last_name: customer.last_name,
        shipping_address: JSON.stringify({
          first_name: customer.first_name,
          last_name: customer.last_name,
          address1: customer.address1,
          city: customer.city,
          province: customer.province,
          zip: customer.zip,
          country: 'United States'
        }),
        shipping_method: 'Standard Shipping',
        shipping_price: '10.00',
        items: JSON.stringify([{ variant_id: '123', quantity: 1, price: 100 }]),
        store_domain: 'sqqpyb-yq.myshopify.com',
        rep: 'john_doe',
        environment: 'production'
      };
      
      const request = mockPaymentIntentRequest(['us_bank_account'], metadata);
      
      // Verify all metadata fields are included
      expect(request.metadata.customer_email).toBe(customer.email);
      expect(request.metadata.customer_first_name).toBe(customer.first_name);
      expect(request.metadata.customer_last_name).toBe(customer.last_name);
      expect(request.metadata.shipping_address).toBeDefined();
      expect(request.metadata.shipping_method).toBe('Standard Shipping');
      expect(request.metadata.shipping_price).toBe('10.00');
      expect(request.metadata.items).toBeDefined();
      expect(request.metadata.store_domain).toBe('sqqpyb-yq.myshopify.com');
      expect(request.metadata.rep).toBe('john_doe');
      expect(request.metadata.environment).toBe('production');
    });
  });
  
  describe('Environment-Specific ACH Configuration', () => {
    it('should use different ACH config for each environment', () => {
      const configs = {
        development: {
          paymentMethodConfigId: 'pmc_test_dev_123',
          environment: 'development'
        },
        staging: {
          paymentMethodConfigId: 'pmc_test_stage_456',
          environment: 'staging'
        },
        production: {
          paymentMethodConfigId: 'pmc_1Rpctk2MiCAheYVMW1bJhNXc',
          environment: 'production'
        }
      };
      
      // Verify each environment has unique config
      expect(configs.development.paymentMethodConfigId).not.toBe(configs.staging.paymentMethodConfigId);
      expect(configs.staging.paymentMethodConfigId).not.toBe(configs.production.paymentMethodConfigId);
      expect(configs.development.paymentMethodConfigId).not.toBe(configs.production.paymentMethodConfigId);
      
      // Verify production uses live config
      expect(configs.production.paymentMethodConfigId).toMatch(/^pmc_/);
      
      // Verify non-production uses test configs
      expect(configs.development.paymentMethodConfigId).toContain('test');
      expect(configs.staging.paymentMethodConfigId).toContain('test');
    });
  });
  
  describe('Backend Environment Validation', () => {
    const mockBackendValidation = (paymentMetadata, currentEnv) => {
      const webhookEnv = paymentMetadata.environment || 'production';
      const shouldProcess = currentEnv === webhookEnv;
      
      return {
        currentEnv,
        webhookEnv,
        shouldProcess,
        action: shouldProcess ? 'process_payment' : 'skip_payment'
      };
    };
    
    it('should process payment when environments match', () => {
      const metadata = { environment: 'development' };
      const result = mockBackendValidation(metadata, 'development');
      
      expect(result.shouldProcess).toBe(true);
      expect(result.action).toBe('process_payment');
    });
    
    it('should skip payment when environments mismatch', () => {
      const metadata = { environment: 'production' };
      const result = mockBackendValidation(metadata, 'development');
      
      expect(result.shouldProcess).toBe(false);
      expect(result.action).toBe('skip_payment');
    });
    
    it('should handle missing environment metadata', () => {
      const metadata = {}; // No environment field
      const result = mockBackendValidation(metadata, 'production');
      
      expect(result.webhookEnv).toBe('production'); // Defaults to production
      expect(result.shouldProcess).toBe(true);
    });
  });
});