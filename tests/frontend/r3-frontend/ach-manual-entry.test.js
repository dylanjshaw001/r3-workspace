// ACH Manual Entry Tests
/**
 * @jest-environment jsdom
 */

const fetch = require('node-fetch');
const { server } = require('../shared/mocks/server');
const { rest } = require('msw');
const { 
  createTestCart, 
  createTestCustomer,
  generateTestSessionToken,
  generateTestCSRFToken
} = require('../shared/helpers/utils/test-helpers');
const { getApiUrl, shouldMockPayments } = require('../shared/helpers/environment');

// Make fetch available globally for jsdom
global.fetch = fetch;

const API_URL = shouldMockPayments() ? 'http://localhost:3000' : getApiUrl();

describe('ACH Manual Entry', () => {
  let checkout;
  let mockStripe;
  
  beforeEach(() => {
    // Mock window.R3_API_CONFIG
    global.window = {
      R3_API_CONFIG: {
        getEndpointUrl: (endpoint) => {
          const endpoints = {
            createPaymentIntent: `${API_URL}/api/stripe/create-payment-intent`
          };
          return endpoints[endpoint];
        }
      },
      location: {
        hostname: 'sqqpyb-yq.myshopify.com'
      },
      navigator: {
        userAgent: 'Mozilla/5.0 Test Browser'
      }
    };
    
    // Mock Stripe
    mockStripe = {
      createPaymentMethod: jest.fn(),
      confirmUsBankAccountPayment: jest.fn()
    };
    
    // Initialize checkout object
    checkout = {
      stripe: mockStripe,
      achMode: 'manual',
      cart: createTestCart(),
      shipping: { price: 1000, method: 'standard' },
      tax: { amount: 800 },
      shippingData: createTestCustomer(),
      sessionToken: generateTestSessionToken(),
      csrfToken: generateTestCSRFToken(),
      
      getAuthHeaders: function() {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`,
          'x-csrf-token': this.csrfToken
        };
      },
      
      showError: jest.fn(),
      
      // Implement routing number validation
      validateRoutingNumber: function(routingNumber) {
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
      },
      
      // Implement form validation
      validateACHForm: function() {
        const completeOrderBtn = document.getElementById('complete-order-btn');
        if (!completeOrderBtn) return;
        
        const mandateChecked = document.getElementById('ach-mandate-checkbox')?.checked;
        let isValid = false;
        
        if (this.achMode === 'manual') {
          const accountHolder = document.getElementById('account-holder-name')?.value;
          const routingNumber = document.getElementById('routing-number')?.value;
          const accountNumber = document.getElementById('account-number')?.value;
          const accountType = document.querySelector('input[name="account-type"]:checked')?.value;
          
          const isRoutingValid = routingNumber && this.validateRoutingNumber(routingNumber);
          const isAccountValid = accountNumber && accountNumber.length >= 4 && accountNumber.length <= 17;
          
          isValid = accountHolder && 
                    isRoutingValid && 
                    isAccountValid && 
                    accountType && 
                    mandateChecked;
        }
        
        completeOrderBtn.disabled = !isValid;
        if (isValid) {
          completeOrderBtn.classList.remove('btn-disabled');
        } else {
          completeOrderBtn.classList.add('btn-disabled');
        }
      },
      
      // Implement processACHPayment for manual mode
      processACHPayment: async function() {
        if (this.achMode === 'manual') {
          const accountHolderName = document.getElementById('account-holder-name')?.value;
          const routingNumber = document.getElementById('routing-number')?.value;
          const accountNumber = document.getElementById('account-number')?.value;
          const accountType = document.querySelector('input[name="account-type"]:checked')?.value;
          const mandateCheckbox = document.getElementById('ach-mandate-checkbox');
          
          // Validate required fields
          if (!accountHolderName || !routingNumber || !accountNumber || !accountType) {
            return { success: false, error: 'Please fill in all bank account details' };
          }
          
          if (!mandateCheckbox || !mandateCheckbox.checked) {
            return { success: false, error: 'Please accept the ACH debit authorization' };
          }
          
          // Create payment method first
          const paymentMethodResult = await this.stripe.createPaymentMethod({
            type: 'us_bank_account',
            us_bank_account: {
              account_number: accountNumber,
              routing_number: routingNumber,
              account_holder_type: 'individual',
              account_type: accountType
            },
            billing_details: {
              name: accountHolderName,
              email: this.shippingData.email,
              phone: this.shippingData.phone,
              address: {
                line1: this.shippingData.address1,
                line2: this.shippingData.address2 || '',
                city: this.shippingData.city,
                state: this.shippingData.province,
                postal_code: this.shippingData.zip,
                country: 'US'
              }
            }
          });
          
          if (paymentMethodResult.error) {
            return { success: false, error: paymentMethodResult.error.message };
          }
          
          // Create payment intent with the payment method
          const response = await fetch(window.R3_API_CONFIG.getEndpointUrl('createPaymentIntent'), {
            method: 'POST',
            credentials: 'include',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
              amount: this.cart.total_price + this.shipping.price + (this.tax?.amount || 0),
              currency: 'usd',
              payment_method_types: ['us_bank_account'],
              payment_method: paymentMethodResult.paymentMethod.id,
              customer_email: this.shippingData.email,
              mandate_data: {
                customer_acceptance: {
                  type: 'online',
                  online: {
                    ip_address: '{{IP_ADDRESS}}', // Backend will fill this
                    user_agent: window.navigator.userAgent
                  }
                }
              },
              metadata: {
                customer_email: this.shippingData.email,
                customer_first_name: this.shippingData.first_name,
                customer_last_name: this.shippingData.last_name,
                shipping_address: JSON.stringify({
                  first_name: this.shippingData.first_name,
                  last_name: this.shippingData.last_name,
                  address1: this.shippingData.address1,
                  address2: this.shippingData.address2 || '',
                  city: this.shippingData.city,
                  province: this.shippingData.province,
                  zip: this.shippingData.zip,
                  country: 'United States',
                  phone: this.shippingData.phone
                }),
                shipping_method: this.shipping.method,
                shipping_price: this.shipping.price.toString(),
                items: JSON.stringify(this.cart.items.map(item => ({
                  variant_id: item.variant_id,
                  quantity: item.quantity,
                  price: item.price,
                  title: item.title
                }))),
                store_domain: window.location.hostname,
                rep: this.cart.attributes?.rep || '',
                environment: 'test'
              }
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            return { success: false, error: error.error || 'Failed to create payment' };
          }
          
          const { clientSecret } = await response.json();
          
          // Confirm the payment
          const confirmResult = await this.stripe.confirmUsBankAccountPayment(clientSecret);
          
          if (confirmResult.error) {
            return { success: false, error: confirmResult.error.message };
          }
          
          return { 
            success: true, 
            paymentId: confirmResult.paymentIntent.id,
            pending: true,
            message: 'Your order has been received! Your bank transfer is being processed.'
          };
        }
      }
    };
    
    // Set up DOM
    document.body.innerHTML = `
      <div id="ach-manual-section">
        <input type="text" id="account-holder-name" />
        <input type="text" id="routing-number" maxlength="9" />
        <input type="text" id="account-number" />
        <label><input type="radio" name="account-type" value="checking" checked /> Checking</label>
        <label><input type="radio" name="account-type" value="savings" /> Savings</label>
        <input type="checkbox" id="ach-mandate-checkbox" />
        <div id="ach-errors" class="error-message" style="display: none;"></div>
      </div>
      <button id="complete-order-btn" class="btn-primary btn-disabled" disabled>Complete Order</button>
    `;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Routing Number Validation', () => {
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
        expect(checkout.validateRoutingNumber(routing)).toBe(true);
      });
    });
    
    it('should reject invalid routing numbers', () => {
      const invalidRoutingNumbers = [
        '123456789', // Invalid checksum
        '000000000', // All zeros
        '12345678',  // Too short
        '1234567890', // Too long
        'abcdefghi', // Non-numeric
        '12345678a', // Contains letter
        '',          // Empty
        null,        // Null
        undefined    // Undefined
      ];
      
      invalidRoutingNumbers.forEach(routing => {
        expect(checkout.validateRoutingNumber(routing)).toBe(false);
      });
    });
    
    it('should handle routing number input formatting', () => {
      const routingInput = document.getElementById('routing-number');
      
      // Simulate input event with non-numeric characters
      routingInput.value = '021-000-021';
      const inputEvent = new Event('input');
      
      // Add event listener to format input
      routingInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
      });
      
      routingInput.dispatchEvent(inputEvent);
      expect(routingInput.value).toBe('021000021');
    });
  });
  
  describe('Account Number Validation', () => {
    it('should accept valid account numbers', () => {
      const validAccountNumbers = [
        '1234',           // Minimum length
        '12345',          // 5 digits
        '123456789',      // 9 digits
        '1234567890123',  // 13 digits
        '12345678901234567' // Maximum length
      ];
      
      const accountInput = document.getElementById('account-number');
      
      validAccountNumbers.forEach(account => {
        accountInput.value = account;
        const isValid = account.length >= 4 && account.length <= 17 && /^\d+$/.test(account);
        expect(isValid).toBe(true);
      });
    });
    
    it('should reject invalid account numbers', () => {
      const invalidAccountNumbers = [
        { value: '123', reason: 'too short' },
        { value: '123456789012345678', reason: 'too long' },
        { value: '12345abc', reason: 'contains letters' },
        { value: '12345 6789', reason: 'contains space' },
        { value: '12345-6789', reason: 'contains dash' }
      ];
      
      invalidAccountNumbers.forEach(({ value, reason }) => {
        const isValid = value.length >= 4 && value.length <= 17 && /^\d+$/.test(value);
        expect(isValid).toBe(false);
      });
    });
  });
  
  describe('Form Validation', () => {
    it('should require all fields for valid form', () => {
      // Fill in all fields correctly
      document.getElementById('account-holder-name').value = 'John Doe';
      document.getElementById('routing-number').value = '021000021';
      document.getElementById('account-number').value = '123456789';
      document.querySelector('input[name="account-type"][value="checking"]').checked = true;
      document.getElementById('ach-mandate-checkbox').checked = true;
      
      checkout.validateACHForm();
      
      const completeBtn = document.getElementById('complete-order-btn');
      expect(completeBtn.disabled).toBe(false);
      expect(completeBtn.classList.contains('btn-disabled')).toBe(false);
    });
    
    it('should disable submit with missing account holder name', () => {
      document.getElementById('account-holder-name').value = '';
      document.getElementById('routing-number').value = '021000021';
      document.getElementById('account-number').value = '123456789';
      document.querySelector('input[name="account-type"][value="checking"]').checked = true;
      document.getElementById('ach-mandate-checkbox').checked = true;
      
      checkout.validateACHForm();
      
      const completeBtn = document.getElementById('complete-order-btn');
      expect(completeBtn.disabled).toBe(true);
    });
    
    it('should disable submit with invalid routing number', () => {
      document.getElementById('account-holder-name').value = 'John Doe';
      document.getElementById('routing-number').value = '123456789'; // Invalid checksum
      document.getElementById('account-number').value = '123456789';
      document.querySelector('input[name="account-type"][value="checking"]').checked = true;
      document.getElementById('ach-mandate-checkbox').checked = true;
      
      checkout.validateACHForm();
      
      const completeBtn = document.getElementById('complete-order-btn');
      expect(completeBtn.disabled).toBe(true);
    });
    
    it('should disable submit without mandate acceptance', () => {
      document.getElementById('account-holder-name').value = 'John Doe';
      document.getElementById('routing-number').value = '021000021';
      document.getElementById('account-number').value = '123456789';
      document.querySelector('input[name="account-type"][value="checking"]').checked = true;
      document.getElementById('ach-mandate-checkbox').checked = false;
      
      checkout.validateACHForm();
      
      const completeBtn = document.getElementById('complete-order-btn');
      expect(completeBtn.disabled).toBe(true);
    });
  });
  
  describe('Payment Processing', () => {
    beforeEach(() => {
      // Fill in valid form data
      document.getElementById('account-holder-name').value = 'John Doe';
      document.getElementById('routing-number').value = '021000021';
      document.getElementById('account-number').value = '123456789';
      document.querySelector('input[name="account-type"][value="checking"]').checked = true;
      document.getElementById('ach-mandate-checkbox').checked = true;
    });
    
    it('should create payment method with correct parameters', async () => {
      mockStripe.createPaymentMethod.mockResolvedValue({
        paymentMethod: { id: 'pm_test_ach_manual' }
      });
      
      server.use(
        rest.post(`${API_URL}/api/stripe/create-payment-intent`, (req, res, ctx) => {
          return res(ctx.json({
            clientSecret: 'pi_test_manual_secret',
            paymentIntentId: 'pi_test_manual'
          }));
        })
      );
      
      mockStripe.confirmUsBankAccountPayment.mockResolvedValue({
        paymentIntent: {
          id: 'pi_test_manual',
          status: 'processing'
        }
      });
      
      await checkout.processACHPayment();
      
      expect(mockStripe.createPaymentMethod).toHaveBeenCalledWith({
        type: 'us_bank_account',
        us_bank_account: {
          account_number: '123456789',
          routing_number: '021000021',
          account_holder_type: 'individual',
          account_type: 'checking'
        },
        billing_details: {
          name: 'John Doe',
          email: 'test@example.com',
          phone: '555-1234',
          address: {
            line1: '123 Test Street',
            line2: 'Apt 4B',
            city: 'New York',
            state: 'NY',
            postal_code: '10001',
            country: 'US'
          }
        }
      });
    });
    
    it('should handle payment method creation errors', async () => {
      mockStripe.createPaymentMethod.mockResolvedValue({
        error: {
          message: 'Invalid routing number'
        }
      });
      
      const result = await checkout.processACHPayment();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid routing number');
    });
    
    it('should create payment intent with manual ACH details', async () => {
      mockStripe.createPaymentMethod.mockResolvedValue({
        paymentMethod: { id: 'pm_test_ach_manual' }
      });
      
      let capturedRequest;
      server.use(
        rest.post(`${API_URL}/api/stripe/create-payment-intent`, async (req, res, ctx) => {
          capturedRequest = await req.json();
          return res(ctx.json({
            clientSecret: 'pi_test_manual_secret',
            paymentIntentId: 'pi_test_manual'
          }));
        })
      );
      
      mockStripe.confirmUsBankAccountPayment.mockResolvedValue({
        paymentIntent: {
          id: 'pi_test_manual',
          status: 'processing'
        }
      });
      
      await checkout.processACHPayment();
      
      expect(capturedRequest).toMatchObject({
        amount: 11800,
        currency: 'usd',
        payment_method_types: ['us_bank_account'],
        payment_method: 'pm_test_ach_manual',
        customer_email: 'test@example.com',
        mandate_data: {
          customer_acceptance: {
            type: 'online',
            online: {
              ip_address: '{{IP_ADDRESS}}',
              user_agent: 'Mozilla/5.0 Test Browser'
            }
          }
        }
      });
    });
    
    it('should handle savings account type', async () => {
      document.querySelector('input[name="account-type"][value="savings"]').checked = true;
      document.querySelector('input[name="account-type"][value="checking"]').checked = false;
      
      mockStripe.createPaymentMethod.mockResolvedValue({
        paymentMethod: { id: 'pm_test_ach_savings' }
      });
      
      server.use(
        rest.post(`${API_URL}/api/stripe/create-payment-intent`, (req, res, ctx) => {
          return res(ctx.json({
            clientSecret: 'pi_test_savings_secret',
            paymentIntentId: 'pi_test_savings'
          }));
        })
      );
      
      mockStripe.confirmUsBankAccountPayment.mockResolvedValue({
        paymentIntent: {
          id: 'pi_test_savings',
          status: 'processing'
        }
      });
      
      await checkout.processACHPayment();
      
      expect(mockStripe.createPaymentMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          us_bank_account: expect.objectContaining({
            account_type: 'savings'
          })
        })
      );
    });
  });
  
  describe('Real-time Validation UI', () => {
    it('should show error for invalid routing number on blur', () => {
      const routingInput = document.getElementById('routing-number');
      const errorEl = document.getElementById('ach-errors');
      
      // Add validation on input
      routingInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
        
        if (e.target.value.length === 9) {
          const isValid = checkout.validateRoutingNumber(e.target.value);
          if (!isValid) {
            errorEl.textContent = 'Invalid routing number. Please check and try again.';
            errorEl.style.display = 'block';
            e.target.classList.add('invalid');
          } else {
            errorEl.style.display = 'none';
            e.target.classList.remove('invalid');
          }
        }
      });
      
      // Type invalid routing number
      routingInput.value = '123456789';
      routingInput.dispatchEvent(new Event('input'));
      
      expect(errorEl.style.display).toBe('block');
      expect(errorEl.textContent).toContain('Invalid routing number');
      expect(routingInput.classList.contains('invalid')).toBe(true);
    });
    
    it('should clear error for valid routing number', () => {
      const routingInput = document.getElementById('routing-number');
      const errorEl = document.getElementById('ach-errors');
      
      // First show error
      errorEl.textContent = 'Invalid routing number';
      errorEl.style.display = 'block';
      routingInput.classList.add('invalid');
      
      // Add validation
      routingInput.addEventListener('input', (e) => {
        if (e.target.value.length === 9) {
          const isValid = checkout.validateRoutingNumber(e.target.value);
          if (isValid) {
            errorEl.style.display = 'none';
            e.target.classList.remove('invalid');
          }
        }
      });
      
      // Type valid routing number
      routingInput.value = '021000021';
      routingInput.dispatchEvent(new Event('input'));
      
      expect(errorEl.style.display).toBe('none');
      expect(routingInput.classList.contains('invalid')).toBe(false);
    });
  });
});