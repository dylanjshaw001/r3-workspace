/**
 * Backend Load & Stress Testing Suite
 * 
 * Comprehensive load and stress testing for the R3 backend API,
 * testing system behavior under various load conditions.
 * 
 * Test Categories:
 * - Load Testing: Normal expected traffic patterns
 * - Stress Testing: Beyond normal capacity limits
 * - Spike Testing: Sudden traffic increases
 * - Volume Testing: Large data processing
 * - Endurance Testing: Extended load periods
 * - Rate Limiting Validation: Circuit breaker behavior
 */

const envHelper = require('../../../shared/helpers/environment');

const { clearTestSessions } = require('../../../shared/helpers/utils/mock-handlers');
const fixtures = require('../../../shared/fixtures');
const crypto = require('crypto');

// Test configuration
const LOAD_TEST_CONFIG = {
  light: { users: 10, duration: 30000 },    // 10 users for 30s
  medium: { users: 25, duration: 60000 },   // 25 users for 1min
  heavy: { users: 50, duration: 120000 },   // 50 users for 2min
  stress: { users: 100, duration: 180000 }, // 100 users for 3min
  spike: { users: 200, duration: 30000 }    // 200 users for 30s
};

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  session_creation: 1000,      // < 1s
  payment_intent: 2000,        // < 2s
  shipping_calc: 500,          // < 500ms
  tax_calc: 300,               // < 300ms
  webhook_processing: 1000,    // < 1s
  success_rate: 95             // > 95% success rate
};

