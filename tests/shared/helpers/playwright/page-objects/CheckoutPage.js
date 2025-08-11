const { expect } = require('@playwright/test');
const { checkoutConfig, testData, performanceThresholds, repConfig } = require('../../../config/shopify-test-env');

/**
 * Custom Checkout Page Object Model
 * 
 * Handles interactions with the R3 custom checkout page including:
 * - Session management and validation
 * - Customer information forms
 * - Payment method selection (Card/ACH)
 * - Rep code validation in checkout
 * - Order creation verification
 */
class CheckoutPage {
  constructor(page) {
    this.page = page;
    
    // Session and initialization - Updated to match actual checkout
    this.sessionStatusSelector = '[data-session-status]';
    this.loadingSelector = '#checkout-loading, .checkout-loading';
    this.containerSelector = '.checkout-container';
    
    // Customer form selectors - Updated to match custom-checkout.liquid
    this.customerFormSelector = '#shipping-form';
    this.emailInputSelector = '#email';
    this.firstNameSelector = '#first_name';
    this.lastNameSelector = '#last_name';
    this.phoneSelector = '#phone';
    
    // Shipping form selectors - Updated to match custom-checkout.liquid
    this.shippingFormSelector = '#shipping-form';
    this.address1Selector = '#address1';
    this.address2Selector = '#address2';
    this.citySelector = '#city';
    this.provinceSelector = '#province';
    this.zipSelector = '#zip';
    this.countrySelector = '#country';
    
    // Payment method selectors - Updated to match custom-checkout.liquid
    this.paymentSectionSelector = '#payment-section';
    this.paymentMethodSelector = 'input[name="payment_method"]';
    this.cardMethodSelector = 'input[name="payment_method"][value="card"]';
    this.achMethodSelector = 'input[name="payment_method"][value="ach"]';
    
    // Card payment form - Updated to match custom-checkout.liquid
    this.cardFormSelector = '#card-element';
    this.cardNumberSelector = '[data-card-number], #card-number';
    this.cardExpirySelector = '[data-card-expiry], #card-expiry';
    this.cardCvcSelector = '[data-card-cvc], #card-cvc';
    
    // ACH payment form
    this.achFormSelector = '#ach-element';
    this.routingNumberSelector = '#routing-number';
    this.accountNumberSelector = '#account-number';
    this.accountTypeSelector = '#account-type';
    
    // Submit buttons - Updated to match custom-checkout.liquid
    this.proceedToPaymentSelector = '#proceed-to-payment-btn';
    this.submitButtonSelector = '#place-order-btn, #submit-payment';
    
    // Order summary
    this.orderSummarySelector = '[data-order-summary]';
    this.orderItemsSelector = '[data-order-items]';
    this.orderSubtotalSelector = '[data-order-subtotal]';
    this.orderShippingSelector = '[data-order-shipping]';
    this.orderTotalSelector = '[data-order-total]';
    
    // Success/error states
    this.successMessageSelector = '[data-success-message], .success-message';
    this.errorMessageSelector = '[data-error-message], .error-message';
    
    // Rep indicator
    this.repIndicatorSelector = '[data-rep-indicator], .rep-indicator';
  }

  async goto() {
    await this.page.goto('/pages/custom-checkout');
    await this.waitForLoad();
  }

  async waitForLoad() {
    // Wait for checkout page to initialize
    await this.page.waitForSelector(this.sessionStatusSelector, { 
      timeout: checkoutConfig.timeouts.sessionLoad 
    });
    
    // Wait for any loading states to complete
    await this.page.waitForFunction(() => {
      const loadingElements = document.querySelectorAll('.checkout-loading, [data-checkout-loading]');
      return loadingElements.length === 0 || Array.from(loadingElements).every(el => 
        el.style.display === 'none' || !el.offsetParent
      );
    }, { timeout: 10000 }).catch(() => {
      // Loading states might not be present
    });
  }

  async getSessionStatus() {
    const statusElement = await this.page.$(this.sessionStatusSelector);
    if (statusElement) {
      return await statusElement.textContent();
    }
    return '';
  }

  async isSessionValid() {
    const status = await this.getSessionStatus();
    return status.toLowerCase().includes('valid') || status.toLowerCase().includes('active');
  }

  async fillCustomerInformation(customerData = testData.customers[0]) {
    // Fill email
    const emailInput = await this.page.$(this.emailInputSelector);
    if (emailInput) {
      await emailInput.fill(customerData.email);
    }
    
    // Fill first name
    const firstNameInput = await this.page.$(this.firstNameSelector);
    if (firstNameInput) {
      await firstNameInput.fill(customerData.firstName);
    }
    
    // Fill last name
    const lastNameInput = await this.page.$(this.lastNameSelector);
    if (lastNameInput) {
      await lastNameInput.fill(customerData.lastName);
    }
    
    // Fill phone
    const phoneInput = await this.page.$(this.phoneSelector);
    if (phoneInput) {
      await phoneInput.fill(customerData.phone);
    }
  }

