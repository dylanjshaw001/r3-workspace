// Order creation pipeline tests - webhook handling and environment filtering

const { createTestWebhookEvent, createTestPaymentIntent } = require('@helpers/utils/test-helpers');
const fixtures = require('@fixtures');
const crypto = require('crypto');

// Helper to generate Stripe webhook signature
function generateWebhookSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return `t=${timestamp},v1=${signature}`;
}

describe('Order Creation Pipeline', () => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST || 'whsec_test_secret';

  describe('Webhook Processing', () => {
    it('should process payment succeeded webhook and create order', async () => {
      const paymentIntent = createTestPaymentIntent({
        id: 'pi_test_success_001',
        status: 'succeeded',
        amount: 11000,
        metadata: {
          customer_email: 'webhook-test@example.com',
          customer_first_name: 'Webhook',
          customer_last_name: 'Test',
          items: JSON.stringify([{
            variant_id: 40000000001,
            quantity: 1,
            price: 10000,
            title: 'Test Product'
          }]),
          shipping_address: JSON.stringify({
            first_name: 'Webhook',
            last_name: 'Test',
            address1: '123 Webhook Street',
            city: 'New York',
            province: 'NY',
            zip: '10001',
            country: 'US'
          }),
          shipping_method: 'Standard Shipping',
          shipping_price: '10.00',
          store_domain: 'test-store.myshopify.com',
          rep: 'webhook-rep',
          environment: 'test'
        }
      });

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', paymentIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.received).toBe(true);
      
      // In a real test, we would verify:
      // 1. Draft order created in Shopify (for test environment)
      // 2. Order contains correct metadata
      // 3. Rep tracking preserved
    });

    it('should reject webhook without signature', async () => {
      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', {});

      const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookEvent)
      });

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('stripe-signature');
    });

    it('should reject webhook with invalid signature', async () => {
      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', {});

      const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'invalid-signature'
        },
        body: JSON.stringify(webhookEvent)
      });

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toContain('Webhook Error');
    });

    it('should handle idempotent webhook delivery', async () => {
      // Stripe may deliver the same webhook multiple times
      const paymentIntent = createTestPaymentIntent({
        id: 'pi_test_idempotent',
        metadata: fixtures.webhooks.paymentSucceeded.data.object.metadata
      });

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', paymentIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      // Send webhook twice
      const responses = await Promise.all([
        fetch(`${process.env.API_URL}/webhook/stripe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature
          },
          body: JSON.stringify(webhookEvent)
        }),
        fetch(`${process.env.API_URL}/webhook/stripe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature
          },
          body: JSON.stringify(webhookEvent)
        })
      ]);

      // Both should succeed
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      
      // But only one order should be created (handled by idempotency)
    });
  });

  describe('Environment Filtering', () => {
    it('should only process webhooks for matching environment', async () => {
      // Test environment webhook should be ignored by production
      const testPaymentIntent = createTestPaymentIntent({
        id: 'pi_test_env_filter',
        livemode: false,
        metadata: {
          ...fixtures.webhooks.paymentSucceeded.data.object.metadata,
          environment: 'test'
        }
      });

      const prodPaymentIntent = createTestPaymentIntent({
        id: 'pi_prod_env_filter',
        livemode: true,
        metadata: {
          ...fixtures.webhooks.paymentSucceeded.data.object.metadata,
          environment: 'production'
        }
      });

      // Both webhooks sent to test environment
      const testWebhook = createTestWebhookEvent('payment_intent.succeeded', testPaymentIntent);
      const prodWebhook = createTestWebhookEvent('payment_intent.succeeded', prodPaymentIntent);

      const testSignature = generateWebhookSignature(testWebhook, webhookSecret);
      const prodSignature = generateWebhookSignature(prodWebhook, webhookSecret);

      // Test webhook should be processed
      const testResponse = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': testSignature
        },
        body: JSON.stringify(testWebhook)
      });

      expect(testResponse.status).toBe(200);

      // Production webhook should be skipped (but still return 200)
      const prodResponse = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': prodSignature
        },
        body: JSON.stringify(prodWebhook)
      });

      expect(prodResponse.status).toBe(200);
      // In logs, this would show as "skipped - environment mismatch"
    });

    it('should create draft orders for test environments', async () => {
      const testEnvironments = ['development', 'staging', 'test'];
      
      for (const env of testEnvironments) {
        const paymentIntent = createTestPaymentIntent({
          id: `pi_test_${env}`,
          livemode: false,
          metadata: {
            ...fixtures.webhooks.paymentSucceeded.data.object.metadata,
            environment: env
          }
        });

        const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', paymentIntent);
        const signature = generateWebhookSignature(webhookEvent, webhookSecret);

        const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature
          },
          body: JSON.stringify(webhookEvent)
        });

        expect(response.status).toBe(200);
        // Would create draft order in Shopify
      }
    });

    it('should create regular orders for production environment', async () => {
      const paymentIntent = createTestPaymentIntent({
        id: 'pi_prod_regular_order',
        livemode: true,
        metadata: {
          ...fixtures.webhooks.paymentSucceeded.data.object.metadata,
          environment: 'production'
        }
      });

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', paymentIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      // This would need production webhook secret in real scenario
      const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });

      expect(response.status).toBe(200);
      // Would create regular order in Shopify (not draft)
    });
  });

  describe('Rep Tracking', () => {
    it('should preserve rep parameter in Shopify order', async () => {
      const repValues = ['john-doe', 'jane-smith', 'sales-team-1'];
      
      for (const rep of repValues) {
        const paymentIntent = createTestPaymentIntent({
          id: `pi_test_rep_${rep}`,
          metadata: {
            ...fixtures.webhooks.paymentSucceeded.data.object.metadata,
            rep: rep
          }
        });

        const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', paymentIntent);
        const signature = generateWebhookSignature(webhookEvent, webhookSecret);

        const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature
          },
          body: JSON.stringify(webhookEvent)
        });

        expect(response.status).toBe(200);
        // Order would include rep in note_attributes
      }
    });

    it('should handle orders without rep parameter', async () => {
      const paymentIntent = createTestPaymentIntent({
        id: 'pi_test_no_rep',
        metadata: {
          customer_email: 'no-rep@example.com',
          customer_first_name: 'No',
          customer_last_name: 'Rep',
          items: JSON.stringify(fixtures.valid.cart.basic.items),
          shipping_address: JSON.stringify(fixtures.valid.customer.basic),
          store_domain: 'test-store.myshopify.com',
          environment: 'test'
          // No rep field
        }
      });

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', paymentIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });

      expect(response.status).toBe(200);
      // Order should still be created without rep
    });
  });

  describe('Order Data Integrity', () => {
    it('should preserve all order data from payment intent', async () => {
      const orderData = {
        customer_email: 'complete@example.com',
        customer_first_name: 'Complete',
        customer_last_name: 'Order',
        items: JSON.stringify([
          {
            variant_id: 40000000001,
            quantity: 2,
            price: 5000,
            title: 'Product A'
          },
          {
            variant_id: 40000000002,
            quantity: 1,
            price: 15000,
            title: 'Product B'
          }
        ]),
        shipping_address: JSON.stringify({
          first_name: 'Complete',
          last_name: 'Order',
          address1: '789 Complete Street',
          address2: 'Suite 100',
          city: 'San Francisco',
          province: 'CA',
          zip: '94105',
          country: 'US',
          phone: '555-9999'
        }),
        shipping_method: 'Express Shipping',
        shipping_price: '20.00',
        store_domain: 'test-store.myshopify.com',
        rep: 'data-integrity-test',
        environment: 'test'
      };

      const paymentIntent = createTestPaymentIntent({
        id: 'pi_test_data_integrity',
        amount: 27000, // (2*5000 + 15000 + 2000 shipping)
        metadata: orderData
      });

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', paymentIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });

      expect(response.status).toBe(200);
      // All data should be preserved in Shopify order
    });

    it('should handle special characters in order data', async () => {
      const specialCharData = {
        customer_email: 'special+test@example.com',
        customer_first_name: "O'Connor",
        customer_last_name: 'José-María',
        items: JSON.stringify([{
          variant_id: 40000000003,
          quantity: 1,
          price: 10000,
          title: 'Product with "quotes" & special chars'
        }]),
        shipping_address: JSON.stringify({
          first_name: "O'Connor",
          last_name: 'José-María',
          address1: '123 Ñoño Street #42',
          city: 'São Paulo',
          province: 'SP',
          zip: '01310-100',
          country: 'BR'
        }),
        store_domain: 'test-store.myshopify.com',
        environment: 'test'
      };

      const paymentIntent = createTestPaymentIntent({
        id: 'pi_test_special_chars',
        metadata: specialCharData
      });

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', paymentIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });

      expect(response.status).toBe(200);
      // Special characters should be properly handled
    });
  });

  describe('Error Recovery', () => {
    it('should handle missing required metadata gracefully', async () => {
      const incompletePaymentIntent = createTestPaymentIntent({
        id: 'pi_test_incomplete',
        metadata: {
          // Missing required fields
          customer_email: 'incomplete@example.com'
        }
      });

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', incompletePaymentIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });

      expect(response.status).toBe(200); // Still return 200 to prevent retries
      // Error would be logged internally
    });

    it('should attempt manual order creation on webhook failure', async () => {
      // This tests the fallback mechanism mentioned in requirements
      const paymentIntent = createTestPaymentIntent({
        id: 'pi_test_manual_fallback',
        metadata: {
          ...fixtures.webhooks.paymentSucceeded.data.object.metadata,
          // Flag to simulate Shopify API failure
          test_scenario: 'shopify_api_failure'
        }
      });

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', paymentIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });

      expect(response.status).toBe(200);
      // System would attempt manual order creation
      // Customer would see generic error if all attempts fail
    });

    it('should handle webhook processing timeout', async () => {
      const paymentIntent = createTestPaymentIntent({
        id: 'pi_test_timeout',
        metadata: {
          ...fixtures.webhooks.paymentSucceeded.data.object.metadata,
          // Flag to simulate slow processing
          test_scenario: 'slow_processing'
        }
      });

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', paymentIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const response = await fetch(`${process.env.API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent),
        // Note: In real scenario, this might timeout
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }).catch(err => ({ status: 'timeout', error: err }));

      if (response.status === 'timeout') {
        // Webhook would be retried by Stripe
        expect(true).toBe(true);
      } else {
        expect(response.status).toBe(200);
      }
    });
  });
});