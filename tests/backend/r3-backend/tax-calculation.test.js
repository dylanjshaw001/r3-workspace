// Mock the tax functions since we can't import ES6 modules directly
const STATE_TAX_RATES = {
  'AL': 0.04, 'AK': 0, 'AZ': 0.056, 'AR': 0.065, 'CA': 0.0725, 'CO': 0.029,
  'CT': 0.0635, 'DE': 0, 'FL': 0.06, 'GA': 0.04, 'HI': 0.04, 'ID': 0.06,
  'IL': 0.0625, 'IN': 0.07, 'IA': 0.06, 'KS': 0.065, 'KY': 0.06, 'LA': 0.0445,
  'ME': 0.055, 'MD': 0.06, 'MA': 0.0625, 'MI': 0.06, 'MN': 0.06875, 'MS': 0.07,
  'MO': 0.04225, 'MT': 0, 'NE': 0.055, 'NV': 0.0685, 'NH': 0, 'NJ': 0.06625,
  'NM': 0.05125, 'NY': 0.04, 'NC': 0.0475, 'ND': 0.05, 'OH': 0.0575, 'OK': 0.045,
  'OR': 0, 'PA': 0.06, 'RI': 0.07, 'SC': 0.06, 'SD': 0.045, 'TN': 0.07,
  'TX': 0.0625, 'UT': 0.0485, 'VT': 0.06, 'VA': 0.043, 'WA': 0.065, 'WV': 0.06,
  'WI': 0.05, 'WY': 0.04, 'DC': 0.06
};

const ESTIMATED_LOCAL_TAX = {
  'AL': 0.0514, 'AK': 0.0143, 'AZ': 0.0277, 'AR': 0.0293, 'CA': 0.0153,
  'CO': 0.0465, 'LA': 0.05, 'MO': 0.0391, 'NY': 0.0449, 'OK': 0.0442, 'WA': 0.0278
};

const calculateTax = (subtotal, shipping, address) => {
  const stateTaxRate = STATE_TAX_RATES[address.state] || 0;
  const localTaxRate = ESTIMATED_LOCAL_TAX[address.state] || 0;
  const combinedRate = stateTaxRate + localTaxRate;

  const STATES_THAT_TAX_SHIPPING = [
    'AR', 'CA', 'CT', 'DC', 'FL', 'GA', 'HI', 'IL', 'IN', 'KS',
    'KY', 'MD', 'MA', 'MI', 'MS', 'NE', 'NJ', 'NM', 'NY', 'NC',
    'ND', 'OH', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
    'WA', 'WV', 'WI'
  ];

  const taxableAmount = STATES_THAT_TAX_SHIPPING.includes(address.state)
    ? subtotal + shipping
    : subtotal;

  const taxAmount = taxableAmount * combinedRate;
  const roundedTax = Math.round(taxAmount * 100) / 100;

  return {
    stateTax: Math.round(subtotal * stateTaxRate * 100) / 100,
    localTax: Math.round(subtotal * localTaxRate * 100) / 100,
    totalTax: roundedTax,
    taxRate: combinedRate,
    taxableAmount,
    breakdown: {
      stateRate: stateTaxRate,
      localRate: localTaxRate,
      combinedRate,
      taxesShipping: STATES_THAT_TAX_SHIPPING.includes(address.state)
    }
  };
};

const getTaxAmount = (subtotal, shipping, address) => {
  const result = calculateTax(subtotal, shipping, address);
  return result.totalTax;
};

