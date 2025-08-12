#!/usr/bin/env node

/**
 * ACH Payment Lifecycle Test Script
 * 
 * This script simulates the full ACH payment lifecycle to test our webhook handling.
 * It creates test payment intents and triggers the appropriate webhook events.
 * 
 * Usage:
 *   node test-ach-flow.js [scenario]
 * 
 * Scenarios:
 *   success - Test successful ACH payment flow (default)
 *   failure - Test failed ACH payment
 *   dispute - Test ACH payment dispute
 */

import Stripe from 'stripe';
import fetch from 'node-fetch';
// Optional: import logger if needed
// import { logger } from '../../r3-backend/utils/logger.js';

// Test configuration
const TEST_CONFIG = {
  // Use test key for ACH testing
  STRIPE_KEY: process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY_DEV,
  WEBHOOK_URL: process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/stripe',
  WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET_DEV,
  
  // Test ACH accounts
  ACCOUNTS: {
    success: {
      routing: '110000000',
      account: '000123456789',
      description: 'Successful ACH payment'
    },
    failure: {
      routing: '110000000', 
      account: '000111111113',
      description: 'Account closed - payment fails'
    },
    high_risk: {
      routing: '110000000',
      account: '000000004954',
      description: 'High fraud risk - payment blocked'
    }
  },
  
  // Test customer data
  CUSTOMER: {
    email: 'ach-test@example.com',
    firstName: 'ACH',
    lastName: 'Tester',
    address: {
      line1: '123 Test St',
      city: 'Test City',
      state: 'NY',
      postal_code: '10001',
      country: 'US'
    }
  },
  
  // Test order data
  ORDER: {
    items: [{
      variant_id: '12345',
      quantity: 1,
      price: '99.99',
      title: 'Test Product'
    }],
    shipping_price: '10.00',
    shipping_method: 'Standard Shipping',
    store_domain: 'sqqpyb-yq.myshopify.com',
    environment: 'dev'
  }
};

// Initialize Stripe
const stripe = new Stripe(TEST_CONFIG.STRIPE_KEY);

/**
 * Create a test customer with bank account
 */
async function createTestCustomer(accountType = 'success') {
  const account = TEST_CONFIG.ACCOUNTS[accountType];
  
  console.log(`\n📝 Creating test customer with ${accountType} account...`);
  
  // Create customer
  const customer = await stripe.customers.create({
    email: TEST_CONFIG.CUSTOMER.email,
    name: `${TEST_CONFIG.CUSTOMER.firstName} ${TEST_CONFIG.CUSTOMER.lastName}`,
    address: TEST_CONFIG.CUSTOMER.address,
    metadata: {
      test_scenario: accountType
    }
  });
  
  console.log(`✅ Customer created: ${customer.id}`);
  
  // Create bank account token
  const token = await stripe.tokens.create({
    bank_account: {
      country: 'US',
      currency: 'usd',
      account_holder_name: `${TEST_CONFIG.CUSTOMER.firstName} ${TEST_CONFIG.CUSTOMER.lastName}`,
      account_holder_type: 'individual',
      routing_number: account.routing,
      account_number: account.account
    }
  });
  
  console.log(`✅ Bank token created: ${token.id}`);
  
  // Attach bank account to customer
  const source = await stripe.customers.createSource(customer.id, {
    source: token.id
  });
  
  console.log(`✅ Bank account attached: ${source.id}`);
  
  // Verify bank account (for testing, use microdeposit amounts)
  await stripe.customers.verifySource(customer.id, source.id, {
    amounts: [32, 45]  // Test amounts for successful verification
  });
  
  console.log(`✅ Bank account verified`);
  
  return { customer, source };
}

/**
 * Create a payment intent for ACH
 */
