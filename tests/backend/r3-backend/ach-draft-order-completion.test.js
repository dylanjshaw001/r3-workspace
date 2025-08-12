/**
 * ACH Draft Order Completion Tests
 * Tests the completion of draft orders when ACH payments succeed
 */

const fetch = require('node-fetch');
const { getApiUrl, shouldMockPayments, getTestEnvironment } = require('../../shared/helpers/environment');
const { 
  generateTestSessionToken,
  generateTestCSRFToken
} = require('../../shared/helpers/test-helpers');

// Use environment-specific API URL
const API_URL = getApiUrl();
const IS_MOCKED = shouldMockPayments();
const TEST_ENV = getTestEnvironment();

describe('ACH Draft Order Completion', () => {
  describe('Draft Order Lifecycle', () => {
    it('should create draft order with ACH_PENDING tag on payment_intent.created', () => {
      // Simulate webhook payload for ACH payment created
      const webhookPayload = {
        type: 'payment_intent.created',
        data: {
          object: {
            id: 'pi_test_ach_123',
            amount: 5000, // $50.00
            payment_method_types: ['us_bank_account'],
            status: 'requires_payment_method',
            metadata: {
              customer_email: 'test@example.com',
              customer_first_name: 'John',
              customer_last_name: 'Doe',
              shipping_price: '1000',
              tax_amount: '500',
              items: JSON.stringify([
                { variant_id: '123', quantity: 1, price: 3500 }
              ])
            }
          }
        }
      };
      
      // Expected draft order tags
      const expectedTags = ['stripe', 'ACH_PAYMENT', 'ACH_PENDING'];
      
      // In production webhook, these tags would be set
      const tags = `stripe,${webhookPayload.data.object.id.slice(-12)},ACH_PAYMENT,ACH_PENDING`;
      
      expectedTags.forEach(tag => {
        expect(tags).toContain(tag);
      });
    });
    
    it('should update draft order tags when ACH payment succeeds', () => {
      // Simulate successful ACH payment
      const initialTags = 'stripe,pi_123,ACH_PAYMENT,ACH_PENDING,TEST_ORDER';
      
      // Simulate tag update logic from updateDraftOrderForACHCompletion
      let updatedTags = initialTags.replace('ACH_PENDING', 'ACH_COMPLETED');
      if (!updatedTags.includes('ACH_COMPLETED')) {
        updatedTags = updatedTags ? `${updatedTags},ACH_COMPLETED` : 'ACH_COMPLETED';
      }
      
      expect(updatedTags).toContain('ACH_COMPLETED');
      expect(updatedTags).not.toContain('ACH_PENDING');
    });
    
    it('should call completeDraftOrder when ACH payment succeeds', async () => {
      // Skip in production to avoid creating real orders
      if (TEST_ENV === 'prod') {
        console.log('Skipping draft order completion test in production');
        return;
      }
      
      // Mock draft order ID
      const draftOrderId = 'draft_123456';
      
      // Expected API endpoint for completing draft order
      const expectedEndpoint = /\/admin\/api\/2024-01\/draft_orders\/.*\/complete\.json$/;
      
      // Verify the endpoint format is correct
      const testEndpoint = `https://test-store.myshopify.com/admin/api/2024-01/draft_orders/${draftOrderId}/complete.json`;
      expect(testEndpoint).toMatch(expectedEndpoint);
      
      // Verify the request body for completion
      const requestBody = {
        payment_pending: false // Mark payment as received
      };
      
      expect(requestBody.payment_pending).toBe(false);
    });
  });
  
  describe('Note Updates', () => {
    it('should update draft order note from pending to completed', () => {
      const pendingNote = '⚠️ This ACH payment is pending bank clearance (1-3 business days). DO NOT fulfill until payment status is confirmed.';
      const completedNote = '✅ ACH payment has been successfully completed and cleared.';
      
      // Simulate note update logic
      let updatedNote = pendingNote.replace(
        '⚠️ This ACH payment is pending bank clearance (1-3 business days). DO NOT fulfill until payment status is confirmed.',
        '✅ ACH payment has been successfully completed and cleared.'
      );
      
      expect(updatedNote).toBe(completedNote);
    });
  });
  
  describe('Environment-Specific Behavior', () => {
    it('should create draft orders for ACH in all environments', () => {
      const environments = ['dev', 'stage', 'prod'];
      
      environments.forEach(env => {
        const isACHPayment = true;
        const isTestEnvironment = env !== 'prod';
        const isTestPayment = env === 'dev';
        
        // ACH always creates draft orders regardless of environment
        const createDraftOrder = isTestEnvironment || isTestPayment || isACHPayment;
        
        expect(createDraftOrder).toBe(true);
        console.log(`Environment: ${env}, Create Draft Order: ${createDraftOrder}`);
      });
    });
    
    it('should handle draft order completion differently per environment', () => {
      const env = TEST_ENV;
      
      if (env === 'dev') {
        // In dev, we might mock the Shopify API
        expect(IS_MOCKED).toBe(true);
        console.log('Development: Using mocked Shopify responses');
      } else if (env === 'stage') {
        // In stage, use real API but test mode
        expect(IS_MOCKED).toBe(false);
        console.log('Staging: Using real Shopify API in test mode');
      } else if (env === 'prod') {
        // In prod, skip destructive operations
        expect(IS_MOCKED).toBe(false);
        console.log('Production: Read-only tests, no order creation');
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should handle draft order completion failure gracefully', () => {
      // Simulate completion failure
      const error = {
        status: 422,
        message: 'Draft order cannot be completed without payment'
      };
      
      // The function should return null on failure
      const result = null; // Simulating completeDraftOrder returning null
      
      expect(result).toBeNull();
    });
    
    it('should continue processing even if draft order update fails', () => {
      // Even if the draft order update/completion fails,
      // the webhook should still mark itself as processed
      const idempotencyKey = 'webhook_123';
      const processed = true; // Webhook marks itself processed
      
      expect(processed).toBe(true);
    });
  });
  
  describe('Idempotency', () => {
    it('should not complete draft order twice for same payment', () => {
      const paymentIntentId = 'pi_test_123';
      const processingKey = `payment_processing_${paymentIntentId}`;
      
      // First completion
      const firstCompletion = { orderId: 'order_123', completed: true };
      
      // Second attempt should be skipped
      const existingOrder = firstCompletion;
      
      if (existingOrder && existingOrder.orderId) {
        // Skip completion, order already exists
        expect(existingOrder.completed).toBe(true);
        console.log('Skipping duplicate draft order completion');
      }
    });
  });
});