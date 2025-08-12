const { expect } = require('@playwright/test');
const { buildTestUrls, testProducts, cartConfig, repConfig } = require('../../../config/shopify-test-env');

/**
 * Product Page Object Model
 * 
 * Handles interactions with Shopify product pages including:
 * - Product selection and options
 * - Add to cart functionality
 * - Quantity selection
 * - Rep parameter preservation
 */
class ProductPage {
  constructor(page) {
    this.page = page;
    this.urls = buildTestUrls();
    
    // Standard Shopify product page selectors
    this.productFormSelector = '[data-product-form], form[action*="/cart/add"]';
    this.addToCartButtonSelector = '[data-add-to-cart], [name="add"], button[type="submit"], .add-to-cart-btn, .btn-product-add';
    this.quantityInputSelector = '[data-quantity], input[name="quantity"], #quantity';
    this.priceSelector = '[data-price], .price, .product-price';
    this.titleSelector = '[data-product-title], .product-title, h1';
    this.variantSelectorPrefix = '[data-variant-selector], select[name*="id"]';
    this.productImagesSelector = '[data-product-images], .product-images';
    this.productDescriptionSelector = '[data-product-description], .product-description';
    
    // Cart notification selectors
    this.cartNotificationSelector = '[data-cart-notification], .cart-notification, .notification';
    this.cartDrawerSelector = '[data-cart-drawer], .cart-drawer';
    
    // Rep parameter elements
    this.repIndicatorSelector = '[data-rep-indicator], .rep-indicator';
    
    // Loading states
    this.loadingSelector = '.loading, [data-loading]';
  }

  async goto(productHandle = testProducts.standard.handle) {
    const productUrl = `${this.urls.home.split('?')[0]}/products/${productHandle}${this.urls.home.includes('?') ? '?' + this.urls.home.split('?')[1] : ''}`;
    await this.page.goto(productUrl);
    await this.waitForLoad();
  }

  async gotoWithRep(productHandle = testProducts.standard.handle, repCode = repConfig.testRepCode) {
    const baseUrl = `${this.urls.home.split('?')[0]}/products/${productHandle}`;
    const urlWithRep = `${baseUrl}?rep=${repCode}${this.urls.home.includes('preview_theme_id') ? '&' + this.urls.home.split('?')[1] : ''}`;
    await this.page.goto(urlWithRep);
    await this.waitForLoad();
  }

  async waitForLoad() {
    // Wait for product form to be present
    await this.page.waitForSelector(this.productFormSelector, { timeout: 10000 });
    
    // Wait for add to cart button
    await this.page.waitForSelector(this.addToCartButtonSelector, { timeout: 5000 });
    
    // Wait for any loading states to complete
    await this.page.waitForFunction(() => {
      const loadingElements = document.querySelectorAll('.loading, [data-loading]');
      return loadingElements.length === 0 || Array.from(loadingElements).every(el => 
        el.style.display === 'none' || !el.offsetParent
      );
    }, { timeout: 5000 }).catch(() => {
      // Loading indicators may not be present, that's ok
    });
  }

  async getProductTitle() {
    const titleElement = await this.page.$(this.titleSelector);
    return titleElement ? await titleElement.textContent() : '';
  }

  async getProductPrice() {
    const priceElement = await this.page.$(this.priceSelector);
    return priceElement ? await priceElement.textContent() : '';
  }

  async setQuantity(quantity) {
    // Try multiple selectors for quantity input
    const quantitySelectors = [
      '[data-qty-input]',
      '#quantity',
      'input[name="quantity"]',
      '.qty-input',
      '.quantity-input'
    ];
    
    let quantityInput = null;
    for (const selector of quantitySelectors) {
      quantityInput = await this.page.$(selector);
      if (quantityInput && await quantityInput.isVisible()) break;
    }
    
    if (quantityInput) {
      // Clear and set new value
      await quantityInput.click({ clickCount: 3 }); // Triple click to select all
      await quantityInput.fill(quantity.toString());
      await quantityInput.press('Tab'); // Tab out to trigger change
      await this.page.waitForTimeout(300); // Wait for any updates
    } else {
      console.log('Quantity input not found - will use default quantity');
    }
  }

  async getQuantity() {
    const quantityInput = await this.page.$(this.quantityInputSelector);
    if (quantityInput) {
      const value = await quantityInput.inputValue();
      return parseInt(value) || 1;
    }
    return 1;
  }

  async selectVariant(variantOption) {
    // This is a simplified variant selection - real implementation would need
    // to handle different variant types (color, size, etc.)
    const variantSelectors = await this.page.$$(this.variantSelectorPrefix);
    
    if (variantSelectors.length > 0) {
      // Select the first variant selector and choose the option
      await variantSelectors[0].selectOption({ label: variantOption });
      
      // Wait for price/availability updates
      await this.page.waitForTimeout(500);
    }
  }

