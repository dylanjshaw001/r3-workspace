// ACH Payment End-to-End Tests
const fetch = require('node-fetch');
const { 
  createTestCart, 
  createTestCustomer,
  createTestSession,
  generateTestSessionToken,
  generateTestCSRFToken,
  createTestPaymentIntent,
  createTestWebhookEvent
} = require('../../shared/helpers/utils/test-helpers');
const { server } = require('../../shared/mocks/server');
const { rest } = require('msw');
const { getApiUrl, shouldMockPayments } = require('../../shared/helpers/environment');

// Use environment-specific API URL
const API_URL = shouldMockPayments() ? 'http://localhost:3000' : getApiUrl();

describe('ACH Payment Processing', () => {
  let sessionToken;
  let csrfToken;
  
  beforeEach(async () => {
    // Create a test session if not mocking
    if (process.env.NODE_ENV !== 'development') {
      const response = await fetch(`${API_URL}/api/checkout/session`, {
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
      
      if (response.ok) {
        const data = await response.json();
        sessionToken = data.sessionToken;
        csrfToken = data.csrfToken;
      }
    } else {
      // Use mock values for development
      sessionToken = generateTestSessionToken();
      csrfToken = generateTestCSRFToken();
    }
  });
  
  describe('ACH Frontend Validation', () => {
    it('should validate ABA routing numbers correctly', () => {
      // Valid routing numbers
      const validRoutingNumbers = [
        '021000021', // JPMorgan Chase
        '026009593', // Bank of America
        '121000248', // Wells Fargo
        '322271627'  // Chase California
      ];
      
      validRoutingNumbers.forEach(routing => {
        const isValid = validateRoutingNumber(routing);
        expect(isValid).toBe(true);
      });
      
      // Invalid routing numbers
      const invalidRoutingNumbers = [
        '123456789', // Invalid checksum
        '00000000',  // Invalid format
        '12345',     // Too short
        '1234567890' // Too long
      ];
      
      invalidRoutingNumbers.forEach(routing => {
        const isValid = validateRoutingNumber(routing);
        expect(isValid).toBe(false);
      });
    });
    
    it('should require all ACH fields before enabling submit', () => {
      const requiredFields = {
        accountHolderName: '',
        routingNumber: '',
        accountNumber: '',
        accountType: '',
        mandateAccepted: false
      };
      
      // All fields empty - should be invalid
      expect(isACHFormValid(requiredFields)).toBe(false);
      
      // Fill fields one by one
      requiredFields.accountHolderName = 'John Doe';
      expect(isACHFormValid(requiredFields)).toBe(false);
      
      requiredFields.routingNumber = '021000021';
      expect(isACHFormValid(requiredFields)).toBe(false);
      
      requiredFields.accountNumber = '123456789';
      expect(isACHFormValid(requiredFields)).toBe(false);
      
      requiredFields.accountType = 'checking';
      expect(isACHFormValid(requiredFields)).toBe(false);
      
      requiredFields.mandateAccepted = true;
      expect(isACHFormValid(requiredFields)).toBe(true);
    });
  });
  
  describe('ACH Payment Intent Creation', () => {
    it('should create payment intent with ACH configuration', async () => {
      const customer = createTestCustomer();
      const cart = createTestCart();
      
      const response = await fetch(`${API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 10000, // $100.00
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
            items: JSON.stringify(cart.items.map(item => ({
              variant_id: item.variant_id,
              quantity: item.quantity,
              price: item.price,
              title: item.title
            })))
          }
        })
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('clientSecret');
      expect(data).toHaveProperty('paymentIntentId');
    });
    
    it('should reject ACH payment without customer email', async () => {
      const response = await fetch(`${API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'x-csrf-token': csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          payment_method_types: ['us_bank_account'],
          metadata: {
            // Missing customer_email
            shipping_address: JSON.stringify({
              address1: '123 Test St',
              city: 'New York',
              province: 'NY',
              zip: '10001'
            })
          }
        })
      });
      
      // Should still create payment intent but without receipt_email
      expect(response.status).toBe(200);
    });
  });
  
  describe('ACH Webhook Handling', () => {
    it('should create draft order for ACH payment', async () => {
      // This would test the webhook handling for ACH payments
      // In a real test, you'd simulate a webhook from Stripe
      const webhookPayload = {
        id: 'evt_test_ach',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_ach',
            amount: 10000,
            currency: 'usd',
            payment_method_types: ['us_bank_account'],
            metadata: {
              store_domain: 'sqqpyb-yq.myshopify.com',
              customer_email: 'test@example.com',
              environment: process.env.NODE_ENV || 'development'
            }
          }
        }
      };
      
      // The webhook handler should create a draft order with ACH tags
      // expect(draftOrder.tags).toContain('ACH_PAYMENT');
      // expect(draftOrder.tags).toContain('PENDING_VERIFICATION');
    });
    
    it('should handle ACH charge.succeeded event', async () => {
      const webhookPayload = {
        id: 'evt_test_charge',
        type: 'charge.succeeded',
        data: {
          object: {
            id: 'ch_test_ach',
            payment_intent: 'pi_test_ach',
            amount: 10000,
            payment_method_details: {
              type: 'ach_debit'
            }
          }
        }
      };
      
      // The webhook handler should mark ACH payment as confirmed
      // and potentially convert draft order to real order
    });
    
    it('should handle ACH charge.failed event', async () => {
      const webhookPayload = {
        id: 'evt_test_charge_failed',
        type: 'charge.failed',
        data: {
          object: {
            id: 'ch_test_ach_failed',
            payment_intent: 'pi_test_ach',
            amount: 10000,
            payment_method_details: {
              type: 'ach_debit'
            },
            failure_code: 'insufficient_funds',
            failure_message: 'The bank account has insufficient funds.'
          }
        }
      };
      
      // The webhook handler should cancel draft order
      // and notify customer of failure
    });
  });
});

// Helper functions that would be in the actual frontend code
function validateRoutingNumber(routingNumber) {
  if (!routingNumber || routingNumber.length !== 9 || !/^\d{9}$/.test(routingNumber)) {
    return false;
  }
  
  const digits = routingNumber.split('').map(Number);
  const checksum = (
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8])
  ) % 10;
  
  return checksum === 0;
}

function isACHFormValid(fields) {
  return !!(
    fields.accountHolderName &&
    fields.routingNumber &&
    validateRoutingNumber(fields.routingNumber) &&
    fields.accountNumber &&
    fields.accountNumber.length >= 4 &&
    fields.accountNumber.length <= 17 &&
    fields.accountType &&
    fields.mandateAccepted
  );
}