  async fillShippingAddress(addressData = testData.customers[0].address) {
    // Fill address line 1
    const address1Input = await this.page.$(this.address1Selector);
    if (address1Input) {
      await address1Input.fill(addressData.address1);
    }
    
    // Fill city
    const cityInput = await this.page.$(this.citySelector);
    if (cityInput) {
      await cityInput.fill(addressData.city);
    }
    
    // Select province/state
    const provinceSelect = await this.page.$(this.provinceSelector);
    if (provinceSelect) {
      await provinceSelect.selectOption(addressData.province);
    }
    
    // Fill ZIP code
    const zipInput = await this.page.$(this.zipSelector);
    if (zipInput) {
      await zipInput.fill(addressData.zip);
    }
    
    // Select country
    const countrySelect = await this.page.$(this.countrySelector);
    if (countrySelect) {
      await countrySelect.selectOption(addressData.country);
    }
  }

  async selectPaymentMethod(method = 'card') {
    if (method === 'card') {
      const cardTab = await this.page.$(this.cardTabSelector);
      if (cardTab) {
        await cardTab.click();
        await this.page.waitForSelector(this.cardFormSelector, { state: 'visible' });
      }
    } else if (method === 'ach') {
      const achTab = await this.page.$(this.achTabSelector);
      if (achTab) {
        await achTab.click();
        await this.page.waitForSelector(this.achFormSelector, { state: 'visible' });
      }
    }
  }

  async fillCardInformation(cardData = testData.testCards.visa) {
    await this.selectPaymentMethod('card');
    
    // Wait for Stripe Elements to load
    await this.page.waitForTimeout(2000);
    
    // Fill card number (may be in iframe)
    const cardNumberFrame = await this.page.frameLocator('iframe[name*="card-number"]').first();
    if (await cardNumberFrame.locator('input').isVisible().catch(() => false)) {
      await cardNumberFrame.locator('input').fill(cardData.number);
    } else {
      const cardNumberInput = await this.page.$(this.cardNumberSelector);
      if (cardNumberInput) {
        await cardNumberInput.fill(cardData.number);
      }
    }
    
    // Fill expiry date
    const cardExpiryFrame = await this.page.frameLocator('iframe[name*="card-expiry"]').first();
    if (await cardExpiryFrame.locator('input').isVisible().catch(() => false)) {
      await cardExpiryFrame.locator('input').fill(cardData.exp);
    } else {
      const cardExpiryInput = await this.page.$(this.cardExpirySelector);
      if (cardExpiryInput) {
        await cardExpiryInput.fill(cardData.exp);
      }
    }
    
    // Fill CVC
    const cardCvcFrame = await this.page.frameLocator('iframe[name*="card-cvc"]').first();
    if (await cardCvcFrame.locator('input').isVisible().catch(() => false)) {
      await cardCvcFrame.locator('input').fill(cardData.cvc);
    } else {
      const cardCvcInput = await this.page.$(this.cardCvcSelector);
      if (cardCvcInput) {
        await cardCvcInput.fill(cardData.cvc);
      }
    }
  }

  async fillACHInformation(achData = testData.testBankAccount) {
    await this.selectPaymentMethod('ach');
    
    // Fill routing number
    const routingInput = await this.page.$(this.routingNumberSelector);
    if (routingInput) {
      await routingInput.fill(achData.routing);
    }
    
    // Fill account number
    const accountInput = await this.page.$(this.accountNumberSelector);
    if (accountInput) {
      await accountInput.fill(achData.account);
    }
    
    // Select account type
    const accountTypeSelect = await this.page.$(this.accountTypeSelector);
    if (accountTypeSelect) {
      await accountTypeSelect.selectOption(achData.accountType);
    }
  }

  async submitPayment() {
    const submitButton = await this.page.$(this.submitButtonSelector);
    
    if (!submitButton) {
      throw new Error('Submit button not found');
    }
    
    // Check if button is enabled
    const isDisabled = await submitButton.isDisabled();
    if (isDisabled) {
      throw new Error('Submit button is disabled');
    }
    
    await submitButton.click();
    
    // Wait for payment processing
    await this.page.waitForTimeout(checkoutConfig.timeouts.paymentProcessing);
  }

  async waitForOrderCreation() {
    // Wait for success message or order confirmation
    try {
      await this.page.waitForSelector(this.successMessageSelector, {
        timeout: checkoutConfig.timeouts.orderCreation,
        state: 'visible'
      });
      return true;
    } catch (error) {
      // Check for error message
      const errorElement = await this.page.$(this.errorMessageSelector);
      if (errorElement) {
        const errorText = await errorElement.textContent();
        throw new Error(`Order creation failed: ${errorText}`);
      }
      throw new Error('Order creation timed out');
    }
  }

