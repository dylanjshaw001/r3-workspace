// Deployment validation script
// Runs automated checks to ensure deployment is successful and healthy

import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

// Configuration
const DEPLOYMENT_URL = process.env.DEPLOYMENT_URL || 'https://r3-backend.vercel.app';
const STAGING_URL = process.env.STAGING_URL || 'https://r3-backend-staging.vercel.app';
const TEST_TIMEOUT = 30000; // 30 seconds

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Test results collector
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: []
};

// Helper to make requests with timeout
async function fetchWithTimeout(url, options = {}, timeout = TEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// Test runner
async function runTest(name, testFn) {
  process.stdout.write(`Testing ${name}... `);
  const start = performance.now();

  try {
    await testFn();
    const duration = performance.now() - start;
    console.log(`${colors.green}✓${colors.reset} (${duration.toFixed(0)}ms)`);
    results.passed++;
  } catch (error) {
    const duration = performance.now() - start;
    console.log(`${colors.red}✗${colors.reset} (${duration.toFixed(0)}ms)`);
    console.error(`  ${colors.red}Error: ${error.message}${colors.reset}`);
    results.failed++;
    results.errors.push({ test: name, error: error.message });
  }
}

// Validation tests
async function validateDeployment(baseUrl) {
  console.log(`\n${colors.bright}${colors.blue}Validating deployment: ${baseUrl}${colors.reset}\n`);

  // 1. Basic connectivity
  await runTest('Root endpoint accessibility', async () => {
    const response = await fetchWithTimeout(baseUrl);
    const data = await response.json();

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!data.service || !data.version) {
      throw new Error('Missing service information');
    }
  });

  // 2. Health check
  await runTest('Health check endpoint', async () => {
    const response = await fetchWithTimeout(`${baseUrl}/health`);
    const data = await response.json();

    if (response.status !== 200) {
      throw new Error(`Health check returned status ${response.status}`);
    }

    if (data.status !== 'healthy' && data.status !== 'degraded') {
      throw new Error(`Unhealthy status: ${data.status}`);
    }

    // Check critical services
    if (data.circuitBreakers) {
      const criticalBreakers = ['stripe', 'redis'];
      for (const breaker of criticalBreakers) {
        if (data.circuitBreakers[breaker]?.state === 'OPEN') {
          results.warnings++;
          console.warn(`\n  ${colors.yellow}Warning: ${breaker} circuit breaker is OPEN${colors.reset}`);
        }
      }
    }
  });

  // 3. CORS configuration
  await runTest('CORS configuration', async () => {
    const testOrigin = 'https://sqqpyb-yq.myshopify.com';
    const response = await fetchWithTimeout(baseUrl, {
      headers: {
        'Origin': testOrigin
      }
    });

    // Check CORS headers
    const corsHeader = response.headers.get('access-control-allow-origin');
    if (!corsHeader) {
      throw new Error('Missing CORS headers');
    }
  });

  // 4. Session creation
  await runTest('Session creation endpoint', async () => {
    const response = await fetchWithTimeout(`${baseUrl}/api/checkout/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://sqqpyb-yq.myshopify.com'
      },
      body: JSON.stringify({
        cartToken: `deployment-test-${Date.now()}`,
        cartTotal: 10000
      })
    });

    if (response.status !== 200) {
      const error = await response.json();
      throw new Error(`Session creation failed: ${error.error || response.status}`);
    }

    const data = await response.json();
    if (!data.sessionToken || !data.csrfToken) {
      throw new Error('Missing session or CSRF token');
    }
  });

  // 5. Required endpoints
  const requiredEndpoints = [
    { path: '/api/checkout/csrf', method: 'GET', needsAuth: true },
    { path: '/api/calculate-shipping', method: 'POST', needsAuth: true },
    { path: '/api/calculate-tax', method: 'POST', needsAuth: true },
    { path: '/api/stripe/create-payment-intent', method: 'POST', needsAuth: true },
    { path: '/api/checkout/logout', method: 'POST', needsAuth: true },
    { path: '/monitoring', method: 'GET', needsAuth: false }
  ];

  for (const endpoint of requiredEndpoints) {
    await runTest(`Endpoint ${endpoint.path}`, async () => {
      const headers = {
        'Content-Type': 'application/json',
        'Origin': 'https://sqqpyb-yq.myshopify.com'
      };

      // For authenticated endpoints, we expect 401 without auth
      if (endpoint.needsAuth) {
        const response = await fetchWithTimeout(`${baseUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers,
          body: endpoint.method === 'POST' ? '{}' : undefined
        });

        if (response.status !== 401 && response.status !== 403) {
          throw new Error(`Expected 401/403 without auth, got ${response.status}`);
        }
      } else {
        // Non-auth endpoints should be accessible
        const response = await fetchWithTimeout(`${baseUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers
        });

        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }
      }
    });
  }

  // 6. Performance check
  await runTest('Response time (< 2s)', async () => {
    const start = performance.now();
    await fetchWithTimeout(`${baseUrl}/health`);
    const duration = performance.now() - start;

    if (duration > 2000) {
      throw new Error(`Response took ${duration.toFixed(0)}ms (> 2000ms)`);
    }
  });

  // 7. Circuit breaker functionality
  await runTest('Circuit breaker status', async () => {
    // Create a session first
    const sessionResponse = await fetchWithTimeout(`${baseUrl}/api/checkout/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://sqqpyb-yq.myshopify.com'
      },
      body: JSON.stringify({
        cartToken: `breaker-test-${Date.now()}`,
        cartTotal: 5000
      })
    });

    const { sessionToken } = await sessionResponse.json();

    // Check circuit breaker endpoint
    const response = await fetchWithTimeout(`${baseUrl}/api/circuit-breakers`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    if (response.status !== 200) {
      throw new Error(`Circuit breaker endpoint returned ${response.status}`);
    }

    const data = await response.json();
    if (!data.states || !data.timestamp) {
      throw new Error('Invalid circuit breaker response format');
    }
  });

  // 8. Monitoring dashboard
  await runTest('Monitoring dashboard', async () => {
    const response = await fetchWithTimeout(`${baseUrl}/monitoring`);

    if (response.status !== 200) {
      throw new Error(`Monitoring dashboard returned ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      throw new Error('Monitoring dashboard should return HTML');
    }
  });
}

// Smoke test for critical user flows
async function runSmokeTests(baseUrl) {
  console.log(`\n${colors.bright}${colors.blue}Running smoke tests${colors.reset}\n`);

  await runTest('Complete checkout flow', async () => {
    // 1. Create session
    const sessionResponse = await fetchWithTimeout(`${baseUrl}/api/checkout/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://sqqpyb-yq.myshopify.com'
      },
      body: JSON.stringify({
        cartToken: `smoke-test-${Date.now()}`,
        cartTotal: 10000
      })
    });

    const { sessionToken, csrfToken } = await sessionResponse.json();

    // 2. Calculate shipping
    const shippingResponse = await fetchWithTimeout(`${baseUrl}/api/calculate-shipping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify({
        items: [{ weight: 1000, quantity: 1 }],
        postalCode: '10001',
        country: 'US'
      })
    });

    if (shippingResponse.status !== 200) {
      throw new Error(`Shipping calculation failed: ${shippingResponse.status}`);
    }

    // 3. Calculate tax
    const taxResponse = await fetchWithTimeout(`${baseUrl}/api/calculate-tax`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify({
        subtotal: 10000,
        shipping: 1000,
        state: 'CA'
      })
    });

    if (taxResponse.status !== 200) {
      throw new Error(`Tax calculation failed: ${taxResponse.status}`);
    }

    // 4. Logout
    const logoutResponse = await fetchWithTimeout(`${baseUrl}/api/checkout/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
        'x-csrf-token': csrfToken
      }
    });

    if (logoutResponse.status !== 200) {
      throw new Error(`Logout failed: ${logoutResponse.status}`);
    }
  });
}

