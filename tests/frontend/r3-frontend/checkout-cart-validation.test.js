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

describe('Checkout Cart Validation', () => {
  let checkout;
  let mockConsoleError;
  let mockShowError;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div class="checkout-container"></div>
      <div id="sidebar-subtotal">$0.00</div>
      <div id="sidebar-total">$0.00</div>
      <div id="sidebar-items"></div>
    `;

    // Mock global objects
    global.window.R3_API_CONFIG = {
      getEndpointUrl: jest.fn((endpoint) => {
        const endpoints = {
          'createSession': `${API_URL}/api/checkout/session`,
          'getCSRF': `${API_URL}/api/checkout/csrf`
        };
        return endpoints[endpoint];
      })
    };

    // Mock console.error to check for errors
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create mock checkout instance
    class MockCustomCheckout {
      constructor() {
        this.cart = null;
        this.sessionToken = null;
        this.csrfToken = null;
      }

      async loadCart() {
        try {
          const response = await fetch('/cart.js');
          
          if (response.status === 429) {
            console.warn('Rate limited by Shopify. Waiting before retry...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            const retryResponse = await fetch('/cart.js');
            if (retryResponse.ok) {
              this.cart = await retryResponse.json();
            } else {
              throw new Error('Failed to load cart after retry');
            }
          } else if (response.ok) {
            this.cart = await response.json();
          } else {
            throw new Error(`Failed to load cart: ${response.status}`);
          }
          
          // Validate cart data
          if (!this.cart || typeof this.cart !== 'object') {
            throw new Error('Invalid cart: Cart data is missing or invalid');
          }
          
          if (!this.cart.token || typeof this.cart.token !== 'string') {
            throw new Error('Invalid cart: Cart token is missing');
          }
          
          if (!this.cart.items || !Array.isArray(this.cart.items)) {
            throw new Error('Invalid cart: Cart items are missing or invalid');
          }
          
          if (this.cart.items.length === 0) {
            throw new Error('Invalid cart: Cart is empty');
          }
          
          if (typeof this.cart.total_price !== 'number' || this.cart.total_price < 0) {
            throw new Error('Invalid cart: Cart total price is invalid');
          }
          
          this.updateCartDisplay();
        } catch (error) {
          console.error('Error loading cart:', error);
          this.showError('Unable to load cart data. Please refresh the page.');
        }
      }

      async initializeSession() {
        try {
          // Validate cart before creating session
          if (!this.cart || !this.cart.token || !this.cart.total_price) {
            throw new Error('Invalid cart: Missing required cart data');
          }
          
          const response = await fetch(window.R3_API_CONFIG.getEndpointUrl('createSession'), {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              cartToken: this.cart.token,
              domain: window.location.hostname,
              cartTotal: this.cart.total_price
            })
          });

          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || data.message || 'Failed to create checkout session');
          }
          
          this.sessionToken = data.sessionToken;
          this.csrfToken = data.csrfToken;
        } catch (error) {
          throw error;
        }
      }

      updateCartDisplay() {
        // Mock implementation
      }

      showError(message) {
        // Mock implementation
      }
    }
    
    checkout = new MockCustomCheckout();
    
    // Mock showError method
    mockShowError = jest.spyOn(checkout, 'showError').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleError.mockRestore();
    mockShowError.mockRestore();
  });

  describe('Cart Loading Validation', () => {
    test('should handle empty cart gracefully', async () => {
      server.use(
        rest.get('*/cart.js', (req, res, ctx) => {
          return res(ctx.json({
            token: 'test_token_123',
            items: [],
            total_price: 0
          }));
        })
      );

      await checkout.loadCart();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error loading cart:', 
        expect.objectContaining({
          message: 'Invalid cart: Cart is empty'
        })
      );
      expect(mockShowError).toHaveBeenCalledWith('Unable to load cart data. Please refresh the page.');
    });

    test('should handle missing cart token', async () => {
      server.use(
        rest.get('*/cart.js', (req, res, ctx) => {
          return res(ctx.json({
            items: [{id: 1, quantity: 1, price: 1000}],
            total_price: 1000
          }));
        })
      );

      await checkout.loadCart();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error loading cart:', 
        expect.objectContaining({
          message: 'Invalid cart: Cart token is missing'
        })
      );
    });

    test('should handle invalid cart items', async () => {
      server.use(
        rest.get('*/cart.js', (req, res, ctx) => {
          return res(ctx.json({
            token: 'test_token_123',
            items: 'not-an-array',
            total_price: 1000
          }));
        })
      );

      await checkout.loadCart();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error loading cart:', 
        expect.objectContaining({
          message: 'Invalid cart: Cart items are missing or invalid'
        })
      );
    });

    test('should handle invalid cart total price', async () => {
      server.use(
        rest.get('*/cart.js', (req, res, ctx) => {
          return res(ctx.json({
            token: 'test_token_123',
            items: [{id: 1, quantity: 1, price: 1000}],
            total_price: -100
          }));
        })
      );

      await checkout.loadCart();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error loading cart:', 
        expect.objectContaining({
          message: 'Invalid cart: Cart total price is invalid'
        })
      );
    });

    test('should handle null cart response', async () => {
      server.use(
        rest.get('*/cart.js', (req, res, ctx) => {
          return res(ctx.json(null));
        })
      );

      await checkout.loadCart();

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error loading cart:', 
        expect.objectContaining({
          message: 'Invalid cart: Cart data is missing or invalid'
        })
      );
    });

    test('should handle valid cart successfully', async () => {
      server.use(
        rest.get('*/cart.js', (req, res, ctx) => {
          return res(ctx.json({
            token: 'test_token_123',
            items: [{id: 1, quantity: 1, price: 1000}],
            total_price: 1000
          }));
        })
      );

      await checkout.loadCart();

      expect(checkout.cart).toEqual({
        token: 'test_token_123',
        items: [{id: 1, quantity: 1, price: 1000}],
        total_price: 1000
      });
      expect(mockConsoleError).not.toHaveBeenCalled();
      expect(mockShowError).not.toHaveBeenCalled();
    });
  });

  describe('Session Initialization Validation', () => {
    beforeEach(() => {
      // Set valid cart data
      checkout.cart = {
        token: 'test_token_123',
        items: [{id: 1, quantity: 1, price: 1000}],
        total_price: 1000
      };
    });

    test('should validate cart before creating session', async () => {
      // Clear cart to test validation
      checkout.cart = null;

      await expect(checkout.initializeSession()).rejects.toThrow('Invalid cart: Missing required cart data');
    });

    test('should validate cart token exists', async () => {
      checkout.cart.token = null;

      await expect(checkout.initializeSession()).rejects.toThrow('Invalid cart: Missing required cart data');
    });

    test('should validate cart total price exists', async () => {
      checkout.cart.total_price = undefined;

      await expect(checkout.initializeSession()).rejects.toThrow('Invalid cart: Missing required cart data');
    });

    test('should handle backend validation errors', async () => {
      server.use(
        rest.get('*/api/checkout/csrf', (req, res, ctx) => {
          return res(ctx.status(401));
        }),
        rest.post('*/api/checkout/session', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({ error: 'Invalid cart', details: 'Cart token too short' })
          );
        })
      );

      await expect(checkout.initializeSession()).rejects.toThrow('Invalid cart');
    });
  });

  describe('Stripe Element Callback Safety', () => {
    test('should safely handle missing callbacks structure', () => {
      // Mock checkout payments instance
      const mockCheckoutPayments = {
        cardElement: {
          _empty: false,
          _callbacks: null
        }
      };

      // This should not throw
      expect(() => {
        const event = mockCheckoutPayments.cardElement._empty ? {complete: false} : {complete: true};
        if (mockCheckoutPayments.cardElement._callbacks && 
            mockCheckoutPayments.cardElement._callbacks.change && 
            Array.isArray(mockCheckoutPayments.cardElement._callbacks.change)) {
          mockCheckoutPayments.cardElement._callbacks.change.forEach(cb => {
            if (typeof cb === 'function') {
              cb(event);
            }
          });
        }
      }).not.toThrow();
    });

    test('should safely handle non-function callbacks', () => {
      // Mock checkout payments instance
      const mockCheckoutPayments = {
        cardElement: {
          _empty: false,
          _callbacks: {
            change: ['not-a-function', null, undefined, 123]
          }
        }
      };

      // This should not throw
      expect(() => {
        const event = mockCheckoutPayments.cardElement._empty ? {complete: false} : {complete: true};
        if (mockCheckoutPayments.cardElement._callbacks && 
            mockCheckoutPayments.cardElement._callbacks.change && 
            Array.isArray(mockCheckoutPayments.cardElement._callbacks.change)) {
          mockCheckoutPayments.cardElement._callbacks.change.forEach(cb => {
            if (typeof cb === 'function') {
              cb(event);
            }
          });
        }
      }).not.toThrow();
    });
  });
});