// MSW (Mock Service Worker) handlers for API mocking

const { rest } = require('msw');
const { createTestSession, createTestPaymentIntent, generateTestSessionToken } = require('./test-helpers');

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Session storage for tests
const testSessions = new Map();

// Rate limiting storage  
const requestCounts = new Map();

// Helper to simulate rate limiting
function checkRateLimit(endpoint, ip = '127.0.0.1', limit = 10, window = 60000) {
  const key = `${endpoint}:${ip}`;
  const now = Date.now();
  
  if (!requestCounts.has(key)) {
    requestCounts.set(key, []);
  }
  
  const requests = requestCounts.get(key);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < window);
  
  if (validRequests.length >= limit) {
    return false; // Rate limited
  }
  
  validRequests.push(now);
  requestCounts.set(key, validRequests);
  return true;
}

// Helper to validate domains
function isValidDomain(origin) {
  const validDomains = [
    'sqqpyb-yq.myshopify.com',
    'localhost:3000',
    'localhost:9292', 
    '127.0.0.1:3000',
    'test-store.myshopify.com',
    'rthree.io'
  ];
  
  return validDomains.some(domain => origin?.includes(domain));
}

const handlers = [
  // Session creation
  rest.post(`${API_URL}/api/checkout/session`, async (req, res, ctx) => {
    const origin = req.headers.get('origin');
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // Check rate limiting for session creation (stricter)
    if (!checkRateLimit('session-create', ip, 5, 60000)) {
      return res(
        ctx.status(429),
        ctx.json({ 
          error: 'Too many session creation attempts', 
          retryAfter: 60 
        })
      );
    }
    
    // Validate domain origin
    if (!isValidDomain(origin)) {
      return res(
        ctx.status(403),
        ctx.json({ error: 'Unauthorized domain' })
      );
    }
    
    const { cartToken, cartTotal } = await req.json();
    
    if (!cartToken) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Missing cart token' })
      );
    }
    
    // Validate cart total format
    if (cartTotal !== undefined && (typeof cartTotal !== 'number' || cartTotal < 0)) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Invalid cart total' })
      );
    }
    
    const session = createTestSession({ cartToken, cartTotal });
    testSessions.set(session.sessionId, session);
    
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        sessionToken: session.sessionId,
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt
      })
    );
  }),

  // CSRF token endpoint
  rest.get(`${API_URL}/api/checkout/csrf`, (req, res, ctx) => {
    const authHeader = req.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken || !testSessions.has(sessionToken)) {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Invalid session' })
      );
    }
    
    const session = testSessions.get(sessionToken);
    return res(
      ctx.status(200),
      ctx.json({ csrfToken: session.csrfToken })
    );
  }),

  // Payment intent creation
  rest.post(`${API_URL}/api/stripe/create-payment-intent`, async (req, res, ctx) => {
    const authHeader = req.headers.get('authorization');
    const csrfToken = req.headers.get('x-csrf-token');
    const sessionToken = authHeader?.replace('Bearer ', '');
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // Check rate limiting for payment creation (moderate for testing)
    if (!checkRateLimit('payment-create', ip, 10, 60000)) {
      return res(
        ctx.status(429),
        ctx.json({ 
          error: 'Too many payment attempts', 
          retryAfter: 60 
        })
      );
    }
    
    // Validate session
    if (!sessionToken || !testSessions.has(sessionToken)) {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Invalid session' })
      );
    }
    
    const session = testSessions.get(sessionToken);
    
    // Check session expiry
    if (Date.now() > session.expiresAt) {
      testSessions.delete(sessionToken);
      return res(
        ctx.status(401),
        ctx.json({ error: 'Session expired' })
      );
    }
    
    // Validate CSRF
    if (!csrfToken || csrfToken !== session.csrfToken) {
      return res(
        ctx.status(403),
        ctx.json({ error: 'CSRF token required' })
      );
    }
    
    let { amount, metadata, customer_email, payment_method_types } = await req.json();
    
    // Validate amount
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Invalid amount' })
      );
    }
    
    // Check amount limit ($9,999.99)
    if (amount > 999999) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Amount exceeds maximum limit' })
      );
    }
    
    // Validate email format if provided
    if (customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email)) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Invalid email format' })
      );
    }
    
    // Sanitize XSS attempts in metadata
    if (metadata && typeof metadata === 'object') {
      const sanitizedMetadata = {};
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === 'string') {
          // Remove script tags and dangerous content
          sanitizedMetadata[key] = value
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<script.*?>/gi, '')
            .replace(/<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/data:text\/html/gi, '')
            .replace(/vbscript:/gi, '');
        } else {
          sanitizedMetadata[key] = value;
        }
      }
      metadata = sanitizedMetadata;
    }
    
    // Check payment method types
    const paymentTypes = payment_method_types || ['card'];
    const isAch = paymentTypes.includes('us_bank_account');
    const requires3DSecure = metadata?.card_3ds_required === 'true';
    
    // Create test payment intent
    const paymentIntent = createTestPaymentIntent({
      amount,
      metadata,
      payment_method_types: paymentTypes,
      status: isAch ? 'requires_action' : (requires3DSecure ? 'requires_action' : 'requires_confirmation'),
      next_action: isAch ? { type: 'verify_with_microdeposits' } : (requires3DSecure ? { type: 'use_stripe_sdk' } : null)
    });
    
    return res(
      ctx.status(200),
      ctx.json({
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        clientSecret: paymentIntent.client_secret, // For backward compatibility
        paymentIntentId: paymentIntent.id // For backward compatibility
      })
    );
  }),

  // Shipping calculation
  rest.post(`${API_URL}/api/calculate-shipping`, async (req, res, ctx) => {
    const { items, postalCode, address } = await req.json();
    
    if (!items || items.length === 0) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Invalid or missing items' })
      );
    }
    
    const zip = postalCode || address?.postal_code;
    if (!zip) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Postal code is required' })
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        shipping: {
          price: 1000, // $10.00
          method: 'Ground Shipping'
        }
      })
    );
  }),

  // Tax calculation
  rest.post(`${API_URL}/api/calculate-tax`, async (req, res, ctx) => {
    const { subtotal, shipping, state } = await req.json();
    
    if (typeof subtotal !== 'number' || subtotal < 0) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Invalid subtotal' })
      );
    }
    
    // Simple tax calculation for testing
    const taxRate = state === 'CA' ? 0.0725 : 0.06;
    const taxableAmount = subtotal + shipping;
    const taxAmount = Math.round(taxableAmount * taxRate);
    
    return res(
      ctx.status(200),
      ctx.json({
        taxRate,
        taxAmount,
        taxableAmount,
        total: taxableAmount + taxAmount
      })
    );
  }),

  // Logout
  rest.post(`${API_URL}/api/checkout/logout`, (req, res, ctx) => {
    const authHeader = req.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (sessionToken && testSessions.has(sessionToken)) {
      testSessions.delete(sessionToken);
    }
    
    return res(
      ctx.status(200),
      ctx.json({ success: true })
    );
  }),

  // Health check
  rest.get(`${API_URL}/health`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        kv: { status: 'OK', latency: 10 },
        environment: 'test',
        version: '3.1.0'
      })
    );
  }),

  // Stripe webhook (for testing webhook handling)
  rest.post(`${API_URL}/webhook/stripe`, async (req, res, ctx) => {
    const signature = req.headers.get('stripe-signature');
    const timestamp = req.headers.get('stripe-timestamp');
    
    if (!signature) {
      return res(
        ctx.status(400),
        ctx.text('Webhook Error: Missing stripe-signature header')
      );
    }
    
    // Simulate signature validation failure
    if (signature.includes('invalid') || signature === 't=invalid') {
      return res(
        ctx.status(400),
        ctx.text('Webhook Error: Invalid signature')
      );
    }
    
    // Simulate replay attack detection
    if (timestamp && Date.now() - parseInt(timestamp) * 1000 > 300000) { // 5 minutes
      return res(
        ctx.status(400),
        ctx.text('Webhook Error: Timestamp too old')
      );
    }
    
    const body = await req.text();
    
    // Validate body tampering
    if (body.includes('tampered')) {
      return res(
        ctx.status(400),
        ctx.text('Webhook Error: Invalid payload')
      );
    }
    
    // Simulate webhook processing
    return res(
      ctx.status(200),
      ctx.json({ received: true })
    );
  }),

  // Shopify cart endpoints
  rest.get('/cart.js', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(createTestCart())
    );
  }),

  rest.post('/cart/update.js', async (req, res, ctx) => {
    const { attributes } = await req.json();
    
    // Return updated cart with new attributes
    return res(
      ctx.status(200),
      ctx.json(createTestCart({ attributes }))
    );
  }),

  rest.post('/cart/clear.js', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ items: [], total_price: 0 })
    );
  }),

  // API Stripe webhook endpoint (for order creation tests)
  rest.post(`${API_URL}/api/stripe/webhook`, async (req, res, ctx) => {
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      return res(
        ctx.status(400),
        ctx.text('Webhook Error: Missing stripe-signature header')
      );
    }
    
    // Simulate signature validation failure
    if (signature.includes('invalid')) {
      return res(
        ctx.status(400),
        ctx.text('Webhook Error: Invalid signature')
      );
    }
    
    const event = await req.json();
    
    // Simulate webhook processing
    console.log('Processing webhook event:', event.type);
    
    return res(
      ctx.status(200),
      ctx.json({ received: true })
    );
  })
];

// Helper to clear test sessions between tests
function clearTestSessions() {
  testSessions.clear();
  requestCounts.clear();
}

// Helper to add a test session manually
function addTestSession(sessionId, sessionData) {
  testSessions.set(sessionId, sessionData);
}

// Helper to get a test session
function getTestSession(sessionId) {
  return testSessions.get(sessionId);
}

// Helper to reset rate limiting
function resetRateLimiting() {
  requestCounts.clear();
}

module.exports = {
  handlers,
  clearTestSessions,
  addTestSession,
  getTestSession,
  resetRateLimiting
};