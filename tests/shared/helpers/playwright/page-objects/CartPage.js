const { expect } = require('@playwright/test');
const { cartConfig, buildTestUrls, repConfig } = require('../../../config/shopify-test-env');

/**
 * Cart Page Object Model
 * 
 * Handles interactions with the Shopify cart including:
 * - Cart drawer/page interactions
 * - Item quantity management
 * - Item removal
 * - Checkout navigation
 * - Rep parameter validation in cart attributes
 */
class CartPage {
  constructor(page) {
    this.page = page;
    this.urls = buildTestUrls();
    
    // Cart page selectors (both drawer and full page) - Updated to match actual theme
    this.cartPageSelector = '.cart-page';
    this.cartDrawerSelector = '[data-cart-drawer], .cart-drawer';
    this.cartItemsSelector = '.cart-drawer__items, .cart-items';
    this.cartItemSelector = '[data-variant-id], .cart-drawer__item, .cart-item';
    this.emptyCartSelector = '[data-cart-empty], .cart-empty, .cart-drawer__empty';
    
    // Item controls - Updated to match actual theme
    this.quantityInputSelector = '[data-quantity-input], input[name="updates[]"], .quantity-input';
    this.increaseButtonSelector = '[data-quantity-increase], .quantity-btn:has-text("+"), .qty-plus';
    this.decreaseButtonSelector = '[data-quantity-decrease], .quantity-btn:has-text("-"), .qty-minus';
    this.removeButtonSelector = '[data-remove-item], .cart-item__remove, .cart-drawer__remove';
    
    // Cart totals
    this.subtotalSelector = '[data-cart-subtotal], .cart-subtotal, .cart-drawer__subtotal';
    this.shippingSelector = '[data-cart-shipping], .cart-shipping, .shipping-cost';
    this.totalSelector = '[data-cart-total], .cart-total, .cart-drawer__total';
    
    // Checkout button - Updated to match actual theme
    this.checkoutButtonSelector = '.cart-drawer__checkout, button[name="checkout"], .button--primary:has-text("Checkout")';
    
    // Cart count - Updated to match actual theme
    this.cartCountSelector = '.rh-navbar__cart-count';
    
    // Loading states
    this.loadingSelector = '.cart-loading, [data-cart-loading]';
    
    // Cart attributes (for rep code)
    this.cartFormSelector = 'form[action="/cart"]';
  }

  async goto() {
    // The cart page redirects to checkout or products, so we need to handle this
    // Instead, we'll open the cart drawer or use cart.js API
    
    // Option 1: Try to open cart drawer instead of going to cart page
    const cartIcon = await this.page.$('[data-cart-drawer-toggle], .rh-navbar__cart');
    if (cartIcon) {
      await cartIcon.click();
      await this.page.waitForTimeout(500); // Wait for drawer animation
      
      // Check if drawer opened
      const drawer = await this.page.$(this.cartDrawerSelector);
      if (drawer && await drawer.isVisible()) {
        return; // Successfully opened drawer
      }
    }
    
    // Option 2: If drawer doesn't work, try the cart page anyway
    // but handle potential redirect
    const response = await this.page.goto(this.urls.cart, { waitUntil: 'domcontentloaded' });
    
    // Check if we were redirected
    const currentUrl = this.page.url();
    if (currentUrl.includes('/checkout') || currentUrl.includes('/collections')) {
      console.log('Cart page redirected to:', currentUrl);
      // Navigate back or handle as needed
    } else {
      await this.waitForLoad();
    }
  }

  async openCartDrawer() {
    // Try multiple selectors for cart icon
    const cartIconSelectors = [
      '[data-cart-drawer-toggle]',
      '.rh-navbar__cart',
      '[data-cart-icon]',
      '.cart-icon',
      '#cart-icon',
      'a[href="/cart"]'
    ];
    
    for (const selector of cartIconSelectors) {
      const cartIcon = await this.page.$(selector);
      if (cartIcon) {
        await cartIcon.click();
        await this.page.waitForTimeout(cartConfig.animations.drawerOpenDelay);
        return;
      }
    }
    
    throw new Error('Cart icon not found');
  }

