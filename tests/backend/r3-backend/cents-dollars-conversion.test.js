/**
 * Cents to Dollars Conversion Tests
 * Tests the proper conversion of prices from cents to dollars for Shopify orders
 */

const { getApiUrl, shouldMockPayments } = require('../../shared/helpers/environment');

describe('Cents to Dollars Conversion', () => {
  describe('Webhook Price Conversion', () => {
    it('should convert line item prices from cents to dollars', () => {
      // Test data: prices in cents (as received from frontend)
      const items = [
        { variant_id: '123', quantity: 1, price: 1000 }, // $10.00
        { variant_id: '456', quantity: 2, price: 2500 }, // $25.00
        { variant_id: '789', quantity: 1, price: 999 }   // $9.99
      ];
      
      // Expected conversion (what Shopify expects)
      const expectedPrices = ['10.00', '25.00', '9.99'];
      
      // Simulate the conversion logic from webhook
      const convertedItems = items.map(item => ({
        ...item,
        price: (parseFloat(item.price) / 100).toFixed(2)
      }));
      
      // Verify conversions
      convertedItems.forEach((item, index) => {
        expect(item.price).toBe(expectedPrices[index]);
      });
    });
    
    it('should convert shipping price from cents to dollars', () => {
      // Test various shipping prices in cents
      const shippingPrices = [
        { cents: 500, expected: '5.00' },    // $5.00
        { cents: 1000, expected: '10.00' },  // $10.00
        { cents: 2500, expected: '25.00' },  // $25.00 (ONEbox case)
        { cents: 0, expected: '0.00' }       // Free shipping
      ];
      
      shippingPrices.forEach(({ cents, expected }) => {
        const converted = (parseFloat(cents) / 100).toFixed(2);
        expect(converted).toBe(expected);
      });
    });
    
    it('should convert tax amount from cents to dollars', () => {
      // Test various tax amounts in cents
      const taxAmounts = [
        { cents: 625, expected: '6.25' },   // 6.25% of $100
        { cents: 1875, expected: '18.75' }, // 7.5% of $250
        { cents: 0, expected: '0.00' },     // No tax state
        { cents: 123, expected: '1.23' }    // Small tax amount
      ];
      
      taxAmounts.forEach(({ cents, expected }) => {
        const converted = (parseFloat(cents) / 100).toFixed(2);
        expect(converted).toBe(expected);
      });
    });
    
    it('should handle edge cases in price conversion', () => {
      // Test edge cases
      const edgeCases = [
        { cents: 1, expected: '0.01' },        // One cent
        { cents: 99999, expected: '999.99' },  // Large amount
        { cents: 50, expected: '0.50' },       // Half dollar
        { cents: '1000', expected: '10.00' },  // String input
        { cents: null, expected: '0.00' },     // Null value
        { cents: undefined, expected: '0.00' } // Undefined value
      ];
      
      edgeCases.forEach(({ cents, expected }) => {
        const value = cents || 0;
        const converted = (parseFloat(value) / 100).toFixed(2);
        expect(converted).toBe(expected);
      });
    });
  });
  
  describe('Order Total Calculations', () => {
    it('should calculate correct total with all components', () => {
      // Simulate order with items, shipping, and tax (all in cents)
      const order = {
        items: [
          { price: 1000, quantity: 2 }, // $20.00
          { price: 2500, quantity: 1 }  // $25.00
        ],
        shipping_price: 1000, // $10.00
        tax_amount: 550       // $5.50
      };
      
      // Calculate subtotal
      const subtotalCents = order.items.reduce(
        (sum, item) => sum + (item.price * item.quantity), 
        0
      );
      const subtotal = subtotalCents / 100; // $45.00
      
      // Convert to dollars
      const shipping = order.shipping_price / 100; // $10.00
      const tax = order.tax_amount / 100;          // $5.50
      
      // Calculate total
      const total = subtotal + shipping + tax;
      
      expect(subtotal).toBe(45.00);
      expect(shipping).toBe(10.00);
      expect(tax).toBe(5.50);
      expect(total).toBe(60.50);
      expect(total.toFixed(2)).toBe('60.50');
    });
    
    it('should match Stripe payment intent amount', () => {
      // Stripe sends amount in cents
      const stripeAmount = 6050; // $60.50 in cents
      
      // Convert for Shopify transaction
      const shopifyAmount = (stripeAmount / 100).toFixed(2);
      
      expect(shopifyAmount).toBe('60.50');
    });
  });
  
  describe('Environment-Specific Conversion', () => {
    it('should handle conversions consistently across environments', () => {
      const env = process.env.NODE_ENV || 'development';
      
      // All environments should convert the same way
      const testAmount = 12345; // $123.45 in cents
      const expected = '123.45';
      
      const converted = (parseFloat(testAmount) / 100).toFixed(2);
      
      expect(converted).toBe(expected);
      
      // Log for visibility
      console.log(`Environment: ${env}, Conversion: ${testAmount} cents → $${converted}`);
    });
  });
});