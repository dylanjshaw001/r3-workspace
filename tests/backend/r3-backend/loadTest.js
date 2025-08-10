// Load testing for the payment backend
import { LoadTester } from './testFramework.js';
import fetch from 'node-fetch';

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const STRIPE_TEST_KEY = process.env.STRIPE_TEST_KEY || 'sk_test_...';

// Test scenarios
const scenarios = {
  // Simulate checkout session creation
  async createSession() {
    const response = await fetch(`${BASE_URL}/api/checkout/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cartToken: `test-cart-${Date.now()}-${Math.random()}`,
        domain: 'test.myshopify.com',
        cartTotal: Math.floor(Math.random() * 50000) + 1000
      })
    });

    if (!response.ok) {
      throw new Error(`Session creation failed: ${response.status}`);
    }

    return await response.json();
  },

  // Simulate payment flow
  async completePayment() {
    // Create session
    const sessionResponse = await scenarios.createSession();
    const { sessionToken, csrfToken } = sessionResponse;

    // Create payment intent
    const paymentResponse = await fetch(`${BASE_URL}/api/stripe/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify({
        amount: Math.floor(Math.random() * 50000) + 1000,
        currency: 'usd',
        metadata: {
          customer_email: `test${Date.now()}@example.com`,
          items: JSON.stringify([
            { name: 'Test Product', quantity: 1, price: 100 }
          ])
        }
      })
    });

    if (!paymentResponse.ok) {
      throw new Error(`Payment creation failed: ${paymentResponse.status}`);
    }

    return await paymentResponse.json();
  },

  // Simulate shipping calculation
  async calculateShipping(sessionToken) {
    const response = await fetch(`${BASE_URL}/api/calculate-shipping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        postalCode: ['10001', '90210', '60601', '33101'][Math.floor(Math.random() * 4)],
        country: 'US',
        items: [{ weight: 1000, quantity: Math.floor(Math.random() * 5) + 1 }]
      })
    });

    if (!response.ok) {
      throw new Error(`Shipping calculation failed: ${response.status}`);
    }

    return await response.json();
  },

  // Mixed realistic workload
  async mixedWorkload() {
    const operations = [
      () => scenarios.createSession(),
      () => scenarios.completePayment(),
      async () => {
        const session = await scenarios.createSession();
        return scenarios.calculateShipping(session.sessionToken);
      }
    ];

    const operation = operations[Math.floor(Math.random() * operations.length)];
    return await operation();
  }
};

// Run load tests
async function runLoadTests() {
  console.log('Starting load tests...\n');

  // Test 1: Session creation load
  console.log('Test 1: Session Creation Load');
  const sessionTest = new LoadTester({
    concurrency: 50,
    duration: 30000, // 30 seconds
    rampUp: 5000 // 5 second ramp
  });

  const sessionResults = await sessionTest.run(scenarios.createSession);
  console.log('Session Creation Results:', sessionResults);
  console.log('');

  // Test 2: Payment flow load
  console.log('Test 2: Payment Flow Load');
  const paymentTest = new LoadTester({
    concurrency: 20,
    duration: 30000,
    rampUp: 10000
  });

  const paymentResults = await paymentTest.run(scenarios.completePayment);
  console.log('Payment Flow Results:', paymentResults);
  console.log('');

  // Test 3: Mixed workload
  console.log('Test 3: Mixed Workload');
  const mixedTest = new LoadTester({
    concurrency: 30,
    duration: 60000, // 1 minute
    rampUp: 15000
  });

  const mixedResults = await mixedTest.run(scenarios.mixedWorkload);
  console.log('Mixed Workload Results:', mixedResults);
  console.log('');

  // Summary
  console.log('Load Test Summary:');
  console.log('==================');
  console.log(`Session Creation: ${sessionResults.requestsPerSecond} req/s, ${sessionResults.p95} p95`);
  console.log(`Payment Flow: ${paymentResults.requestsPerSecond} req/s, ${paymentResults.p95} p95`);
  console.log(`Mixed Workload: ${mixedResults.requestsPerSecond} req/s, ${mixedResults.p95} p95`);

  // Check for failures
  const totalErrors = sessionResults.failed + paymentResults.failed + mixedResults.failed;
  if (totalErrors > 0) {
    console.log(`\nWarning: ${totalErrors} total errors occurred during testing`);
    process.exit(1);
  }
}

// Stress test - push to limits
async function runStressTest() {
  console.log('Starting stress test...\n');

  const stressTest = new LoadTester({
    concurrency: 100,
    duration: 120000, // 2 minutes
    rampUp: 30000 // 30 second ramp
  });

  const results = await stressTest.run(scenarios.mixedWorkload);

  console.log('Stress Test Results:');
  console.log('===================');
  console.log(`Total Requests: ${results.total}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed} (${results.errorRate})`);
  console.log(`Requests/sec: ${results.requestsPerSecond}`);
  console.log(`Average Latency: ${results.averageLatency}`);
  console.log(`P95 Latency: ${results.p95}`);
  console.log(`P99 Latency: ${results.p99}`);

  if (results.errors) {
    console.log('\nError breakdown:');
    Object.entries(results.errors).forEach(([error, count]) => {
      console.log(`  ${error}: ${count}`);
    });
  }
}

// Main execution
const testType = process.argv[2] || 'load';

if (testType === 'stress') {
  runStressTest().catch(console.error);
} else {
  runLoadTests().catch(console.error);
}
