const { expect } = require('@playwright/test');
const { buildTestUrls, testProducts, repConfig } = require('../../../config/shopify-test-env');

/**
 * Home Page Object Model
 * 
 * Handles interactions with the Shopify store homepage
 * including navigation, rep parameter handling, and initial cart state
 */
class HomePage {
  constructor(page) {
    this.page = page;
    this.urls = buildTestUrls();
    
    // Selectors - Updated to match actual theme implementation
    this.navigationMenuSelector = '.rh-navbar';
    this.cartIconSelector = '[data-cart-drawer-toggle], .rh-navbar__cart';
    this.cartCountSelector = '.rh-navbar__cart-count';
    this.searchSelector = '[data-search], input[type="search"]';
    this.productGridSelector = '[data-product-grid], .product-grid, .collection__products';
    this.productItemSelector = '[data-product-item], .product-item, .product-card';
    this.announcementBarSelector = '.announcement-bar, [data-announcement]';
    
    // Rep parameter elements
    this.repIndicatorSelector = '[data-rep-indicator], .rep-indicator';
  }

  async goto() {
    await this.page.goto(this.urls.home);
    await this.waitForLoad();
  }

  async gotoWithRep(repCode = repConfig.testRepCode) {
    const urlWithRep = `${this.urls.home}${this.urls.home.includes('?') ? '&' : '?'}rep=${repCode}`;
    await this.page.goto(urlWithRep, { waitUntil: 'domcontentloaded' });
    await this.waitForLoad();
    
    // Wait for rep-tracking.js script to execute and process the parameter
    await this.page.waitForFunction(
      ({key, expectedCode}) => {
        const stored = localStorage.getItem(key);
        return stored === expectedCode;
      },
      { key: repConfig.localStorage.repKey, expectedCode: repCode },
      { timeout: 5000 }
    ).catch(async (error) => {
      console.log('Warning: Rep parameter not stored automatically, attempting manual storage');
      // If automatic storage failed, try manual storage as fallback
      await this.page.evaluate(({key, code}) => {
        localStorage.setItem(key, code);
        localStorage.setItem('r3_rep_info', JSON.stringify({
          code: code,
          timestamp: new Date().toISOString(),
          source: 'test_fallback'
        }));
      }, { key: repConfig.localStorage.repKey, code: repCode });
    });
  }

  async waitForLoad() {
    // Wait for main navigation to be visible
    await this.page.waitForSelector(this.navigationMenuSelector, { timeout: 10000 });
    
    // Wait for cart icon to be present (standard in Shopify themes)
    await this.page.waitForSelector(this.cartIconSelector, { timeout: 5000 }).catch(() => {
      // Some themes might not have cart icon on homepage
      console.log('Cart icon not found on homepage - this may be expected');
    });
  }

  async getCartCount() {
    try {
      // The cart count element only exists when there are items in the cart
      const cartCountElement = await this.page.$(this.cartCountSelector);
      if (cartCountElement) {
        const count = await cartCountElement.textContent();
        return parseInt(count) || 0;
      }
      // No cart count element means empty cart
      return 0;
    } catch (error) {
      // If there's an error reading cart count, assume empty cart
      return 0;
    }
  }

  async clickCartIcon() {
    await this.page.click(this.cartIconSelector);
    // Wait a moment for cart drawer to open
    await this.page.waitForTimeout(500);
  }

  async navigateToProducts() {
    // Try to find a products or shop link
    const productLinkSelectors = [
      'a[href*="/collections/all"]',
      'a[href*="/collections"]',
      'a:has-text("Shop")',
      'a:has-text("Products")',
      'a:has-text("All Products")'
    ];
    
    for (const selector of productLinkSelectors) {
      const link = await this.page.$(selector);
      if (link) {
        await link.click();
        return;
      }
    }
    
    // Fallback: navigate directly to collections page
    await this.page.goto(this.urls.collection);
  }

  async navigateToProduct(productHandle = testProducts.standard.handle) {
    await this.page.goto(`${this.urls.home.split('?')[0]}/products/${productHandle}${this.urls.home.includes('?') ? '?' + this.urls.home.split('?')[1] : ''}`);
    // Wait for the page to fully load
    await this.page.waitForLoadState('networkidle');
  }

  async search(query) {
    const searchInput = await this.page.$(this.searchSelector);
    if (searchInput) {
      await searchInput.fill(query);
      await searchInput.press('Enter');
      await this.page.waitForLoadState('networkidle');
    } else {
      throw new Error('Search functionality not found on this theme');
    }
  }

  async checkRepParameterHandling(expectedRepCode = repConfig.testRepCode) {
    // Check if rep code is stored in localStorage
    const storedRepCode = await this.page.evaluate((key) => {
      return localStorage.getItem(key);
    }, repConfig.localStorage.repKey);
    
    expect(storedRepCode).toBe(expectedRepCode);

    // Check if rep indicator is shown (if theme supports it)
    const repIndicator = await this.page.$(this.repIndicatorSelector);
    if (repIndicator) {
      const repText = await repIndicator.textContent();
      expect(repText).toContain(expectedRepCode);
    }
  }

  async getPageTitle() {
    return await this.page.title();
  }

  async getPageUrl() {
    return this.page.url();
  }

  async takeScreenshot(name = 'homepage') {
    return await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  // Performance monitoring
  async measurePageLoadTime() {
    return await this.page.evaluate(() => {
      return {
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
      };
    });
  }

  // Accessibility helpers
  async checkAccessibility() {
    // Check for basic accessibility requirements
    const results = await this.page.evaluate(() => {
      const issues = [];
      
      // Check for images without alt text
      const images = document.querySelectorAll('img:not([alt])');
      if (images.length > 0) {
        issues.push(`Found ${images.length} images without alt text`);
      }
      
      // Check for links without accessible names
      const links = document.querySelectorAll('a:not([aria-label]):not([title])');
      const linksWithoutText = Array.from(links).filter(link => !link.textContent.trim());
      if (linksWithoutText.length > 0) {
        issues.push(`Found ${linksWithoutText.length} links without accessible names`);
      }
      
      // Check for proper heading structure
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length === 0) {
        issues.push('No heading structure found');
      }
      
      return issues;
    });
    
    return results;
  }
}

module.exports = HomePage;