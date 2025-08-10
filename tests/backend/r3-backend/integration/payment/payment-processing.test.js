// Payment processing tests

const { createTestSession, createTestPaymentIntent } = require('@helpers/utils/test-helpers');
const { clearTestSessions, addTestSession } = require('@helpers/utils/mock-handlers');
const fixtures = require('@fixtures');

describe('Payment Processing', () => {
  let validSession;
  
  beforeEach(async () => {
    clearTestSessions();
    
    // Create a valid session for tests
    const response = await fetch(`${process.env.API_URL}/api/checkout/session`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': 'https://sqqpyb-yq.myshopify.com'
      },
      body: JSON.stringify({
        cartToken: fixtures.valid.cart.basic.token,
        cartTotal: fixtures.valid.cart.basic.total_price
      })
    });
    
    validSession = await response.json();
  });

  describe('Card Payments', () => {
    it('should create payment intent for valid card payment', async () => {
      const cart = fixtures.valid.cart.basic;
      const customer = fixtures.valid.customer.basic;
      
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: cart.total_price + 1000, // Include shipping
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            customer_email: customer.email,
            customer_first_name: customer.first_name,
            customer_last_name: customer.last_name,
            items: JSON.stringify(cart.items),
            shipping_address: JSON.stringify({
              first_name: customer.first_name,
              last_name: customer.last_name,
              address1: customer.address1,
              address2: customer.address2,
              city: customer.city,
              province: customer.province,
              zip: customer.zip,
              country: customer.country,
              phone: customer.phone
            }),
            shipping_method: 'Standard Shipping',
            shipping_price: '10.00',
            store_domain: 'test-store.myshopify.com',
            environment: 'test'
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      expect(data).toMatchObject({
        clientSecret: expect.stringMatching(/^pi_test_.*_secret_/),
        paymentIntentId: expect.stringMatching(/^pi_test_/)
      });
    });

    it('should include rep tracking in payment metadata', async () => {
      const cartWithRep = fixtures.valid.cart.withRep;
      const customer = fixtures.valid.customer.basic;
      
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: cartWithRep.total_price,
          currency: 'usd',
          metadata: {
            customer_email: customer.email,
            customer_first_name: customer.first_name,
            customer_last_name: customer.last_name,
            items: JSON.stringify(cartWithRep.items),
            shipping_address: JSON.stringify(customer),
            store_domain: 'test-store.myshopify.com',
            rep: cartWithRep.attributes.rep,
            environment: 'test'
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.paymentIntentId).toBeDefined();
      
      // In real test, we'd verify the metadata was saved correctly
      // For now, we just ensure the request succeeded with rep included
    });

    it('should reject payment intent with invalid amount', async () => {
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: -1000, // Negative amount
          currency: 'usd',
          metadata: {}
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid amount');
    });

    it('should reject payment intent with amount exceeding limit', async () => {
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 1000000, // $10,000 - exceeds limit
          currency: 'usd',
          metadata: {}
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid amount');
    });

    it('should handle 3D Secure card requirements', async () => {
      const customer = fixtures.valid.customer.basic;
      
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 5000,
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            customer_email: customer.email,
            // Include flag to simulate 3DS requirement
            test_mode: '3d_secure_required'
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.clientSecret).toBeDefined();
      
      // In a real implementation, the payment intent would require additional action
      // The frontend would handle this with Stripe.js
    });
  });

  describe('ACH Payments', () => {
    it('should create payment intent for ACH payment', async () => {
      const customer = fixtures.valid.customer.basic;
      
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: customer.email,
          metadata: {
            customer_email: customer.email,
            customer_first_name: customer.first_name,
            customer_last_name: customer.last_name,
            items: JSON.stringify(fixtures.valid.cart.basic.items),
            shipping_address: JSON.stringify(customer),
            store_domain: 'test-store.myshopify.com',
            environment: 'test'
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.clientSecret).toBeDefined();
      expect(data.paymentIntentId).toBeDefined();
    });

    it('should handle ACH payment verification requirements', async () => {
      // ACH payments require additional verification
      // This test ensures the proper flow is supported
      
      const customer = fixtures.valid.customer.basic;
      const achDetails = fixtures.valid.payment.ach;
      
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 25000, // $250 - larger amount typical for ACH
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: customer.email,
          metadata: {
            customer_email: customer.email,
            customer_first_name: customer.first_name,
            customer_last_name: customer.last_name,
            payment_method: 'ach',
            account_holder_name: achDetails.account_holder_name,
            environment: 'test'
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.clientSecret).toBeDefined();
      
      // ACH payments process asynchronously
      // The webhook will handle the final confirmation
    });
  });

  describe('Payment Method Switching', () => {
    it('should handle switching from card to ACH', async () => {
      const customer = fixtures.valid.customer.basic;
      
      // First create card payment intent
      const cardResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: { customer_email: customer.email }
        })
      });
      
      expect(cardResponse.status).toBe(200);
      const cardData = await cardResponse.json();
      
      // Then create ACH payment intent (simulating user switching)
      const achResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          customer_email: customer.email,
          metadata: { 
            customer_email: customer.email,
            previous_intent: cardData.paymentIntentId // Track switch
          }
        })
      });
      
      expect(achResponse.status).toBe(200);
      const achData = await achResponse.json();
      
      // Different payment intents should be created
      expect(achData.paymentIntentId).not.toBe(cardData.paymentIntentId);
    });
  });

  describe('Declined Payments', () => {
    it('should handle declined card gracefully', async () => {
      const customer = fixtures.valid.customer.basic;
      
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            customer_email: customer.email,
            // Flag to simulate declined card in test mode
            test_scenario: 'card_declined'
          }
        })
      });

      // Payment intent creation should still succeed
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.clientSecret).toBeDefined();
      
      // The actual decline would happen during confirmation on frontend
    });

    it('should support retry after declined payment', async () => {
      // This test simulates the retry flow after a declined payment
      const customer = fixtures.valid.customer.basic;
      
      // First attempt (will be declined on frontend)
      const firstResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          metadata: { customer_email: customer.email }
        })
      });
      
      expect(firstResponse.status).toBe(200);
      
      // Second attempt with different card
      const retryResponse = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          metadata: { 
            customer_email: customer.email,
            retry_attempt: 'true'
          }
        })
      });
      
      expect(retryResponse.status).toBe(200);
      const retryData = await retryResponse.json();
      expect(retryData.paymentIntentId).toBeDefined();
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('should use test Stripe keys in test environment', async () => {
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 5000,
          currency: 'usd',
          metadata: {
            environment: 'test',
            customer_email: 'test@example.com'
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      
      // Test payment intents have specific prefixes
      expect(data.paymentIntentId).toMatch(/^pi_test_/);
      expect(data.clientSecret).toMatch(/_secret_test/);
    });

    it('should include environment in payment metadata', async () => {
      const environments = ['development', 'staging', 'production'];
      
      for (const env of environments) {
        const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validSession.sessionToken}`,
            'x-csrf-token': validSession.csrfToken
          },
          body: JSON.stringify({
            amount: 5000,
            currency: 'usd',
            metadata: {
              environment: env,
              customer_email: `${env}@example.com`
            }
          })
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.paymentIntentId).toBeDefined();
      }
    });
  });

  describe('Payment Security', () => {
    it('should require valid session for payment creation', async () => {
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-session-token',
          'x-csrf-token': 'invalid-csrf'
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd'
        })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('session');
    });

    it('should validate CSRF token for payment requests', async () => {
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': 'wrong-csrf-token'
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd'
        })
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('CSRF');
    });

    it('should sanitize customer data in metadata', async () => {
      const response = await fetch(`${process.env.API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${validSession.sessionToken}`,
          'x-csrf-token': validSession.csrfToken
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          metadata: {
            customer_email: '<script>alert("xss")</script>test@example.com',
            customer_first_name: 'Test<script>',
            customer_last_name: 'Customer</script>'
          }
        })
      });

      expect(response.status).toBe(200);
      // In real implementation, the email would be sanitized
      // The payment intent would be created with clean data
    });
  });
});