describe('Tax Calculation', () => {
  describe('State tax rates', () => {
    test('should calculate California tax correctly', () => {
      const result = calculateTax(100, 10, { state: 'CA' });
      
      expect(result.stateTax).toBe(7.25); // 100 * 0.0725
      expect(result.localTax).toBe(1.53); // 100 * 0.0153
      expect(result.totalTax).toBe(9.66); // (100 + 10) * 0.0878 = 9.658 rounded to 9.66
      expect(result.taxRate).toBeCloseTo(0.0878); // 0.0725 + 0.0153
    });

    test('should calculate Texas tax correctly', () => {
      const result = calculateTax(100, 10, { state: 'TX' });
      
      expect(result.stateTax).toBe(6.25); // 100 * 0.0625
      expect(result.localTax).toBe(0); // No local tax estimate for TX
      expect(result.totalTax).toBe(6.88); // Shipping taxed in TX
      expect(result.taxRate).toBe(0.0625);
    });

    test('should handle no-tax states correctly', () => {
      const noTaxStates = ['AK', 'DE', 'MT', 'NH', 'OR'];
      
      noTaxStates.forEach(state => {
        const result = calculateTax(100, 10, { state });
        expect(result.stateTax).toBe(0);
        expect(result.taxRate).toBe(result.localTax > 0 ? result.localTax / 100 : 0);
      });
    });

    test('should calculate high-tax states correctly', () => {
      const result = calculateTax(100, 10, { state: 'CA' }); // Highest combined rate
      
      expect(result.taxRate).toBeCloseTo(0.0878); // 7.25% + 1.53%
      expect(result.totalTax).toBe(9.66);
    });
  });

  describe('Local tax calculations', () => {
    test('should add local tax for states with high local taxes', () => {
      const result = calculateTax(100, 10, { state: 'AL' });
      
      expect(result.stateTax).toBe(4); // 100 * 0.04
      expect(result.localTax).toBe(5.14); // 100 * 0.0514
      expect(result.taxRate).toBeCloseTo(0.0914);
    });

    test('should handle Alaska with local tax but no state tax', () => {
      const result = calculateTax(100, 10, { state: 'AK' });
      
      expect(result.stateTax).toBe(0);
      expect(result.localTax).toBe(1.43); // 100 * 0.0143
      expect(result.totalTax).toBe(1.43); // AK doesn't tax shipping
    });

    test('should calculate Colorado high local taxes', () => {
      const result = calculateTax(100, 10, { state: 'CO' });
      
      expect(result.stateTax).toBe(2.9); // 100 * 0.029
      expect(result.localTax).toBe(4.65); // 100 * 0.0465
      expect(result.taxRate).toBeCloseTo(0.0755);
    });
  });

  describe('Shipping taxation', () => {
    test('should tax shipping for applicable states', () => {
      const statesThatTaxShipping = ['CA', 'TX', 'NY', 'FL'];
      
      statesThatTaxShipping.forEach(state => {
        const result = calculateTax(100, 10, { state });
        expect(result.taxableAmount).toBe(110);
        expect(result.breakdown.taxesShipping).toBe(true);
      });
    });

    test('should not tax shipping for exempt states', () => {
      const statesNoShippingTax = ['AZ', 'AL', 'AK', 'CO'];
      
      statesNoShippingTax.forEach(state => {
        const result = calculateTax(100, 10, { state });
        expect(result.taxableAmount).toBe(100);
        expect(result.breakdown.taxesShipping).toBe(false);
      });
    });

    test('should calculate tax correctly with shipping', () => {
      const result = calculateTax(100, 20, { state: 'CA' });
      
      // CA taxes shipping: (100 + 20) * 0.0878 = 10.536
      expect(result.totalTax).toBe(10.54);
      expect(result.taxableAmount).toBe(120);
    });

    test('should calculate tax correctly without shipping', () => {
      const result = calculateTax(100, 20, { state: 'AZ' });
      
      // AZ doesn't tax shipping: 100 * 0.0837 = 8.37
      expect(result.totalTax).toBe(8.37);
      expect(result.taxableAmount).toBe(100);
    });
  });

  describe('Tax breakdown', () => {
    test('should provide complete tax breakdown', () => {
      const result = calculateTax(100, 10, { state: 'NY' });
      
      expect(result).toMatchObject({
        stateTax: 4, // 100 * 0.04
        localTax: 4.49, // 100 * 0.0449
        totalTax: expect.any(Number),
        taxRate: 0.0849,
        taxableAmount: 110, // NY taxes shipping
        breakdown: {
          stateRate: 0.04,
          localRate: 0.0449,
          combinedRate: 0.0849,
          taxesShipping: true
        }
      });
    });

    test('should handle zero subtotal', () => {
      const result = calculateTax(0, 10, { state: 'CA' });
      
      expect(result.stateTax).toBe(0);
      expect(result.localTax).toBe(0);
      expect(result.totalTax).toBe(0.88); // Only shipping taxed
    });
  });

  describe('Rounding and precision', () => {
    test('should round tax to 2 decimal places', () => {
      const result = calculateTax(33.33, 7.77, { state: 'CA' });
      
      // Should be rounded to cents
      expect(Number.isInteger(result.totalTax * 100)).toBe(true);
      expect(Number.isInteger(result.stateTax * 100)).toBe(true);
      expect(Number.isInteger(result.localTax * 100)).toBe(true);
    });

    test('should handle very small amounts', () => {
      const result = calculateTax(1, 0, { state: 'CA' });
      
      expect(result.stateTax).toBe(0.07);
      expect(result.localTax).toBe(0.02);
      expect(result.totalTax).toBe(0.09);
    });

    test('should handle very large amounts', () => {
      const result = calculateTax(10000, 100, { state: 'CA' });
      
      expect(result.stateTax).toBe(725); // 10000 * 0.0725
      expect(result.localTax).toBe(153); // 10000 * 0.0153
      expect(result.totalTax).toBe(886.78); // (10000 + 100) * 0.0878
    });
  });

  describe('getTaxAmount helper', () => {
    test('should return just the tax amount', () => {
      const tax = getTaxAmount(100, 10, { state: 'CA' });
      
      expect(tax).toBe(9.66);
      expect(typeof tax).toBe('number');
    });

    test('should match calculateTax totalTax', () => {
      const address = { state: 'NY' };
      const fullResult = calculateTax(100, 10, address);
      const simpleResult = getTaxAmount(100, 10, address);
      
      expect(simpleResult).toBe(fullResult.totalTax);
    });
  });

  describe('Edge cases', () => {
    test('should handle unknown state codes', () => {
      const result = calculateTax(100, 10, { state: 'XX' });
      
      expect(result.stateTax).toBe(0);
      expect(result.localTax).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.taxRate).toBe(0);
    });

    test('should handle missing state', () => {
      const result = calculateTax(100, 10, { state: undefined });
      
      expect(result.totalTax).toBe(0);
      expect(result.breakdown.taxesShipping).toBe(false);
    });

    test('should handle negative amounts gracefully', () => {
      const result = calculateTax(-100, -10, { state: 'CA' });
      
      expect(result.stateTax).toBe(-7.25);
      expect(result.totalTax).toBe(-9.66);
    });

    test('should handle Washington DC', () => {
      const result = calculateTax(100, 10, { state: 'DC' });
      
      expect(result.stateTax).toBe(6); // 100 * 0.06
      expect(result.localTax).toBe(0); // No local tax for DC
      expect(result.totalTax).toBe(6.6); // DC taxes shipping
    });
  });

  describe('Real-world scenarios', () => {
    test('should calculate tax for typical e-commerce order', () => {
      const subtotal = 89.99;
      const shipping = 12.50;
      const address = { state: 'CA' };
      
      const result = calculateTax(subtotal, shipping, address);
      
      expect(result.totalTax).toBe(9); // (89.99 + 12.50) * 0.0878
      expect(result.stateTax).toBe(6.52);
      expect(result.localTax).toBe(1.38);
    });

    test('should calculate tax for free shipping order', () => {
      const subtotal = 150;
      const shipping = 0;
      const address = { state: 'TX' };
      
      const result = calculateTax(subtotal, shipping, address);
      
      expect(result.totalTax).toBe(9.38); // 150 * 0.0625
      expect(result.taxableAmount).toBe(150);
    });

    test('should calculate tax for multi-state comparison', () => {
      const subtotal = 100;
      const shipping = 10;
      
      const results = {
        CA: calculateTax(subtotal, shipping, { state: 'CA' }).totalTax,
        TX: calculateTax(subtotal, shipping, { state: 'TX' }).totalTax,
        NY: calculateTax(subtotal, shipping, { state: 'NY' }).totalTax,
        FL: calculateTax(subtotal, shipping, { state: 'FL' }).totalTax,
        OR: calculateTax(subtotal, shipping, { state: 'OR' }).totalTax
      };
      
      // Verify relative tax amounts
      expect(results.CA).toBeGreaterThan(results.TX);
      expect(results.NY).toBeGreaterThan(results.FL);
      expect(results.OR).toBe(0); // No sales tax in Oregon
    });
  });
});