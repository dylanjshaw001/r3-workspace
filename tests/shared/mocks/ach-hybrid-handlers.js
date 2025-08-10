// Enhanced ACH Hybrid Mode Mock Handlers for MSW
const { rest } = require('msw');
const { createTestPaymentIntent } = require('../helpers/utils/test-helpers');

// Helper to check payment mode
function getPaymentMode(metadata) {
  return metadata?.payment_mode || 'unknown';
}

// Helper to generate bank details based on mode
function generateBankDetails(mode, paymentMethod) {
  if (mode === 'financial_connections') {
    return {
      bank_name: 'Chase Bank',
      last4: '1234',
      account_holder_type: 'individual',
      account_type: 'checking',
      financial_connections_account: 'fca_test_connected'
    };
  } else if (mode === 'manual_entry') {
    return {
      bank_name: 'STRIPE TEST BANK',
      last4: paymentMethod?.endsWith('6789') ? '6789' : '0000',
      account_holder_type: 'individual',
      account_type: 'checking',
      routing_number: '110000000'
    };
  }
  return null;
}

const achHybridHandlers = [
  // Enhanced ACH Payment Intent Creation
  rest.post('*/api/stripe/create-payment-intent', (req, res, ctx) => {
    const { 
      payment_method_types, 
      payment_method,
      amount, 
      metadata, 
      customer_email,
      mandate_data 
    } = req.body;
    
    // Check if this is an ACH payment
    if (payment_method_types?.includes('us_bank_account')) {
      const mode = getPaymentMode(metadata);
      
      // Create mode-specific payment intent
      const paymentIntent = createTestPaymentIntent({
        id: `pi_ach_${mode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        payment_method_types,
        status: payment_method ? 'requires_confirmation' : 'requires_payment_method',
        client_secret: `pi_ach_${mode}_${Date.now()}_secret_test`,
        payment_method: payment_method || null,
        metadata: {
          ...metadata,
          payment_type: 'ach',
          payment_mode: mode
        }
      });
      
      // Add mode-specific configurations
      if (mode === 'financial_connections') {
        paymentIntent.payment_method_options = {
          us_bank_account: {
            financial_connections: {
              permissions: ['payment_method', 'balances'],
              prefetch: ['balances']
            },
            verification_method: 'automatic'
          }
        };
      } else if (mode === 'manual_entry') {
        paymentIntent.payment_method_options = {
          us_bank_account: {
            verification_method: 'microdeposits'
          }
        };
        
        // Include mandate data for manual entry
        if (mandate_data) {
          paymentIntent.mandate_data = mandate_data;
        }
      }
      
      if (customer_email) {
        paymentIntent.receipt_email = customer_email;
      }
      
      return res(
        ctx.status(200),
        ctx.json({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          mode: mode
        })
      );
    }
    
    // Default response for non-ACH payments
    return res(ctx.status(200), ctx.json({
      clientSecret: 'pi_test_secret',
      paymentIntentId: 'pi_test'
    }));
  }),
  
  // Mock Stripe Financial Connections Session
  rest.post('https://api.stripe.com/v1/financial_connections/sessions', (req, res, ctx) => {
    const clientSecret = req.url.searchParams.get('client_secret');
    
    return res(
      ctx.status(200),
      ctx.json({
        id: 'fcsess_test_hybrid',
        object: 'financial_connections.session',
        client_secret: clientSecret || 'fcsess_test_hybrid_secret',
        filters: {
          countries: ['US'],
          account_subcategories: ['checking', 'savings']
        },
        permissions: ['payment_method', 'balances'],
        prefetch: ['balances'],
        return_url: 'https://sqqpyb-yq.myshopify.com/checkout/success',
        status: 'pending',
        status_details: {
          cancelled: null
        }
      })
    );
  }),
  
  // Mock collect bank account for payment (Financial Connections)
  rest.post('https://api.stripe.com/v1/payment_intents/:id/collect_bank_account', (req, res, ctx) => {
    const { id } = req.params;
    const { return_url } = req.body;
    
    return res(
      ctx.status(200),
      ctx.json({
        payment_intent: {
          id,
          status: 'requires_confirmation',
          payment_method: 'pm_fc_connected',
          payment_method_options: {
            us_bank_account: {
              financial_connections: {
                session: 'fcsess_test_connected'
              }
            }
          }
        },
        financial_connections_session: {
          id: 'fcsess_test_connected',
          url: `https://connect.stripe.com/test/fc/session?client_secret=${id}_secret`,
          return_url
        }
      })
    );
  }),
  
  // Mock create payment method (Manual Entry)
  rest.post('https://api.stripe.com/v1/payment_methods', (req, res, ctx) => {
    const { type, us_bank_account, billing_details } = req.body;
    
    if (type === 'us_bank_account') {
      // Validate routing number (simplified)
      if (us_bank_account.routing_number === '123456789') {
        return res(
          ctx.status(400),
          ctx.json({
            error: {
              type: 'invalid_request_error',
              code: 'routing_number_invalid',
              message: 'The routing number provided is invalid'
            }
          })
        );
      }
      
      return res(
        ctx.status(200),
        ctx.json({
          id: `pm_manual_${Date.now()}`,
          object: 'payment_method',
          billing_details,
          created: Math.floor(Date.now() / 1000),
          livemode: false,
          type: 'us_bank_account',
          us_bank_account: {
            account_holder_type: us_bank_account.account_holder_type,
            account_type: us_bank_account.account_type,
            bank_name: 'STRIPE TEST BANK',
            financial_connections_account: null,
            fingerprint: 'test_fingerprint',
            last4: us_bank_account.account_number.slice(-4),
            networks: {
              preferred: 'ach',
              supported: ['ach']
            },
            routing_number: us_bank_account.routing_number
          }
        })
      );
    }
    
    return res(ctx.status(400), ctx.json({
      error: { message: 'Invalid payment method type' }
    }));
  }),
  
  // Mock confirm US bank account payment
  rest.post('https://api.stripe.com/v1/payment_intents/:id/confirm', (req, res, ctx) => {
    const { id } = req.params;
    const { payment_method } = req.body;
    
    // Determine mode from payment method
    const isFC = payment_method?.startsWith('pm_fc_');
    const mode = isFC ? 'financial_connections' : 'manual_entry';
    
    return res(
      ctx.status(200),
      ctx.json({
        id,
        status: 'processing',
        amount: 11800,
        currency: 'usd',
        payment_method,
        payment_method_types: ['us_bank_account'],
        payment_method_options: {
          us_bank_account: {
            verification_method: isFC ? 'instant' : 'microdeposits'
          }
        },
        next_action: isFC ? null : {
          type: 'verify_with_microdeposits',
          verify_with_microdeposits: {
            arrival_date: Math.floor(Date.now() / 1000) + 172800, // 2 days
            hosted_verification_url: `https://hooks.stripe.com/verify/microdeposits/${id}`,
            microdeposit_type: 'amounts'
          }
        },
        metadata: {
          payment_mode: mode
        }
      })
    );
  }),
  
  // Enhanced webhook handler with mode differentiation
  rest.post('http://localhost:3000/api/stripe/webhook', (req, res, ctx) => {
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      return res(ctx.status(400), ctx.text('Missing stripe-signature header'));
    }
    
    const event = req.body;
    
    // Handle different ACH events based on payment mode
    if (event.type === 'payment_intent.processing') {
      const paymentIntent = event.data.object;
      const mode = getPaymentMode(paymentIntent.metadata);
      
      if (paymentIntent.payment_method_types?.includes('us_bank_account')) {
        // Log different handling based on mode
        console.log(`Processing ACH payment in ${mode} mode`);
        
        return res(ctx.json({ 
          received: true,
          message: `ACH payment processing (${mode} mode)`,
          mode: mode,
          requiresMicrodeposits: mode === 'manual_entry'
        }));
      }
    }
    
    if (event.type === 'charge.succeeded') {
      const charge = event.data.object;
      if (charge.payment_method_details?.type === 'ach_debit') {
        const mode = getPaymentMode(charge.metadata);
        
        return res(ctx.json({ 
          received: true,
          message: `ACH charge succeeded (${mode} mode)`,
          mode: mode
        }));
      }
    }
    
    if (event.type === 'charge.failed') {
      const charge = event.data.object;
      if (charge.payment_method_details?.type === 'ach_debit') {
        const mode = getPaymentMode(charge.metadata);
        
        return res(ctx.json({ 
          received: true,
          message: `ACH charge failed (${mode} mode)`,
          mode: mode,
          failure_code: charge.failure_code,
          failure_message: charge.failure_message
        }));
      }
    }
    
    // Handle microdeposits verification for manual entry
    if (event.type === 'payment_intent.requires_action') {
      const paymentIntent = event.data.object;
      const mode = getPaymentMode(paymentIntent.metadata);
      
      if (mode === 'manual_entry' && paymentIntent.next_action?.type === 'verify_with_microdeposits') {
        return res(ctx.json({ 
          received: true,
          message: 'Microdeposits verification required',
          verification_url: paymentIntent.next_action.verify_with_microdeposits.hosted_verification_url
        }));
      }
    }
    
    // Default webhook response
    return res(ctx.json({ received: true }));
  }),
  
  // Mock ACH metrics endpoint with mode breakdown
  rest.get('*/api/ach/monitoring', (req, res, ctx) => {
    const auth = req.headers.get('authorization');
    
    if (!auth || !auth.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ error: 'No session token provided' }));
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        metrics: {
          overall: {
            started: { count: 10, totalAmount: 100000 },
            completed: { count: 7, totalAmount: 70000, avgProcessingDays: 2.1 },
            failed: { count: 2, totalAmount: 20000 },
            pending: { count: 1, totalAmount: 10000 },
            successRate: 77.78
          },
          by_mode: {
            financial_connections: {
              started: { count: 6, totalAmount: 60000 },
              completed: { count: 5, totalAmount: 50000, avgProcessingDays: 1.8 },
              failed: { count: 0, totalAmount: 0 },
              pending: { count: 1, totalAmount: 10000 },
              successRate: 100.00
            },
            manual_entry: {
              started: { count: 4, totalAmount: 40000 },
              completed: { count: 2, totalAmount: 20000, avgProcessingDays: 3.5 },
              failed: { count: 2, totalAmount: 20000 },
              pending: { count: 0, totalAmount: 0 },
              successRate: 50.00,
              failure_reasons: {
                insufficient_funds: 1,
                invalid_account: 1
              }
            }
          }
        },
        pendingPayments: [
          {
            paymentIntentId: 'pi_test_ach_fc_pending',
            amount: 10000,
            customerEmail: 'test@example.com',
            createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            status: 'processing',
            mode: 'financial_connections',
            expectedClearingDate: new Date(Date.now() + 86400000).toISOString() // 1 day from now
          }
        ],
        lastUpdated: new Date().toISOString()
      })
    );
  })
];

