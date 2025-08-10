// Test fixtures - Reusable test data

const fixtures = {
  // Valid test data
  valid: {
    cart: {
      basic: {
        token: 'test-cart-token-123',
        total_price: 10000, // $100.00
        items: [
          {
            variant_id: 40000000001,
            quantity: 1,
            price: 10000,
            title: 'Test Product',
            product_id: 7000000001,
            requires_shipping: true,
            grams: 1000
          }
        ]
      },
      withRep: {
        token: 'test-cart-token-456',
        total_price: 20000,
        attributes: {
          rep: 'john-doe',
          rep_timestamp: new Date().toISOString()
        },
        items: [
          {
            variant_id: 40000000002,
            quantity: 2,
            price: 10000,
            title: 'Test Product with Rep',
            product_id: 7000000002,
            requires_shipping: true,
            grams: 1000
          }
        ]
      },
      multipleItems: {
        token: 'test-cart-token-789',
        total_price: 35000,
        items: [
          {
            variant_id: 40000000003,
            quantity: 1,
            price: 15000,
            title: 'Product A',
            product_id: 7000000003,
            requires_shipping: true,
            grams: 500
          },
          {
            variant_id: 40000000004,
            quantity: 2,
            price: 10000,
            title: 'Product B',
            product_id: 7000000004,
            requires_shipping: true,
            grams: 750
          }
        ]
      }
    },
    
    customer: {
      basic: {
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'Customer',
        phone: '555-0100',
        address1: '123 Test Street',
        address2: '',
        city: 'New York',
        province: 'NY',
        zip: '10001',
        country: 'US'
      },
      withApartment: {
        email: 'apartment@example.com',
        first_name: 'Apartment',
        last_name: 'Dweller',
        phone: '555-0200',
        address1: '456 High Rise Blvd',
        address2: 'Apt 42B',
        city: 'San Francisco',
        province: 'CA',
        zip: '94105',
        country: 'US'
      },
      international: {
        email: 'international@example.com',
        first_name: 'International',
        last_name: 'Customer',
        phone: '+44 20 7946 0958',
        address1: '10 Downing Street',
        address2: '',
        city: 'London',
        province: '',
        zip: 'SW1A 2AA',
        country: 'GB'
      }
    },
    
    payment: {
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: new Date().getFullYear() + 2,
        cvc: '123',
        postal_code: '10001'
      },
      card3DS: {
        number: '4000000000003220',
        exp_month: 12,
        exp_year: new Date().getFullYear() + 2,
        cvc: '123',
        postal_code: '10001'
      },
      ach: {
        account_holder_name: 'Test Customer',
        routing_number: '110000000',
        account_number: '000123456789',
        account_type: 'checking'
      }
    }
  },
  
  // Invalid test data
  invalid: {
    cart: {
      missingToken: {
        total_price: 10000,
        items: []
      },
      emptyItems: {
        token: 'test-cart-token-empty',
        total_price: 0,
        items: []
      },
      negativePrice: {
        token: 'test-cart-token-negative',
        total_price: -1000,
        items: [
          {
            variant_id: 40000000005,
            quantity: 1,
            price: -1000,
            title: 'Invalid Product'
          }
        ]
      }
    },
    
    customer: {
      missingEmail: {
        first_name: 'No',
        last_name: 'Email',
        address1: '123 Test Street',
        city: 'New York',
        province: 'NY',
        zip: '10001'
      },
      invalidZip: {
        email: 'bad-zip@example.com',
        first_name: 'Bad',
        last_name: 'Zip',
        address1: '123 Test Street',
        city: 'New York',
        province: 'NY',
        zip: 'INVALID'
      },
      missingRequired: {
        email: 'incomplete@example.com'
      }
    },
    
    payment: {
      declinedCard: {
        number: '4000000000000002',
        exp_month: 12,
        exp_year: new Date().getFullYear() + 2,
        cvc: '123',
        postal_code: '10001'
      },
      expiredCard: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: new Date().getFullYear() - 1,
        cvc: '123',
        postal_code: '10001'
      },
      invalidACH: {
        account_holder_name: 'Test Customer',
        routing_number: '123456789', // Invalid length
        account_number: '000123456789',
        account_type: 'checking'
      }
    }
  },
  
  // Edge case test data
  edgeCases: {
    cart: {
      largeQuantity: {
        token: 'test-cart-token-large',
        total_price: 1000000, // $10,000
        items: [
          {
            variant_id: 40000000006,
            quantity: 100,
            price: 10000,
            title: 'Bulk Product'
          }
        ]
      },
      zeroQuantity: {
        token: 'test-cart-token-zero',
        total_price: 0,
        items: [
          {
            variant_id: 40000000007,
            quantity: 0,
            price: 10000,
            title: 'Zero Quantity Product'
          }
        ]
      }
    },
    
    customer: {
      longAddress: {
        email: 'long-address@example.com',
        first_name: 'VeryLongFirstNameThatExceedsNormalLength',
        last_name: 'VeryLongLastNameThatExceedsNormalLength',
        address1: '123456789 This Is An Extremely Long Street Name That Goes On And On And On',
        address2: 'Building A, Floor 42, Suite 4200, Near The Big Tree By The Lake',
        city: 'San Francisco',
        province: 'CA',
        zip: '94105'
      },
      specialCharacters: {
        email: 'special+chars@example.com',
        first_name: "O'Brien",
        last_name: 'José-María',
        address1: '123 Ñoño Street #42',
        city: 'São Paulo',
        province: 'SP',
        zip: '01310-100'
      }
    }
  },
  
  // Environment-specific data
  environments: {
    development: {
      stripeKey: 'pk_test_development',
      apiUrl: 'http://localhost:3000',
      shopifyDomain: 'dev-store.myshopify.com'
    },
    staging: {
      stripeKey: 'pk_test_staging',
      apiUrl: 'https://r3-backend-staging.vercel.app',
      shopifyDomain: 'stage-store.myshopify.com'
    },
    production: {
      stripeKey: 'pk_live_production',
      apiUrl: 'https://r3-backend.vercel.app',
      shopifyDomain: 'rthree.io'
    }
  },
  
  // Session states
  sessions: {
    valid: {
      token: 'valid-session-token-123',
      csrfToken: 'valid-csrf-token-123',
      expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes from now
    },
    expired: {
      token: 'expired-session-token-456',
      csrfToken: 'expired-csrf-token-456',
      expiresAt: Date.now() - (60 * 1000) // 1 minute ago
    },
    nearExpiry: {
      token: 'near-expiry-session-token-789',
      csrfToken: 'near-expiry-csrf-token-789',
      expiresAt: Date.now() + (2 * 60 * 1000) // 2 minutes from now
    }
  },
  
  // Webhook payloads
  webhooks: {
    paymentSucceeded: {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_success',
          amount: 10000,
          currency: 'usd',
          status: 'succeeded',
          livemode: false,
          metadata: {
            customer_email: 'webhook@example.com',
            customer_first_name: 'Webhook',
            customer_last_name: 'Test',
            items: JSON.stringify([{
              variant_id: 40000000008,
              quantity: 1,
              price: 10000,
              title: 'Webhook Test Product'
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
            shipping_method: 'Standard',
            shipping_price: '10.00',
            store_domain: 'test-store.myshopify.com',
            rep: 'webhook-rep',
            environment: 'test'
          }
        }
      }
    },
    paymentFailed: {
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_test_failed',
          amount: 10000,
          currency: 'usd',
          status: 'requires_payment_method',
          last_payment_error: {
            code: 'card_declined',
            message: 'Your card was declined.'
          }
        }
      }
    }
  },
  
  // Error scenarios
  errors: {
    network: new Error('Network request failed'),
    timeout: new Error('Request timeout'),
    server: { error: 'Internal server error', code: 'SERVER_ERROR' },
    validation: { error: 'Validation failed', code: 'VALIDATION_ERROR' },
    auth: { error: 'Unauthorized', code: 'UNAUTHORIZED' },
    rateLimit: { error: 'Too many requests', code: 'RATE_LIMITED' }
  }
};

module.exports = fixtures;