describe('Backend Load & Stress Testing', () => {
  const backendUrl = envHelper.getApiUrl();
  
  beforeEach(() => {
    clearTestSessions();
  });

  describe('Load Testing - Normal Traffic Patterns', () => {
    it('should handle light load - 10 concurrent users', async () => {
      console.log('🔥 Load Test: 10 concurrent users for 30 seconds');
      
      const results = await runLoadTest(LOAD_TEST_CONFIG.light);
      
      // Analyze results
      expect(results.totalRequests).toBeGreaterThan(0);
      expect(results.successRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.success_rate);
      expect(results.averageResponseTime).toBeLessThan(2000);
      expect(results.errorCount).toBeLessThan(results.totalRequests * 0.05); // < 5% errors
      
      console.log('📊 Light Load Results:');
      console.log(`   Total Requests: ${results.totalRequests}`);
      console.log(`   Success Rate: ${results.successRate.toFixed(2)}%`);
      console.log(`   Average Response Time: ${results.averageResponseTime}ms`);
      console.log(`   Error Count: ${results.errorCount}`);
      console.log('✅ Light load test PASSED');
    }, 45000);

    it('should handle medium load - 25 concurrent users', async () => {
      console.log('🔥 Load Test: 25 concurrent users for 1 minute');
      
      const results = await runLoadTest(LOAD_TEST_CONFIG.medium);
      
      expect(results.successRate).toBeGreaterThan(PERFORMANCE_THRESHOLDS.success_rate);
      expect(results.averageResponseTime).toBeLessThan(3000); // Allow slightly higher under load
      
      console.log('📊 Medium Load Results:');
      console.log(`   Total Requests: ${results.totalRequests}`);
      console.log(`   Success Rate: ${results.successRate.toFixed(2)}%`);
      console.log(`   Average Response Time: ${results.averageResponseTime}ms`);
      console.log(`   95th Percentile: ${results.p95ResponseTime}ms`);
      console.log('✅ Medium load test PASSED');
    }, 75000);

    it('should maintain performance under sustained load', async () => {
      console.log('🔥 Endurance Test: 25 users for extended period');
      
      const results = await runEnduranceTest({
        users: 25,
        duration: 180000, // 3 minutes
        rampUpTime: 30000 // 30s ramp up
      });
      
      // Performance should not degrade over time
      expect(results.performanceDegradation).toBeLessThan(50); // < 50% increase
      expect(results.memoryLeaks).toBe(false);
      expect(results.successRate).toBeGreaterThan(90); // Allow slightly lower for endurance
      
      console.log('📊 Endurance Test Results:');
      console.log(`   Performance Degradation: ${results.performanceDegradation}%`);
      console.log(`   Memory Issues: ${results.memoryLeaks ? 'Detected' : 'None'}`);
      console.log(`   Final Success Rate: ${results.successRate.toFixed(2)}%`);
      console.log('✅ Endurance test PASSED');
    }, 240000);
  });

  describe('Stress Testing - Beyond Normal Capacity', () => {
    it('should gracefully handle stress load - 50 concurrent users', async () => {
      console.log('⚡ Stress Test: 50 concurrent users');
      
      const results = await runLoadTest(LOAD_TEST_CONFIG.heavy);
      
      // Under stress, some degradation is acceptable but system should remain stable
      expect(results.successRate).toBeGreaterThan(80); // Lower threshold for stress
      expect(results.errorCount).toBeLessThan(results.totalRequests * 0.2); // < 20% errors
      expect(results.systemCrashed).toBe(false);
      
      console.log('📊 Stress Test Results:');
      console.log(`   Total Requests: ${results.totalRequests}`);
      console.log(`   Success Rate: ${results.successRate.toFixed(2)}%`);
      console.log(`   Average Response Time: ${results.averageResponseTime}ms`);
      console.log(`   System Stability: ${results.systemCrashed ? 'CRASHED' : 'STABLE'}`);
      
      if (results.successRate < PERFORMANCE_THRESHOLDS.success_rate) {
        console.log('⚠️  Performance degraded under stress (expected)');
      }
      
      console.log('✅ Stress test PASSED');
    }, 180000);

    it('should handle extreme stress - 100 concurrent users', async () => {
      console.log('💥 Extreme Stress Test: 100 concurrent users');
      
      const results = await runLoadTest(LOAD_TEST_CONFIG.stress);
      
      // System should remain operational even under extreme load
      expect(results.systemCrashed).toBe(false);
      expect(results.successRate).toBeGreaterThan(50); // Very low threshold for extreme stress
      
      console.log('📊 Extreme Stress Results:');
      console.log(`   Total Requests: ${results.totalRequests}`);
      console.log(`   Success Rate: ${results.successRate.toFixed(2)}%`);
      console.log(`   System Status: ${results.systemCrashed ? 'CRASHED' : 'OPERATIONAL'}`);
      
      console.log('✅ Extreme stress test PASSED - System remained operational');
    }, 240000);
  });

  describe('Spike Testing - Sudden Load Increases', () => {
    it('should handle traffic spikes - sudden 200 users', async () => {
      console.log('🚀 Spike Test: Sudden spike to 200 concurrent users');
      
      // Start with baseline load
      const baselinePromise = runContinuousLoad(10, 60000); // 10 users background load
      
      // Wait 15 seconds then spike
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      const spikeResults = await runLoadTest(LOAD_TEST_CONFIG.spike);
      const baselineResults = await baselinePromise;
      
      // Spike should be handled without crashing
      expect(spikeResults.systemCrashed).toBe(false);
      expect(spikeResults.successRate).toBeGreaterThan(30); // Very low threshold for spikes
      
      // Baseline should not be significantly affected
      expect(baselineResults.successRate).toBeGreaterThan(70);
      
      console.log('📊 Spike Test Results:');
      console.log(`   Spike Success Rate: ${spikeResults.successRate.toFixed(2)}%`);
      console.log(`   Baseline Success Rate: ${baselineResults.successRate.toFixed(2)}%`);
      console.log(`   System Status: ${spikeResults.systemCrashed ? 'CRASHED' : 'OPERATIONAL'}`);
      console.log('✅ Spike test PASSED');
    }, 120000);
  });

  describe('Volume Testing - Large Data Processing', () => {
    it('should handle large cart orders efficiently', async () => {
      console.log('📦 Volume Test: Large cart orders');
      
      const largeCartTests = [
        { items: 10, expectedTime: 2000 },
        { items: 25, expectedTime: 3000 },
        { items: 50, expectedTime: 5000 }
      ];
      
      for (const test of largeCartTests) {
        const largeCart = createLargeCart(test.items);
        
        const startTime = Date.now();
        const result = await processLargeCartOrder(largeCart);
        const processingTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(processingTime).toBeLessThan(test.expectedTime);
        
        console.log(`✅ ${test.items} items processed in ${processingTime}ms`);
      }
      
      console.log('✅ Volume test PASSED');
    });

    it('should handle high-value orders without performance impact', async () => {
      console.log('💰 Volume Test: High-value orders');
      
      const highValueTests = [
        { amount: 100000, description: '$1,000 order' },  // $1,000
        { amount: 500000, description: '$5,000 order' },  // $5,000
        { amount: 1000000, description: '$10,000 order' } // $10,000
      ];
      
      for (const test of highValueTests) {
        const startTime = Date.now();
        const result = await processHighValueOrder(test.amount);
        const processingTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(processingTime).toBeLessThan(3000); // High value shouldn't slow processing
        
        console.log(`✅ ${test.description} processed in ${processingTime}ms`);
      }
      
      console.log('✅ High-value order test PASSED');
    });
  });

  describe('Rate Limiting & Circuit Breaker Testing', () => {
    it('should enforce rate limits under excessive load', async () => {
      console.log('🚧 Rate Limiting Test: Excessive requests from single source');
      
      const rapidRequests = [];
      const requestCount = 100;
      const timeWindow = 5000; // 5 seconds
      
      const startTime = Date.now();
      
      // Send rapid requests from same IP/session
      for (let i = 0; i < requestCount; i++) {
        rapidRequests.push(makeRapidRequest(i));
      }
      
      const results = await Promise.allSettled(rapidRequests);
      const endTime = Date.now();
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const rateLimited = results.filter(r => r.status === 'fulfilled' && r.value.rateLimited).length;
      
      // Should have some rate limiting in effect
      expect(rateLimited).toBeGreaterThan(0);
      expect(successful).toBeLessThan(requestCount);
      
      console.log('📊 Rate Limiting Results:');
      console.log(`   Total Requests: ${requestCount}`);
      console.log(`   Successful: ${successful}`);
      console.log(`   Rate Limited: ${rateLimited}`);
      console.log(`   Time Window: ${endTime - startTime}ms`);
      console.log('✅ Rate limiting test PASSED');
    });

    it('should trigger circuit breaker under sustained failures', async () => {
      console.log('⚡ Circuit Breaker Test: Sustained failures');
      
      // Send requests that will fail (invalid data)
      const failingRequests = [];
      const requestCount = 50;
      
      for (let i = 0; i < requestCount; i++) {
        failingRequests.push(makeFailingRequest());
      }
      
      const results = await Promise.allSettled(failingRequests);
      
      const failures = results.filter(r => r.status === 'fulfilled' && r.value.failed).length;
      const circuitBreakerTriggered = results.some(r => 
        r.status === 'fulfilled' && r.value.circuitBreakerOpen
      );
      
      // Circuit breaker should trigger after enough failures
      expect(failures).toBeGreaterThan(10);
      expect(circuitBreakerTriggered).toBe(true);
      
      console.log('📊 Circuit Breaker Results:');
      console.log(`   Failures: ${failures}`);
      console.log(`   Circuit Breaker Triggered: ${circuitBreakerTriggered}`);
      console.log('✅ Circuit breaker test PASSED');
    });
  });

  describe('Database/Redis Load Testing', () => {
    it('should handle high session creation/cleanup load', async () => {
      console.log('💾 Database Load Test: High session turnover');
      
      const sessionTests = [];
      const sessionCount = 200;
      
      // Create many sessions rapidly
      for (let i = 0; i < sessionCount; i++) {
        sessionTests.push(createAndCleanupSession(i));
      }
      
      const results = await Promise.allSettled(sessionTests);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      
      expect(successful).toBeGreaterThan(sessionCount * 0.9); // > 90% success
      
      console.log('📊 Session Load Results:');
      console.log(`   Sessions Created: ${sessionCount}`);
      console.log(`   Successful: ${successful}`);
      console.log(`   Success Rate: ${(successful/sessionCount*100).toFixed(2)}%`);
      console.log('✅ Session load test PASSED');
    });
  });

  // Helper Functions
  async function runLoadTest(config) {
    const results = {
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      responseTimes: [],
      systemCrashed: false
    };
    
    const startTime = Date.now();
    const userPromises = [];
    
    // Create concurrent users
    for (let userId = 0; userId < config.users; userId++) {
      const userPromise = simulateUser(userId, config.duration, results);
      userPromises.push(userPromise);
    }
    
    try {
      await Promise.allSettled(userPromises);
    } catch (error) {
      results.systemCrashed = true;
      console.error('System crashed during load test:', error);
    }
    
    // Calculate metrics
    results.successRate = (results.successCount / results.totalRequests) * 100;
    results.averageResponseTime = results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length;
    results.p95ResponseTime = calculatePercentile(results.responseTimes, 95);
    
    return results;
  }
  
  async function simulateUser(userId, duration, results) {
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      try {
        const requestStart = Date.now();
        
        // Simulate realistic user flow
        const success = await performUserAction(userId);
        
        const responseTime = Date.now() - requestStart;
        results.responseTimes.push(responseTime);
        results.totalRequests++;
        
        if (success) {
          results.successCount++;
        } else {
          results.errorCount++;
        }
        
        // Random delay between requests (realistic user behavior)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
        
      } catch (error) {
        results.errorCount++;
        results.totalRequests++;
      }
    }
  }
  
  async function performUserAction(userId) {
    const testData = {
      cart: {
        ...fixtures.valid.cart.basic,
        token: `load-test-cart-${userId}-${Date.now()}`
      },
      customer: {
        ...fixtures.valid.customer.basic,
        email: `load-test-${userId}@example.com`
      }
    };
    
    try {
      // Create session
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: testData.cart.token,
          cartTotal: testData.cart.total_price
        })
      });
      
      if (!sessionResponse.ok) return false;
      
      const session = await sessionResponse.json();
      
      // Create payment intent
      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: testData.cart.total_price,
          currency: 'usd',
          metadata: {
            customer_email: testData.customer.email,
            load_test_user: userId.toString()
          }
        })
      });
      
      return paymentResponse.ok;
      
    } catch (error) {
      return false;
    }
  }
  
  async function runEnduranceTest(config) {
    const results = {
      performanceDegradation: 0,
      memoryLeaks: false,
      successRate: 0
    };
    
    const samples = [];
    const sampleInterval = 30000; // Sample every 30 seconds
    const samplesCount = Math.floor(config.duration / sampleInterval);
    
    for (let i = 0; i < samplesCount; i++) {
      const sampleStart = Date.now();
      const sampleResults = await runLoadTest({
        users: config.users,
        duration: sampleInterval
      });
      
      samples.push({
        timestamp: sampleStart,
        averageResponseTime: sampleResults.averageResponseTime,
        successRate: sampleResults.successRate
      });
      
      console.log(`Sample ${i + 1}/${samplesCount}: ${sampleResults.averageResponseTime}ms avg, ${sampleResults.successRate.toFixed(1)}% success`);
    }
    
    // Analyze performance degradation
    const firstSample = samples[0];
    const lastSample = samples[samples.length - 1];
    
    results.performanceDegradation = ((lastSample.averageResponseTime - firstSample.averageResponseTime) / firstSample.averageResponseTime) * 100;
    results.successRate = lastSample.successRate;
    
    // Check for memory leaks (simplified check)
    const responseTimeGrowth = samples.map((sample, index) => 
      index === 0 ? 0 : sample.averageResponseTime - samples[index - 1].averageResponseTime
    );
    const averageGrowth = responseTimeGrowth.reduce((a, b) => a + b, 0) / responseTimeGrowth.length;
    results.memoryLeaks = averageGrowth > 50; // Growing more than 50ms per sample indicates potential issue
    
    return results;
  }
  
  function createLargeCart(itemCount) {
    const items = [];
    for (let i = 0; i < itemCount; i++) {
      items.push({
        variant_id: 40000000000 + i,
        quantity: Math.floor(Math.random() * 5) + 1,
        price: (Math.floor(Math.random() * 10000) + 1000),
        title: `Load Test Product ${i + 1}`
      });
    }
    
    const totalPrice = items.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    return {
      ...fixtures.valid.cart.basic,
      items,
      total_price: totalPrice,
      token: `large-cart-${Date.now()}`
    };
  }
  
  async function processLargeCartOrder(cart) {
    try {
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: cart.token,
          cartTotal: cart.total_price
        })
      });
      
      if (!sessionResponse.ok) return { success: false };
      
      const session = await sessionResponse.json();
      
      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: cart.total_price,
          currency: 'usd',
          metadata: {
            customer_email: 'volume-test@example.com',
            items: JSON.stringify(cart.items),
            item_count: cart.items.length.toString()
          }
        })
      });
      
      return { success: paymentResponse.ok };
      
    } catch (error) {
      return { success: false };
    }
  }
  
  async function processHighValueOrder(amount) {
    try {
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: `high-value-${Date.now()}`,
          cartTotal: amount
        })
      });
      
      if (!sessionResponse.ok) return { success: false };
      
      const session = await sessionResponse.json();
      
      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: amount,
          currency: 'usd',
          metadata: {
            customer_email: 'high-value-test@example.com',
            high_value_order: 'true'
          }
        })
      });
      
      return { success: paymentResponse.ok };
      
    } catch (error) {
      return { success: false };
    }
  }
  
  async function makeRapidRequest(requestId) {
    try {
      const response = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com',
          'X-Test-Request-ID': requestId.toString()
        },
        body: JSON.stringify({
          cartToken: `rapid-${requestId}`,
          cartTotal: 10000
        })
      });
      
      if (response.status === 429) {
        return { success: false, rateLimited: true };
      }
      
      return { success: response.ok, rateLimited: false };
      
    } catch (error) {
      return { success: false, rateLimited: false };
    }
  }
  
  async function makeFailingRequest() {
    try {
      const response = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token',
          'x-csrf-token': 'invalid-csrf'
        },
        body: JSON.stringify({
          amount: -1000, // Invalid amount
          currency: 'invalid'
        })
      });
      
      const isCircuitBreakerResponse = response.status === 503 || 
        (await response.text()).includes('circuit breaker');
      
      return {
        failed: !response.ok,
        circuitBreakerOpen: isCircuitBreakerResponse
      };
      
    } catch (error) {
      return { failed: true, circuitBreakerOpen: false };
    }
  }
  
  async function createAndCleanupSession(sessionId) {
    try {
      // Create session
      const createResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: `session-load-test-${sessionId}`,
          cartTotal: 10000
        })
      });
      
      if (!createResponse.ok) return { success: false };
      
      const session = await createResponse.json();
      
      // Cleanup session
      const cleanupResponse = await fetch(`${backendUrl}/api/checkout/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        }
      });
      
      return { success: cleanupResponse.ok };
      
    } catch (error) {
      return { success: false };
    }
  }
  
  async function runContinuousLoad(users, duration) {
    return runLoadTest({ users, duration });
  }
  
  function calculatePercentile(values, percentile) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }
});