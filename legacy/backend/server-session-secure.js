import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { kv } from '@vercel/kv';
import { calculateShipping } from './utils/shipping.js';
import { calculateTax } from './utils/tax.js';
import { getStoreConfig } from './config/index.js';
import { validateCartWithShopify } from './utils/cartValidation.js';
import { isValidShopifyDomain, createSafeError, sanitizeCustomerData } from './utils/security.js';
import { logger } from './utils/logger.js';
import { apiLimiter, sessionLimiter, paymentLimiter } from './middleware/rateLimiter.js';
import {
  createSecureSession,
  getSecureSession,
  deleteSession,
  getCookieOptions,
  generateCSRFToken,
  validateCSRFToken,
  getDomainFromRequest
} from './utils/session.js';

// Initialize logger
logger.info('Server-session-secure.js loaded');

// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  import('dotenv').then(module => module.config());
}

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Check for required environment variables
if (!process.env.STRIPE_SECRET_KEY) {
  logger.error('Missing STRIPE_SECRET_KEY environment variable');
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY.trim()) : null;

// Ensure webhook secret is trimmed at startup
if (process.env.STRIPE_WEBHOOK_SECRET) {
  process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET.trim();
}

// Middleware
const allowedOrigins = [
  'https://sqqpyb-yq.myshopify.com',
  'https://rthree.io',
  'https://www.rthree.io',
  'https://rapidriskreduction.com',
  'https://shop.rapidriskreduction.com',
  'https://r3-stage.myshopify.com',
  'http://localhost:9292', // Shopify local dev
  process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim() : null
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {return callback(null, true);}

    // Check exact matches
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    // Only allow specific Shopify stores
    const allowedShopifyStores = [
      'sqqpyb-yq.myshopify.com',
      'r3-stage.myshopify.com'
    ];

    const shopifyDomain = origin.match(/https?:\/\/([^\/]+\.myshopify\.com)/);
    if (shopifyDomain && allowedShopifyStores.includes(shopifyDomain[1])) {
      callback(null, true);
      return;
    }

    // Allow Shopify preview URLs only for allowed stores
    if (origin.includes('shopifypreview.com')) {
      callback(null, true);
      return;
    }

    // Allow localhost with any port
    if (origin.startsWith('http://localhost') || origin.startsWith('https://localhost')) {
      callback(null, true);
      return;
    }

    logger.securityEvent('CORS blocked origin', { origin });
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Important for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Cookie parser
app.use(cookieParser());

// Request logging middleware
app.use(logger.requestLogger());

// Apply rate limiting
app.use('/api/', apiLimiter);

// Body parsing middleware with size limits
app.use(express.json({
  limit: '1mb',  // Prevent large payloads
  strict: true   // Only accept arrays and objects
}));

// Session validation middleware
const validateSecureSession = async (req, res, next) => {
  // Try cookie first, then Authorization header
  let sessionId = req.cookies?.sessionId;

  // Fallback to Authorization header for cross-origin requests
  if (!sessionId) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionId = authHeader.substring(7);
    }
  }

  if (!sessionId) {
    return res.status(401).json({ error: 'No session found' });
  }

  const result = await getSecureSession(sessionId, req);

  if (!result.valid) {
    // Clear invalid cookie
    res.clearCookie('sessionId');

    if (result.suspicious) {
      logger.securityEvent('Suspicious session activity detected', {
        sessionId: `${sessionId.substring(0, 8)}...`,
        reason: result.error
      });
    }

    return res.status(401).json({ error: result.error });
  }

  // Attach session to request
  req.session = result.session;
  req.sessionId = sessionId;
  next();
};

// CSRF validation middleware
const validateCSRF = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const csrfToken = req.headers['x-csrf-token'];
  const sessionCSRF = req.session?.csrfToken;

  if (!validateCSRFToken(sessionCSRF, csrfToken)) {
    logger.securityEvent('CSRF validation failed', {
      sessionId: `${req.sessionId?.substring(0, 8)}...`,
      method: req.method,
      path: req.path
    });
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'R3 Payment Backend API (Secure)', version: '3.0.0' });
});

// Health check
app.get('/health', async (req, res) => {
  let kvStatus = 'unknown';
  try {
    await kv.set('health-check', 'ok', { ex: 10 });
    const value = await kv.get('health-check');
    kvStatus = value === 'ok' ? 'connected' : 'error';
  } catch (error) {
    kvStatus = `error: ${error.message}`;
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    kv: kvStatus,
    secure: true,
    env: {
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasKvUrl: !!process.env.KV_REST_API_URL,
      hasKvToken: !!process.env.KV_REST_API_TOKEN
    }
  });
});

