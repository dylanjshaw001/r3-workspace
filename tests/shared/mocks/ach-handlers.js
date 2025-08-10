// ACH-specific mock handlers for MSW
const { rest } = require('msw');
const { createTestPaymentIntent } = require('../helpers/utils/test-helpers');

// Helper to check if payment is ACH
function isACHPayment(paymentMethodTypes) {
  return paymentMethodTypes && paymentMethodTypes.includes('us_bank_account');
}

const achHandlers = [
  // ACH Payment Intent Creation
  rest.post('*/api/stripe/create-payment-intent', (req, res, ctx) => {
    const { payment_method_types, amount, metadata, customer_email } = req.body;
    
    if (isACHPayment(payment_method_types)) {
      // Create ACH-specific payment intent
      const paymentIntent = createTestPaymentIntent({
        id: `pi_ach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        payment_method_types,
        status: 'requires_payment_method',
        client_secret: `pi_ach_${Date.now()}_secret_test`,
        metadata: {
          ...metadata,
          payment_type: 'ach'
        }
      });
      
      // Add ACH-specific configuration
      paymentIntent.payment_method_options = {
        us_bank_account: {
          financial_connections: {
            permissions: ['payment_method', 'balances']
          },
          verification_method: 'automatic'
        }
      };
      
      if (customer_email) {
        paymentIntent.receipt_email = customer_email;
      }
      
      return res(
        ctx.status(200),
        ctx.json({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id
        })
      );
    }
    
    // Fall through to default handler for non-ACH payments
    return res(ctx.status(200), ctx.json({
      clientSecret: 'pi_test_secret',
      paymentIntentId: 'pi_test'
    }));
  }),
  
  // ACH Webhook Events
  rest.post('*/api/stripe/webhook', (req, res, ctx) => {
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      return res(ctx.status(400), ctx.text('Missing stripe-signature header'));
    }
    
    // Parse webhook body
    const event = req.body;
    
    // Handle ACH-specific events
    if (event.type === 'payment_intent.processing') {
      const paymentIntent = event.data.object;
      if (isACHPayment(paymentIntent.payment_method_types)) {
        // ACH payment is processing
        return res(ctx.json({ 
          received: true,
          message: 'ACH payment processing webhook received'
        }));
      }
    }
    
    if (event.type === 'charge.succeeded' || event.type === 'charge.failed') {
      const charge = event.data.object;
      if (charge.payment_method_details?.type === 'ach_debit') {
        // ACH charge event
        return res(ctx.json({ 
          received: true,
          message: `ACH ${event.type} webhook received`
        }));
      }
    }
    
    // Default webhook response
    return res(ctx.json({ received: true }));
  }),
  
  // Mock Stripe Financial Connections
  rest.post('https://api.stripe.com/v1/financial_connections/sessions', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 'fcsess_test_ach',
        object: 'financial_connections.session',
        client_secret: 'fcsess_test_ach_secret',
        filters: {
          countries: ['US'],
          account_subcategories: ['checking', 'savings']
        },
        permissions: ['payment_method', 'balances'],
        return_url: 'https://sqqpyb-yq.myshopify.com/checkout/success'
      })
    );
  }),
  
  // Mock ACH monitoring endpoint
  rest.get('http://localhost:3000/api/ach/monitoring', (req, res, ctx) => {
    const auth = req.headers.get('authorization');
    
    if (!auth || !auth.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ error: 'No session token provided' }));
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        metrics: {
          started: { count: 5, totalAmount: 50000 },
          completed: { count: 3, totalAmount: 30000, avgProcessingDays: 2.3 },
          failed: { count: 1, totalAmount: 10000, failureCodes: { insufficient_funds: 1 } },
          successRate: 75.00
        },
        pendingPayments: [
          {
            paymentIntentId: 'pi_test_ach_pending',
            amount: 10000,
            customerEmail: 'test@example.com',
            createdAt: new Date().toISOString(),
            status: 'pending'
          }
        ],
        lastUpdated: new Date().toISOString()
      })
    );
  })
];

// ACH test utilities
const achTestUtils = {
  // Create a mock ACH payment method
  createACHPaymentMethod() {
    return {
      id: 'pm_test_ach',
      object: 'payment_method',
      billing_details: {
        email: 'test@example.com',
        name: 'Test Customer'
      },
      type: 'us_bank_account',
      us_bank_account: {
        account_holder_type: 'individual',
        account_type: 'checking',
        bank_name: 'TEST BANK',
        financial_connections_account: 'fca_test',
        last4: '6789',
        routing_number: '110000000'
      }
    };
  },
  
  // Create a mock ACH charge
  createACHCharge(status = 'succeeded') {
    return {
      id: 'ch_test_ach',
      object: 'charge',
      amount: 10000,
      currency: 'usd',
      payment_intent: 'pi_test_ach',
      payment_method: 'pm_test_ach',
      payment_method_details: {
        type: 'ach_debit',
        ach_debit: {
          account_holder_type: 'individual',
          bank_name: 'TEST BANK',
          country: 'US',
          fingerprint: 'test_fingerprint',
          last4: '6789',
          routing_number: '110000000'
        }
      },
      status,
      failure_code: status === 'failed' ? 'insufficient_funds' : null,
      failure_message: status === 'failed' ? 'The bank account has insufficient funds.' : null
    };
  },
  
  // Create ACH webhook event
  createACHWebhookEvent(type, data) {
    return {
      id: `evt_test_ach_${Date.now()}`,
      object: 'event',
      api_version: '2020-08-27',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: data
      },
      livemode: false,
      pending_webhooks: 1,
      request: {
        id: null,
        idempotency_key: null
      },
      type
    };
  }
};

module.exports = {
  achHandlers,
  achTestUtils
};