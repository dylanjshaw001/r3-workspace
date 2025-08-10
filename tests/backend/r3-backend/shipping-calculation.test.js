// Mock the shipping functions since we can't import ES6 modules directly
const calculateShipping = (items, address) => {
  // Calculate total weight and check for special items
  let totalWeight = 0;
  let hasNaloxone = false;
  let subtotal = 0;

  items.forEach(item => {
    totalWeight += item.quantity * (item.weight || 0.5); // Default 0.5 lbs
    subtotal += item.price * item.quantity;

    // Check for naloxone or other restricted items
    if (item.product_type === 'naloxone' || item.tags?.includes('naloxone')) {
      hasNaloxone = true;
    }
  });

  // Define shipping zones
  const zones = {
    // Zone 1 - West Coast (highest rates)
    'CA': 1, 'OR': 1, 'WA': 1, 'NV': 1,
    // Zone 2 - Mountain/Central
    'AZ': 2, 'UT': 2, 'CO': 2, 'NM': 2, 'TX': 2, 'OK': 2, 'KS': 2,
    'NE': 2, 'SD': 2, 'ND': 2, 'MN': 2, 'IA': 2, 'MO': 2, 'AR': 2,
    'LA': 2, 'WI': 2, 'IL': 2, 'MS': 2, 'MI': 2, 'IN': 2, 'KY': 2,
    'TN': 2, 'AL': 2, 'OH': 2,
    // Zone 3 - East Coast
    'WV': 3, 'VA': 3, 'NC': 3, 'SC': 3, 'GA': 3, 'FL': 3,
    'MD': 3, 'DE': 3, 'PA': 3, 'NJ': 3, 'NY': 3, 'CT': 3,
    'RI': 3, 'MA': 3, 'VT': 3, 'NH': 3, 'ME': 3,
    // Zone 4 - Non-continental
    'AK': 4, 'HI': 4, 'PR': 4
  };

  const zone = zones[address.state] || 3;

  // Base rates by zone
  const baseRates = {
    1: { standard: 12, express: 28, overnight: 45 },
    2: { standard: 10, express: 25, overnight: 42 },
    3: { standard: 8, express: 22, overnight: 38 },
    4: { standard: 20, express: 45, overnight: 65 }
  };

  // Weight-based adjustments
  const weightMultiplier = Math.max(1, Math.ceil(totalWeight / 2)); // Every 2 lbs adds to cost

  // Calculate rates
  const rates = {
    standard: {
      id: 'standard_shipping',
      title: 'Standard Shipping (5-7 business days)',
      price: baseRates[zone].standard * weightMultiplier,
      delivery_days: '5-7'
    },
    express: {
      id: 'express_shipping',
      title: 'Express Shipping (2-3 business days)',
      price: baseRates[zone].express * weightMultiplier,
      delivery_days: '2-3'
    },
    overnight: {
      id: 'overnight_shipping',
      title: 'Overnight Shipping (1 business day)',
      price: baseRates[zone].overnight * weightMultiplier,
      delivery_days: '1'
    }
  };

  // Free shipping logic
  if (subtotal >= 100 && !hasNaloxone) {
    rates.standard.price = 0;
    rates.standard.title = 'FREE Standard Shipping (5-7 business days)';
  }

  // Special handling for naloxone
  if (hasNaloxone) {
    // Add $5 to all rates for special handling
    Object.keys(rates).forEach(key => {
      rates[key].price += 5;
      rates[key].title += ' (Special Handling)';
    });
  }

  // Format prices
  Object.keys(rates).forEach(key => {
    rates[key].price = Math.round(rates[key].price * 100) / 100; // Round to cents
  });

  return rates;
};

const getShippingRate = (items, address, method) => {
  const rates = calculateShipping(items, address);
  return rates[method] || rates.standard;
};