async function createACHPaymentIntent(customer, source) {
  console.log(`\n💳 Creating ACH payment intent...`);
  
  const amount = Math.round((parseFloat(TEST_CONFIG.ORDER.items[0].price) + parseFloat(TEST_CONFIG.ORDER.shipping_price)) * 100);
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    customer: customer.id,
    payment_method_types: ['us_bank_account'],
    payment_method: source.id,
    confirm: true,
    mandate_data: {
      customer_acceptance: {
        type: 'online',
        online: {
          ip_address: '127.0.0.1',
          user_agent: 'test-script'
        }
      }
    },
    metadata: {
      customer_email: TEST_CONFIG.CUSTOMER.email,
      customer_first_name: TEST_CONFIG.CUSTOMER.firstName,
      customer_last_name: TEST_CONFIG.CUSTOMER.lastName,
      items: JSON.stringify(TEST_CONFIG.ORDER.items),
      shipping_address: JSON.stringify(TEST_CONFIG.CUSTOMER.address),
      shipping_price: TEST_CONFIG.ORDER.shipping_price,
      shipping_method: TEST_CONFIG.ORDER.shipping_method,
      store_domain: TEST_CONFIG.ORDER.store_domain,
      environment: TEST_CONFIG.ORDER.environment,
      test_mode: 'true'
    }
  });
  
  console.log(`✅ Payment intent created: ${paymentIntent.id}`);
  console.log(`   Status: ${paymentIntent.status}`);
  console.log(`   Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
  
  return paymentIntent;
}

/**
 * Simulate webhook event
 */
async function simulateWebhookEvent(eventType, paymentIntent) {
  console.log(`\n🔔 Simulating webhook event: ${eventType}`);
  
  // Create event object
  const event = {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    type: eventType,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: paymentIntent
    },
    livemode: false
  };
  
  // Create signature (simplified for testing)
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify(event);
  const signature = `t=${timestamp},v1=test_signature`;
  
  try {
    // Send to webhook endpoint
    const response = await fetch(TEST_CONFIG.WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': signature
      },
      body: payload
    });
    
    const result = await response.text();
    console.log(`   Response: ${response.status} - ${result}`);
    
    if (response.ok) {
      console.log(`✅ Webhook event delivered successfully`);
    } else {
      console.log(`❌ Webhook delivery failed`);
    }
  } catch (error) {
    console.error(`❌ Error sending webhook:`, error.message);
  }
}

/**
 * Simulate the full ACH payment lifecycle
 */
async function simulateACHLifecycle(scenario = 'success') {
  console.log(`\n🚀 Starting ACH Payment Lifecycle Test - Scenario: ${scenario}`);
  console.log('═'.repeat(60));
  
  try {
    // Step 1: Create customer and bank account
    const { customer, source } = await createTestCustomer(scenario);
    
    // Step 2: Create payment intent
    const paymentIntent = await createACHPaymentIntent(customer, source);
    
    // Step 3: Simulate webhook events based on scenario
    console.log(`\n📊 Simulating payment lifecycle events...`);
    
    // Initial processing state (ACH payment initiated)
    await simulateWebhookEvent('payment_intent.processing', {
      ...paymentIntent,
      status: 'processing'
    });
    
    // Wait a moment to simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (scenario === 'success') {
      // Simulate successful payment
      await simulateWebhookEvent('payment_intent.succeeded', {
        ...paymentIntent,
        status: 'succeeded'
      });
      
      // Also simulate charge.succeeded
      await simulateWebhookEvent('charge.succeeded', {
        id: `ch_test_${Date.now()}`,
        object: 'charge',
        amount: paymentIntent.amount,
        payment_intent: paymentIntent.id,
        payment_method_details: {
          type: 'ach_debit'
        },
        metadata: paymentIntent.metadata
      });
      
      console.log(`\n✅ SUCCESS: ACH payment completed successfully`);
      
    } else if (scenario === 'failure') {
      // Simulate failed payment
      await simulateWebhookEvent('charge.failed', {
        id: `ch_test_${Date.now()}`,
        object: 'charge',
        amount: paymentIntent.amount,
        payment_intent: paymentIntent.id,
        payment_method_details: {
          type: 'ach_debit'
        },
        failure_code: 'account_closed',
        failure_message: 'The bank account has been closed.',
        metadata: paymentIntent.metadata
      });
      
      console.log(`\n❌ FAILURE: ACH payment failed - Account closed`);
      
    } else if (scenario === 'dispute') {
      // First succeed, then dispute
      await simulateWebhookEvent('payment_intent.succeeded', {
        ...paymentIntent,
        status: 'succeeded'
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate dispute
      await simulateWebhookEvent('charge.dispute.created', {
        id: `dp_test_${Date.now()}`,
        object: 'dispute',
        charge: `ch_test_${Date.now()}`,
        amount: paymentIntent.amount,
        reason: 'unauthorized',
        status: 'lost',  // ACH disputes are immediately lost
        metadata: paymentIntent.metadata
      });
      
      console.log(`\n⚠️ DISPUTE: ACH payment disputed by customer`);
    }
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📋 Test Summary:');
    console.log(`   Scenario: ${scenario}`);
    console.log(`   Payment Intent: ${paymentIntent.id}`);
    console.log(`   Customer: ${customer.id}`);
    console.log(`   Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
    console.log(`\n💡 Check your webhook logs and Shopify orders to verify:`);
    console.log(`   1. Draft order was created with ACH_PENDING tag`);
    console.log(`   2. Order was updated when payment ${scenario === 'success' ? 'succeeded' : 'failed'}`);
    console.log(`   3. Customer emails were sent appropriately`);
    
  } catch (error) {
    console.error(`\n❌ Test failed:`, error.message);
    process.exit(1);
  }
}

/**
 * Run local webhook endpoint test
 */
async function testLocalWebhook() {
  console.log(`\n🔍 Testing webhook endpoint connectivity...`);
  
  try {
    const response = await fetch(TEST_CONFIG.WEBHOOK_URL.replace('/webhook/stripe', '/health'));
    if (response.ok) {
      console.log(`✅ Backend server is running`);
    } else {
      console.log(`⚠️ Backend server returned status ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Cannot connect to backend server at ${TEST_CONFIG.WEBHOOK_URL}`);
    console.log(`\n💡 Make sure your backend is running:`);
    console.log(`   cd /Users/dylanjshaw/r3/r3-backend`);
    console.log(`   npm run dev`);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const scenario = process.argv[2] || 'success';
  
  if (!['success', 'failure', 'dispute'].includes(scenario)) {
    console.error(`❌ Invalid scenario: ${scenario}`);
    console.log(`\nUsage: node test-ach-flow.js [success|failure|dispute]`);
    process.exit(1);
  }
  
  // Check if we're testing locally
  if (TEST_CONFIG.WEBHOOK_URL.includes('localhost')) {
    await testLocalWebhook();
  }
  
  // Run the test
  await simulateACHLifecycle(scenario);
  
  console.log(`\n✨ Test completed successfully!`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { createTestCustomer, createACHPaymentIntent, simulateWebhookEvent };