  async waitForLoad() {
    // Wait for cart content to load
    await this.page.waitForFunction(() => {
      return document.querySelector('[data-cart-items], .cart-items') !== null ||
             document.querySelector('[data-cart-empty], .cart-empty') !== null;
    }, { timeout: 10000 });
    
    // Wait for any loading states to complete
    await this.page.waitForFunction(() => {
      const loadingElements = document.querySelectorAll('.cart-loading, [data-cart-loading]');
      return loadingElements.length === 0 || Array.from(loadingElements).every(el => 
        el.style.display === 'none' || !el.offsetParent
      );
    }, { timeout: 5000 }).catch(() => {
      // Loading states might not be present
    });
  }

  async isEmpty() {
    const emptyCartElement = await this.page.$(this.emptyCartSelector);
    if (emptyCartElement) {
      const isVisible = await emptyCartElement.isVisible();
      return isVisible;
    }
    
    // Also check if cart items container exists but is empty
    const cartItems = await this.page.$$(this.cartItemSelector);
    return cartItems.length === 0;
  }

  async getCartItemCount() {
    const cartItems = await this.page.$$(this.cartItemSelector);
    return cartItems.length;
  }

  async getCartItems() {
    const cartItems = await this.page.$$(this.cartItemSelector);
    const items = [];
    
    for (const item of cartItems) {
      const title = await item.$eval('[data-item-title], .item-title, .cart-item-title', 
        el => el.textContent.trim()).catch(() => '');
      const price = await item.$eval('[data-item-price], .item-price, .cart-item-price', 
        el => el.textContent.trim()).catch(() => '');
      const quantity = await item.$eval('[data-cart-quantity], input[name*="quantity"]', 
        el => parseInt(el.value) || 1).catch(() => 1);
      
      items.push({ title, price, quantity });
    }
    
    return items;
  }

  async updateQuantity(itemIndex, newQuantity) {
    const cartItems = await this.page.$$(this.cartItemSelector);
    
    if (itemIndex >= cartItems.length) {
      throw new Error(`Item index ${itemIndex} out of range`);
    }
    
    const item = cartItems[itemIndex];
    const quantityInput = await item.$(this.quantityInputSelector);
    
    if (quantityInput) {
      await quantityInput.fill(newQuantity.toString());
      
      // Some themes auto-update, others need manual trigger
      await quantityInput.press('Enter').catch(() => {
        // Enter might not work, try blur event
        quantityInput.blur();
      });
      
      // Wait for cart update with throttling
      await this.page.waitForTimeout(cartConfig.animations.updateDelay);
      await this.waitForLoad();
    } else {
      // Try using increase/decrease buttons
      const currentQuantity = await this.getItemQuantity(itemIndex);
      const difference = newQuantity - currentQuantity;
      
      if (difference > 0) {
        for (let i = 0; i < difference; i++) {
          await this.increaseQuantity(itemIndex);
        }
      } else if (difference < 0) {
        for (let i = 0; i < Math.abs(difference); i++) {
          await this.decreaseQuantity(itemIndex);
        }
      }
    }
  }

  async getItemQuantity(itemIndex) {
    const cartItems = await this.page.$$(this.cartItemSelector);
    const item = cartItems[itemIndex];
    
    if (!item) return 0;
    
    const quantityInput = await item.$(this.quantityInputSelector);
    if (quantityInput) {
      const value = await quantityInput.inputValue();
      return parseInt(value) || 1;
    }
    
    return 1;
  }

  async increaseQuantity(itemIndex) {
    const cartItems = await this.page.$$(this.cartItemSelector);
    const item = cartItems[itemIndex];
    const increaseButton = await item.$(this.increaseButtonSelector);
    
    if (increaseButton) {
      await increaseButton.click();
      await this.page.waitForTimeout(cartConfig.animations.updateDelay);
      await this.waitForLoad();
    }
  }

  async decreaseQuantity(itemIndex) {
    const cartItems = await this.page.$$(this.cartItemSelector);
    const item = cartItems[itemIndex];
    const decreaseButton = await item.$(this.decreaseButtonSelector);
    
    if (decreaseButton) {
      await decreaseButton.click();
      await this.page.waitForTimeout(cartConfig.animations.updateDelay);
      await this.waitForLoad();
    }
  }

