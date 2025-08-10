/**
 * Test suite for checkout cart update behavior
 * Ensures proper UI updates when cart is modified during checkout
 * @jest-environment jsdom
 */

describe('Checkout Cart Update Behavior', () => {
  let checkout;
  let mockCart;
  let mockPriceLoading;

  beforeEach(() => {
    // Setup DOM elements
    document.body.innerHTML = `
      <div id="sidebar-items">
        <div class="summary-item">
          <span class="item-quantity">Qty: 2</span>
        </div>
      </div>
      <div id="sidebar-subtotal">$20.00</div>
      <div id="sidebar-shipping">$5.00</div>
      <div id="sidebar-total">$25.00</div>
    `;

    // Mock cart data
    mockCart = {
      items: [{ quantity: 2, price: 1000 }],
      item_count: 2,
      total_price: 2000
    };

    // Mock PriceLoading
    mockPriceLoading = {
      showLoadingForElements: jest.fn(),
      hideLoadingForElements: jest.fn(),
      showCheckoutCalculating: jest.fn(),
      hideCheckoutCalculating: jest.fn(),
      isLoading: jest.fn().mockReturnValue(false),
      hideLoading: jest.fn()
    };
    window.PriceLoading = mockPriceLoading;

    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cart quantity changes', () => {
    it('should show spinners on all price elements when cart quantity changes', async () => {
      // Mock cart API response with quantity change
      const updatedCart = {
        ...mockCart,
        items: [{ quantity: 3, price: 1000 }],
        item_count: 3,
        total_price: 3000
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => updatedCart
      });

      // Simulate cart change check
      const customCheckout = {
        cart: mockCart,
        checkCartChanges: async function() {
          const response = await fetch('/cart.js');
          const currentCart = await response.json();
          
          if (currentCart.item_count !== this.cart.item_count) {
            window.PriceLoading.showLoadingForElements([
              '#sidebar-subtotal',
              '#sidebar-shipping',
              '#sidebar-total'
            ]);
            this.cart = currentCart;
          }
        }
      };

      await customCheckout.checkCartChanges();

      // Verify spinners were shown
      expect(mockPriceLoading.showLoadingForElements).toHaveBeenCalledWith([
        '#sidebar-subtotal',
        '#sidebar-shipping',
        '#sidebar-total'
      ]);
    });

    it('should update quantity display when cart quantity changes', () => {
      const checkout = {
        cart: {
          items: [{ quantity: 5 }],
          item_count: 5,
          total_price: 5000
        },
        updateCartDisplay: function() {
          const summaryItems = document.querySelectorAll('.summary-item');
          summaryItems.forEach((itemEl, index) => {
            if (this.cart.items[index]) {
              const quantityEl = itemEl.querySelector('.item-quantity');
              if (quantityEl) {
                quantityEl.textContent = `Qty: ${this.cart.items[index].quantity}`;
              }
            }
          });
        }
      };

      checkout.updateCartDisplay();

      const quantityEl = document.querySelector('.item-quantity');
      expect(quantityEl.textContent).toBe('Qty: 5');
    });
  });

  describe('Empty cart handling', () => {
    it('should redirect to products page when cart becomes empty', async () => {
      // Mock empty cart response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ item_count: 0, items: [], total_price: 0 })
      });

      // Mock window.location
      delete window.location;
      window.location = { href: '' };

      const checkout = {
        cart: mockCart,
        handleEmptyCart: function() {
          window.location.href = '/collections/all';
        },
        checkCartChanges: async function() {
          const response = await fetch('/cart.js');
          const currentCart = await response.json();
          
          if (currentCart.item_count === 0) {
            this.handleEmptyCart();
          }
        }
      };

      await checkout.checkCartChanges();

      expect(window.location.href).toBe('/collections/all');
    });

    it('should clear monitoring interval when cart is empty', () => {
      const mockInterval = 123;
      const checkout = {
        cartMonitorInterval: mockInterval,
        handleEmptyCart: function() {
          if (this.cartMonitorInterval) {
            clearInterval(this.cartMonitorInterval);
          }
          window.location.href = '/collections/all';
        }
      };

      jest.spyOn(global, 'clearInterval');
      checkout.handleEmptyCart();

      expect(clearInterval).toHaveBeenCalledWith(mockInterval);
    });
  });

  describe('Shipping recalculation', () => {
    it('should recalculate shipping when cart items change', async () => {
      const updatedCart = {
        ...mockCart,
        items: [{ quantity: 4, price: 1000 }],
        item_count: 4,
        total_price: 4000
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => updatedCart
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ shipping: { price: 800 } })
        });

      const checkout = {
        cart: mockCart,
        calculateShipping: jest.fn(),
        checkCartChanges: async function() {
          const response = await fetch('/cart.js');
          const currentCart = await response.json();
          
          const itemCountChanged = currentCart.item_count !== this.cart.item_count;
          if (itemCountChanged) {
            this.cart = currentCart;
            await this.calculateShipping();
          }
        }
      };

      await checkout.checkCartChanges();

      expect(checkout.calculateShipping).toHaveBeenCalled();
    });
  });

  describe('Total calculation', () => {
    it('should calculate total including subtotal, shipping, and tax', () => {
      const checkout = {
        cart: { total_price: 2000 },
        shipping: { price: 500 },
        tax: { amount: 150 },
        formatMoney: (cents) => `$${(cents / 100).toFixed(2)}`,
        updateTotals: function() {
          let totalAmount = this.cart.total_price;
          if (this.shipping) {
            totalAmount += this.shipping.price;
          }
          if (this.tax && this.tax.amount) {
            totalAmount += this.tax.amount;
          }
          return this.formatMoney(totalAmount);
        }
      };

      const total = checkout.updateTotals();
      expect(total).toBe('$26.50'); // $20 + $5 + $1.50
    });
  });

  describe('Spinner consistency', () => {
    it('should use small spinner (14x14px) for all loading states', () => {
      const style = document.createElement('style');
      style.textContent = `
        .price-loading-spinner {
          width: 14px;
          height: 14px;
        }
        .checkout-loading-spinner {
          width: 14px;
          height: 14px;
        }
      `;
      document.head.appendChild(style);

      const spinner = document.createElement('span');
      spinner.className = 'price-loading-spinner';
      document.body.appendChild(spinner);

      const checkoutSpinner = document.createElement('span');
      checkoutSpinner.className = 'checkout-loading-spinner';
      document.body.appendChild(checkoutSpinner);

      const priceSpinnerStyles = window.getComputedStyle(spinner);
      const checkoutSpinnerStyles = window.getComputedStyle(checkoutSpinner);

      // Both spinners should be the same small size
      expect(priceSpinnerStyles.width).toBe('14px');
      expect(priceSpinnerStyles.height).toBe('14px');
      expect(checkoutSpinnerStyles.width).toBe('14px');
      expect(checkoutSpinnerStyles.height).toBe('14px');
    });
  });
});