// Main execution
async function main() {
  const targetUrl = process.argv[2] || DEPLOYMENT_URL;
  const isProduction = targetUrl.includes('r3-backend.vercel.app');

  console.log(`${colors.bright}R3 Payment Backend - Deployment Validation${colors.reset}`);
  console.log('='.repeat(50));
  console.log(`Target: ${targetUrl}`);
  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'STAGING'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  try {
    // Run validation tests
    await validateDeployment(targetUrl);

    // Run smoke tests
    await runSmokeTests(targetUrl);

    // Summary
    console.log(`\n${'='.repeat(50)}`);
    console.log(`${colors.bright}Summary:${colors.reset}`);
    console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${results.warnings}${colors.reset}`);

    if (results.failed > 0) {
      console.log(`\n${colors.red}Deployment validation FAILED${colors.reset}`);
      console.log('\nErrors:');
      results.errors.forEach(({ test, error }) => {
        console.log(`  - ${test}: ${error}`);
      });
      process.exit(1);
    } else if (results.warnings > 0) {
      console.log(`\n${colors.yellow}Deployment validation PASSED with warnings${colors.reset}`);
      process.exit(0);
    } else {
      console.log(`\n${colors.green}Deployment validation PASSED${colors.reset}`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`\n${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateDeployment, runSmokeTests };