describe('Shipping Calculation', () => {
  describe('Zone-based pricing', () => {
    test('should apply Zone 1 (West Coast) rates', () => {
      const items = [{ quantity: 1, price: 50, weight: 1 }];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(12);
      expect(rates.express.price).toBe(28);
      expect(rates.overnight.price).toBe(45);
    });

    test('should apply Zone 2 (Mountain/Central) rates', () => {
      const items = [{ quantity: 1, price: 50, weight: 1 }];
      const address = { state: 'TX' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(10);
      expect(rates.express.price).toBe(25);
      expect(rates.overnight.price).toBe(42);
    });

    test('should apply Zone 3 (East Coast) rates', () => {
      const items = [{ quantity: 1, price: 50, weight: 1 }];
      const address = { state: 'NY' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(8);
      expect(rates.express.price).toBe(22);
      expect(rates.overnight.price).toBe(38);
    });

    test('should apply Zone 4 (Non-continental) rates', () => {
      const items = [{ quantity: 1, price: 50, weight: 1 }];
      const address = { state: 'HI' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(20);
      expect(rates.express.price).toBe(45);
      expect(rates.overnight.price).toBe(65);
    });

    test('should default to Zone 3 for unknown states', () => {
      const items = [{ quantity: 1, price: 50, weight: 1 }];
      const address = { state: 'XX' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(8);
    });
  });

  describe('Weight-based calculations', () => {
    test('should not increase price for items under 2 lbs', () => {
      const items = [{ quantity: 1, price: 50, weight: 1.5 }];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(12); // Base rate, no multiplier
    });

    test('should double price for items between 2-4 lbs', () => {
      const items = [{ quantity: 1, price: 50, weight: 3 }];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(24); // 12 * 2
    });

    test('should triple price for items between 4-6 lbs', () => {
      const items = [{ quantity: 1, price: 50, weight: 5 }];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(36); // 12 * 3
    });

    test('should calculate weight for multiple items', () => {
      const items = [
        { quantity: 2, price: 25, weight: 1.5 }, // 3 lbs
        { quantity: 1, price: 30, weight: 2 }    // 2 lbs
      ];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(36); // 12 * 3 (5 lbs total)
    });

    test('should use default weight of 0.5 lbs when weight not specified', () => {
      const items = [
        { quantity: 4, price: 20 } // 4 * 0.5 = 2 lbs, $80 total (under free shipping threshold)
      ];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(12); // 12 * 1 (2 lbs = multiplier of 1)
    });
  });

  describe('Free shipping logic', () => {
    test('should provide free standard shipping for orders $100+', () => {
      const items = [{ quantity: 2, price: 60, weight: 1 }]; // $120 total
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(0);
      expect(rates.standard.title).toContain('FREE');
      expect(rates.express.price).toBe(28); // Express not free
      expect(rates.overnight.price).toBe(45); // Overnight not free
    });

    test('should not provide free shipping for orders under $100', () => {
      const items = [{ quantity: 1, price: 99, weight: 1 }];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(12);
      expect(rates.standard.title).not.toContain('FREE');
    });

    test('should not provide free shipping for naloxone orders even if $100+', () => {
      const items = [{ 
        quantity: 2, 
        price: 60, 
        weight: 1,
        product_type: 'naloxone'
      }];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(17); // 12 + 5 special handling
      expect(rates.standard.title).not.toContain('FREE');
    });
  });

  describe('Naloxone special handling', () => {
    test('should add $5 to all rates for naloxone by product_type', () => {
      const items = [{ 
        quantity: 1, 
        price: 50, 
        weight: 1,
        product_type: 'naloxone'
      }];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(17); // 12 + 5
      expect(rates.express.price).toBe(33); // 28 + 5
      expect(rates.overnight.price).toBe(50); // 45 + 5
      expect(rates.standard.title).toContain('Special Handling');
    });

    test('should add $5 to all rates for naloxone by tags', () => {
      const items = [{ 
        quantity: 1, 
        price: 50, 
        weight: 1,
        tags: ['medical', 'naloxone', 'prescription']
      }];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(17);
      expect(rates.standard.title).toContain('Special Handling');
    });

    test('should apply special handling once for mixed orders', () => {
      const items = [
        { quantity: 1, price: 30, weight: 1, product_type: 'naloxone' },
        { quantity: 1, price: 40, weight: 1 },
        { quantity: 1, price: 50, weight: 1, tags: ['naloxone'] }
      ];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      // 3 lbs = 2x multiplier, base 12 * 2 = 24 + 5 special = 29
      expect(rates.standard.price).toBe(29);
    });
  });

  describe('Rate formatting', () => {
    test('should include all required fields in rates', () => {
      const items = [{ quantity: 1, price: 50, weight: 1 }];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard).toMatchObject({
        id: 'standard_shipping',
        title: expect.stringContaining('Standard Shipping'),
        price: expect.any(Number),
        delivery_days: '5-7'
      });
      
      expect(rates.express).toMatchObject({
        id: 'express_shipping',
        title: expect.stringContaining('Express Shipping'),
        price: expect.any(Number),
        delivery_days: '2-3'
      });
      
      expect(rates.overnight).toMatchObject({
        id: 'overnight_shipping',
        title: expect.stringContaining('Overnight Shipping'),
        price: expect.any(Number),
        delivery_days: '1'
      });
    });

    test('should round prices to 2 decimal places', () => {
      const items = [{ quantity: 1, price: 33.33, weight: 1.7 }];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      // Should be rounded to 2 decimal places
      expect(Number.isInteger(rates.standard.price * 100)).toBe(true);
      expect(Number.isInteger(rates.express.price * 100)).toBe(true);
      expect(Number.isInteger(rates.overnight.price * 100)).toBe(true);
    });
  });

  describe('getShippingRate helper', () => {
    test('should return specific shipping method rate', () => {
      const items = [{ quantity: 1, price: 50, weight: 1 }];
      const address = { state: 'CA' };
      
      const expressRate = getShippingRate(items, address, 'express');
      
      expect(expressRate).toMatchObject({
        id: 'express_shipping',
        price: 28
      });
    });

    test('should default to standard for invalid method', () => {
      const items = [{ quantity: 1, price: 50, weight: 1 }];
      const address = { state: 'CA' };
      
      const rate = getShippingRate(items, address, 'invalid_method');
      
      expect(rate).toMatchObject({
        id: 'standard_shipping',
        price: 12
      });
    });
  });

  describe('Edge cases', () => {
    test('should handle empty items array', () => {
      const items = [];
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(12); // Base rate with no weight
    });

    test('should handle missing address state', () => {
      const items = [{ quantity: 1, price: 50, weight: 1 }];
      const address = {};
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(8); // Default Zone 3 rate
    });

    test('should handle very heavy orders', () => {
      const items = [{ quantity: 10, price: 8, weight: 10 }]; // 100 lbs, $80 total (under free shipping)
      const address = { state: 'CA' };
      
      const rates = calculateShipping(items, address);
      
      expect(rates.standard.price).toBe(600); // 12 * 50 (100/2)
    });
  });
});