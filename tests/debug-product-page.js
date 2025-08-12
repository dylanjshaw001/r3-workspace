const { chromium } = require('@playwright/test');
const HomePage = require('./shared/helpers/playwright/page-objects/HomePage');

async function debugProductPage() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    const homePage = new HomePage(page);
    
    console.log('🔍 Navigating to product page...');
    await homePage.navigateToProduct('fentanyl-test-strip-kit');
    
    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'debug-product-page.png' });
    
    console.log('🔍 Looking for add to cart button...');
    const buttons = await page.$$('button');
    console.log(`Found ${buttons.length} button elements`);
    
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const className = await button.getAttribute('class');
      const dataAddToCart = await button.getAttribute('data-add-to-cart');
      const name = await button.getAttribute('name');
      const type = await button.getAttribute('type');
      
      console.log(`Button ${i + 1}:`);
      console.log(`  Text: "${text}"`);
      console.log(`  Class: "${className}"`);
      console.log(`  data-add-to-cart: "${dataAddToCart}"`);
      console.log(`  name: "${name}"`);
      console.log(`  type: "${type}"`);
      console.log('---');
    }
    
    console.log('🔍 Checking page URL...');
    console.log(`Current URL: ${page.url()}`);
    
    console.log('✅ Debug complete. Check debug-product-page.png for screenshot.');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await browser.close();
  }
}

debugProductPage();