  async removeItem(itemIndex) {
    const initialItemCount = await this.getCartItemCount();
    
    const cartItems = await this.page.$$(this.cartItemSelector);
    const item = cartItems[itemIndex];
    const removeButton = await item.$(this.removeButtonSelector);
    
    if (removeButton) {
      await removeButton.click();
      
      // Wait for cart update
      await this.page.waitForTimeout(cartConfig.animations.updateDelay);
      await this.waitForLoad();
      
      // Verify item was removed
      const newItemCount = await this.getCartItemCount();
      expect(newItemCount).toBe(initialItemCount - 1);
    } else {
      // Try setting quantity to 0
      await this.updateQuantity(itemIndex, 0);
    }
  }

  async getSubtotal() {
    const subtotalElement = await this.page.$(this.subtotalSelector);
    if (subtotalElement) {
      return await subtotalElement.textContent();
    }
    return '';
  }

  async getShippingCost() {
    const shippingElement = await this.page.$(this.shippingSelector);
    if (shippingElement) {
      return await shippingElement.textContent();
    }
    return '';
  }

  async getTotal() {
    const totalElement = await this.page.$(this.totalSelector);
    if (totalElement) {
      return await totalElement.textContent();
    }
    return '';
  }

  async proceedToCheckout() {
    const checkoutButton = await this.page.$(this.checkoutButtonSelector);
    
    if (!checkoutButton) {
      throw new Error('Checkout button not found');
    }
    
    // Check if button is enabled
    const isDisabled = await checkoutButton.isDisabled();
    if (isDisabled) {
      throw new Error('Checkout button is disabled');
    }
    
    await checkoutButton.click();
    
    // Wait for navigation to checkout
    await this.page.waitForLoadState('networkidle');
  }

  async verifyRepCodeInCart(expectedRepCode = repConfig.testRepCode) {
    // Check localStorage
    const storedRepCode = await this.page.evaluate((key) => {
      return localStorage.getItem(key);
    }, repConfig.localStorage.repKey);
    
    expect(storedRepCode).toBe(expectedRepCode);
    
    // Check cart attributes by examining form data
    const cartAttributesData = await this.page.evaluate((attrName) => {
      const cartForm = document.querySelector('form[action="/cart"]');
      if (cartForm) {
        const repInput = cartForm.querySelector(`input[name="attributes[${attrName}]"]`);
        return repInput ? repInput.value : null;
      }
      
      // Also check if it's in the cart object globally
      return window.cart && window.cart.attributes ? window.cart.attributes[attrName] : null;
    }, repConfig.cartAttribute);
    
    if (cartAttributesData !== null) {
      expect(cartAttributesData).toBe(expectedRepCode);
    }
  }

  async clearCart() {
    while (!(await this.isEmpty())) {
      const itemCount = await this.getCartItemCount();
      if (itemCount > 0) {
        await this.removeItem(0); // Always remove the first item
      } else {
        break; // Safety break
      }
    }
  }

  async takeScreenshot(name = 'cart') {
    return await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  // Performance monitoring
  async measureCartUpdatePerformance(operation) {
    const startTime = Date.now();
    await operation();
    const endTime = Date.now();
    
    return {
      operationTime: endTime - startTime,
      timestamp: new Date().toISOString()
    };
  }

  // Test cart behavior with ONEbox products
  async hasONEboxProducts() {
    const cartItems = await this.getCartItems();
    return cartItems.some(item => 
      item.title.toLowerCase().includes('onebox') ||
      item.title.toLowerCase().includes('one box')
    );
  }

  async getCartShippingMessage() {
    // Look for shipping messages that might be specific to ONEbox vs regular products
    const shippingMessages = await this.page.$$eval(
      '.cart-shipping-message, [data-shipping-message], .shipping-note',
      elements => elements.map(el => el.textContent.trim())
    ).catch(() => []);
    
    return shippingMessages;
  }

  // Accessibility checks
  async checkCartAccessibility() {
    const issues = await this.page.evaluate(() => {
      const problems = [];
      
      // Check if quantity inputs have proper labels
      const quantityInputs = document.querySelectorAll('input[name*="quantity"]');
      quantityInputs.forEach(input => {
        if (!input.getAttribute('aria-label') && !input.closest('label')) {
          problems.push('Quantity input lacks proper labeling');
        }
      });
      
      // Check if remove buttons are accessible
      const removeButtons = document.querySelectorAll('.cart-remove, [data-cart-remove]');
      removeButtons.forEach(button => {
        if (!button.textContent.trim() && !button.getAttribute('aria-label')) {
          problems.push('Remove button lacks accessible label');
        }
      });
      
      return problems;
    });
    
    return issues;
  }
}

module.exports = CartPage;