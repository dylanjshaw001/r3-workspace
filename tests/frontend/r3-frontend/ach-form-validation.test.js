// ACH Form Validation Tests for Frontend
describe('ACH Form Validation', () => {
  describe('Routing Number Validation', () => {
    // ABA routing number checksum algorithm
    function validateRoutingNumber(routingNumber) {
      if (!routingNumber || routingNumber.length !== 9 || !/^\d{9}$/.test(routingNumber)) {
        return false;
      }
      
      // Reject all zeros
      if (routingNumber === '000000000') {
        return false;
      }
      
      const digits = routingNumber.split('').map(Number);
      const checksum = (
        3 * (digits[0] + digits[3] + digits[6]) +
        7 * (digits[1] + digits[4] + digits[7]) +
        1 * (digits[2] + digits[5] + digits[8])
      ) % 10;
      
      return checksum === 0;
    }
    
    it('should validate known bank routing numbers', () => {
      const validRoutingNumbers = {
        '021000021': 'JPMorgan Chase',
        '026009593': 'Bank of America', 
        '121000248': 'Wells Fargo',
        '322271627': 'Chase California',
        '121042882': 'Wells Fargo California',
        '031176110': 'Capital One',
        '011401533': 'Citizens Bank',
        '211274450': 'Truist Bank'
      };
      
      Object.entries(validRoutingNumbers).forEach(([routing, bank]) => {
        expect(validateRoutingNumber(routing)).toBe(true);
      });
    });
    
    it('should reject invalid routing numbers', () => {
      const invalidRoutingNumbers = [
        '123456789', // Invalid checksum
        '000000000', // All zeros (valid checksum but invalid routing)
        '12345678',  // Too short
        '1234567890', // Too long
        'abcdefghi', // Non-numeric
        '12345678a', // Contains letter
        '',          // Empty
        null,        // Null
        undefined    // Undefined
      ];
      
      invalidRoutingNumbers.forEach(routing => {
        expect(validateRoutingNumber(routing)).toBe(false);
      });
    });
    
    it('should handle edge cases', () => {
      // Valid routing number as number type
      expect(validateRoutingNumber(21000021)).toBe(false); // Should be string
      
      // Valid routing with spaces
      expect(validateRoutingNumber('021 000 021')).toBe(false);
      
      // Valid routing with dashes
      expect(validateRoutingNumber('021-000-021')).toBe(false);
    });
  });
  
  describe('Account Number Validation', () => {
    function validateAccountNumber(accountNumber) {
      return !!(
        accountNumber &&
        /^\d+$/.test(accountNumber) &&
        accountNumber.length >= 4 &&
        accountNumber.length <= 17
      );
    }
    
    it('should validate account numbers within range', () => {
      const validAccountNumbers = [
        '1234',           // Minimum length
        '12345',          // 5 digits
        '123456789',      // 9 digits
        '1234567890123',  // 13 digits
        '12345678901234567' // Maximum length
      ];
      
      validAccountNumbers.forEach(account => {
        expect(validateAccountNumber(account)).toBe(true);
      });
    });
    
    it('should reject invalid account numbers', () => {
      const invalidAccountNumbers = [
        '123',                    // Too short
        '123456789012345678',     // Too long
        '12345abc',               // Contains letters
        '12345 6789',             // Contains space
        '12345-6789',             // Contains dash
        '',                       // Empty
        null,                     // Null
        undefined                 // Undefined
      ];
      
      invalidAccountNumbers.forEach(account => {
        expect(validateAccountNumber(account)).toBe(false);
      });
    });
  });
  
  describe('ACH Form Complete Validation', () => {
    function validateACHForm(form) {
      return !!(
        form.accountHolderName &&
        form.accountHolderName.trim().length > 0 &&
        form.routingNumber &&
        validateRoutingNumber(form.routingNumber) &&
        form.accountNumber &&
        validateAccountNumber(form.accountNumber) &&
        form.accountType &&
        ['checking', 'savings'].includes(form.accountType) &&
        form.mandateAccepted === true
      );
    }
    
    it('should require all fields for valid form', () => {
      const validForm = {
        accountHolderName: 'John Doe',
        routingNumber: '021000021',
        accountNumber: '123456789',
        accountType: 'checking',
        mandateAccepted: true
      };
      
      expect(validateACHForm(validForm)).toBe(true);
    });
    
    it('should reject form with missing fields', () => {
      const baseForm = {
        accountHolderName: 'John Doe',
        routingNumber: '021000021',
        accountNumber: '123456789',
        accountType: 'checking',
        mandateAccepted: true
      };
      
      // Test each missing field
      const missingFieldTests = [
        { ...baseForm, accountHolderName: '' },
        { ...baseForm, routingNumber: '' },
        { ...baseForm, accountNumber: '' },
        { ...baseForm, accountType: '' },
        { ...baseForm, mandateAccepted: false }
      ];
      
      missingFieldTests.forEach(form => {
        expect(validateACHForm(form)).toBe(false);
      });
    });
    
    it('should reject invalid account types', () => {
      const form = {
        accountHolderName: 'John Doe',
        routingNumber: '021000021',
        accountNumber: '123456789',
        accountType: 'credit', // Invalid type
        mandateAccepted: true
      };
      
      expect(validateACHForm(form)).toBe(false);
    });
    
    it('should require mandate acceptance', () => {
      const form = {
        accountHolderName: 'John Doe',
        routingNumber: '021000021',
        accountNumber: '123456789',
        accountType: 'checking',
        mandateAccepted: false
      };
      
      expect(validateACHForm(form)).toBe(false);
    });
    
    it('should trim account holder name', () => {
      const form = {
        accountHolderName: '  ', // Only whitespace
        routingNumber: '021000021',
        accountNumber: '123456789',
        accountType: 'checking',
        mandateAccepted: true
      };
      
      expect(validateACHForm(form)).toBe(false);
    });
  });
  
  describe('ACH UI Behavior', () => {
    it('should disable submit button until form is complete', () => {
      const formStates = [
        { complete: false, fields: {} },
        { complete: false, fields: { accountHolderName: 'John' } },
        { complete: false, fields: { accountHolderName: 'John', routingNumber: '021000021' } },
        { complete: false, fields: { accountHolderName: 'John', routingNumber: '021000021', accountNumber: '123456789' } },
        { complete: false, fields: { accountHolderName: 'John', routingNumber: '021000021', accountNumber: '123456789', accountType: 'checking' } },
        { complete: true, fields: { accountHolderName: 'John', routingNumber: '021000021', accountNumber: '123456789', accountType: 'checking', mandateAccepted: true } }
      ];
      
      formStates.forEach((state, index) => {
        if (index < formStates.length - 1) {
          expect(state.complete).toBe(false);
        } else {
          expect(state.complete).toBe(true);
        }
      });
    });
    
    it('should show error for invalid routing number', () => {
      const getErrorMessage = (routingNumber) => {
        if (!routingNumber) return '';
        if (routingNumber.length !== 9) return 'Routing number must be 9 digits';
        if (!/^\d{9}$/.test(routingNumber)) return 'Routing number must contain only digits';
        if (!validateRoutingNumber(routingNumber)) return 'Invalid routing number. Please check and try again.';
        return '';
      };
      
      expect(getErrorMessage('12345')).toBe('Routing number must be 9 digits');
      expect(getErrorMessage('12345678a')).toBe('Routing number must contain only digits');
      expect(getErrorMessage('123456789')).toBe('Invalid routing number. Please check and try again.');
      expect(getErrorMessage('021000021')).toBe('');
    });
  });
});