  async addToCart() {
    // Get initial cart count for verification
    const initialCartCount = await this.getCurrentCartCount();
    
    // Make sure we have a valid variant selected
    const variantInput = await this.page.$('[data-variant-input], input[name="id"]');
    if (variantInput) {
      const variantId = await variantInput.getAttribute('value');
      if (!variantId) {
        console.log('Warning: No variant selected, selecting first available');
        // Try to select first available variant
        const firstVariant = await this.page.$('input[name="id"]');
        if (firstVariant) {
          await firstVariant.evaluate(el => el.click());
        }
      }
    }
    
    // Click add to cart button
    const addToCartButton = await this.page.$(this.addToCartButtonSelector);
    
    if (!addToCartButton) {
      throw new Error('Add to cart button not found');
    }
    
    // Check if button is disabled
    const isDisabled = await addToCartButton.isDisabled();
    if (isDisabled) {
      throw new Error('Add to cart button is disabled - product may be out of stock');
    }
    
    // Click and wait for network response
    const [response] = await Promise.all([
      this.page.waitForResponse(
        resp => resp.url().includes('/cart/add') || resp.url().includes('/cart/update'),
        { timeout: 10000 }
      ).catch(() => null),
      addToCartButton.click()
    ]);
    
    // Wait a bit for UI to update
    await this.page.waitForTimeout(1000);
    
    // Check if cart drawer opened
    const cartDrawer = await this.page.$('[data-cart-drawer]');
    if (cartDrawer) {
      const isVisible = await cartDrawer.isVisible();
      if (isVisible) {
        console.log('Cart drawer opened after add to cart');
      }
    }
    
    // Try to get updated cart count
    const newCartCount = await this.getCurrentCartCount();
    
    // If count didn't increase, try fetching cart.js directly
    if (newCartCount <= initialCartCount) {
      const cartData = await this.page.evaluate(() => {
        return fetch('/cart.js')
          .then(r => r.json())
          .catch(() => null);
      });
      
      if (cartData && cartData.item_count > 0) {
        console.log(`Cart has ${cartData.item_count} items according to cart.js API`);
        return cartData.item_count;
      }
      
      console.log(`Warning: Cart count did not increase. Initial: ${initialCartCount}, New: ${newCartCount}`);
    }
    
    return newCartCount;
  }

  async getCurrentCartCount() {
    // The cart count element in the theme is .rh-navbar__cart-count
    // It only exists when there are items in the cart
    const cartCountElement = await this.page.$('.rh-navbar__cart-count');
    
    if (cartCountElement) {
      const text = await cartCountElement.textContent();
      const count = parseInt(text) || 0;
      return count;
    }
    
    // No cart count element means empty cart
    return 0;
  }

  async waitForCartNotification() {
    try {
      await this.page.waitForSelector(this.cartNotificationSelector, { 
        timeout: 3000,
        state: 'visible' 
      });
      return true;
    } catch (error) {
      // Cart notification might not appear in all themes
      return false;
    }
  }

  async isCartDrawerOpen() {
    const cartDrawer = await this.page.$(this.cartDrawerSelector);
    if (cartDrawer) {
      // Check if the drawer has the 'is-open' class rather than just visibility
      const isOpen = await cartDrawer.evaluate(el => el.classList.contains('is-open'));
      return isOpen;
    }
    return false;
  }

  async checkRepParameterPersistence(expectedRepCode = repConfig.testRepCode) {
    // Verify rep code is still in localStorage
    const storedRepCode = await this.page.evaluate((key) => {
      return localStorage.getItem(key);
    }, repConfig.localStorage.repKey);
    
    expect(storedRepCode).toBe(expectedRepCode);
    
    // Check if rep indicator is shown
    const repIndicator = await this.page.$(this.repIndicatorSelector);
    if (repIndicator) {
      const isVisible = await repIndicator.isVisible();
      expect(isVisible).toBe(true);
    }
  }

  async checkRepCodeInUrl(expectedRepCode = repConfig.testRepCode) {
    const currentUrl = this.page.url();
    expect(currentUrl).toContain(`rep=${expectedRepCode}`);
  }

  // Test ONEbox specific functionality
  async isONEboxProduct() {
    // Check if this is a ONEbox product by looking for specific indicators
    const oneboxIndicators = [
      '[data-onebox]',
      '.onebox-product',
      ':has-text("ONEbox")'
    ];
    
    for (const selector of oneboxIndicators) {
      const element = await this.page.$(selector);
      if (element) return true;
    }
    
    // Also check product title/description
    const title = await this.getProductTitle();
    const description = await this.page.$eval(this.productDescriptionSelector, el => el.textContent).catch(() => '');
    
    return title.toLowerCase().includes('onebox') || description.toLowerCase().includes('onebox');
  }

  async getShippingInfo() {
    // Look for shipping information on product page
    const shippingSelectors = [
      '[data-shipping-info]',
      '.shipping-info',
      '.product-shipping',
      ':has-text("shipping")'
    ];
    
    for (const selector of shippingSelectors) {
      const element = await this.page.$(selector);
      if (element) {
        return await element.textContent();
      }
    }
    
    return null;
  }

  async takeScreenshot(name = 'product-page') {
    return await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  // Performance monitoring
  async measureAddToCartPerformance() {
    const startTime = Date.now();
    await this.addToCart();
    const endTime = Date.now();
    
    return {
      addToCartTime: endTime - startTime,
      timestamp: new Date().toISOString()
    };
  }

  // Accessibility checks
  async checkProductPageAccessibility() {
    const issues = await this.page.evaluate(() => {
      const problems = [];
      
      // Check if product images have alt text
      const images = document.querySelectorAll('img:not([alt])');
      if (images.length > 0) {
        problems.push(`${images.length} product images missing alt text`);
      }
      
      // Check if add to cart button is accessible
      const addButton = document.querySelector('[data-add-to-cart], button[name="add"]');
      if (addButton && !addButton.textContent.trim() && !addButton.getAttribute('aria-label')) {
        problems.push('Add to cart button lacks accessible label');
      }
      
      return problems;
    });
    
    return issues;
  }
}

module.exports = ProductPage;