// Create secure checkout session
app.post('/api/checkout/session', sessionLimiter, async (req, res) => {
  try {
    const { cartToken, cartTotal } = req.body;

    // Get domain from request headers, not body
    const domain = getDomainFromRequest(req);

    if (!cartToken) {
      return res.status(400).json({ error: 'Missing cart token' });
    }

    // Validate domain is allowed
    if (!isValidShopifyDomain(domain)) {
      logger.securityEvent('Invalid domain attempted', { domain });
      return res.status(403).json({ error: 'Unauthorized domain' });
    }

    // Validate the cart with updated validation logic
    const cartValidation = await validateCartWithShopify(cartToken, domain, { cartTotal });
    if (!cartValidation.valid) {
      logger.warn('Invalid cart detected', {
        cartToken: `${cartToken.substring(0, 8)}...`,
        domain,
        validation: cartValidation
      });
      return res.status(400).json({ error: 'Invalid cart', details: cartValidation.error });
    }

    // Generate CSRF token first
    const csrfToken = generateCSRFToken();

    // Create secure session with CSRF token included
    const { sessionId, session } = await createSecureSession(req, {
      cartToken,
      cartTotal: cartValidation.shopifyTotal || cartTotal,
      csrfToken
    });

    // Set secure HTTP-only cookie
    res.cookie('sessionId', sessionId, getCookieOptions(isProduction));

    res.json({
      success: true,
      sessionToken: sessionId, // For cross-origin requests
      csrfToken, // Client needs this for subsequent requests
      expiresIn: 1800 // 30 minutes in seconds
    });
  } catch (error) {
    logger.error('Session creation error', { error: error.message });
    res.status(500).json(createSafeError(error, !isProduction));
  }
});

// Get CSRF token for existing session
app.get('/api/checkout/csrf', validateSecureSession, (req, res) => {
  const csrfToken = req.session.csrfToken || generateCSRFToken();

  // Update session with new CSRF token if needed
  if (!req.session.csrfToken) {
    req.session.csrfToken = csrfToken;
    kv.set(`session:${req.sessionId}`, req.session, {
      ex: Math.floor((req.session.expiresAt - Date.now()) / 1000)
    });
  }

  res.json({ csrfToken });
});

// Logout endpoint
app.post('/api/checkout/logout', validateSecureSession, async (req, res) => {
  await deleteSession(req.sessionId);
  res.clearCookie('sessionId');
  res.json({ success: true });
});

// Calculate shipping (secure session auth)
app.post('/api/calculate-shipping', validateSecureSession, validateCSRF, async (req, res) => {
  try {
    const { items, postalCode, country = 'US', subtotal, address } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid or missing items' });
    }

    // Handle both old format (postalCode) and new format (address)
    let validatedPostalCode = postalCode;
    if (address && address.postal_code) {
      validatedPostalCode = address.postal_code;
    }

    if (!validatedPostalCode) {
      return res.status(400).json({ error: 'Postal code is required' });
    }

    // Validate postal code format (US ZIP codes)
    if (country === 'US' && !/^\d{5}(-\d{4})?$/.test(validatedPostalCode)) {
      return res.status(400).json({ error: 'Invalid US postal code format' });
    }

    const rates = calculateShipping(items, validatedPostalCode, country, subtotal);
    res.json({ rates });
  } catch (error) {
    logger.error('Shipping calculation error', { error: error.message });
    res.status(500).json(createSafeError(error, !isProduction));
  }
});

// Calculate tax (secure session auth)
app.post('/api/calculate-tax', validateSecureSession, validateCSRF, async (req, res) => {
  try {
    const { subtotal, shipping, state } = req.body;
    const tax = calculateTax(subtotal, shipping, state);
    res.json(tax);
  } catch (error) {
    logger.error('Tax calculation error', { error: error.message });
    res.status(500).json(createSafeError(error, !isProduction));
  }
});

// Create payment intent (secure session auth)
app.post('/api/stripe/create-payment-intent', paymentLimiter, validateSecureSession, validateCSRF, async (req, res) => {
  try {
    const { amount, currency = 'usd', metadata = {} } = req.body;

    // Validate amount
    if (!amount || amount <= 0 || amount > 999999) { // Max $9,999.99
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    // Add session info to metadata
    metadata.sessionId = req.sessionId;
    metadata.cartToken = req.session.cartToken;
    metadata.domain = req.session.domain;

    // Sanitize metadata
    if (metadata.customer_email) {
      metadata.customer_email = sanitizeCustomerData({ email: metadata.customer_email }).email;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount, // Already in cents from frontend
      currency,
      payment_method_types: req.body.payment_method_types || ['card'],
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });

    // Track payment intent in session
    req.session.paymentIntents.push(paymentIntent.id);
    // Update session in KV
    await kv.set(`session:${req.sessionId}`, req.session, {
      ex: Math.floor((req.session.expiresAt - Date.now()) / 1000)
    });

    logger.paymentEvent('Payment intent created', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    logger.error('Payment intent creation error', { error: error.message });
    res.status(500).json(createSafeError(error, !isProduction));
  }
});

// Don't start server in Vercel environment
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Secure server running on port ${PORT}`);
  });
}

export default app;
