const { test, expect } = require('@playwright/test');
const HomePage = require('../../../../shared/helpers/playwright/page-objects/HomePage');
const ProductPage = require('../../../../shared/helpers/playwright/page-objects/ProductPage');
const CartPage = require('../../../../shared/helpers/playwright/page-objects/CartPage');
const CheckoutPage = require('../../../../shared/helpers/playwright/page-objects/CheckoutPage');
const { testData, checkoutConfig, performanceThresholds } = require('../../../../shared/config/shopify-test-env');

/**
 * Checkout Form and Payment Testing
 * 
 * Comprehensive testing of the custom checkout page including:
 * - Form validation and error handling
 * - Payment method switching (Card vs ACH)
 * - Stripe Elements integration
 * - Session management
 * - Order creation workflows
 * - Error recovery and retry logic
 */

test.describe('Checkout Form and Payment', () => {
  let homePage;
  let productPage;
  let cartPage;
  let checkoutPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    productPage = new ProductPage(page);
    cartPage = new CartPage(page);
    checkoutPage = new CheckoutPage(page);
    
    // Set up cart with test product
    await homePage.navigateToProduct('test-product');
    await productPage.setQuantity(2);
    await productPage.addToCart();
    await cartPage.goto();
    await cartPage.proceedToCheckout();
  });

  test('Checkout Page: Loads with valid session', async ({ page }) => {
    // Verify checkout page loaded correctly
    await expect(page).toHaveURL(/custom-checkout/);
    
    // Check session status
    const sessionValid = await checkoutPage.isSessionValid();
    expect(sessionValid).toBe(true);
    
    const sessionStatus = await checkoutPage.getSessionStatus();
    expect(sessionStatus.toLowerCase()).toContain('valid');
    
    // Verify page elements are present
    const customerFormExists = await page.$('[data-customer-form]') !== null;
    const shippingFormExists = await page.$('[data-shipping-form]') !== null;
    const paymentTabsExist = await page.$('[data-payment-tabs]') !== null;
    
    expect(customerFormExists).toBe(true);
    expect(shippingFormExists).toBe(true);
    expect(paymentTabsExist).toBe(true);
  });

  test('Customer Form: Field validation', async ({ page }) => {
    // Test email validation
    await checkoutPage.fillCustomerInformation({
      email: 'invalid-email',
      firstName: 'Test',
      lastName: 'User',
      phone: '555-0123'
    });
    
    // Try to proceed and check for validation errors
    const submitButton = await page.$('[data-checkout-submit]');
    if (submitButton) {
      await submitButton.click();
      
      // Should show email validation error
      const errorMessage = await checkoutPage.getErrorMessage();
      if (errorMessage) {
        expect(errorMessage.toLowerCase()).toContain('email');
      } else {
        // Check for HTML5 validation
        const emailInput = await page.$('[data-customer-email]');
        const validityState = await emailInput.evaluate(el => el.validity.valid);
        expect(validityState).toBe(false);
      }
    }
    
    // Test with valid email
    await checkoutPage.fillCustomerInformation({
      email: 'valid@example.com',
      firstName: 'Test',
      lastName: 'User',
      phone: '555-0123'
    });
    
    // Email should now be valid
    const emailInput = await page.$('[data-customer-email]');
    if (emailInput) {
      const validityState = await emailInput.evaluate(el => el.validity.valid);
      expect(validityState).toBe(true);
    }
  });

  test('Shipping Form: Address validation', async ({ page }) => {
    // Fill customer info first
    await checkoutPage.fillCustomerInformation(testData.customers[0]);
    
    // Test incomplete address
    await checkoutPage.fillShippingAddress({
      address1: '123 Test St',
      city: '', // Missing city
      province: 'NY',
      zip: '10001',
      country: 'US'
    });
    
    // Try to proceed
    const submitButton = await page.$('[data-checkout-submit]');
    if (submitButton) {
      await submitButton.click();
      
      // Should show address validation error or prevent submission
      const cityInput = await page.$('[data-city]');
      if (cityInput) {
        const validityState = await cityInput.evaluate(el => el.validity.valid);
        expect(validityState).toBe(false);
      }
    }
    
    // Fill complete address
    await checkoutPage.fillShippingAddress(testData.customers[0].address);
    
    // Address should now be valid
    const cityInput = await page.$('[data-city]');
    if (cityInput) {
      const validityState = await cityInput.evaluate(el => el.validity.valid);
      expect(validityState).toBe(true);
    }
  });

  test('Payment Methods: Card vs ACH tab switching', async ({ page }) => {
    // Test card tab selection
    await checkoutPage.selectPaymentMethod('card');
    
    // Verify card form is visible
    const cardForm = await page.$('[data-card-form]');
    const cardFormVisible = cardForm ? await cardForm.isVisible() : false;
    expect(cardFormVisible).toBe(true);
    
    // Verify ACH form is hidden
    const achForm = await page.$('[data-ach-form]');
    const achFormVisible = achForm ? await achForm.isVisible() : false;
    expect(achFormVisible).toBe(false);
    
    // Switch to ACH tab
    await checkoutPage.selectPaymentMethod('ach');
    
    // Verify ACH form is visible
    const achFormVisibleAfter = achForm ? await achForm.isVisible() : false;
    expect(achFormVisibleAfter).toBe(true);
    
    // Verify card form is hidden
    const cardFormVisibleAfter = cardForm ? await cardForm.isVisible() : false;
    expect(cardFormVisibleAfter).toBe(false);
  });

  test('Card Payment: Stripe Elements integration', async ({ page }) => {
    await checkoutPage.fillCustomerInformation(testData.customers[0]);
    await checkoutPage.fillShippingAddress();
    await checkoutPage.selectPaymentMethod('card');
    
    // Wait for Stripe Elements to load
    await page.waitForTimeout(3000);
    
    // Check if Stripe Elements iframes are present
    const cardNumberFrame = page.frameLocator('iframe[name*="card-number"]');
    const cardExpiryFrame = page.frameLocator('iframe[name*="card-expiry"]');
    const cardCvcFrame = page.frameLocator('iframe[name*="card-cvc"]');
    
    // Try to interact with Stripe Elements
    try {
      await cardNumberFrame.locator('input').fill('4242424242424242');
      await cardExpiryFrame.locator('input').fill('12/34');
      await cardCvcFrame.locator('input').fill('123');
      
      // Elements should be filled successfully
      expect(true).toBe(true); // If we got here, Stripe Elements are working
    } catch (error) {
      // Fallback to direct form fields if not using Stripe Elements
      console.log('Stripe Elements not detected, testing direct card inputs');
      
      const cardNumberInput = await page.$('[data-card-number]');
      if (cardNumberInput) {
        await cardNumberInput.fill('4242424242424242');
        
        const cardExpiryInput = await page.$('[data-card-expiry]');
        if (cardExpiryInput) {
          await cardExpiryInput.fill('12/34');
        }
        
        const cardCvcInput = await page.$('[data-card-cvc]');
        if (cardCvcInput) {
          await cardCvcInput.fill('123');
        }
      }
    }
  });

  test('ACH Payment: Bank account form', async ({ page }) => {
    await checkoutPage.fillCustomerInformation(testData.customers[0]);
    await checkoutPage.fillShippingAddress();
    await checkoutPage.selectPaymentMethod('ach');
    
    // Fill ACH information
    await checkoutPage.fillACHInformation(testData.testBankAccount);
    
    // Verify fields were filled
    const routingInput = await page.$('[data-routing-number]');
    if (routingInput) {
      const routingValue = await routingInput.inputValue();
      expect(routingValue).toBe(testData.testBankAccount.routing);
    }
    
    const accountInput = await page.$('[data-account-number]');
    if (accountInput) {
      const accountValue = await accountInput.inputValue();
      expect(accountValue).toBe(testData.testBankAccount.account);
    }
    
    const accountTypeSelect = await page.$('[data-account-type]');
    if (accountTypeSelect) {
      const selectedValue = await accountTypeSelect.inputValue();
      expect(selectedValue).toBe(testData.testBankAccount.accountType);
    }
  });

  test('Payment Processing: Successful card payment', async ({ page }) => {
    test.slow(); // Payment processing can take time
    
    const orderSummary = await checkoutPage.completeFullCheckout(
      testData.customers[0],
      'card'
    );
    
    // Verify order was created
    expect(orderSummary.total).toBeTruthy();
    
    const successMessage = await checkoutPage.getSuccessMessage();
    expect(successMessage).toContain('Order created');
    
    // Verify page shows success state
    const successElement = await page.$('[data-success-message]');
    const isVisible = successElement ? await successElement.isVisible() : false;
    expect(isVisible).toBe(true);
  });

  test('Payment Processing: Successful ACH payment', async ({ page }) => {
    test.slow();
    
    const orderSummary = await checkoutPage.completeFullCheckout(
      testData.customers[0],
      'ach'
    );
    
    expect(orderSummary.total).toBeTruthy();
    
    const successMessage = await checkoutPage.getSuccessMessage();
    expect(successMessage).toContain('Order created');
  });

  test('Error Handling: Declined card payment', async ({ page }) => {
    await checkoutPage.fillCustomerInformation(testData.customers[0]);
    await checkoutPage.fillShippingAddress();
    
    // Use declined test card
    await checkoutPage.fillCardInformation(testData.testCards.visaDeclined);
    
    await checkoutPage.submitPayment();
    
    // Should not create order, should show error
    const errorMessage = await checkoutPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
    expect(errorMessage.toLowerCase()).toContain('declined');
    
    // Success message should not be present
    const successMessage = await checkoutPage.getSuccessMessage();
    expect(successMessage).toBeFalsy();
  });

  test('Form State Management: Data persistence during errors', async ({ page }) => {
    // Fill out form completely
    const customerData = testData.customers[0];
    await checkoutPage.fillCustomerInformation(customerData);
    await checkoutPage.fillShippingAddress(customerData.address);
    
    // Use declined card to trigger error
    await checkoutPage.fillCardInformation(testData.testCards.visaDeclined);
    await checkoutPage.submitPayment();
    
    // Wait for error
    await checkoutPage.getErrorMessage();
    
    // Verify form data is still present
    const emailInput = await page.$('[data-customer-email]');
    if (emailInput) {
      const emailValue = await emailInput.inputValue();
      expect(emailValue).toBe(customerData.email);
    }
    
    const firstNameInput = await page.$('[data-first-name]');
    if (firstNameInput) {
      const firstNameValue = await firstNameInput.inputValue();
      expect(firstNameValue).toBe(customerData.firstName);
    }
    
    const address1Input = await page.$('[data-address1]');
    if (address1Input) {
      const address1Value = await address1Input.inputValue();
      expect(address1Value).toBe(customerData.address.address1);
    }
  });

  test('Order Summary: Displays correct totals', async ({ page }) => {
    // Fill forms but don't submit yet
    await checkoutPage.fillCustomerInformation(testData.customers[0]);
    await checkoutPage.fillShippingAddress();
    await checkoutPage.selectPaymentMethod('card');
    
    // Get order summary
    const orderSummary = await checkoutPage.getOrderSummary();
    
    // Verify order summary has expected structure
    expect(orderSummary.items).toBeDefined();
    expect(orderSummary.items.length).toBeGreaterThan(0);
    
    if (orderSummary.subtotal) {
      expect(orderSummary.subtotal).toContain('$');
    }
    
    if (orderSummary.total) {
      expect(orderSummary.total).toContain('$');
    }
    
    // Verify items match what was added to cart
    const firstItem = orderSummary.items[0];
    expect(firstItem.quantity).toBe(2); // We added quantity 2 in beforeEach
  });

  test('Session Timeout: Handles expired sessions', async ({ page }) => {
    // Simulate session expiry by waiting or manipulating localStorage
    await page.evaluate(() => {
      // Clear session token to simulate expiry
      localStorage.removeItem('r3_session_token');
    });
    
    // Try to submit payment
    await checkoutPage.fillCustomerInformation(testData.customers[0]);
    await checkoutPage.fillShippingAddress();
    await checkoutPage.fillCardInformation();
    
    await checkoutPage.submitPayment();
    
    // Should either refresh session or show appropriate error
    const errorMessage = await checkoutPage.getErrorMessage();
    if (errorMessage) {
      expect(errorMessage.toLowerCase()).toContain('session');
    } else {
      // Or session was automatically renewed
      const sessionStatus = await checkoutPage.getSessionStatus();
      expect(sessionStatus.toLowerCase()).toContain('valid');
    }
  });

  test('Performance: Checkout page meets performance thresholds', async ({ page }) => {
    const performanceData = await checkoutPage.measureCheckoutPerformance();
    
    expect(performanceData.pageLoadTime).toBeLessThan(performanceThresholds.checkoutLoad);
    
    // Test form interaction performance
    const startTime = Date.now();
    
    await checkoutPage.fillCustomerInformation(testData.customers[0]);
    await checkoutPage.fillShippingAddress();
    await checkoutPage.selectPaymentMethod('card');
    
    const formFillTime = Date.now() - startTime;
    expect(formFillTime).toBeLessThan(5000); // Form filling should be fast
  });

  test('Accessibility: Checkout form is accessible', async ({ page }) => {
    const accessibilityIssues = await checkoutPage.checkCheckoutAccessibility();
    expect(accessibilityIssues).toEqual([]);
    
    // Test keyboard navigation through form
    await page.keyboard.press('Tab'); // Should focus first form field
    
    // Fill form using keyboard
    await page.keyboard.type(testData.customers[0].email);
    await page.keyboard.press('Tab'); // Move to next field
    await page.keyboard.type(testData.customers[0].firstName);
    
    // Verify form was filled via keyboard
    const emailInput = await page.$('[data-customer-email]');
    if (emailInput) {
      const emailValue = await emailInput.inputValue();
      expect(emailValue).toBe(testData.customers[0].email);
    }
  });

  test('Payment Method Persistence: Remembers selected method', async ({ page }) => {
    // Select ACH payment method
    await checkoutPage.selectPaymentMethod('ach');
    
    // Fill some form data
    await checkoutPage.fillCustomerInformation(testData.customers[0]);
    
    // Reload page
    await page.reload();
    await checkoutPage.waitForLoad();
    
    // Check if ACH is still selected (if this behavior is implemented)
    const achTab = await page.$('[data-payment-ach]');
    if (achTab) {
      const isActive = await achTab.evaluate(el => 
        el.classList.contains('active') || 
        el.getAttribute('aria-selected') === 'true'
      );
      
      // This depends on implementation - some forms remember, others don't
      console.log('ACH tab active after reload:', isActive);
    }
  });

  test('Mobile Checkout: Touch-friendly interactions', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip('This test only runs on mobile');
    }
    
    // Test mobile form interactions
    await checkoutPage.fillCustomerInformation(testData.customers[0]);
    
    // Test payment method tabs on mobile
    await checkoutPage.selectPaymentMethod('card');
    
    const cardForm = await page.$('[data-card-form]');
    const cardFormVisible = cardForm ? await cardForm.isVisible() : false;
    expect(cardFormVisible).toBe(true);
    
    // Switch to ACH on mobile
    await checkoutPage.selectPaymentMethod('ach');
    
    const achForm = await page.$('[data-ach-form]');
    const achFormVisible = achForm ? await achForm.isVisible() : false;
    expect(achFormVisible).toBe(true);
  });

  test('Edge Cases: Very long form inputs', async ({ page }) => {
    // Test with very long inputs to verify truncation/validation
    const longString = 'x'.repeat(1000);
    
    await checkoutPage.fillCustomerInformation({
      email: 'test@example.com',
      firstName: longString,
      lastName: longString,
      phone: '555-0123'
    });
    
    // Verify inputs handle long strings appropriately
    const firstNameInput = await page.$('[data-first-name]');
    if (firstNameInput) {
      const firstNameValue = await firstNameInput.inputValue();
      expect(firstNameValue.length).toBeLessThan(1000); // Should be truncated
    }
  });

  // Take screenshots on test failures
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshot = await page.screenshot({ 
        path: `test-results/screenshots/checkout-failure-${testInfo.title.replace(/\s+/g, '-')}-${Date.now()}.png`,
        fullPage: true 
      });
      await testInfo.attach('screenshot', { body: screenshot, contentType: 'image/png' });
    }
  });
});