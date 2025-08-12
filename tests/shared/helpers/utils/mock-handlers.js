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
    'rthree.io',
    'www.rthree.io',
    'r3-stage.myshopify.com'
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

  // GET session endpoint (for error testing)
  rest.get(`${API_URL}/api/checkout/session`, (req, res, ctx) => {
    return res(
      ctx.status(405),
      ctx.json({ error: 'Method not allowed. Use POST to create sessions.' })
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
    
    // Check if session is expired
    if (session.expiresAt && session.expiresAt < Date.now()) {
      // Remove expired session from map
      testSessions.delete(sessionToken);
      return res(
        ctx.status(401),
        ctx.json({ error: 'Session expired' })
      );
    }
    
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
        ctx.json({ error: 'Invalid amount: exceeds maximum limit' })
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
    const authHeader = req.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    // Validate session
    if (!sessionToken || !testSessions.has(sessionToken)) {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Invalid session' })
      );
    }
    
    const session = testSessions.get(sessionToken);
    
    // Check if session is expired
    if (session.expiresAt && session.expiresAt < Date.now()) {
      testSessions.delete(sessionToken);
      return res(
        ctx.status(401),
        ctx.json({ error: 'Session expired' })
      );
    }
    
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
    
    // Check for ONEbox products to calculate shipping appropriately
    let hasONEboxProducts = false;
    let totalONEboxQuantity = 0;
    
    items.forEach(item => {
      // Check properties field for _onebox flag (used in tests)
      const hasOneboxProperty = item.properties && 
        (item.properties._onebox === 'true' || 
         item.properties._onebox === true);
      
      // Check title for ONEbox
      const itemTitle = (item.title || '').toLowerCase();
      const isONEbox = hasOneboxProperty || 
        itemTitle.includes('onebox') ||
        itemTitle.includes('naloxone') ||
        itemTitle.includes('narcan');
      
      if (isONEbox) {
        hasONEboxProducts = true;
        totalONEboxQuantity += Number(item.quantity) || 1;
      }
    });
    
    // Calculate shipping price based on product type
    let shippingPrice = 1000; // Default $10.00
    if (hasONEboxProducts) {
      // ONEbox shipping: $25 per case of 10, or $5 per unit
      const caseSize = 10;
      const casePrice = 2500; // $25 in cents
      const unitPrice = 500;  // $5 in cents
      
      const cases = Math.floor(totalONEboxQuantity / caseSize);
      const remainingUnits = totalONEboxQuantity % caseSize;
      shippingPrice = (cases * casePrice) + (remainingUnits * unitPrice);
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        shipping: {
          price: shippingPrice,
          method: 'Ground Shipping',
          description: hasONEboxProducts ? 
            `ONEbox shipping (${totalONEboxQuantity} units)` : 
            'Standard shipping'
        }
      })
    );
  }),

  // Tax calculation
  rest.post(`${API_URL}/api/calculate-tax`, async (req, res, ctx) => {
    const authHeader = req.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    // Validate session
    if (!sessionToken || !testSessions.has(sessionToken)) {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Invalid session' })
      );
    }
    
    const session = testSessions.get(sessionToken);
    
    // Check if session is expired
    if (session.expiresAt && session.expiresAt < Date.now()) {
      testSessions.delete(sessionToken);
      return res(
        ctx.status(401),
        ctx.json({ error: 'Session expired' })
      );
    }
    
    const { subtotal, shipping, state } = await req.json();
    
    if (typeof subtotal !== 'number' || subtotal < 0) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Invalid subtotal' })
      );
    }
    
    // Validate state format - reject SQL injection attempts
    if (state && (typeof state !== 'string' || state.length > 2 || 
                  state.includes("'") || state.includes(";") || state.includes("-") ||
                  state.includes("DROP") || state.includes("DELETE") || state.includes("OR"))) {
      return res(
        ctx.status(400),
        ctx.json({ error: 'Invalid state format' })
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
    
    // Validate session first
    if (!sessionToken || !testSessions.has(sessionToken)) {
      return res(
        ctx.status(401),
        ctx.json({ error: 'Invalid session' })
      );
    }
    
    // Delete the session
    testSessions.delete(sessionToken);
    
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
  
  // Root endpoint
  rest.get(`${API_URL}/`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.text('R3 Backend API')
    );
  }),
  
  // Non-existent endpoint for error testing
  rest.get(`${API_URL}/api/error`, (req, res, ctx) => {
    return res(
      ctx.status(404),
      ctx.json({ error: 'Endpoint not found' })
    );
  }),

  // Stripe webhook (for testing webhook handling)
  rest.post(`${API_URL}/webhook/stripe`, async (req, res, ctx) => {
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      return res(
        ctx.status(400),
        ctx.text('Webhook Error: Missing stripe-signature header')
      );
    }
    
    // Parse timestamp from signature header (format: t=1234567890,v1=signature)
    let timestamp = null;
    const timestampMatch = signature.match(/t=(\d+)/);
    if (timestampMatch) {
      timestamp = parseInt(timestampMatch[1]);
    }
    
    // Simulate signature validation failure
    if (signature.includes('invalid-signature') || signature.includes('invalid_signature') || signature.includes('signature_for_different_body')) {
      return res(
        ctx.status(400),
        ctx.text('Webhook Error: Invalid signature')
      );
    }
    
    // Simulate replay attack detection (timestamp older than 5 minutes)
    if (timestamp && Date.now() - timestamp * 1000 > 300000) { // 5 minutes
      return res(
        ctx.status(400),
        ctx.text('Webhook Error: Timestamp too old')
      );
    }
    
    const body = await req.text();
    
    // Detect body tampering by checking for modified amount or other tampering indicators
    const parsedBody = JSON.parse(body);
    if (parsedBody.data?.object?.amount === 1 && signature.includes('signature_for_different_body')) {
      return res(
        ctx.status(400),
        ctx.text('Webhook Error: Signature verification failed')
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
    
    // If this is a payment_intent.succeeded event, simulate order creation
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const environment = paymentIntent.metadata?.environment || 'dev';
      
      // Simulate the order creation that would happen in the real webhook
      // This will make a simulated request to Shopify API which will be caught by test-specific handlers
      try {
        const orderData = {
          email: paymentIntent.metadata?.customer_email || 'test@example.com',
          financial_status: 'paid',
          total_price: paymentIntent.amount / 100,
          payment_intent_id: paymentIntent.id,
          source_name: 'web',
          tags: environment !== 'production' ? ['test-order'] : []
        };
        
        // Determine which Shopify endpoint to call based on environment
        const isDraftOrder = environment !== 'production';
        const endpoint = isDraftOrder ? 'draft_orders.json' : 'orders.json';
        const shopifyDomain = environment === 'production' ? 'rthree.io' : 'sqqpyb-yq.myshopify.com';
        
        // Make the simulated Shopify API call (will be intercepted by test handlers)
        await fetch(`https://${shopifyDomain}/admin/api/2024-01/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isDraftOrder ? { draft_order: orderData } : { order: orderData })
        });
      } catch (error) {
        // Ignore fetch errors in test environment
        console.log('Simulated order creation (test mode)');
      }
    }
    
    return res(
      ctx.status(200),
      ctx.json({ received: true })
    );
  }),

  // Shopify Admin API endpoints (for order creation tests)
  rest.post('https://sqqpyb-yq.myshopify.com/admin/api/*/draft_orders.json', async (req, res, ctx) => {
    const requestBody = await req.json();
    const draftOrder = requestBody.draft_order;
    
    // This handler can be overridden by individual tests for specific tracking
    return res(
      ctx.status(200),
      ctx.json({
        draft_order: {
          id: Math.floor(Math.random() * 1000000),
          created_at: new Date().toISOString(),
          ...draftOrder
        }
      })
    );
  }),

  rest.post('https://rthree.io/admin/api/*/orders.json', async (req, res, ctx) => {
    const requestBody = await req.json();
    const order = requestBody.order;
    
    // This handler can be overridden by individual tests for specific tracking
    return res(
      ctx.status(200),
      ctx.json({
        order: {
          id: Math.floor(Math.random() * 1000000),
          created_at: new Date().toISOString(),
          ...order
        }
      })
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