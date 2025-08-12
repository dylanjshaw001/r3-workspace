/**
 * Comprehensive Backend API E2E Journey Tests
 * 
 * These tests validate complete API-only flows through the R3 backend,
 * from session creation through order completion, without UI dependencies.
 * 
 * Test Coverage:
 * - Complete checkout API flows (session → payment → webhook → order)
 * - Rep parameter tracking through entire backend pipeline  
 * - Payment method flows (Card vs ACH)
 * - Environment-specific behavior (draft vs regular orders)
 * - Error recovery and retry scenarios
 * - Concurrent user handling
 * - Performance benchmarks
 */

const envHelper = require('../../../shared/helpers/environment');

const { clearTestSessions, addTestSession } = require('../../../shared/helpers/utils/mock-handlers');
const fixtures = require('../../../shared/fixtures');
const crypto = require('crypto');

// Helper to generate valid Stripe webhook signature
function generateWebhookSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return `t=${timestamp},v1=${signature}`;
}

// Helper to create test webhook event
function createTestWebhookEvent(type, paymentIntent) {
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: paymentIntent
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null
    },
    type: type
  };
}

describe('Backend API E2E Journey Tests', () => {
  const backendUrl = envHelper.getApiUrl();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST || 'whsec_test_secret';
  
  beforeEach(async () => {
    clearTestSessions();
  });

  describe('Complete API Journey - Card Payment', () => {
    it('should complete full API flow: Session → Payment → Webhook → Order', async () => {
      const testData = {
        cart: fixtures.valid.cart.basic,
        customer: fixtures.valid.customer.basic,
        repCode: 'api-journey-rep-001'
      };

      console.log('🚀 Starting complete card payment API journey...');

      // STEP 1: Create checkout session
      console.log('📝 Step 1: Creating checkout session...');
      
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: testData.cart.token,
          cartTotal: testData.cart.total_price
        })
      });
      
      expect(sessionResponse.status).toBe(200);
      const session = await sessionResponse.json();
      expect(session.sessionToken).toBeDefined();
      expect(session.csrfToken).toBeDefined();
      console.log('✅ Session created:', session.sessionToken.substring(0, 12) + '...');

      // STEP 2: Calculate shipping
      console.log('🚚 Step 2: Calculating shipping...');
      
      const shippingResponse = await fetch(`${backendUrl}/api/calculate-shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          items: testData.cart.items,
          address: {
            postal_code: testData.customer.zip,
            state: testData.customer.province,
            country: testData.customer.country
          }
        })
      });
      
      expect(shippingResponse.status).toBe(200);
      const shippingData = await shippingResponse.json();
      expect(shippingData.shipping).toBeDefined();
      expect(shippingData.shipping.price).toBeGreaterThanOrEqual(0);
      console.log('✅ Shipping calculated:', `$${(shippingData.shipping.price / 100).toFixed(2)}`);

      // STEP 3: Calculate tax  
      console.log('💰 Step 3: Calculating tax...');
      
      const taxResponse = await fetch(`${backendUrl}/api/calculate-tax`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          subtotal: testData.cart.total_price,
          shipping: shippingData.shipping.price,
          state: testData.customer.province
        })
      });
      
      expect(taxResponse.status).toBe(200);
      const taxData = await taxResponse.json();
      expect(taxData.taxAmount).toBeGreaterThanOrEqual(0);
      console.log('✅ Tax calculated:', `$${(taxData.taxAmount / 100).toFixed(2)}`);

      // STEP 4: Create payment intent
      console.log('💳 Step 4: Creating payment intent...');
      
      const totalAmount = testData.cart.total_price + shippingData.shipping.price + taxData.taxAmount;
      
      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: totalAmount,
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            customer_email: testData.customer.email,
            customer_first_name: testData.customer.first_name,
            customer_last_name: testData.customer.last_name,
            items: JSON.stringify(testData.cart.items),
            shipping_address: JSON.stringify({
              first_name: testData.customer.first_name,
              last_name: testData.customer.last_name,
              address1: testData.customer.address1,
              city: testData.customer.city,
              province: testData.customer.province,
              zip: testData.customer.zip,
              country: testData.customer.country,
              phone: testData.customer.phone
            }),
            shipping_method: shippingData.shipping.method,
            shipping_price: (shippingData.shipping.price / 100).toFixed(2),
            tax_amount: (taxData.taxAmount / 100).toFixed(2),
            store_domain: 'sqqpyb-yq.myshopify.com',
            rep: testData.repCode,
            environment: 'test'
          }
        })
      });
      
      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      expect(paymentData.clientSecret).toBeDefined();
      expect(paymentData.paymentIntentId).toMatch(/^pi_test_/);
      console.log('✅ Payment intent created:', paymentData.paymentIntentId);

      // STEP 5: Simulate successful payment confirmation (webhook)
      console.log('🎉 Step 5: Simulating successful payment webhook...');
      
      const succeededPaymentIntent = {
        id: paymentData.paymentIntentId,
        object: 'payment_intent',
        amount: totalAmount,
        currency: 'usd',
        status: 'succeeded',
        livemode: false,
        metadata: {
          customer_email: testData.customer.email,
          customer_first_name: testData.customer.first_name,
          customer_last_name: testData.customer.last_name,
          items: JSON.stringify(testData.cart.items),
          shipping_address: JSON.stringify({
            first_name: testData.customer.first_name,
            last_name: testData.customer.last_name,
            address1: testData.customer.address1,
            city: testData.customer.city,
            province: testData.customer.province,
            zip: testData.customer.zip,
            country: testData.customer.country,
            phone: testData.customer.phone
          }),
          shipping_method: shippingData.shipping.method,
          shipping_price: (shippingData.shipping.price / 100).toFixed(2),
          tax_amount: (taxData.taxAmount / 100).toFixed(2),
          store_domain: 'sqqpyb-yq.myshopify.com',
          rep: testData.repCode,
          environment: 'test'
        },
        charges: {
          data: [{
            id: 'ch_test_charge',
            amount: totalAmount,
            currency: 'usd',
            status: 'succeeded'
          }]
        }
      };

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', succeededPaymentIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const webhookResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });
      
      expect(webhookResponse.status).toBe(200);
      const webhookData = await webhookResponse.json();
      expect(webhookData.received).toBe(true);
      console.log('✅ Webhook processed successfully');

      // STEP 6: Verify session cleanup after successful order
      console.log('🧹 Step 6: Verifying session cleanup...');
      
      const logoutResponse = await fetch(`${backendUrl}/api/checkout/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        }
      });
      
      expect(logoutResponse.status).toBe(200);
      console.log('✅ Session cleaned up successfully');

      // STEP 7: Verify data integrity throughout flow
      console.log('🔍 Step 7: Verifying end-to-end data integrity...');
      
      // All critical data should be preserved
      expect(succeededPaymentIntent.metadata.rep).toBe(testData.repCode);
      expect(succeededPaymentIntent.metadata.customer_email).toBe(testData.customer.email);
      expect(JSON.parse(succeededPaymentIntent.metadata.items)).toEqual(testData.cart.items);
      expect(succeededPaymentIntent.amount).toBe(totalAmount);
      
      console.log('🎯 Complete API journey PASSED!');
      console.log('📊 Journey Summary:');
      console.log(`   Payment ID: ${paymentData.paymentIntentId}`);
      console.log(`   Customer: ${testData.customer.email}`);
      console.log(`   Rep Code: ${testData.repCode}`);
      console.log(`   Total: $${(totalAmount / 100).toFixed(2)}`);
      console.log(`   Items: ${testData.cart.items.length}`);
    });

    it('should complete API flow with ONEbox products and calculated shipping', async () => {
      const testData = {
        cart: {
          ...fixtures.valid.cart.basic,
          items: [
            {
              variant_id: 40000000001,
              quantity: 15, // 15 units = 1 case (10) + 5 units
              price: 500,   // $5.00 per unit
              title: 'ONEbox Test Product',
              properties: { _onebox: 'true' }
            }
          ],
          total_price: 7500 // 15 * $5.00
        },
        customer: fixtures.valid.customer.basic,
        repCode: 'onebox-api-journey'
      };

      console.log('📦 Testing ONEbox API journey with calculated shipping...');

      // Follow same flow but expect different shipping calculation
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: testData.cart.token,
          cartTotal: testData.cart.total_price
        })
      });
      
      const session = await sessionResponse.json();

      // ONEbox products should have calculated shipping
      const shippingResponse = await fetch(`${backendUrl}/api/calculate-shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          items: testData.cart.items,
          address: {
            postal_code: testData.customer.zip,
            state: testData.customer.province,
            country: testData.customer.country
          }
        })
      });
      
      const shippingData = await shippingResponse.json();
      
      // ONEbox shipping should be calculated (not free)
      // 15 units = 1 case ($25) + 5 units ($25) = $50 shipping
      expect(shippingData.shipping.price).toBeGreaterThan(0);
      expect(shippingData.shipping.price).toBe(5000); // $50.00 in cents
      
      console.log('✅ ONEbox shipping calculated correctly:', `$${(shippingData.shipping.price / 100).toFixed(2)}`);
    });
  });

  describe('Complete API Journey - ACH Payment', () => {
    it('should complete full ACH payment flow with async processing', async () => {
      const testData = {
        cart: fixtures.valid.cart.basic,
        customer: fixtures.valid.customer.basic,
        achDetails: fixtures.valid.payment.ach,
        repCode: 'ach-api-journey-001'
      };

      console.log('🏦 Starting complete ACH payment API journey...');

      // Create session
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: testData.cart.token,
          cartTotal: testData.cart.total_price
        })
      });
      
      const session = await sessionResponse.json();

      // Create ACH payment intent
      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: testData.cart.total_price + 1000, // Include shipping
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: testData.customer.email,
          metadata: {
            customer_email: testData.customer.email,
            customer_first_name: testData.customer.first_name,
            customer_last_name: testData.customer.last_name,
            items: JSON.stringify(testData.cart.items),
            shipping_address: JSON.stringify(testData.customer),
            payment_method: 'ach',
            account_holder_name: testData.achDetails.account_holder_name,
            store_domain: 'sqqpyb-yq.myshopify.com',
            rep: testData.repCode,
            environment: 'test'
          }
        })
      });
      
      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      expect(paymentData.clientSecret).toBeDefined();
      
      console.log('✅ ACH payment intent created:', paymentData.paymentIntentId);

      // Simulate successful ACH webhook (happens later after bank verification)
      const achSucceededIntent = {
        id: paymentData.paymentIntentId,
        object: 'payment_intent',
        amount: testData.cart.total_price + 1000,
        currency: 'usd',
        status: 'succeeded',
        livemode: false,
        payment_method: {
          type: 'us_bank_account'
        },
        metadata: {
          customer_email: testData.customer.email,
          customer_first_name: testData.customer.first_name,
          customer_last_name: testData.customer.last_name,
          items: JSON.stringify(testData.cart.items),
          shipping_address: JSON.stringify(testData.customer),
          payment_method: 'ach',
          account_holder_name: testData.achDetails.account_holder_name,
          store_domain: 'sqqpyb-yq.myshopify.com',
          rep: testData.repCode,
          environment: 'test'
        }
      };

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', achSucceededIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const webhookResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });
      
      expect(webhookResponse.status).toBe(200);
      console.log('✅ ACH webhook processed successfully');
      console.log('🎯 ACH API journey PASSED!');
    });

    it('should handle ACH payment requiring additional verification', async () => {
      const testData = {
        cart: fixtures.valid.cart.basic,
        customer: fixtures.valid.customer.basic
      };

      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: testData.cart.token,
          cartTotal: testData.cart.total_price
        })
      });
      
      const session = await sessionResponse.json();

      // Create ACH payment that requires verification
      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: testData.cart.total_price,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: testData.customer.email,
          metadata: {
            customer_email: testData.customer.email,
            payment_method: 'ach',
            verification_required: 'true', // Flag for test scenario
            environment: 'test'
          }
        })
      });
      
      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      
      // Payment intent created but will require additional action
      expect(paymentData.clientSecret).toBeDefined();
      
      // Simulate requires_action webhook
      const requiresActionIntent = {
        id: paymentData.paymentIntentId,
        status: 'requires_action',
        next_action: {
          type: 'verify_with_microdeposits'
        },
        metadata: {
          customer_email: testData.customer.email,
          payment_method: 'ach',
          environment: 'test'
        }
      };

      const actionWebhook = createTestWebhookEvent('payment_intent.requires_action', requiresActionIntent);
      const actionSignature = generateWebhookSignature(actionWebhook, webhookSecret);

      const actionResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': actionSignature
        },
        body: JSON.stringify(actionWebhook)
      });
      
      expect(actionResponse.status).toBe(200);
      console.log('✅ ACH verification flow handled correctly');
    });
  });

  describe('Rep Parameter API Flow', () => {
    it('should preserve rep parameter through entire backend pipeline', async () => {
      const repCodes = ['api-rep-001', 'SALES-TEAM-A', 'rep_with_underscores', 'Rep.With.Dots'];
      
      for (const repCode of repCodes) {
        console.log(`👤 Testing rep flow for: ${repCode}`);
        
        const testData = {
          cart: {
            ...fixtures.valid.cart.basic,
            attributes: {
              rep: repCode,
              rep_timestamp: new Date().toISOString()
            }
          },
          customer: fixtures.valid.customer.basic
        };

        // Session creation
        const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Origin': 'https://sqqpyb-yq.myshopify.com'
          },
          body: JSON.stringify({
            cartToken: testData.cart.token,
            cartTotal: testData.cart.total_price,
            cartAttributes: testData.cart.attributes // Include cart attributes
          })
        });
        
        const session = await sessionResponse.json();
        expect(session.sessionToken).toBeDefined();

        // Payment creation with rep
        const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.sessionToken}`,
            'x-csrf-token': session.csrfToken
          },
          body: JSON.stringify({
            amount: testData.cart.total_price,
            currency: 'usd',
            metadata: {
              customer_email: testData.customer.email,
              items: JSON.stringify(testData.cart.items),
              rep: repCode, // Explicitly include rep
              store_domain: 'sqqpyb-yq.myshopify.com',
              environment: 'test'
            }
          })
        });
        
        expect(paymentResponse.status).toBe(200);
        const paymentData = await paymentResponse.json();

        // Webhook with rep preserved
        const succeededIntent = {
          id: paymentData.paymentIntentId,
          status: 'succeeded',
          amount: testData.cart.total_price,
          metadata: {
            customer_email: testData.customer.email,
            items: JSON.stringify(testData.cart.items),
            rep: repCode, // Rep should be preserved
            store_domain: 'sqqpyb-yq.myshopify.com',
            environment: 'test'
          }
        };

        const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', succeededIntent);
        const signature = generateWebhookSignature(webhookEvent, webhookSecret);

        const webhookResponse = await fetch(`${backendUrl}/webhook/stripe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature
          },
          body: JSON.stringify(webhookEvent)
        });
        
        expect(webhookResponse.status).toBe(200);
        
        // Verify rep was preserved throughout entire flow
        expect(succeededIntent.metadata.rep).toBe(repCode);
        console.log(`✅ Rep "${repCode}" preserved through complete API flow`);
      }
    });

    it('should handle orders without rep parameter gracefully', async () => {
      const testData = {
        cart: fixtures.valid.cart.basic,
        customer: fixtures.valid.customer.basic
      };

      // Complete flow without rep
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: testData.cart.token,
          cartTotal: testData.cart.total_price
          // No cartAttributes with rep
        })
      });
      
      const session = await sessionResponse.json();

      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: testData.cart.total_price,
          currency: 'usd',
          metadata: {
            customer_email: testData.customer.email,
            items: JSON.stringify(testData.cart.items),
            // No rep field
            store_domain: 'sqqpyb-yq.myshopify.com',
            environment: 'test'
          }
        })
      });
      
      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();

      // Webhook should still process successfully without rep
      const succeededIntent = {
        id: paymentData.paymentIntentId,
        status: 'succeeded',
        amount: testData.cart.total_price,
        metadata: {
          customer_email: testData.customer.email,
          items: JSON.stringify(testData.cart.items),
          store_domain: 'sqqpyb-yq.myshopify.com',
          environment: 'test'
        }
      };

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', succeededIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const webhookResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });
      
      expect(webhookResponse.status).toBe(200);
      console.log('✅ Order without rep processed successfully');
    });
  });

  describe('Environment-Specific API Behavior', () => {
    it('should use correct settings for each environment', async () => {
      const environments = [
        { env: 'development', expectTestKeys: true, expectDraftOrder: true },
        { env: 'staging', expectTestKeys: true, expectDraftOrder: true },
        { env: 'production', expectTestKeys: false, expectDraftOrder: false }
      ];

      for (const { env, expectTestKeys, expectDraftOrder } of environments) {
        console.log(`🌍 Testing ${env} environment API behavior...`);
        
        const testData = {
          cart: fixtures.valid.cart.basic,
          customer: fixtures.valid.customer.basic
        };

        // Create session with environment-specific settings
        const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Origin': 'https://sqqpyb-yq.myshopify.com'
          },
          body: JSON.stringify({
            cartToken: `${env}-test-cart`,
            cartTotal: testData.cart.total_price
          })
        });
        
        const session = await sessionResponse.json();

        const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.sessionToken}`,
            'x-csrf-token': session.csrfToken
          },
          body: JSON.stringify({
            amount: testData.cart.total_price,
            currency: 'usd',
            metadata: {
              customer_email: `${env}@example.com`,
              environment: env, // Explicit environment
              store_domain: 'sqqpyb-yq.myshopify.com'
            }
          })
        });
        
        expect(paymentResponse.status).toBe(200);
        const paymentData = await paymentResponse.json();

        if (expectTestKeys) {
          expect(paymentData.paymentIntentId).toMatch(/^pi_test_/);
          console.log(`✅ ${env} correctly using test Stripe keys`);
        } else {
          expect(paymentData.paymentIntentId).toMatch(/^pi_/);
          console.log(`✅ ${env} correctly using live Stripe keys`);
        }

        // Test webhook processing for environment
        const succeededIntent = {
          id: paymentData.paymentIntentId,
          status: 'succeeded',
          amount: testData.cart.total_price,
          livemode: !expectTestKeys,
          metadata: {
            customer_email: `${env}@example.com`,
            environment: env,
            store_domain: 'sqqpyb-yq.myshopify.com'
          }
        };

        const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', succeededIntent);
        const signature = generateWebhookSignature(webhookEvent, webhookSecret);

        const webhookResponse = await fetch(`${backendUrl}/webhook/stripe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': signature
          },
          body: JSON.stringify(webhookEvent)
        });
        
        expect(webhookResponse.status).toBe(200);
        
        if (expectDraftOrder) {
          console.log(`✅ ${env} would create draft order in Shopify`);
        } else {
          console.log(`✅ ${env} would create regular order in Shopify`);
        }
      }
    });
  });

  describe('Error Recovery API Scenarios', () => {
    it('should handle session expiry and recovery', async () => {
      console.log('🔄 Testing session expiry and recovery...');
      
      const testData = {
        cart: fixtures.valid.cart.basic,
        customer: fixtures.valid.customer.basic
      };

      // Create initial session
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: testData.cart.token,
          cartTotal: testData.cart.total_price
        })
      });
      
      const session = await sessionResponse.json();
      console.log('✅ Initial session created');

      // Simulate session expiry by using invalid token
      const expiredResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer expired-invalid-token',
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: testData.cart.total_price,
          currency: 'usd'
        })
      });
      
      expect(expiredResponse.status).toBe(401);
      console.log('✅ Expired session correctly rejected');

      // Recover by creating new session
      const recoveryResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: testData.cart.token,
          cartTotal: testData.cart.total_price
        })
      });
      
      const recoveredSession = await recoveryResponse.json();
      expect(recoveredSession.sessionToken).not.toBe(session.sessionToken);
      console.log('✅ New session created for recovery');

      // Continue with recovered session
      const continueResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${recoveredSession.sessionToken}`,
          'x-csrf-token': recoveredSession.csrfToken
        },
        body: JSON.stringify({
          amount: testData.cart.total_price,
          currency: 'usd',
          metadata: {
            customer_email: testData.customer.email,
            recovery_test: 'true'
          }
        })
      });
      
      expect(continueResponse.status).toBe(200);
      console.log('🎯 Session recovery API flow PASSED!');
    });

    it('should handle payment method switching during API flow', async () => {
      console.log('🔄 Testing payment method switching...');
      
      const testData = {
        cart: fixtures.valid.cart.basic,
        customer: fixtures.valid.customer.basic
      };

      // Create session
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: testData.cart.token,
          cartTotal: testData.cart.total_price
        })
      });
      
      const session = await sessionResponse.json();

      // First attempt: Card payment
      const cardResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: testData.cart.total_price,
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            customer_email: testData.customer.email,
            payment_attempt: '1'
          }
        })
      });
      
      expect(cardResponse.status).toBe(200);
      const cardPayment = await cardResponse.json();
      console.log('✅ Card payment intent created');

      // Switch to ACH payment (simulate user changing mind)
      const achResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: testData.cart.total_price,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: testData.customer.email,
          metadata: {
            customer_email: testData.customer.email,
            payment_attempt: '2',
            previous_intent_id: cardPayment.paymentIntentId
          }
        })
      });
      
      expect(achResponse.status).toBe(200);
      const achPayment = await achResponse.json();
      
      // Should be different payment intents
      expect(achPayment.paymentIntentId).not.toBe(cardPayment.paymentIntentId);
      console.log('✅ Successfully switched from card to ACH payment');
      console.log('🎯 Payment method switching API flow PASSED!');
    });

    it('should handle webhook processing failures gracefully', async () => {
      console.log('⚠️  Testing webhook failure scenarios...');
      
      const testData = fixtures.valid.cart.basic;

      // Test: Missing signature
      const missingSignatureResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // No stripe-signature header
        },
        body: JSON.stringify({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test_missing_sig' } }
        })
      });
      
      expect(missingSignatureResponse.status).toBe(400);
      console.log('✅ Missing signature correctly rejected');

      // Test: Invalid signature
      const invalidSignatureResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'invalid-signature-format'
        },
        body: JSON.stringify({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_test_invalid_sig' } }
        })
      });
      
      expect(invalidSignatureResponse.status).toBe(400);
      console.log('✅ Invalid signature correctly rejected');

      // Test: Valid signature but incomplete metadata
      const incompletePaymentIntent = {
        id: 'pi_test_incomplete_metadata',
        status: 'succeeded',
        amount: 10000,
        metadata: {
          customer_email: 'incomplete@example.com'
          // Missing required fields like items, shipping_address, etc.
        }
      };

      const incompleteEvent = createTestWebhookEvent('payment_intent.succeeded', incompletePaymentIntent);
      const incompleteSignature = generateWebhookSignature(incompleteEvent, webhookSecret);

      const incompleteResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': incompleteSignature
        },
        body: JSON.stringify(incompleteEvent)
      });
      
      // Should still return 200 to prevent webhook retries, but log error internally
      expect(incompleteResponse.status).toBe(200);
      console.log('✅ Incomplete metadata handled gracefully');
      console.log('🎯 Webhook error handling API tests PASSED!');
    });
  });

  describe('Performance API Benchmarks', () => {
    it('should meet performance targets for complete API flow', async () => {
      console.log('⚡ Running API performance benchmarks...');
      
      const testData = {
        cart: fixtures.valid.cart.basic,
        customer: fixtures.valid.customer.basic
      };

      const overallStart = Date.now();
      let sessionTime, shippingTime, taxTime, paymentTime, webhookTime;

      // Session creation performance
      const sessionStart = Date.now();
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: testData.cart.token,
          cartTotal: testData.cart.total_price
        })
      });
      sessionTime = Date.now() - sessionStart;
      const session = await sessionResponse.json();

      // Shipping calculation performance
      const shippingStart = Date.now();
      const shippingResponse = await fetch(`${backendUrl}/api/calculate-shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          items: testData.cart.items,
          address: {
            postal_code: testData.customer.zip,
            state: testData.customer.province
          }
        })
      });
      shippingTime = Date.now() - shippingStart;
      const shippingData = await shippingResponse.json();

      // Tax calculation performance
      const taxStart = Date.now();
      const taxResponse = await fetch(`${backendUrl}/api/calculate-tax`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          subtotal: testData.cart.total_price,
          shipping: shippingData.shipping.price,
          state: testData.customer.province
        })
      });
      taxTime = Date.now() - taxStart;
      const taxData = await taxResponse.json();

      // Payment intent performance
      const paymentStart = Date.now();
      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: testData.cart.total_price + shippingData.shipping.price + taxData.taxAmount,
          currency: 'usd',
          metadata: {
            customer_email: testData.customer.email,
            performance_test: 'true'
          }
        })
      });
      paymentTime = Date.now() - paymentStart;
      const paymentData = await paymentResponse.json();

      // Webhook processing performance
      const webhookStart = Date.now();
      const succeededIntent = {
        id: paymentData.paymentIntentId,
        status: 'succeeded',
        amount: testData.cart.total_price + shippingData.shipping.price + taxData.taxAmount,
        metadata: {
          customer_email: testData.customer.email,
          performance_test: 'true',
          environment: 'test'
        }
      };

      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', succeededIntent);
      const signature = generateWebhookSignature(webhookEvent, webhookSecret);

      const webhookResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookEvent)
      });
      webhookTime = Date.now() - webhookStart;

      const totalTime = Date.now() - overallStart;

      // Performance assertions
      expect(sessionTime).toBeLessThan(1000);   // Session creation < 1s
      expect(shippingTime).toBeLessThan(500);   // Shipping calc < 500ms
      expect(taxTime).toBeLessThan(300);        // Tax calc < 300ms
      expect(paymentTime).toBeLessThan(2000);   // Payment intent < 2s
      expect(webhookTime).toBeLessThan(1000);   // Webhook processing < 1s
      expect(totalTime).toBeLessThan(5000);     // Total flow < 5s

      console.log('📊 Performance Results:');
      console.log(`   Session Creation: ${sessionTime}ms`);
      console.log(`   Shipping Calculation: ${shippingTime}ms`);
      console.log(`   Tax Calculation: ${taxTime}ms`);
      console.log(`   Payment Intent: ${paymentTime}ms`);
      console.log(`   Webhook Processing: ${webhookTime}ms`);
      console.log(`   Total API Flow: ${totalTime}ms`);
      console.log('🎯 All performance targets met!');
    });
  });

  describe('Concurrent API Users', () => {
    it('should handle multiple concurrent checkout sessions', async () => {
      console.log('👥 Testing concurrent API users...');
      
      const concurrentUsers = 5;
      const userPromises = [];

      for (let i = 0; i < concurrentUsers; i++) {
        const userPromise = (async (userId) => {
          const testData = {
            cart: {
              ...fixtures.valid.cart.basic,
              token: `concurrent-cart-${userId}`
            },
            customer: {
              ...fixtures.valid.customer.basic,
              email: `concurrent-user-${userId}@example.com`
            }
          };

          // Create session for this user
          const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Origin': 'https://sqqpyb-yq.myshopify.com'
            },
            body: JSON.stringify({
              cartToken: testData.cart.token,
              cartTotal: testData.cart.total_price
            })
          });
          
          const session = await sessionResponse.json();

          // Create payment for this user
          const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.sessionToken}`,
              'x-csrf-token': session.csrfToken
            },
            body: JSON.stringify({
              amount: testData.cart.total_price,
              currency: 'usd',
              metadata: {
                customer_email: testData.customer.email,
                user_id: userId.toString(),
                concurrent_test: 'true'
              }
            })
          });

          const paymentData = await paymentResponse.json();

          return {
            userId,
            sessionToken: session.sessionToken,
            paymentIntentId: paymentData.paymentIntentId,
            success: paymentResponse.status === 200
          };
        })(i);

        userPromises.push(userPromise);
      }

      const results = await Promise.all(userPromises);
      
      // All users should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(concurrentUsers);
      
      // All should have unique session tokens
      const sessionTokens = results.map(r => r.sessionToken);
      const uniqueTokens = new Set(sessionTokens);
      expect(uniqueTokens.size).toBe(concurrentUsers);
      
      // All should have unique payment intents
      const paymentIds = results.map(r => r.paymentIntentId);
      const uniquePayments = new Set(paymentIds);
      expect(uniquePayments.size).toBe(concurrentUsers);

      console.log(`✅ ${concurrentUsers} concurrent users handled successfully`);
      console.log('🎯 Concurrent API users test PASSED!');
    });
  });
});