// Test utilities for hybrid ACH
const achHybridTestUtils = {
  // Create mock payment intent for Financial Connections
  createFCPaymentIntent(overrides = {}) {
    return {
      id: `pi_fc_${Date.now()}`,
      client_secret: `pi_fc_${Date.now()}_secret`,
      status: 'requires_payment_method',
      amount: 10000,
      currency: 'usd',
      payment_method_types: ['us_bank_account'],
      payment_method_options: {
        us_bank_account: {
          financial_connections: {
            permissions: ['payment_method', 'balances']
          }
        }
      },
      metadata: {
        payment_mode: 'financial_connections',
        ...overrides.metadata
      },
      ...overrides
    };
  },
  
  // Create mock payment intent for manual entry
  createManualPaymentIntent(overrides = {}) {
    return {
      id: `pi_manual_${Date.now()}`,
      client_secret: `pi_manual_${Date.now()}_secret`,
      status: 'requires_confirmation',
      amount: 10000,
      currency: 'usd',
      payment_method_types: ['us_bank_account'],
      payment_method: `pm_manual_${Date.now()}`,
      payment_method_options: {
        us_bank_account: {
          verification_method: 'microdeposits'
        }
      },
      metadata: {
        payment_mode: 'manual_entry',
        ...overrides.metadata
      },
      ...overrides
    };
  },
  
  // Create connected bank account result (FC)
  createConnectedBankResult() {
    return {
      paymentIntent: {
        id: 'pi_fc_connected',
        status: 'requires_confirmation',
        payment_method: 'pm_fc_connected',
        payment_method: {
          us_bank_account: {
            bank_name: 'Chase Bank',
            last4: '1234',
            account_type: 'checking'
          }
        }
      }
    };
  },
  
  // Create manual payment method
  createManualPaymentMethod(details = {}) {
    const defaults = {
      routing_number: '021000021',
      account_number: '123456789',
      account_type: 'checking',
      account_holder_name: 'John Doe'
    };
    
    const merged = { ...defaults, ...details };
    
    return {
      id: `pm_manual_${Date.now()}`,
      type: 'us_bank_account',
      us_bank_account: {
        account_holder_type: 'individual',
        account_type: merged.account_type,
        bank_name: 'STRIPE TEST BANK',
        last4: merged.account_number.slice(-4),
        routing_number: merged.routing_number
      },
      billing_details: {
        name: merged.account_holder_name
      }
    };
  }
};

module.exports = {
  achHybridHandlers,
  achHybridTestUtils
};