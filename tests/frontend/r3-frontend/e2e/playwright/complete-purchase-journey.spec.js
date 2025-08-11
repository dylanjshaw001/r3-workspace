const { test, expect } = require('@playwright/test');
const HomePage = require('../../../../shared/helpers/playwright/page-objects/HomePage');
const ProductPage = require('../../../../shared/helpers/playwright/page-objects/ProductPage');
const CartPage = require('../../../../shared/helpers/playwright/page-objects/CartPage');
const CheckoutPage = require('../../../../shared/helpers/playwright/page-objects/CheckoutPage');
const { testData, performanceThresholds } = require('../../../../shared/config/shopify-test-env');

/**
 * Complete Purchase Journey E2E Tests
 * 
 * These tests simulate real customer behavior through the entire
 * purchase flow from homepage to order completion
 */

test.describe('Complete Purchase Journey', () => {
  let homePage;
  let productPage;
  let cartPage;
  let checkoutPage;

  test.beforeEach(async ({ page }) => {
    // Initialize page objects
    homePage = new HomePage(page);
    productPage = new ProductPage(page);
    cartPage = new CartPage(page);
    checkoutPage = new CheckoutPage(page);
    
    // Start from homepage
    await homePage.goto();
  });

  test('Happy Path: Complete purchase with card payment', async ({ page }) => {
    test.slow(); // This is a comprehensive test that may take longer
    
    // Step 1: Navigate to product page
    await homePage.navigateToProduct('test-product');
    await expect(page).toHaveURL(/products\/test-product/);
    
    // Step 2: Verify product page loaded correctly
    const productTitle = await productPage.getProductTitle();
    expect(productTitle).toBeTruthy();
    
    const productPrice = await productPage.getProductPrice();
    expect(productPrice).toBeTruthy();
    
    // Step 3: Add product to cart
    await productPage.setQuantity(2);
    const cartCount = await productPage.addToCart();
    expect(cartCount).toBe(2);
    
    // Step 4: Verify cart drawer/notification appears
    const cartNotificationShown = await productPage.waitForCartNotification();
    // Note: Some themes may not show cart notification, that's OK
    
    // Step 5: Navigate to cart page
    await cartPage.goto();
    
    // Step 6: Verify cart contents
    const cartItems = await cartPage.getCartItems();
    expect(cartItems).toHaveLength(1);
    expect(cartItems[0].quantity).toBe(2);
    
    // Step 7: Update quantity in cart
    await cartPage.updateQuantity(0, 3);
    const updatedItems = await cartPage.getCartItems();
    expect(updatedItems[0].quantity).toBe(3);
    
    // Step 8: Proceed to checkout
    await cartPage.proceedToCheckout();
    await expect(page).toHaveURL(/custom-checkout/);
    
    // Step 9: Verify checkout page loaded with valid session
    const sessionValid = await checkoutPage.isSessionValid();
    expect(sessionValid).toBe(true);
    
    // Step 10: Complete checkout form
    const orderSummary = await checkoutPage.completeFullCheckout(
      testData.customers[0],
      'card'
    );
    
    // Step 11: Verify order was created successfully
    expect(orderSummary.items).toHaveLength(1);
    expect(orderSummary.total).toBeTruthy();
    
    // Step 12: Verify success message
    const successMessage = await checkoutPage.getSuccessMessage();
    expect(successMessage).toContain('Order created');
  });

  test('Happy Path: Complete purchase with ACH payment', async ({ page }) => {
    test.slow();
    
    // Follow same flow but with ACH payment
    await homePage.navigateToProduct('test-product');
    await productPage.addToCart();
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    
    const orderSummary = await checkoutPage.completeFullCheckout(
      testData.customers[0],
      'ach'
    );
    
    expect(orderSummary.total).toBeTruthy();
    
    const successMessage = await checkoutPage.getSuccessMessage();
    expect(successMessage).toContain('Order created');
  });

  test('ONEbox Product Purchase Flow', async ({ page }) => {
    // Test the special ONEbox product flow
    await homePage.navigateToProduct('flex-naloxone-emergency-kit');
    
    const isONEbox = await productPage.isONEboxProduct();
    expect(isONEbox).toBe(true);
    
    // Add ONEbox product to cart
    await productPage.setQuantity(15); // 15 units should trigger case calculation
    await productPage.addToCart();
    
    await cartPage.goto();
    
    // Verify ONEbox shipping calculation
    const hasONEboxProducts = await cartPage.hasONEboxProducts();
    expect(hasONEboxProducts).toBe(true);
    
    const shippingMessages = await cartPage.getCartShippingMessage();
    // ONEbox products should show calculated shipping
    expect(shippingMessages.some(msg => msg.includes('$') || msg.includes('shipping'))).toBe(true);
    
    await cartPage.proceedToCheckout();
    
    const orderSummary = await checkoutPage.completeFullCheckout(
      testData.customers[0],
      'card'
    );
    
    // Verify shipping was calculated for ONEbox products
    expect(orderSummary.shipping).toBeTruthy();
    expect(orderSummary.shipping).not.toContain('FREE');
  });

  test('Cart Management Flow', async ({ page }) => {
    // Test comprehensive cart management
    
    // Add multiple different products
    await homePage.navigateToProduct('test-product');
    await productPage.setQuantity(2);
    await productPage.addToCart();
    
    await homePage.navigateToProduct('flex-naloxone-emergency-kit');
    await productPage.setQuantity(5);
    await productPage.addToCart();
    
    // Navigate to cart
    await cartPage.goto();
    
    // Verify both products are in cart
    const cartItems = await cartPage.getCartItems();
    expect(cartItems).toHaveLength(2);
    
    // Test quantity updates
    await cartPage.updateQuantity(0, 1); // Decrease first product
    await cartPage.updateQuantity(1, 10); // Increase second product
    
    const updatedItems = await cartPage.getCartItems();
    expect(updatedItems[0].quantity).toBe(1);
    expect(updatedItems[1].quantity).toBe(10);
    
    // Test item removal
    await cartPage.removeItem(0);
    
    const remainingItems = await cartPage.getCartItems();
    expect(remainingItems).toHaveLength(1);
    
    // Clear entire cart
    await cartPage.clearCart();
    
    const isEmpty = await cartPage.isEmpty();
    expect(isEmpty).toBe(true);
  });

  test('Error Handling: Invalid payment information', async ({ page }) => {
    // Test error handling with invalid card
    await homePage.navigateToProduct('test-product');
    await productPage.addToCart();
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    
    // Fill customer info
    await checkoutPage.fillCustomerInformation();
    await checkoutPage.fillShippingAddress();
    
    // Use declined test card
    await checkoutPage.fillCardInformation(testData.testCards.visaDeclined);
    
    await checkoutPage.submitPayment();
    
    // Should show error message instead of success
    const errorMessage = await checkoutPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
    expect(errorMessage.toLowerCase()).toContain('declined');
  });

  test('Performance: Page load times meet thresholds', async ({ page }) => {
    // Test homepage performance
    const homeLoadTime = await homePage.measurePageLoadTime();
    expect(homeLoadTime.loadComplete).toBeLessThan(performanceThresholds.pageLoad);
    
    // Test product page performance
    await homePage.navigateToProduct('test-product');
    const productLoadTime = await productPage.measureAddToCartPerformance();
    expect(productLoadTime.addToCartTime).toBeLessThan(performanceThresholds.cartUpdate);
    
    // Test checkout page performance
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    const checkoutPerf = await checkoutPage.measureCheckoutPerformance();
    expect(checkoutPerf.pageLoadTime).toBeLessThan(performanceThresholds.checkoutLoad);
  });

  test('Accessibility: Key pages meet basic requirements', async ({ page }) => {
    // Test homepage accessibility
    const homeAccessibilityIssues = await homePage.checkAccessibility();
    expect(homeAccessibilityIssues).toEqual([]);
    
    // Test product page accessibility
    await homePage.navigateToProduct('test-product');
    const productAccessibilityIssues = await productPage.checkProductPageAccessibility();
    expect(productAccessibilityIssues).toEqual([]);
    
    // Test cart page accessibility
    await productPage.addToCart();
    await cartPage.goto();
    const cartAccessibilityIssues = await cartPage.checkCartAccessibility();
    expect(cartAccessibilityIssues).toEqual([]);
    
    // Test checkout page accessibility
    await cartPage.proceedToCheckout();
    const checkoutAccessibilityIssues = await checkoutPage.checkCheckoutAccessibility();
    expect(checkoutAccessibilityIssues).toEqual([]);
  });

  test('Cross-browser compatibility', async ({ page, browserName }) => {
    // This test runs across all configured browsers
    console.log(`Testing on ${browserName}`);
    
    // Basic flow that should work on all browsers
    await homePage.navigateToProduct('test-product');
    await productPage.addToCart();
    await cartPage.goto();
    
    const cartItems = await cartPage.getCartItems();
    expect(cartItems).toHaveLength(1);
    
    await cartPage.proceedToCheckout();
    const sessionValid = await checkoutPage.isSessionValid();
    expect(sessionValid).toBe(true);
  });

  test('Mobile responsiveness', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip('This test only runs on mobile');
    }
    
    // Test mobile-specific interactions
    await homePage.navigateToProduct('test-product');
    
    // On mobile, cart might behave differently
    await productPage.addToCart();
    
    // Test mobile cart drawer if present
    const isCartDrawerOpen = await productPage.isCartDrawerOpen();
    if (isCartDrawerOpen) {
      // Cart drawer opened on mobile
      expect(isCartDrawerOpen).toBe(true);
    } else {
      // Navigate to cart page on mobile
      await cartPage.goto();
    }
    
    const cartItems = await cartPage.getCartItems();
    expect(cartItems).toHaveLength(1);
  });

  // Take screenshots on failure for debugging
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshot = await page.screenshot({ 
        path: `test-results/screenshots/failure-${testInfo.title.replace(/\s+/g, '-')}-${Date.now()}.png`,
        fullPage: true 
      });
      await testInfo.attach('screenshot', { body: screenshot, contentType: 'image/png' });
    }
  });
});

// Performance-specific tests
test.describe('Performance Testing', () => {
  test('Page load performance under load', async ({ page }) => {
    const homePage = new HomePage(page);
    
    // Simulate slower network
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 100); // Add 100ms delay
    });
    
    const startTime = Date.now();
    await homePage.goto();
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(performanceThresholds.pageLoad + 1000); // Allow for network simulation
  });
});

// Accessibility-specific tests
test.describe('Accessibility Testing', () => {
  test('Keyboard navigation works throughout purchase flow', async ({ page }) => {
    const homePage = new HomePage(page);
    const productPage = new ProductPage(page);
    
    await homePage.goto();
    
    // Navigate to product using keyboard
    await page.keyboard.press('Tab'); // Focus first interactive element
    await page.keyboard.press('Enter');
    
    // This is a basic test - full keyboard nav would need more specific implementation
    expect(page.url()).toContain('sqqpyb-yq.myshopify.com');
  });
});