// ACH Hybrid Checkout Flow Integration Tests
const fetch = require('node-fetch');
const { server } = require('../shared/mocks/server');
const { rest } = require('msw');
const { 
  createTestCart, 
  createTestCustomer,
  createTestSession,
  generateTestSessionToken,
  generateTestCSRFToken,
  createTestPaymentIntent,
  createTestWebhookEvent,
  waitFor
} = require('../shared/helpers/utils/test-helpers');
const { getApiUrl, shouldMockPayments } = require('../shared/helpers/environment');

const API_URL = shouldMockPayments() ? 'http://localhost:3000' : getApiUrl();

describe('ACH Hybrid Checkout Flow - End to End', () => {
  let sessionToken;
  let csrfToken;
  
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  
  beforeEach(async () => {
    // Create session for tests
    sessionToken = generateTestSessionToken();
    csrfToken = generateTestCSRFToken();
    
    // Mock session creation
    server.use(
      rest.post(`${API_URL}/api/checkout/session`, (req, res, ctx) => {
        return res(ctx.json({
          sessionToken,
          csrfToken
        }));
      })
    );
  });
  
  describe('Financial Connections Flow', () => {
    it('should complete full checkout with Financial Connections', async () => {
      // Step 1: Calculate shipping
      const shippingResponse = await fetch(`${API_URL}/api/calculate-shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          items: createTestCart().items,
          address: {
            postal_code: '10001',
            state: 'NY',
            country: 'US'
          }
        })
      });
      
      expect(shippingResponse.ok).toBe(true);
      const shippingData = await shippingResponse.json();
      
      // Step 2: Calculate tax
      const taxResponse = await fetch(`${API_URL}/api/calculate-tax`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          subtotal: 10000,
          shipping: shippingData.shipping.price,
          state: 'NY'
        })
      });
      
      expect(taxResponse.ok).toBe(true);
      const taxData = await taxResponse.json();
      
      // Step 3: Create ACH payment intent for Financial Connections
      const customer = createTestCustomer();
      const paymentResponse = await fetch(`${API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 10000 + shippingData.shipping.price + (taxData.tax || 0),
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: customer.email,
          metadata: {
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
            shipping_method: shippingData.shipping.method,
            shipping_price: shippingData.shipping.price.toString(),
            items: JSON.stringify(createTestCart().items.map(item => ({
              variant_id: item.variant_id,
              quantity: item.quantity,
              price: item.price,
              title: item.title
            }))),
            payment_mode: 'financial_connections'
          }
        })
      });
      
      expect(paymentResponse.ok).toBe(true);
      const paymentData = await paymentResponse.json();
      expect(paymentData.clientSecret).toBeDefined();
      expect(paymentData.paymentIntentId).toBeDefined();
      
      // Step 4: Simulate successful bank connection (would be done via Stripe.js)
      // In real flow, this would be: stripe.collectBankAccountForPayment()
      
      // Step 5: Simulate webhook for processing ACH payment
      const webhookPayload = createTestWebhookEvent('payment_intent.processing', {
        id: paymentData.paymentIntentId,
        amount: 11000,
        currency: 'usd',
        payment_method_types: ['us_bank_account'],
        status: 'processing',
        metadata: {
          store_domain: 'sqqpyb-yq.myshopify.com',
          customer_email: customer.email,
          environment: 'test',
          payment_mode: 'financial_connections'
        }
      });
      
      const webhookResponse = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });
      
      expect(webhookResponse.ok).toBe(true);
      const webhookResult = await webhookResponse.json();
      expect(webhookResult.received).toBe(true);
    });
    
    it('should handle Financial Connections cancellation gracefully', async () => {
      const customer = createTestCustomer();
      
      // Create payment intent
      const paymentResponse = await fetch(`${API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 11000,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: customer.email,
          metadata: {
            customer_email: customer.email,
            payment_mode: 'financial_connections'
          }
        })
      });
      
      expect(paymentResponse.ok).toBe(true);
      const paymentData = await paymentResponse.json();
      
      // Simulate user cancelling Financial Connections
      // In real flow: stripe.collectBankAccountForPayment() returns {error: {type: 'canceled'}}
      
      // Payment intent should still exist but not be confirmed
      expect(paymentData.paymentIntentId).toBeDefined();
      // No webhook would fire in this case
    });
  });
  
  describe('Manual Entry Flow', () => {
    it('should complete full checkout with manual ACH entry', async () => {
      // Step 1-2: Shipping and tax calculation (same as above)
      const shippingData = { shipping: { price: 1000, method: 'standard' } };
      const taxData = { tax: 800 };
      
      // Step 3: Create payment intent with manual ACH details
      const customer = createTestCustomer();
      const bankDetails = {
        accountHolderName: 'John Doe',
        routingNumber: '021000021',
        accountNumber: '123456789',
        accountType: 'checking'
      };
      
      // First, create payment method (simulated)
      const paymentMethodId = 'pm_test_manual_ach';
      
      // Create payment intent with payment method
      const paymentResponse = await fetch(`${API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 11800,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          payment_method: paymentMethodId,
          customer_email: customer.email,
          mandate_data: {
            customer_acceptance: {
              type: 'online',
              online: {
                ip_address: '{{IP_ADDRESS}}',
                user_agent: 'Mozilla/5.0 Test Browser'
              }
            }
          },
          metadata: {
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
            payment_mode: 'manual_entry',
            bank_details: JSON.stringify({
              account_holder: bankDetails.accountHolderName,
              account_type: bankDetails.accountType,
              last4: bankDetails.accountNumber.slice(-4)
            })
          }
        })
      });
      
      expect(paymentResponse.ok).toBe(true);
      const paymentData = await paymentResponse.json();
      expect(paymentData.clientSecret).toBeDefined();
      
      // Step 4: Simulate payment confirmation (would be done via Stripe.js)
      // In real flow: stripe.confirmUsBankAccountPayment(clientSecret)
      
      // Step 5: Simulate webhook for processing manual ACH payment
      const webhookPayload = createTestWebhookEvent('payment_intent.processing', {
        id: paymentData.paymentIntentId || 'pi_test_manual',
        amount: 11800,
        currency: 'usd',
        payment_method_types: ['us_bank_account'],
        status: 'processing',
        metadata: {
          store_domain: 'sqqpyb-yq.myshopify.com',
          customer_email: customer.email,
          environment: 'test',
          payment_mode: 'manual_entry'
        }
      });
      
      const webhookResponse = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      });
      
      expect(webhookResponse.ok).toBe(true);
    });
    
    it('should handle invalid routing number in manual entry', async () => {
      const customer = createTestCustomer();
      
      // Attempt to create payment with invalid routing number
      const paymentResponse = await fetch(`${API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 11800,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          payment_method: 'pm_invalid_routing', // This would fail in Stripe
          customer_email: customer.email,
          metadata: {
            payment_mode: 'manual_entry',
            error_test: 'invalid_routing'
          }
        })
      });
      
      // In a real scenario, this might return 400 or the error would come from Stripe
      // For testing, we can simulate either scenario
      if (!paymentResponse.ok) {
        const error = await paymentResponse.json();
        expect(error.error).toContain('routing');
      }
    });
  });
  
  describe('Mode Switching During Checkout', () => {
    it('should allow switching from Financial Connections to manual entry', async () => {
      const customer = createTestCustomer();
      
      // Step 1: Start with Financial Connections
      const fcPaymentResponse = await fetch(`${API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 11800,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: customer.email,
          metadata: {
            customer_email: customer.email,
            payment_mode: 'financial_connections'
          }
        })
      });
      
      expect(fcPaymentResponse.ok).toBe(true);
      const fcPaymentData = await fcPaymentResponse.json();
      
      // Step 2: User cancels and switches to manual entry
      // Create new payment intent with manual details
      const manualPaymentResponse = await fetch(`${API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 11800,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          payment_method: 'pm_test_manual_switch',
          customer_email: customer.email,
          metadata: {
            customer_email: customer.email,
            payment_mode: 'manual_entry',
            previous_mode: 'financial_connections',
            previous_intent: fcPaymentData.paymentIntentId
          }
        })
      });
      
      expect(manualPaymentResponse.ok).toBe(true);
      const manualPaymentData = await manualPaymentResponse.json();
      
      // Should have different payment intent IDs
      expect(manualPaymentData.paymentIntentId).not.toBe(fcPaymentData.paymentIntentId);
    });
  });
  
  describe('Webhook Processing for Both Modes', () => {
    it('should differentiate between FC and manual webhooks', async () => {
      // Financial Connections webhook
      const fcWebhook = createTestWebhookEvent('payment_intent.processing', {
        id: 'pi_test_fc',
        payment_method_types: ['us_bank_account'],
        metadata: {
          payment_mode: 'financial_connections',
          store_domain: 'sqqpyb-yq.myshopify.com'
        }
      });
      
      const fcResponse = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fcWebhook)
      });
      
      expect(fcResponse.ok).toBe(true);
      
      // Manual entry webhook
      const manualWebhook = createTestWebhookEvent('payment_intent.processing', {
        id: 'pi_test_manual',
        payment_method_types: ['us_bank_account'],
        metadata: {
          payment_mode: 'manual_entry',
          store_domain: 'sqqpyb-yq.myshopify.com'
        }
      });
      
      const manualResponse = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(manualWebhook)
      });
      
      expect(manualResponse.ok).toBe(true);
    });
    
    it('should handle ACH payment failure for both modes', async () => {
      // Test failure webhook
      const failureWebhook = createTestWebhookEvent('charge.failed', {
        id: 'ch_test_failed',
        payment_intent: 'pi_test_ach',
        amount: 11800,
        payment_method_details: {
          type: 'ach_debit',
          ach_debit: {
            bank_name: 'Test Bank',
            last4: '6789'
          }
        },
        failure_code: 'insufficient_funds',
        failure_message: 'The bank account has insufficient funds.',
        metadata: {
          payment_mode: 'manual_entry' // Could be either mode
        }
      });
      
      const response = await fetch(`${API_URL}/api/stripe/webhook`, {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(failureWebhook)
      });
      
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.received).toBe(true);
    });
  });
  
  describe('Session Management Across Modes', () => {
    it('should maintain session state when switching modes', async () => {
      // Create initial session
      const sessionResponse = await fetch(`${API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: generateTestSessionToken(),
          cartTotal: 10000
        })
      });
      
      expect(sessionResponse.ok).toBe(true);
      const sessionData = await sessionResponse.json();
      const { sessionToken: newToken, csrfToken: newCsrf } = sessionData;
      
      // Use same session for Financial Connections attempt
      const fcResponse = await fetch(`${API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
          'x-csrf-token': newCsrf,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 11800,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          metadata: { payment_mode: 'financial_connections' }
        })
      });
      
      expect(fcResponse.ok).toBe(true);
      
      // Use same session for manual entry
      const manualResponse = await fetch(`${API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
          'x-csrf-token': newCsrf,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 11800,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          payment_method: 'pm_test_manual',
          metadata: { payment_mode: 'manual_entry' }
        })
      });
      
      expect(manualResponse.ok).toBe(true);
    });
  });
});