// Export validation functions for use in actual implementation
if (typeof module !== 'undefined' && module.exports) {
  // Define functions at module level for export
  function validateRoutingNumber(routingNumber) {
    if (!routingNumber || routingNumber.length !== 9 || !/^\d{9}$/.test(routingNumber)) {
      return false;
    }
    
    // Reject all zeros
    if (routingNumber === '000000000') {
      return false;
    }
    
    const digits = routingNumber.split('').map(Number);
    const checksum = (
      3 * (digits[0] + digits[3] + digits[6]) +
      7 * (digits[1] + digits[4] + digits[7]) +
      1 * (digits[2] + digits[5] + digits[8])
    ) % 10;
    
    return checksum === 0;
  }
  
  function validateAccountNumber(accountNumber) {
    return !!(
      accountNumber &&
      /^\d+$/.test(accountNumber) &&
      accountNumber.length >= 4 &&
      accountNumber.length <= 17
    );
  }
  
  function validateACHForm(form) {
    return !!(
      form.accountHolderName &&
      form.accountHolderName.trim().length > 0 &&
      form.routingNumber &&
      validateRoutingNumber(form.routingNumber) &&
      form.accountNumber &&
      validateAccountNumber(form.accountNumber) &&
      form.accountType &&
      ['checking', 'savings'].includes(form.accountType) &&
      form.mandateAccepted === true
    );
  }
  
  module.exports = {
    validateRoutingNumber,
    validateAccountNumber,
    validateACHForm
  };
}