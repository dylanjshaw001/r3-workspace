const { test, expect } = require('@playwright/test');
const HomePage = require('../../../../shared/helpers/playwright/page-objects/HomePage');
const ProductPage = require('../../../../shared/helpers/playwright/page-objects/ProductPage');
const CartPage = require('../../../../shared/helpers/playwright/page-objects/CartPage');
const { cartConfig, testProducts, performanceThresholds } = require('../../../../shared/config/shopify-test-env');

/**
 * Cart Management UI Tests
 * 
 * Comprehensive testing of cart UI interactions including:
 * - Cart drawer vs cart page behavior
 * - Real-time quantity updates with 1.5s throttling
 * - Item removal and cart clearing
 * - Visual feedback and animations
 * - Cart count updates
 * - Mixed product type handling (standard + ONEbox)
 */

test.describe('Cart Management UI', () => {
  let homePage;
  let productPage;
  let cartPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    productPage = new ProductPage(page);
    cartPage = new CartPage(page);
  });

  test('Cart Drawer: Opens and displays items correctly', async ({ page }) => {
    // Add item to cart
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.waitForLoad();
    await productPage.setQuantity(2);
    await productPage.addToCart();
    
    // Check if cart drawer opened automatically
    const isDrawerOpen = await productPage.isCartDrawerOpen();
    
    if (isDrawerOpen) {
      // Verify drawer contents
      const cartItems = await cartPage.getCartItems();
      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].quantity).toBe(2);
      
      // Test drawer controls
      await cartPage.updateQuantity(0, 3);
      const updatedItems = await cartPage.getCartItems();
      expect(updatedItems[0].quantity).toBe(3);
    } else {
      // Some themes may not have cart drawer, that's OK
      console.log('Theme does not use cart drawer - skipping drawer-specific tests');
    }
  });

  test('Cart Icon: Updates count in real-time', async ({ page }) => {
    // Start with empty cart
    await homePage.goto();
    const initialCount = await homePage.getCartCount();
    
    // Add first product
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.setQuantity(3);
    await productPage.addToCart();
    
    // Verify cart count updated
    const firstCount = await productPage.getCurrentCartCount();
    expect(firstCount).toBe(initialCount + 3);
    
    // Add second product
    await homePage.navigateToProduct('flex-naloxone-emergency-kit');
    await productPage.setQuantity(5);
    await productPage.addToCart();
    
    // Verify cart count updated again
    const secondCount = await productPage.getCurrentCartCount();
    expect(secondCount).toBe(initialCount + 8); // 3 + 5
    
    // Navigate to homepage and verify count persists
    await homePage.goto();
    const finalCount = await homePage.getCartCount();
    expect(finalCount).toBe(initialCount + 8);
  });

  test('Quantity Updates: Respects 1.5s throttling', async ({ page }) => {
    // Add product to cart
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.addToCart();
    
    // Navigate to cart page
    await cartPage.goto();
    
    // Test rapid quantity changes
    const startTime = Date.now();
    
    // Make rapid changes
    await cartPage.updateQuantity(0, 2);
    await cartPage.updateQuantity(0, 3);
    await cartPage.updateQuantity(0, 4);
    
    const endTime = Date.now();
    const timeTaken = endTime - startTime;
    
    // Should take at least close to the throttling time
    expect(timeTaken).toBeGreaterThan(cartConfig.animations.updateDelay - 200);
    
    // Verify final quantity is correct
    const finalItems = await cartPage.getCartItems();
    expect(finalItems[0].quantity).toBe(4);
  });

  test('Cart Updates: Visual feedback during changes', async ({ page }) => {
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.addToCart();
    await cartPage.goto();
    
    // Monitor for loading states during updates
    await cartPage.updateQuantity(0, 5);
    
    // Check if loading indicators appeared and disappeared
    const loadingElements = await page.$$('.loading, [data-loading], .cart-loading');
    
    // Loading elements should not be visible after update completes
    for (const element of loadingElements) {
      const isVisible = await element.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    }
    
    // Verify update was successful
    const items = await cartPage.getCartItems();
    expect(items[0].quantity).toBe(5);
  });

  test('Item Removal: Single item removal', async ({ page }) => {
    // Add multiple items
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.setQuantity(2);
    await productPage.addToCart();
    
    await homePage.navigateToProduct('flex-naloxone-emergency-kit');
    await productPage.setQuantity(3);
    await productPage.addToCart();
    
    await cartPage.goto();
    
    // Verify both items present
    let cartItems = await cartPage.getCartItems();
    expect(cartItems).toHaveLength(2);
    
    // Remove first item
    await cartPage.removeItem(0);
    
    // Verify one item removed
    cartItems = await cartPage.getCartItems();
    expect(cartItems).toHaveLength(1);
    
    // Verify cart count updated
    const cartCount = await productPage.getCurrentCartCount();
    expect(cartCount).toBe(3); // Should be 3 from remaining item
  });

  test('Cart Clearing: Remove all items', async ({ page }) => {
    // Add multiple items
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.addToCart();
    
    await homePage.navigateToProduct('flex-naloxone-emergency-kit');
    await productPage.addToCart();
    
    await cartPage.goto();
    
    // Verify items are present
    expect(await cartPage.isEmpty()).toBe(false);
    
    // Clear entire cart
    await cartPage.clearCart();
    
    // Verify cart is empty
    expect(await cartPage.isEmpty()).toBe(true);
    
    // Verify cart count is zero
    const cartCount = await productPage.getCurrentCartCount();
    expect(cartCount).toBe(0);
  });

  test('Mixed Products: Standard and ONEbox together', async ({ page }) => {
    // Add standard product
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.setQuantity(2);
    await productPage.addToCart();
    
    // Add ONEbox product
    await homePage.navigateToProduct('flex-naloxone-emergency-kit');
    await productPage.setQuantity(15); // Should trigger case calculation
    await productPage.addToCart();
    
    await cartPage.goto();
    
    // Verify both product types in cart
    const cartItems = await cartPage.getCartItems();
    expect(cartItems).toHaveLength(2);
    
    // Check for different shipping messages
    const shippingMessages = await cartPage.getCartShippingMessage();
    console.log('Shipping messages:', shippingMessages);
    
    // ONEbox products should show calculated shipping
    const hasONEboxProducts = await cartPage.hasONEboxProducts();
    expect(hasONEboxProducts).toBe(true);
    
    // Update quantities and verify shipping updates
    await cartPage.updateQuantity(1, 20); // Increase ONEbox quantity
    
    // Shipping should recalculate
    const updatedShippingMessages = await cartPage.getCartShippingMessage();
    console.log('Updated shipping messages:', updatedShippingMessages);
  });

  test('Quantity Controls: Increase/decrease buttons', async ({ page }) => {
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.addToCart();
    await cartPage.goto();
    
    // Test increase button
    const initialQuantity = await cartPage.getItemQuantity(0);
    await cartPage.increaseQuantity(0);
    
    const increasedQuantity = await cartPage.getItemQuantity(0);
    expect(increasedQuantity).toBe(initialQuantity + 1);
    
    // Test decrease button
    await cartPage.decreaseQuantity(0);
    
    const decreasedQuantity = await cartPage.getItemQuantity(0);
    expect(decreasedQuantity).toBe(initialQuantity);
  });

  test('Cart Totals: Subtotal and shipping calculation', async ({ page }) => {
    // Add standard product (free shipping)
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.setQuantity(1);
    await productPage.addToCart();
    
    await cartPage.goto();
    
    // Get subtotal for standard product
    const standardSubtotal = await cartPage.getSubtotal();
    expect(standardSubtotal).toBeTruthy();
    
    const standardShipping = await cartPage.getShippingCost();
    // Standard products should have free shipping
    if (standardShipping) {
      expect(standardShipping.toLowerCase()).toContain('free');
    }
    
    // Add ONEbox product
    await homePage.navigateToProduct('flex-naloxone-emergency-kit');
    await productPage.setQuantity(10);
    await productPage.addToCart();
    
    await cartPage.goto();
    
    // Shipping should now be calculated due to ONEbox
    const mixedShipping = await cartPage.getShippingCost();
    console.log('Mixed cart shipping:', mixedShipping);
    
    // Verify total updates
    const total = await cartPage.getTotal();
    expect(total).toBeTruthy();
  });

  test('Cart Performance: Update operations within thresholds', async ({ page }) => {
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.addToCart();
    await cartPage.goto();
    
    // Measure quantity update performance
    const updatePerf = await cartPage.measureCartUpdatePerformance(async () => {
      await cartPage.updateQuantity(0, 5);
    });
    
    expect(updatePerf.operationTime).toBeLessThan(performanceThresholds.cartUpdate);
    
    // Measure item removal performance
    const removePerf = await cartPage.measureCartUpdatePerformance(async () => {
      await cartPage.removeItem(0);
    });
    
    expect(removePerf.operationTime).toBeLessThan(performanceThresholds.cartUpdate);
  });

  test('Cart Accessibility: UI elements are accessible', async ({ page }) => {
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.addToCart();
    await cartPage.goto();
    
    // Check cart accessibility
    const accessibilityIssues = await cartPage.checkCartAccessibility();
    expect(accessibilityIssues).toEqual([]);
    
    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Should focus first interactive element
    
    // Test if quantity inputs can be focused and modified via keyboard
    const quantityInput = await page.$('[data-cart-quantity], input[name*="quantity"]');
    if (quantityInput) {
      await quantityInput.focus();
      await page.keyboard.press('Control+A'); // Select all
      await page.keyboard.type('3');
      await page.keyboard.press('Enter');
      
      // Wait for update
      await page.waitForTimeout(cartConfig.animations.updateDelay);
      
      const updatedQuantity = await cartPage.getItemQuantity(0);
      expect(updatedQuantity).toBe(3);
    }
  });

  test('Cart States: Empty cart handling', async ({ page }) => {
    // Start with empty cart
    await cartPage.goto();
    
    // Verify empty state
    expect(await cartPage.isEmpty()).toBe(true);
    
    // Check for empty cart message/UI
    const emptyCartElements = await page.$$('[data-cart-empty], .cart-empty');
    expect(emptyCartElements.length).toBeGreaterThan(0);
    
    // Verify checkout button is not present or disabled in empty state
    const checkoutButton = await page.$('[data-cart-checkout], .cart-checkout');
    if (checkoutButton) {
      const isDisabled = await checkoutButton.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });

  test('Cart Persistence: Items persist across page reloads', async ({ page }) => {
    // Add items to cart
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.setQuantity(2);
    await productPage.addToCart();
    
    await homePage.navigateToProduct('flex-naloxone-emergency-kit');
    await productPage.setQuantity(5);
    await productPage.addToCart();
    
    // Navigate to cart and verify items
    await cartPage.goto();
    const initialItems = await cartPage.getCartItems();
    expect(initialItems).toHaveLength(2);
    
    // Reload page
    await page.reload();
    await cartPage.waitForLoad();
    
    // Verify items are still there
    const persistedItems = await cartPage.getCartItems();
    expect(persistedItems).toHaveLength(2);
    expect(persistedItems[0].quantity).toBe(initialItems[0].quantity);
    expect(persistedItems[1].quantity).toBe(initialItems[1].quantity);
  });

  test('Cart Error Handling: Network failures', async ({ page }) => {
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.addToCart();
    await cartPage.goto();
    
    // Simulate network failure during cart update
    await page.route('**/cart/**', route => {
      route.abort();
    });
    
    // Attempt to update quantity
    try {
      await cartPage.updateQuantity(0, 5);
    } catch (error) {
      // Should handle gracefully
    }
    
    // Remove network simulation
    await page.unroute('**/cart/**');
    
    // Verify cart is still functional
    const items = await cartPage.getCartItems();
    expect(items).toHaveLength(1);
  });

  test('Mobile Cart: Touch interactions', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip('This test only runs on mobile');
    }
    
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    await productPage.addToCart();
    
    // On mobile, cart might behave differently
    const isCartDrawerOpen = await productPage.isCartDrawerOpen();
    
    if (isCartDrawerOpen) {
      // Test mobile cart drawer interactions
      const cartItems = await cartPage.getCartItems();
      expect(cartItems).toHaveLength(1);
      
      // Test swipe to close (if supported)
      // This would need custom implementation based on theme
    } else {
      // Navigate to cart page for mobile
      await cartPage.goto();
      
      // Test touch interactions for quantity updates
      await cartPage.updateQuantity(0, 3);
      
      const items = await cartPage.getCartItems();
      expect(items[0].quantity).toBe(3);
    }
  });

  // Cleanup after each test
  test.afterEach(async ({ page }) => {
    // Clear cart for next test
    try {
      await cartPage.goto();
      if (!(await cartPage.isEmpty())) {
        await cartPage.clearCart();
      }
    } catch (error) {
      // If cart clearing fails, it's not critical for other tests
      console.log('Cart cleanup failed:', error.message);
    }
  });
});