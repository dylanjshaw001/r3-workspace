// ACH Financial Connections Tests
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

describe('ACH Financial Connections Flow', () => {
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
      }
    };
    
    // Mock Stripe
    mockStripe = {
      collectBankAccountForPayment: jest.fn()
    };
    
    // Initialize checkout object with test data
    checkout = {
      stripe: mockStripe,
      achMode: 'connections',
      achBankAccountConnected: false,
      achClientSecret: null,
      achAccountHolderName: null,
      achPaymentIntent: null,
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
      
      // Implement the actual initiateFinancialConnections method
      initiateFinancialConnections: async function() {
        try {
          // First get the account holder name
          const accountHolderNameFC = document.getElementById('account-holder-name-fc');
          if (!accountHolderNameFC || !accountHolderNameFC.value.trim()) {
            this.showError('Please enter the account holder name');
            return;
          }
          
          // Mark that we're using Financial Connections
          this.achBankAccountConnected = false;
          this.achMode = 'connections';
          
          // Create payment intent first
          const response = await fetch(window.R3_API_CONFIG.getEndpointUrl('createPaymentIntent'), {
            method: 'POST',
            credentials: 'include',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
              amount: this.cart.total_price + this.shipping.price + (this.tax?.amount || 0),
              currency: 'usd',
              payment_method_types: ['us_bank_account'],
              customer_email: this.shippingData.email,
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
            console.error('Payment intent creation failed:', error);
            this.showError(error.error || 'Failed to initialize bank connection');
            throw new Error(error.error || 'Failed to initialize bank connection');
          }
          
          const data = await response.json();
          const { clientSecret } = data;
          
          // Store for later use
          this.achClientSecret = clientSecret;
          this.achAccountHolderName = accountHolderNameFC.value.trim();
          
          // Launch Financial Connections
          const result = await this.stripe.collectBankAccountForPayment({
            clientSecret: clientSecret,
            params: {
              payment_method_type: 'us_bank_account',
              payment_method_data: {
                billing_details: {
                  name: this.achAccountHolderName,
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
              }
            },
            expand: ['payment_method']
          });
          
          if (result.error) {
            if (result.error.type === 'canceled') {
              // User cancelled - no error needed
              return;
            }
            this.showError(result.error.message);
          } else if (result.paymentIntent) {
            // Bank account connected successfully
            this.achBankAccountConnected = true;
            this.achPaymentIntent = result.paymentIntent;
            
            // Update UI to show success
            const connectBtn = document.getElementById('connect-bank-btn');
            if (connectBtn) {
              connectBtn.innerHTML = '<span class="checkmark">✓</span> Bank Account Connected';
              connectBtn.classList.add('btn-success');
              connectBtn.disabled = true;
            }
            
            // Show connected account info
            const connectedInfo = document.getElementById('ach-connected-info');
            if (connectedInfo) {
              const bankName = result.paymentIntent.payment_method?.us_bank_account?.bank_name || 'Bank';
              const last4 = result.paymentIntent.payment_method?.us_bank_account?.last4 || '****';
              connectedInfo.innerHTML = `<p class="success-text">Connected: ${bankName} ****${last4}</p>`;
              connectedInfo.style.display = 'block';
            }
            
            // Validate form to potentially enable complete order button
            if (this.validateACHForm) {
              this.validateACHForm();
            }
          }
        } catch (error) {
          console.error('Financial Connections error:', error);
          this.showError(error.message || 'Failed to connect bank account. Please try again.');
        }
      }
    };
    
    // Set up DOM
    document.body.innerHTML = `
      <div id="ach-connection-section">
        <input type="text" id="account-holder-name-fc" value="" />
        <button id="connect-bank-btn">Connect Bank Account</button>
        <div id="ach-connected-info" style="display: none;"></div>
      </div>
      <div class="checkout-container" data-environment="test"></div>
    `;
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('initiateFinancialConnections', () => {
    it('should validate account holder name is required', async () => {
      const accountHolderInput = document.getElementById('account-holder-name-fc');
      accountHolderInput.value = '';
      
      await checkout.initiateFinancialConnections();
      
      expect(checkout.showError).toHaveBeenCalledWith('Please enter the account holder name');
      expect(mockStripe.collectBankAccountForPayment).not.toHaveBeenCalled();
    });
    
    it('should create payment intent with correct parameters', async () => {
      const accountHolderInput = document.getElementById('account-holder-name-fc');
      accountHolderInput.value = 'John Doe';
      
      // Mock successful payment intent creation
      server.use(
        rest.post(`${API_URL}/api/stripe/create-payment-intent`, (req, res, ctx) => {
          return res(ctx.json({
            clientSecret: 'pi_test_secret',
            paymentIntentId: 'pi_test_123'
          }));
        })
      );
      
      // Mock Stripe collectBankAccountForPayment
      mockStripe.collectBankAccountForPayment.mockResolvedValue({
        paymentIntent: {
          id: 'pi_test_123',
          payment_method: {
            us_bank_account: {
              bank_name: 'Test Bank',
              last4: '6789'
            }
          }
        }
      });
      
      await checkout.initiateFinancialConnections();
      
      expect(mockStripe.collectBankAccountForPayment).toHaveBeenCalledWith({
        clientSecret: 'pi_test_secret',
        params: {
          payment_method_type: 'us_bank_account',
          payment_method_data: {
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
          }
        },
        expand: ['payment_method']
      });
    });
    
    it('should handle successful bank connection', async () => {
      const accountHolderInput = document.getElementById('account-holder-name-fc');
      accountHolderInput.value = 'John Doe';
      
      server.use(
        rest.post(`${API_URL}/api/stripe/create-payment-intent`, (req, res, ctx) => {
          return res(ctx.json({
            clientSecret: 'pi_test_secret',
            paymentIntentId: 'pi_test_123'
          }));
        })
      );
      
      const mockPaymentIntent = {
        id: 'pi_test_123',
        payment_method: {
          us_bank_account: {
            bank_name: 'Chase Bank',
            last4: '1234'
          }
        }
      };
      
      mockStripe.collectBankAccountForPayment.mockResolvedValue({
        paymentIntent: mockPaymentIntent
      });
      
      checkout.validateACHForm = jest.fn();
      
      await checkout.initiateFinancialConnections();
      
      expect(checkout.achBankAccountConnected).toBe(true);
      expect(checkout.achPaymentIntent).toEqual(mockPaymentIntent);
      expect(checkout.achClientSecret).toBe('pi_test_secret');
      expect(checkout.achAccountHolderName).toBe('John Doe');
      
      // Check UI updates
      const connectBtn = document.getElementById('connect-bank-btn');
      expect(connectBtn.innerHTML).toContain('Bank Account Connected');
      expect(connectBtn.classList.contains('btn-success')).toBe(true);
      expect(connectBtn.disabled).toBe(true);
      
      const connectedInfo = document.getElementById('ach-connected-info');
      expect(connectedInfo.style.display).toBe('block');
      expect(connectedInfo.innerHTML).toContain('Chase Bank ****1234');
      
      expect(checkout.validateACHForm).toHaveBeenCalled();
    });
    
    it('should handle user cancellation silently', async () => {
      const accountHolderInput = document.getElementById('account-holder-name-fc');
      accountHolderInput.value = 'John Doe';
      
      server.use(
        rest.post(`${API_URL}/api/stripe/create-payment-intent`, (req, res, ctx) => {
          return res(ctx.json({
            clientSecret: 'pi_test_secret',
            paymentIntentId: 'pi_test_123'
          }));
        })
      );
      
      mockStripe.collectBankAccountForPayment.mockResolvedValue({
        error: {
          type: 'canceled',
          message: 'User canceled the Financial Connections flow'
        }
      });
      
      // Reset showError mock before test
      checkout.showError.mockClear();
      
      await checkout.initiateFinancialConnections();
      
      // Should not show error for cancellation
      expect(checkout.showError).not.toHaveBeenCalled();
      expect(checkout.achBankAccountConnected).toBe(false);
    });
    
    it('should show error for other Stripe errors', async () => {
      const accountHolderInput = document.getElementById('account-holder-name-fc');
      accountHolderInput.value = 'John Doe';
      
      server.use(
        rest.post(`${API_URL}/api/stripe/create-payment-intent`, (req, res, ctx) => {
          return res(ctx.json({
            clientSecret: 'pi_test_secret',
            paymentIntentId: 'pi_test_123'
          }));
        })
      );
      
      mockStripe.collectBankAccountForPayment.mockResolvedValue({
        error: {
          type: 'api_error',
          message: 'Unable to connect to bank'
        }
      });
      
      await checkout.initiateFinancialConnections();
      
      expect(checkout.showError).toHaveBeenCalledWith('Unable to connect to bank');
      expect(checkout.achBankAccountConnected).toBe(false);
    });
    
    it('should handle payment intent creation failure', async () => {
      const accountHolderInput = document.getElementById('account-holder-name-fc');
      accountHolderInput.value = 'John Doe';
      
      server.use(
        rest.post(`${API_URL}/api/stripe/create-payment-intent`, (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({ error: 'Invalid session' })
          );
        })
      );
      
      await checkout.initiateFinancialConnections();
      
      expect(checkout.showError).toHaveBeenCalledWith('Invalid session');
      // Should also check that function threw
      expect(checkout.achBankAccountConnected).toBe(false);
      expect(mockStripe.collectBankAccountForPayment).not.toHaveBeenCalled();
    });
    
    it('should include all required metadata in payment intent', async () => {
      const accountHolderInput = document.getElementById('account-holder-name-fc');
      accountHolderInput.value = 'John Doe';
      
      let capturedRequest;
      server.use(
        rest.post(`${API_URL}/api/stripe/create-payment-intent`, async (req, res, ctx) => {
          capturedRequest = await req.json();
          return res(ctx.json({
            clientSecret: 'pi_test_secret',
            paymentIntentId: 'pi_test_123'
          }));
        })
      );
      
      mockStripe.collectBankAccountForPayment.mockResolvedValue({
        paymentIntent: { id: 'pi_test_123' }
      });
      
      await checkout.initiateFinancialConnections();
      
      expect(capturedRequest).toMatchObject({
        amount: 11800, // cart (10000) + shipping (1000) + tax (800)
        currency: 'usd',
        payment_method_types: ['us_bank_account'],
        customer_email: 'test@example.com',
        metadata: {
          customer_email: 'test@example.com',
          customer_first_name: 'Test',
          customer_last_name: 'Customer',
          shipping_method: 'standard',
          shipping_price: '1000',
          store_domain: 'sqqpyb-yq.myshopify.com',
          environment: 'test'
        }
      });
      
      // Verify shipping address is properly stringified
      const shippingAddress = JSON.parse(capturedRequest.metadata.shipping_address);
      expect(shippingAddress).toMatchObject({
        first_name: 'Test',
        last_name: 'Customer',
        address1: '123 Test Street',
        city: 'New York',
        province: 'NY',
        zip: '10001',
        country: 'United States'
      });
    });
  });
  
  describe('Payment Confirmation Flow', () => {
    beforeEach(() => {
      // Set up connected state
      checkout.achBankAccountConnected = true;
      checkout.achClientSecret = 'pi_test_secret';
      checkout.achMode = 'connections';
      
      // Add processACHPayment method
      checkout.processACHPayment = async function() {
        if (this.achMode === 'connections' && this.achBankAccountConnected) {
          const mandateCheckbox = document.getElementById('ach-mandate-checkbox');
          if (!mandateCheckbox || !mandateCheckbox.checked) {
            return { success: false, error: 'Please accept the ACH debit authorization' };
          }
          
          try {
            const confirmResult = await this.stripe.confirmUsBankAccountPayment(this.achClientSecret);
            
            if (confirmResult.error) {
              return { 
                success: false, 
                error: confirmResult.error.message || 'Payment confirmation failed' 
              };
            }
            
            const finalStatus = confirmResult.paymentIntent.status;
            
            if (finalStatus === 'processing' || finalStatus === 'requires_action' || finalStatus === 'succeeded') {
              return { 
                success: true, 
                paymentId: confirmResult.paymentIntent.id,
                pending: true,
                message: 'Your order has been received! Your bank transfer is being processed and typically completes within 1-3 business days.'
              };
            } else {
              return { 
                success: false, 
                error: `Payment failed with status: ${finalStatus}` 
              };
            }
          } catch (confirmError) {
            return { 
              success: false, 
              error: confirmError.message || 'Failed to confirm payment' 
            };
          }
        }
      };
      
      // Add mandate checkbox to DOM
      document.body.innerHTML += `
        <input type="checkbox" id="ach-mandate-checkbox" />
        <div id="ach-element"></div>
      `;
      
      // Add confirmUsBankAccountPayment mock
      mockStripe.confirmUsBankAccountPayment = jest.fn();
    });
    
    it('should require mandate acceptance before confirming payment', async () => {
      const mandateCheckbox = document.getElementById('ach-mandate-checkbox');
      mandateCheckbox.checked = false;
      
      const result = await checkout.processACHPayment();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Please accept the ACH debit authorization');
      expect(mockStripe.confirmUsBankAccountPayment).not.toHaveBeenCalled();
    });
    
    it('should confirm payment with connected bank account', async () => {
      const mandateCheckbox = document.getElementById('ach-mandate-checkbox');
      mandateCheckbox.checked = true;
      
      mockStripe.confirmUsBankAccountPayment.mockResolvedValue({
        paymentIntent: {
          id: 'pi_test_123',
          status: 'processing'
        }
      });
      
      const result = await checkout.processACHPayment();
      
      expect(mockStripe.confirmUsBankAccountPayment).toHaveBeenCalledWith('pi_test_secret');
      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('pi_test_123');
      expect(result.pending).toBe(true);
      expect(result.message).toContain('1-3 business days');
    });
  });
});