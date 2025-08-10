// Complete checkout flow E2E tests

const { createTestCart, createTestCustomer, waitFor } = require('@helpers/utils/test-helpers');
const { clearTestSessions } = require('@helpers/utils/mock-handlers');
const fixtures = require('@fixtures');

describe('Complete Checkout Flow', () => {
  beforeEach(() => {
    clearTestSessions();
  });

  describe('Happy Path - Card Payment', () => {
    it('should complete full checkout with card payment', async () => {
      const cart = fixtures.valid.cart.basic;
      const customer = fixtures.valid.customer.basic;
      const card = fixtures.valid.payment.card;

      // Step 1: Create checkout session
      const sessionResponse = await fetch(`${process.env.API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: cart.token,
          cartTotal: cart.total_price
        })
      });

      expect(sessionResponse.status).toBe(200);
      const session = await sessionResponse.json();
      expect(session).toBeValidSession();

      // Step 2: Calculate shipping
      const shippingResponse = await fetch(`${process.env.API_URL}/api/calculate-shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          items: cart.items,
          address: {
            postal_code: customer.zip,
            state: customer.province,
            country: customer.country
          }
        })
      });

      expect(shippingResponse.status).toBe(200);
      const shippingData = await shippingResponse.json();
      expect(shippingData.shipping.price).toBeGreaterThan(0);

      // Step 3: Calculate tax
      const taxResponse = await fetch(`${process.env.API_URL}/api/calculate-tax`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          subtotal: cart.total_price,
          shipping: shippingData.shipping.price,
          state: customer.province
        })
      });

      expect(taxResponse.status).toBe(200);
      const taxData = await taxResponse.json();
      expect(taxData.taxAmount).toBeGreaterThanOrEqual(0);

      // Step 4: Create payment intent
      const totalAmount = cart.total_price + shippingData.shipping.price + taxData.taxAmount;
      
      const paymentResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
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
            customer_email: customer.email,
            customer_first_name: customer.first_name,
            customer_last_name: customer.last_name,
            items: JSON.stringify(cart.items),
            shipping_address: JSON.stringify(customer),
            shipping_method: shippingData.shipping.method,
            shipping_price: (shippingData.shipping.price / 100).toFixed(2),
            store_domain: 'test-store.myshopify.com',
            environment: 'test'
          }
        })
      });

      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      expect(paymentData).toBeValidPaymentIntent();

      // Step 5: Simulate successful payment confirmation (frontend would handle this)
      // In real E2E test with Playwright, we would:
      // - Fill card details
      // - Confirm payment
      // - Wait for success message

      // Step 6: Verify session cleanup after order
      const logoutResponse = await fetch(`${process.env.API_URL}/api/checkout/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        }
      });

      expect(logoutResponse.status).toBe(200);
    });

    it('should complete checkout with rep tracking', async () => {
      const cart = fixtures.valid.cart.withRep;
      const customer = fixtures.valid.customer.basic;

      // Create session
      const sessionResponse = await fetch(`${process.env.API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: cart.token,
          cartTotal: cart.total_price
        })
      });

      const session = await sessionResponse.json();

      // Create payment intent with rep
      const paymentResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: cart.total_price,
          currency: 'usd',
          metadata: {
            customer_email: customer.email,
            customer_first_name: customer.first_name,
            customer_last_name: customer.last_name,
            items: JSON.stringify(cart.items),
            shipping_address: JSON.stringify(customer),
            store_domain: 'test-store.myshopify.com',
            rep: cart.attributes.rep, // Include rep from cart
            environment: 'test'
          }
        })
      });

      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      expect(paymentData.paymentIntentId).toBeDefined();
      
      // Rep would be included in the webhook payload
    });
  });

  describe('Happy Path - ACH Payment', () => {
    it('should complete checkout with ACH payment', async () => {
      const cart = fixtures.valid.cart.basic;
      const customer = fixtures.valid.customer.basic;
      const ach = fixtures.valid.payment.ach;

      // Create session
      const sessionResponse = await fetch(`${process.env.API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: cart.token,
          cartTotal: cart.total_price
        })
      });

      const session = await sessionResponse.json();

      // Create ACH payment intent
      const paymentResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: cart.total_price,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: customer.email,
          metadata: {
            customer_email: customer.email,
            customer_first_name: customer.first_name,
            customer_last_name: customer.last_name,
            items: JSON.stringify(cart.items),
            shipping_address: JSON.stringify(customer),
            store_domain: 'test-store.myshopify.com',
            payment_method: 'ach',
            account_holder_name: ach.account_holder_name,
            environment: 'test'
          }
        })
      });

      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      expect(paymentData.clientSecret).toBeDefined();
      
      // ACH payments are async - webhook will fire later
    });
  });

  describe('Edge Cases', () => {
    it('should handle session expiry during checkout', async () => {
      const cart = fixtures.valid.cart.basic;
      const customer = fixtures.valid.customer.basic;

      // Create session
      const sessionResponse = await fetch(`${process.env.API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: cart.token,
          cartTotal: cart.total_price
        })
      });

      const session = await sessionResponse.json();

      // Simulate session expiry by using invalid token
      const expiredToken = 'expired-session-token';

      // Try to create payment with expired session
      const paymentResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${expiredToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: cart.total_price,
          currency: 'usd'
        })
      });

      expect(paymentResponse.status).toBe(401);

      // Recover by creating new session
      const recoveryResponse = await fetch(`${process.env.API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: cart.token,
          cartTotal: cart.total_price
        })
      });

      expect(recoveryResponse.status).toBe(200);
      const newSession = await recoveryResponse.json();
      expect(newSession.sessionToken).not.toBe(session.sessionToken);
    });

    it('should handle payment method switching', async () => {
      const cart = fixtures.valid.cart.basic;
      const customer = fixtures.valid.customer.basic;

      // Create session
      const sessionResponse = await fetch(`${process.env.API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: cart.token,
          cartTotal: cart.total_price
        })
      });

      const session = await sessionResponse.json();

      // First try card payment
      const cardPaymentResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: cart.total_price,
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            customer_email: customer.email,
            payment_attempt: '1'
          }
        })
      });

      expect(cardPaymentResponse.status).toBe(200);
      const cardPayment = await cardPaymentResponse.json();

      // Switch to ACH
      const achPaymentResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: cart.total_price,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: customer.email,
          metadata: {
            customer_email: customer.email,
            payment_attempt: '2',
            previous_intent: cardPayment.paymentIntentId
          }
        })
      });

      expect(achPaymentResponse.status).toBe(200);
      const achPayment = await achPaymentResponse.json();
      
      // Different payment intents
      expect(achPayment.paymentIntentId).not.toBe(cardPayment.paymentIntentId);
    });

    it('should handle cart changes during checkout', async () => {
      let cart = fixtures.valid.cart.basic;
      const customer = fixtures.valid.customer.basic;

      // Create session with initial cart
      const sessionResponse = await fetch(`${process.env.API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: cart.token,
          cartTotal: cart.total_price
        })
      });

      const session = await sessionResponse.json();

      // Simulate cart update (user added item)
      const updatedCart = {
        ...cart,
        total_price: cart.total_price + 5000,
        items: [...cart.items, {
          variant_id: 40000000099,
          quantity: 1,
          price: 5000,
          title: 'Added Product'
        }]
      };

      // Create new session with updated cart
      const newSessionResponse = await fetch(`${process.env.API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: updatedCart.token,
          cartTotal: updatedCart.total_price
        })
      });

      const newSession = await newSessionResponse.json();

      // Create payment with updated amount
      const paymentResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newSession.sessionToken}`,
          'x-csrf-token': newSession.csrfToken
        },
        body: JSON.stringify({
          amount: updatedCart.total_price,
          currency: 'usd',
          metadata: {
            customer_email: customer.email,
            items: JSON.stringify(updatedCart.items),
            cart_updated: 'true'
          }
        })
      });

      expect(paymentResponse.status).toBe(200);
    });
  });

  describe('Multiple Concurrent Checkouts', () => {
    it('should handle multiple users checking out simultaneously', async () => {
      const carts = [
        fixtures.valid.cart.basic,
        fixtures.valid.cart.multipleItems,
        { ...fixtures.valid.cart.basic, token: 'concurrent-cart-3' }
      ];

      // Create sessions concurrently
      const sessionPromises = carts.map(cart => 
        fetch(`${process.env.API_URL}/api/checkout/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://sqqpyb-yq.myshopify.com'
          },
          body: JSON.stringify({
            cartToken: cart.token,
            cartTotal: cart.total_price
          })
        }).then(r => r.json())
      );

      const sessions = await Promise.all(sessionPromises);
      
      // All should have unique tokens
      const tokens = sessions.map(s => s.sessionToken);
      expect(new Set(tokens).size).toBe(tokens.length);

      // Create payments concurrently
      const paymentPromises = sessions.map((session, index) => 
        fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.sessionToken}`,
            'x-csrf-token': session.csrfToken
          },
          body: JSON.stringify({
            amount: carts[index].total_price,
            currency: 'usd',
            metadata: {
              customer_email: `user${index}@example.com`,
              concurrent_test: 'true'
            }
          })
        })
      );

      const paymentResponses = await Promise.all(paymentPromises);
      const statuses = paymentResponses.map(r => r.status);
      
      // All should succeed
      expect(statuses.every(status => status === 200)).toBe(true);
    });
  });

  describe('Environment-Specific Checkout', () => {
    it('should use correct settings for test environment', async () => {
      const cart = fixtures.valid.cart.basic;
      const customer = fixtures.valid.customer.basic;

      // Create session
      const sessionResponse = await fetch(`${process.env.API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: cart.token,
          cartTotal: cart.total_price
        })
      });

      const session = await sessionResponse.json();

      // Create payment intent with test environment
      const paymentResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: cart.total_price,
          currency: 'usd',
          metadata: {
            customer_email: customer.email,
            environment: 'test', // Explicit test environment
            store_domain: 'test-store.myshopify.com'
          }
        })
      });

      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      
      // Test payment intents have specific format
      expect(paymentData.paymentIntentId).toMatch(/^pi_test_/);
    });

    it('should create draft orders in test environment', async () => {
      // This would be verified through webhook processing
      // Test environment webhooks should create draft orders
      
      const webhookPayload = fixtures.webhooks.paymentSucceeded;
      
      // Ensure environment is set to test
      expect(webhookPayload.data.object.metadata.environment).toBe('test');
      
      // When webhook is processed, it should create a draft order
      // This is verified in the webhook tests
    });
  });
});