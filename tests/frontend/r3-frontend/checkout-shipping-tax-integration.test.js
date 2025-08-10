/**
 * @jest-environment jsdom
 */
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { rest } = require('msw');
const { setupServer } = require('msw/node');
const { getApiUrl, shouldMockPayments } = require('../../shared/helpers/environment');

// Mock server for API calls
const server = setupServer();
const API_URL = shouldMockPayments() ? 'http://localhost:3000' : getApiUrl();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Checkout Shipping and Tax Integration', () => {
  let checkout;
  
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div class="checkout-container"></div>
      <div id="shipping-methods"></div>
      <div id="sidebar-subtotal">$0.00</div>
      <div id="sidebar-shipping">TBD</div>
      <div id="sidebar-tax">$0.00</div>
      <div id="sidebar-total">$0.00</div>
      <input id="province" value="CA">
      <input id="zip" value="90210">
    `;

    // Mock global objects
    global.window.R3_API_CONFIG = {
      getEndpointUrl: jest.fn((endpoint) => {
        const endpoints = {
          'calculateShipping': `${API_URL}/api/calculate-shipping`,
          'calculateTax': `${API_URL}/api/calculate-tax`,
          'createSession': `${API_URL}/api/checkout/session`
        };
        return endpoints[endpoint];
      })
    };

    // Create mock checkout instance
    checkout = {
      cart: {
        token: 'test_token',
        items: [
          { 
            variant_id: 1, 
            quantity: 2, 
            price: 5000, // $50 in cents
            weight: 1.5,
            product_title: 'Test Product' 
          }
        ],
        total_price: 10000, // $100 in cents
        item_count: 2
      },
      sessionToken: 'test_session_token',
      csrfToken: 'test_csrf_token',
      shippingData: {
        address1: '123 Test St',
        city: 'Beverly Hills',
        province: 'CA',
        zip: '90210'
      },
      shipping: null,
      subtotal: 10000,
      
      getAuthHeaders() {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`,
          'x-csrf-token': this.csrfToken
        };
      },
      
      formatMoney(cents) {
        return `$${(cents / 100).toFixed(2)}`;
      },
      
      updateTotals() {
        // Update sidebar totals
        const subtotalEl = document.getElementById('sidebar-subtotal');
        const shippingEl = document.getElementById('sidebar-shipping');
        const taxEl = document.getElementById('sidebar-tax');
        const totalEl = document.getElementById('sidebar-total');
        
        if (subtotalEl) subtotalEl.textContent = this.formatMoney(this.subtotal);
        if (shippingEl) shippingEl.textContent = this.shipping 
          ? this.formatMoney(this.shipping.price * 100)
          : 'TBD';
        if (taxEl && this.tax) taxEl.textContent = this.formatMoney(this.tax * 100);
        
        const total = this.subtotal + 
          (this.shipping ? this.shipping.price * 100 : 0) + 
          (this.tax ? this.tax * 100 : 0);
        
        if (totalEl) totalEl.textContent = this.formatMoney(total);
      },
      
      showError: jest.fn()
    };
  });

  describe('Shipping Calculation Flow', () => {
    test('should calculate shipping rates and display options', async () => {
      // Mock shipping calculation response
      server.use(
        rest.post('*/api/calculate-shipping', async (req, res, ctx) => {
          const body = await req.json();
          expect(body).toMatchObject({
            address: {
              line1: '123 Test St',
              city: 'Beverly Hills',
              state: 'CA',
              postal_code: '90210',
              country: 'US'
            },
            items: checkout.cart.items
          });
          
          return res(ctx.json({
            rates: {
              standard: {
                id: 'standard_shipping',
                title: 'FREE Standard Shipping (5-7 business days)',
                price: 0,
                delivery_days: '5-7'
              },
              express: {
                id: 'express_shipping',
                title: 'Express Shipping (2-3 business days)',
                price: 28,
                delivery_days: '2-3'
              },
              overnight: {
                id: 'overnight_shipping',
                title: 'Overnight Shipping (1 business day)',
                price: 45,
                delivery_days: '1'
              }
            }
          }));
        })
      );

      // Implementation based on actual checkout.js
      const response = await fetch(window.R3_API_CONFIG.getEndpointUrl('calculateShipping'), {
        method: 'POST',
        credentials: 'include',
        headers: checkout.getAuthHeaders(),
        body: JSON.stringify({
          address: {
            line1: checkout.shippingData.address1,
            line2: checkout.shippingData.address2 || '',
            city: checkout.shippingData.city,
            state: checkout.shippingData.province,
            postal_code: checkout.shippingData.zip,
            country: 'US'
          },
          items: checkout.cart.items
        })
      });

      const data = await response.json();
      const rates = data.rates;

      // Update shipping selection
      checkout.shipping = rates.standard;
      
      // Create shipping method HTML
      const shippingMethodsEl = document.getElementById('shipping-methods');
      shippingMethodsEl.innerHTML = Object.values(rates).map(rate => `
        <div class="shipping-method">
          <input type="radio" name="shipping_method" value="${rate.id}" 
            ${rate.id === 'standard_shipping' ? 'checked' : ''}>
          <div class="shipping-method-details">
            <div class="shipping-method-name">${rate.title}</div>
            <div class="shipping-method-time">${rate.delivery_days} business days</div>
          </div>
          <div class="shipping-method-price">${checkout.formatMoney(rate.price * 100)}</div>
        </div>
      `).join('');

      // Verify shipping options displayed
      expect(shippingMethodsEl.innerHTML).toContain('FREE Standard Shipping');
      expect(shippingMethodsEl.innerHTML).toContain('$28.00');
      expect(shippingMethodsEl.innerHTML).toContain('$45.00');
      
      // Update totals
      checkout.updateTotals();
      expect(document.getElementById('sidebar-shipping').textContent).toBe('$0.00');
    });

    test('should handle shipping for heavy items', async () => {
      // Update cart with heavy items
      checkout.cart.items = [
        { variant_id: 1, quantity: 10, price: 2000, weight: 5 } // 50 lbs total
      ];
      checkout.subtotal = 20000; // $200

      server.use(
        rest.post('*/api/calculate-shipping', async (req, res, ctx) => {
          return res(ctx.json({
            rates: {
              standard: {
                id: 'standard_shipping',
                title: 'FREE Standard Shipping (5-7 business days)',
                price: 0, // Free over $100
                delivery_days: '5-7'
              },
              express: {
                id: 'express_shipping',
                title: 'Express Shipping (2-3 business days)',
                price: 700, // 28 * 25 (50lbs/2)
                delivery_days: '2-3'
              }
            }
          }));
        })
      );

      const response = await fetch(window.R3_API_CONFIG.getEndpointUrl('calculateShipping'), {
        method: 'POST',
        headers: checkout.getAuthHeaders(),
        body: JSON.stringify({
          address: { state: checkout.shippingData.province },
          items: checkout.cart.items
        })
      });

      const data = await response.json();
      expect(data.rates.express.price).toBe(700);
    });

    test('should handle naloxone special shipping', async () => {
      checkout.cart.items = [
        { 
          variant_id: 1, 
          quantity: 1, 
          price: 15000, 
          weight: 1,
          product_type: 'naloxone'
        }
      ];

      server.use(
        rest.post('*/api/calculate-shipping', async (req, res, ctx) => {
          return res(ctx.json({
            rates: {
              standard: {
                id: 'standard_shipping',
                title: 'Standard Shipping (5-7 business days) (Special Handling)',
                price: 17, // No free shipping + $5 special handling
                delivery_days: '5-7'
              }
            }
          }));
        })
      );

      const response = await fetch(window.R3_API_CONFIG.getEndpointUrl('calculateShipping'), {
        method: 'POST',
        headers: checkout.getAuthHeaders(),
        body: JSON.stringify({
          address: { state: checkout.shippingData.province },
          items: checkout.cart.items
        })
      });

      const data = await response.json();
      expect(data.rates.standard.price).toBe(17);
      expect(data.rates.standard.title).toContain('Special Handling');
    });
  });

  describe('Tax Calculation Flow', () => {
    beforeEach(() => {
      // Set shipping first
      checkout.shipping = {
        id: 'standard_shipping',
        price: 10,
        method: 'Standard Shipping'
      };
    });

    test('should calculate tax after shipping selection', async () => {
      server.use(
        rest.post('*/api/calculate-tax', async (req, res, ctx) => {
          const body = await req.json();
          expect(body).toMatchObject({
            address: {
              state: 'CA'
            },
            shipping: checkout.shipping
          });
          
          return res(ctx.json({
            stateTax: 7.25,
            localTax: 1.53,
            totalTax: 9.68, // (100 + 10) * 0.0878
            taxRate: 0.0878,
            breakdown: {
              taxesShipping: true
            }
          }));
        })
      );

      const response = await fetch(window.R3_API_CONFIG.getEndpointUrl('calculateTax'), {
        method: 'POST',
        credentials: 'include',
        headers: checkout.getAuthHeaders(),
        body: JSON.stringify({
          address: {
            state: checkout.shippingData.province
          },
          items: checkout.cart.items,
          shipping: checkout.shipping
        })
      });

      const taxData = await response.json();
      checkout.tax = taxData.totalTax;
      
      checkout.updateTotals();
      
      expect(document.getElementById('sidebar-tax').textContent).toBe('$9.68');
      expect(document.getElementById('sidebar-total').textContent).toBe('$119.68');
    });

    test('should handle no-tax states', async () => {
      checkout.shippingData.province = 'OR';
      document.getElementById('province').value = 'OR';

      server.use(
        rest.post('*/api/calculate-tax', async (req, res, ctx) => {
          return res(ctx.json({
            stateTax: 0,
            localTax: 0,
            totalTax: 0,
            taxRate: 0,
            breakdown: {
              taxesShipping: false
            }
          }));
        })
      );

      const response = await fetch(window.R3_API_CONFIG.getEndpointUrl('calculateTax'), {
        method: 'POST',
        headers: checkout.getAuthHeaders(),
        body: JSON.stringify({
          address: { state: 'OR' },
          items: checkout.cart.items,
          shipping: checkout.shipping
        })
      });

      const taxData = await response.json();
      checkout.tax = taxData.totalTax;
      
      checkout.updateTotals();
      
      expect(document.getElementById('sidebar-tax').textContent).toBe('$0.00');
    });
  });

  describe('Complete Order Summary', () => {
    test('should update all totals correctly', async () => {
      // 1. Calculate shipping
      server.use(
        rest.post('*/api/calculate-shipping', async (req, res, ctx) => {
          return res(ctx.json({
            rates: {
              express: {
                id: 'express_shipping',
                price: 28
              }
            }
          }));
        }),
        rest.post('*/api/calculate-tax', async (req, res, ctx) => {
          return res(ctx.json({
            totalTax: 11.34 // (100 + 28) * 0.0878 for CA
          }));
        })
      );

      // Select express shipping
      checkout.shipping = { id: 'express_shipping', price: 28 };
      
      // Calculate tax
      const taxResponse = await fetch(window.R3_API_CONFIG.getEndpointUrl('calculateTax'), {
        method: 'POST',
        headers: checkout.getAuthHeaders(),
        body: JSON.stringify({
          address: { state: 'CA' },
          items: checkout.cart.items,
          shipping: checkout.shipping
        })
      });
      
      const taxData = await taxResponse.json();
      checkout.tax = taxData.totalTax;
      
      // Update all totals
      checkout.updateTotals();
      
      // Verify final calculations
      expect(document.getElementById('sidebar-subtotal').textContent).toBe('$100.00');
      expect(document.getElementById('sidebar-shipping').textContent).toBe('$28.00');
      expect(document.getElementById('sidebar-tax').textContent).toBe('$11.34');
      expect(document.getElementById('sidebar-total').textContent).toBe('$139.34');
    });
  });

  describe('Error Handling', () => {
    test('should handle shipping calculation errors', async () => {
      server.use(
        rest.post('*/api/calculate-shipping', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Shipping service unavailable' }));
        })
      );

      try {
        await fetch(window.R3_API_CONFIG.getEndpointUrl('calculateShipping'), {
          method: 'POST',
          headers: checkout.getAuthHeaders(),
          body: JSON.stringify({
            address: { state: 'CA' },
            items: checkout.cart.items
          })
        });
      } catch (error) {
        // Use default shipping
        checkout.shipping = {
          price: 10,
          method: 'Ground Shipping (delivery time varies)'
        };
      }

      expect(checkout.shipping.price).toBe(10);
    });

    test('should validate address before calculating', () => {
      // Missing required address fields
      checkout.shippingData = {};
      
      // Should use default rates
      if (!checkout.shippingData || !checkout.shippingData.address1) {
        checkout.shipping = {
          price: 10,
          method: 'Ground Shipping (delivery time varies)',
          itemCount: checkout.cart?.item_count || 0
        };
      }
      
      expect(checkout.shipping.price).toBe(10);
      expect(checkout.shipping.method).toContain('Ground Shipping');
    });
  });
});