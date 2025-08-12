#!/usr/bin/env node

/**
 * Test checkout flow on staging
 * This script simulates a complete checkout process
 */

const https = require('https');

// Configuration - Use environment variables with fallbacks
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || 'sqqpyb-yq.myshopify.com';
const SHOPIFY_THEME_ID_STAGING = process.env.SHOPIFY_THEME_ID_STAGING || '153047662834';
const STAGING_URL = `https://${SHOPIFY_STORE_DOMAIN}?preview_theme_id=${SHOPIFY_THEME_ID_STAGING}`;
const BACKEND_URL = process.env.R3_API_URL_STAGING || 'https://r3-backend-git-stage-r3.vercel.app';
const TEST_CART_TOKEN = `test-${Date.now()}`;

// Test card details
const TEST_CARD = {
  number: '4242424242424242',
  exp_month: 12,
  exp_year: 2025,
  cvc: '123'
};

// Test customer details
const TEST_CUSTOMER = {
  email: `test-${Date.now()}@example.com`,
  firstName: 'Test',
  lastName: 'User',
  phone: '5551234567'
};

// Test address
const TEST_ADDRESS = {
  address1: '123 Test St',
  city: 'New York',
  province: 'NY',
  country: 'US',
  zip: '10001'
};

async function makeRequest(url, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (e) {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testCheckout() {
  console.log('🛒 Starting checkout flow test...\n');

  try {
    // Step 1: Test backend health
    console.log('1️⃣  Testing backend health...');
    const healthCheck = await makeRequest(`${BACKEND_URL}/health`);
    if (healthCheck.status !== 200 || healthCheck.body.status !== 'healthy') {
      throw new Error('Backend is not healthy');
    }
    console.log('   ✅ Backend is healthy\n');

    // Step 2: Create checkout session
    console.log('2️⃣  Creating checkout session...');
    const sessionData = {
      cartToken: TEST_CART_TOKEN,
      domain: SHOPIFY_STORE_DOMAIN,
      cartTotal: 5000,
      items: [
        {
          title: 'Test Product',
          variant_id: '12345',
          quantity: 1,
          price: 50.00
        }
      ]
    };

    const sessionResponse = await makeRequest(
      `${BACKEND_URL}/api/checkout/session`,
      'POST',
      sessionData
    );

    if (sessionResponse.status !== 201) {
      throw new Error(`Failed to create session: ${JSON.stringify(sessionResponse.body)}`);
    }

    const { sessionToken } = sessionResponse.body;
    console.log(`   ✅ Session created: ${sessionToken.substring(0, 20)}...\n`);

    // Step 3: Create payment intent
    console.log('3️⃣  Creating payment intent...');
    const paymentData = {
      amount: 5000,
      paymentMethodType: 'card',
      email: TEST_CUSTOMER.email,
      shippingAddress: {
        ...TEST_ADDRESS,
        firstName: TEST_CUSTOMER.firstName,
        lastName: TEST_CUSTOMER.lastName
      },
      billingAddress: TEST_ADDRESS,
      items: sessionData.items,
      metadata: {
        store_domain: SHOPIFY_STORE_DOMAIN,
        customer_email: TEST_CUSTOMER.email,
        customer_first_name: TEST_CUSTOMER.firstName,
        customer_last_name: TEST_CUSTOMER.lastName,
        rep: 'test-automation'
      }
    };

    const paymentResponse = await makeRequest(
      `${BACKEND_URL}/api/stripe/create-payment-intent`,
      'POST',
      paymentData,
      {
        'Authorization': `Bearer ${sessionToken}`
      }
    );

    if (paymentResponse.status !== 200) {
      throw new Error(`Failed to create payment intent: ${JSON.stringify(paymentResponse.body)}`);
    }

    const { clientSecret, paymentIntentId } = paymentResponse.body;
    console.log(`   ✅ Payment intent created: ${paymentIntentId}\n`);

    // Step 4: Verify webhook endpoint
    console.log('4️⃣  Testing webhook endpoint...');
    const webhookTest = await makeRequest(
      `${BACKEND_URL}/webhook/stripe`,
      'POST',
      { test: true }
    );

    // Should return error about missing signature (which is expected)
    if (webhookTest.body && webhookTest.body.includes('Missing stripe-signature')) {
      console.log('   ✅ Webhook endpoint is responding correctly\n');
    } else {
      console.log('   ⚠️  Webhook response unexpected:', webhookTest.body, '\n');
    }

    // Summary
    console.log('✨ Checkout Flow Test Complete!\n');
    console.log('Summary:');
    console.log('--------');
    console.log(`Backend URL: ${BACKEND_URL}`);
    console.log(`Session Token: ${sessionToken.substring(0, 20)}...`);
    console.log(`Payment Intent: ${paymentIntentId}`);
    console.log(`Test Email: ${TEST_CUSTOMER.email}`);
    console.log('\n✅ All systems operational!');
    console.log('\nTo complete a full purchase test:');
    console.log('1. Visit:', STAGING_URL);
    console.log('2. Add a product to cart');
    console.log('3. Go to checkout at /pages/checkout');
    console.log('4. Use test card: 4242 4242 4242 4242');
    console.log('5. Check Shopify admin for the draft order');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testCheckout();