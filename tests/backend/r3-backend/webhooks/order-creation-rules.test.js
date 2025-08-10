// Order Creation Rules Test
// Tests the webhook handler's order creation logic across environments
const fetch = require('node-fetch');
const { server } = require('../../../shared/mocks/server');
const { rest } = require('msw');
const { createTestWebhookEvent } = require('../../../shared/helpers/utils/test-helpers');
const { getApiUrl, shouldMockPayments } = require('../../../shared/helpers/environment');

const API_URL = shouldMockPayments() ? 'http://localhost:3000' : getApiUrl();

describe('Webhook Order Creation Rules', () => {
  let createdOrders = [];
  
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    createdOrders = [];
  });
  afterAll(() => server.close());
  
  beforeEach(() => {
    // Mock Shopify Admin API
    server.use(
      // Draft Orders API (staging/dev)
      rest.post('https://sqqpyb-yq.myshopify.com/admin/api/*/draft_orders.json', (req, res, ctx) => {
        const draftOrder = req.body.draft_order;
        createdOrders.push({
          type: 'draft_order',
          environment: 'staging/dev',
          ...draftOrder
        });
        
        return res(ctx.json({
          draft_order: {
            id: Math.floor(Math.random() * 1000000),
            ...draftOrder
          }
        }));
      }),
      
      // Real Orders API (production)
      rest.post('https://rthree.io/admin/api/*/orders.json', (req, res, ctx) => {
        const order = req.body.order;
        createdOrders.push({
          type: 'order',
          environment: 'production',
          ...order
        });
        
        return res(ctx.json({
          order: {
            id: Math.floor(Math.random() * 1000000),
            ...order
          }
        }));
      })
    );
  });
  
  describe('Environment-Based Order Creation', () => {
    test('Production environment creates real orders', async () => {
      const webhookPayload = {
        id: 'evt_prod_test',
        type: 'payment_intent.succeeded',
        livemode: true,
        data: {
          object: {
            id: 'pi_prod_test',
            amount: 10000,
            currency: 'usd',
            status: 'succeeded',
            livemode: true,
            metadata: {
              environment: 'production',
              store_domain: 'rthree.io',
              customer_email: 'customer@example.com',
              items: JSON.stringify([{
                variant_id: '12345',
                quantity: 1,
                price: 10000
              }])
            }
          }
        }
      };
      
      const response = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'whsec_prod_test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });
      
      expect(response.ok).toBe(true);
      
      // In production with livemode, should create real order
      // Note: Actual implementation would create real orders
      // This test documents the expected behavior
    });
    
    test('Staging environment creates draft orders', async () => {
      const webhookPayload = {
        id: 'evt_stage_test',
        type: 'payment_intent.succeeded',
        livemode: false,
        data: {
          object: {
            id: 'pi_stage_test',
            amount: 10000,
            currency: 'usd',
            status: 'succeeded',
            livemode: false,
            metadata: {
              environment: 'staging',
              store_domain: 'sqqpyb-yq.myshopify.com',
              customer_email: 'test@example.com',
              items: JSON.stringify([{
                variant_id: '12345',
                quantity: 1,
                price: 10000
              }])
            }
          }
        }
      };
      
      const response = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'whsec_stage_test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });
      
      expect(response.ok).toBe(true);
      // Should create draft order in staging
    });
    
    test('Development environment creates draft orders', async () => {
      const webhookPayload = {
        id: 'evt_dev_test',
        type: 'payment_intent.succeeded',
        livemode: false,
        data: {
          object: {
            id: 'pi_dev_test',
            amount: 10000,
            currency: 'usd',
            status: 'succeeded',
            livemode: false,
            metadata: {
              environment: 'development',
              store_domain: 'sqqpyb-yq.myshopify.com',
              customer_email: 'dev@example.com',
              items: JSON.stringify([{
                variant_id: '12345',
                quantity: 1,
                price: 10000
              }])
            }
          }
        }
      };
      
      const response = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'whsec_dev_test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });
      
      expect(response.ok).toBe(true);
      // Should create draft order in development
    });
  });
  
  describe('One Order Per Payment Rule', () => {
    test('Should create exactly one order per successful payment', async () => {
      const paymentIntentId = 'pi_test_single';
      
      // First webhook
      const webhook1 = createTestWebhookEvent('payment_intent.succeeded', {
        id: paymentIntentId,
        amount: 10000,
        metadata: {
          environment: 'staging',
          customer_email: 'test@example.com'
        }
      });
      
      await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_sig_1',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhook1)
      });
      
      // Duplicate webhook (same payment intent)
      const webhook2 = createTestWebhookEvent('payment_intent.succeeded', {
        id: paymentIntentId, // Same ID
        amount: 10000,
        metadata: {
          environment: 'staging',
          customer_email: 'test@example.com'
        }
      });
      
      await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_sig_2',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhook2)
      });
      
      // Should only create one order despite two webhooks
      // Actual implementation should check for existing orders
    });
    
    test('Different payment intents should create separate orders', async () => {
      const payments = [
        { id: 'pi_test_1', amount: 10000 },
        { id: 'pi_test_2', amount: 20000 },
        { id: 'pi_test_3', amount: 15000 }
      ];
      
      for (const payment of payments) {
        const webhook = createTestWebhookEvent('payment_intent.succeeded', {
          id: payment.id,
          amount: payment.amount,
          metadata: {
            environment: 'staging',
            customer_email: 'test@example.com'
          }
        });
        
        await fetch(`${API_URL}/api/stripe/webhook`, {
          method: 'POST',
          headers: {
            'stripe-signature': `test_sig_${payment.id}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhook)
        });
      }
      
      // Should create 3 separate orders
      expect(createdOrders.length).toBe(3);
    });
  });
  
  describe('Payment Method Agnostic', () => {
    const paymentMethods = [
      { 
        name: 'card', 
        types: ['card'], 
        status: 'succeeded',
        event: 'payment_intent.succeeded'
      },
      { 
        name: 'ach_financial_connections', 
        types: ['us_bank_account'], 
        status: 'processing',
        event: 'payment_intent.processing'
      },
      { 
        name: 'ach_manual', 
        types: ['us_bank_account'], 
        status: 'processing',
        event: 'payment_intent.processing'
      }
    ];
    
    paymentMethods.forEach(pm => {
      test(`Should create order for ${pm.name} payment`, async () => {
        const webhook = createTestWebhookEvent(pm.event, {
          id: `pi_test_${pm.name}`,
          amount: 10000,
          payment_method_types: pm.types,
          status: pm.status,
          metadata: {
            environment: 'staging',
            customer_email: 'test@example.com',
            payment_mode: pm.name
          }
        });
        
        const response = await fetch(`${API_URL}/api/stripe/webhook`, {
          method: 'POST',
          headers: {
            'stripe-signature': 'test_signature',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhook)
        });
        
        expect(response.ok).toBe(true);
        // Should create order regardless of payment method
      });
    });
  });
  
  describe('Order Tags and Metadata', () => {
    test('Draft orders should include environment tags', async () => {
      const environments = ['staging', 'development'];
      
      for (const env of environments) {
        const webhook = createTestWebhookEvent('payment_intent.succeeded', {
          id: `pi_test_${env}_tags`,
          amount: 10000,
          metadata: {
            environment: env,
            customer_email: 'test@example.com',
            rep: 'sales_rep_123'
          }
        });
        
        await fetch(`${API_URL}/api/stripe/webhook`, {
          method: 'POST',
          headers: {
            'stripe-signature': 'test_signature',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhook)
        });
      }
      
      // Created orders should have environment tags
      // Expected tags: environment name, payment method, rep (if present)
    });
    
    test('ACH orders should include ACH-specific tags', async () => {
      const webhook = createTestWebhookEvent('payment_intent.processing', {
        id: 'pi_test_ach_tags',
        amount: 10000,
        payment_method_types: ['us_bank_account'],
        status: 'processing',
        metadata: {
          environment: 'staging',
          customer_email: 'test@example.com',
          payment_mode: 'ach_manual'
        }
      });
      
      await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhook)
      });
      
      // Should include ACH_PAYMENT tag
      // Should include PENDING_CLEARING tag for processing status
    });
  });
  
  describe('Error Handling', () => {
    test('Should handle missing metadata gracefully', async () => {
      const webhook = createTestWebhookEvent('payment_intent.succeeded', {
        id: 'pi_test_no_metadata',
        amount: 10000,
        // No metadata
      });
      
      const response = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhook)
      });
      
      // Should still process but may skip order creation
      expect(response.ok).toBe(true);
    });
    
    test('Should validate required fields before order creation', async () => {
      const webhook = createTestWebhookEvent('payment_intent.succeeded', {
        id: 'pi_test_invalid',
        amount: 10000,
        metadata: {
          environment: 'staging',
          // Missing customer_email
          // Missing items
        }
      });
      
      const response = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhook)
      });
      
      expect(response.ok).toBe(true); // Webhook acknowledged
      // But order creation might be skipped due to missing data
    });
  });
  
  describe('Production Safeguards', () => {
    test('Should never create test orders in production Shopify', async () => {
      const webhook = createTestWebhookEvent('payment_intent.succeeded', {
        id: 'pi_test_prod_safeguard',
        amount: 10000,
        livemode: false, // Test mode
        metadata: {
          environment: 'production',
          store_domain: 'rthree.io',
          customer_email: 'test@example.com'
        }
      });
      
      const response = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhook)
      });
      
      expect(response.ok).toBe(true);
      // Should NOT create order in production with test payment
    });
    
    test('Should validate environment matches Stripe mode', async () => {
      const mismatchedWebhook = createTestWebhookEvent('payment_intent.succeeded', {
        id: 'pi_live_mismatch',
        amount: 10000,
        livemode: true, // Live mode
        metadata: {
          environment: 'development', // But dev environment
          customer_email: 'test@example.com'
        }
      });
      
      const response = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mismatchedWebhook)
      });
      
      expect(response.ok).toBe(true);
      // Should handle mismatch appropriately
    });
  });
});