  async getOrderSummary() {
    const orderSummary = {};
    
    // Get items
    const itemsElements = await this.page.$$(this.orderItemsSelector + ' .order-item');
    orderSummary.items = [];
    
    for (const item of itemsElements) {
      const title = await item.$eval('.item-title', el => el.textContent.trim()).catch(() => '');
      const quantity = await item.$eval('.item-quantity', el => parseInt(el.textContent) || 1).catch(() => 1);
      const price = await item.$eval('.item-price', el => el.textContent.trim()).catch(() => '');
      
      orderSummary.items.push({ title, quantity, price });
    }
    
    // Get subtotal
    const subtotalElement = await this.page.$(this.orderSubtotalSelector);
    if (subtotalElement) {
      orderSummary.subtotal = await subtotalElement.textContent();
    }
    
    // Get shipping
    const shippingElement = await this.page.$(this.orderShippingSelector);
    if (shippingElement) {
      orderSummary.shipping = await shippingElement.textContent();
    }
    
    // Get total
    const totalElement = await this.page.$(this.orderTotalSelector);
    if (totalElement) {
      orderSummary.total = await totalElement.textContent();
    }
    
    return orderSummary;
  }

  async verifyRepCodeInCheckout(expectedRepCode = repConfig.testRepCode) {
    // Check localStorage persistence
    const storedRepCode = await this.page.evaluate((key) => {
      return localStorage.getItem(key);
    }, repConfig.localStorage.repKey);
    
    expect(storedRepCode).toBe(expectedRepCode);
    
    // Check if rep indicator is displayed
    const repIndicator = await this.page.$(this.repIndicatorSelector);
    if (repIndicator) {
      const isVisible = await repIndicator.isVisible();
      expect(isVisible).toBe(true);
      
      const repText = await repIndicator.textContent();
      expect(repText).toContain(expectedRepCode);
    }
    
    // Check if rep code will be included in order
    const repCodeValue = await this.page.evaluate((attrName) => {
      // Check if there's a hidden input for rep code
      const repInput = document.querySelector(`input[name*="${attrName}"]`);
      return repInput ? repInput.value : null;
    }, repConfig.cartAttribute);
    
    if (repCodeValue !== null) {
      expect(repCodeValue).toBe(expectedRepCode);
    }
  }

  async completeFullCheckout(customerData = testData.customers[0], paymentMethod = 'card') {
    // Fill customer information
    await this.fillCustomerInformation(customerData);
    
    // Fill shipping address
    await this.fillShippingAddress(customerData.address);
    
    // Select and fill payment information
    if (paymentMethod === 'card') {
      await this.fillCardInformation();
    } else if (paymentMethod === 'ach') {
      await this.fillACHInformation();
    }
    
    // Submit payment
    await this.submitPayment();
    
    // Wait for order creation
    await this.waitForOrderCreation();
    
    return await this.getOrderSummary();
  }

  async takeScreenshot(name = 'checkout') {
    return await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  // Performance monitoring
  async measureCheckoutPerformance() {
    const startTime = Date.now();
    
    const loadTime = await this.page.evaluate(() => {
      return performance.timing.loadEventEnd - performance.timing.navigationStart;
    });
    
    return {
      pageLoadTime: loadTime,
      timestamp: new Date().toISOString()
    };
  }

  // Error handling
  async getErrorMessage() {
    const errorElement = await this.page.$(this.errorMessageSelector);
    if (errorElement) {
      return await errorElement.textContent();
    }
    return null;
  }

  async getSuccessMessage() {
    const successElement = await this.page.$(this.successMessageSelector);
    if (successElement) {
      return await successElement.textContent();
    }
    return null;
  }

  // Accessibility checks
  async checkCheckoutAccessibility() {
    const issues = await this.page.evaluate(() => {
      const problems = [];
      
      // Check form labels
      const inputs = document.querySelectorAll('input[type="text"], input[type="email"], select');
      inputs.forEach(input => {
        if (!input.getAttribute('aria-label') && !input.closest('label') && !document.querySelector(`label[for="${input.id}"]`)) {
          problems.push(`Input ${input.name || input.id} lacks proper labeling`);
        }
      });
      
      // Check payment method tabs
      const paymentTabs = document.querySelectorAll('[data-payment-card], [data-payment-ach]');
      paymentTabs.forEach(tab => {
        if (!tab.getAttribute('role') || tab.getAttribute('role') !== 'tab') {
          problems.push('Payment method tabs missing proper ARIA roles');
        }
      });
      
      return problems;
    });
    
    return issues;
  }
}

module.exports = CheckoutPage;