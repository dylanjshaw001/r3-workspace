const { test, expect } = require('@playwright/test');
const HomePage = require('../../../../shared/helpers/playwright/page-objects/HomePage');
const ProductPage = require('../../../../shared/helpers/playwright/page-objects/ProductPage');
const CartPage = require('../../../../shared/helpers/playwright/page-objects/CartPage');
const CheckoutPage = require('../../../../shared/helpers/playwright/page-objects/CheckoutPage');
const { repConfig, testData } = require('../../../../shared/config/shopify-test-env');

/**
 * Rep Parameter Flow Testing
 * 
 * Tests the complete rep parameter tracking system including:
 * - URL parameter detection and storage
 * - Persistence across page navigation
 * - localStorage management
 * - Cart attributes integration
 * - Checkout form inclusion
 * - Order creation with rep data
 */

test.describe('Rep Parameter Flow', () => {
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
  });

  test('Rep Parameter: Initial capture from URL', async ({ page }) => {
    // Listen for console messages before navigation
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    
    // Start with rep parameter in URL
    await homePage.gotoWithRep('test-rep-123');
    
    // Verify rep code was captured and stored
    await homePage.checkRepParameterHandling('test-rep-123');
    
    // Check localStorage directly
    const storedRepCode = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, repConfig.localStorage.repKey);
    
    expect(storedRepCode).toBe('test-rep-123');
    
    // Check if rep info was also stored
    const storedRepInfo = await page.evaluate((key) => {
      const info = localStorage.getItem(key);
      return info ? JSON.parse(info) : null;
    }, repConfig.localStorage.repInfoKey);
    
    if (storedRepInfo) {
      expect(storedRepInfo.code).toBe('test-rep-123');
      expect(storedRepInfo.timestamp).toBeTruthy();
    }
  });

  test('Rep Parameter: Persistence across page navigation', async ({ page }) => {
    const testRepCode = 'navigation-test-rep';
    
    // Start with rep parameter
    await homePage.gotoWithRep(testRepCode);
    
    // Navigate to different pages and verify persistence
    
    // 1. Navigate to product page
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.checkRepParameterPersistence(testRepCode);
    
    // 2. Navigate to another product
    await homePage.navigateToProduct('classic-naloxone-emergency-kit');
    await productPage.checkRepParameterPersistence(testRepCode);
    
    // 3. Navigate to collections/shop page
    await homePage.navigateToProducts();
    
    // Verify rep code still in localStorage
    const storedRepCode = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, repConfig.localStorage.repKey);
    expect(storedRepCode).toBe(testRepCode);
    
    // 4. Navigate back to homepage
    await homePage.goto();
    
    // Rep should still be there
    const finalRepCode = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, repConfig.localStorage.repKey);
    expect(finalRepCode).toBe(testRepCode);
  });

  test('Rep Parameter: Cart integration and attributes', async ({ page }) => {
    const testRepCode = 'cart-integration-rep';
    
    // Start with rep parameter
    await homePage.gotoWithRep(testRepCode);
    
    // Add product to cart
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.addToCart();
    
    // Navigate to cart
    await cartPage.goto();
    
    // Verify rep code is in cart attributes
    await cartPage.verifyRepCodeInCart(testRepCode);
    
    // Add another product to verify rep persists
    await homePage.navigateToProduct('classic-naloxone-emergency-kit');
    await productPage.addToCart();
    
    // Return to cart and verify rep still there
    await cartPage.goto();
    await cartPage.verifyRepCodeInCart(testRepCode);
    
    // Modify cart quantities and verify rep persists
    const cartItems = await cartPage.getCartItems();
    if (cartItems.length > 1) {
      await cartPage.updateQuantity(0, 3);
      await cartPage.verifyRepCodeInCart(testRepCode);
    }
  });

  test('Rep Parameter: Checkout form integration', async ({ page }) => {
    const testRepCode = 'checkout-integration-rep';
    
    // Complete flow with rep parameter
    await homePage.gotoWithRep(testRepCode);
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.addToCart();
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    
    // Verify rep code is present in checkout
    await checkoutPage.verifyRepCodeInCheckout(testRepCode);
    
    // Fill out customer information
    await checkoutPage.fillCustomerInformation(testData.customers[0]);
    await checkoutPage.fillShippingAddress();
    
    // Verify rep code is still there after form interactions
    await checkoutPage.verifyRepCodeInCheckout(testRepCode);
    
    // Fill payment info and submit
    await checkoutPage.fillCardInformation();
    
    // Final verification before submission
    await checkoutPage.verifyRepCodeInCheckout(testRepCode);
  });

  test('Rep Parameter: Complete order with rep tracking', async ({ page }) => {
    const testRepCode = 'order-tracking-rep';
    
    // Complete entire purchase flow
    await homePage.gotoWithRep(testRepCode);
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.setQuantity(2);
    await productPage.addToCart();
    
    await cartPage.goto();
    await cartPage.proceedToCheckout();
    
    // Complete checkout with rep verification
    await checkoutPage.verifyRepCodeInCheckout(testRepCode);
    
    const orderSummary = await checkoutPage.completeFullCheckout(
      testData.customers[0],
      'card'
    );
    
    // Verify order was created successfully
    expect(orderSummary.total).toBeTruthy();
    
    const successMessage = await checkoutPage.getSuccessMessage();
    expect(successMessage).toContain('Order created');
    
    // Note: Actual verification that rep code is in the order would require
    // backend API call or webhook verification, which could be added here
  });

  test('Rep Parameter: URL parameter format variations', async ({ page }) => {
    // Test different ways rep parameter might be passed
    
    // Test 1: Standard rep parameter
    await page.goto(`${await homePage.urls.home}?rep=standard-rep-test`);
    let storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('standard-rep-test');
    
    // Clear localStorage
    await page.evaluate(() => localStorage.clear());
    
    // Test 2: Rep parameter with other query params
    await page.goto(`${await homePage.urls.home}?utm_source=email&rep=multi-param-rep&utm_campaign=test`);
    storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('multi-param-rep');
    
    // Clear localStorage
    await page.evaluate(() => localStorage.clear());
    
    // Test 3: Rep parameter with preview theme
    const urlWithPreview = homePage.urls.home.includes('preview_theme_id') 
      ? `${homePage.urls.home}&rep=preview-rep-test`
      : `${homePage.urls.home}?rep=preview-rep-test&preview_theme_id=123`;
    
    await page.goto(urlWithPreview);
    storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('preview-rep-test');
  });

  test('Rep Parameter: Case sensitivity and special characters', async ({ page }) => {
    // Test different rep code formats
    
    // Test uppercase
    await homePage.gotoWithRep('UPPERCASE-REP');
    let storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('UPPERCASE-REP');
    
    // Clear and test mixed case
    await page.evaluate(() => localStorage.clear());
    await homePage.gotoWithRep('MixedCase-Rep-123');
    storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('MixedCase-Rep-123');
    
    // Clear and test with underscores
    await page.evaluate(() => localStorage.clear());
    await homePage.gotoWithRep('rep_with_underscores');
    storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('rep_with_underscores');
    
    // Clear and test with dots
    await page.evaluate(() => localStorage.clear());
    await homePage.gotoWithRep('rep.with.dots');
    storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('rep.with.dots');
  });

  test('Rep Parameter: Overwrite behavior', async ({ page }) => {
    // Test what happens when a rep parameter is already set and a new one comes in
    
    // Set initial rep
    await homePage.gotoWithRep('first-rep');
    let storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('first-rep');
    
    // Navigate with new rep parameter
    await homePage.gotoWithRep('second-rep');
    storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    
    // Verify behavior - this depends on business rules
    // Common approaches: first wins, last wins, or no overwrite
    expect(storedRep).toBeTruthy(); // At minimum, should have some value
    
    // If business rule is "first rep wins", then:
    // expect(storedRep).toBe('first-rep');
    
    // If business rule is "latest rep wins", then:
    // expect(storedRep).toBe('second-rep');
  });

  test('Rep Parameter: Expiration and cleanup', async ({ page }) => {
    // Test if rep parameter has expiration behavior
    
    await homePage.gotoWithRep('expiration-test-rep');
    
    // Check if rep info includes expiration
    const repInfo = await page.evaluate((key) => {
      const info = localStorage.getItem(key);
      return info ? JSON.parse(info) : null;
    }, repConfig.localStorage.repInfoKey);
    
    if (repInfo && repInfo.expiresAt) {
      expect(repInfo.expiresAt).toBeGreaterThan(Date.now());
    }
    
    // Test cleanup of old rep codes (if implemented)
    // This would involve setting localStorage to simulate old data
    await page.evaluate((keys) => {
      // Simulate old rep data
      const oldRepInfo = {
        repCode: 'old-expired-rep',
        timestamp: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
        expiresAt: Date.now() - (24 * 60 * 60 * 1000) // Expired yesterday
      };
      localStorage.setItem(keys.repInfoKey, JSON.stringify(oldRepInfo));
      localStorage.setItem(keys.repKey, 'old-expired-rep');
    }, repConfig.localStorage);
    
    // Navigate to trigger cleanup
    await homePage.gotoWithRep('new-fresh-rep');
    
    const finalRepCode = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(finalRepCode).toBe('new-fresh-rep'); // Should have cleaned up old and set new
  });

  test('Rep Parameter: Multiple browser sessions', async ({ page, context }) => {
    // Test rep parameter behavior across browser sessions
    
    await homePage.gotoWithRep('session-test-rep');
    let storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('session-test-rep');
    
    // Create new page in same context (same session)
    const newPage = await context.newPage();
    const newHomePage = new HomePage(newPage);
    
    await newHomePage.goto();
    
    // Should have same rep code in new page (same session storage)
    const newPageRep = await newPage.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(newPageRep).toBe('session-test-rep');
    
    await newPage.close();
  });

  test('Rep Parameter: Browser back/forward navigation', async ({ page }) => {
    // Test rep persistence with browser navigation
    
    await homePage.gotoWithRep('nav-test-rep');
    
    // Navigate to product page
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    
    // Go back
    await page.goBack();
    
    // Verify rep still there
    let storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('nav-test-rep');
    
    // Go forward
    await page.goForward();
    
    // Verify rep still there
    storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('nav-test-rep');
  });

  // Performance test for rep parameter handling
  test('Rep Parameter: Performance impact', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate with rep parameter
    await homePage.gotoWithRep('performance-test-rep');
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    // Rep parameter handling should not significantly impact page load time
    expect(loadTime).toBeLessThan(5000); // 5 second max
    
    // Verify rep was still captured
    const storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBe('performance-test-rep');
  });

  // Error handling tests
  test('Rep Parameter: Invalid or malicious values', async ({ page }) => {
    // Test handling of invalid rep parameters
    
    // Empty rep parameter
    await page.goto(`${homePage.urls.home}?rep=`);
    let storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    expect(storedRep).toBeNull(); // Should not store empty rep
    
    // Very long rep parameter
    const longRep = 'x'.repeat(1000);
    await page.goto(`${homePage.urls.home}?rep=${longRep}`);
    storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    
    // Should either reject or truncate
    if (storedRep) {
      expect(storedRep.length).toBeLessThan(1000);
    } else {
      expect(storedRep).toBeNull(); // Rejected long rep
    }
    
    // Rep parameter with script injection attempt
    await page.goto(`${homePage.urls.home}?rep=<script>alert('xss')</script>`);
    storedRep = await page.evaluate((key) => localStorage.getItem(key), repConfig.localStorage.repKey);
    
    // Should sanitize or reject
    if (storedRep) {
      expect(storedRep).not.toContain('<script>');
      expect(storedRep).not.toContain('alert');
    }
  });
});