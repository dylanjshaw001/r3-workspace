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

// Import circuit breakers and retry logic
import { stripeBreaker, shopifyBreaker, redisBreaker, getAllBreakerStates } from './utils/circuitBreaker.js';
import { retryStripe, retryShopify, retryRedis } from './utils/retry.js';

// Initialize logger
logger.info('Server-session-integrated.js loaded with circuit breakers and retry logic');

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
  'https://r3-stage.myshopify.com',
  'https://rapidriskreduction.com',
  'https://shop.rapidriskreduction.com'
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) ||
        origin.includes('localhost') ||
        origin.includes('shopifypreview.com')) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'R3 Payment Backend',
    version: '1.0.2',
    status: 'operational',
    endpoints: {
      health: '/health',
      monitoring: '/monitoring',
      session: 'POST /api/checkout/session',
      payment: 'POST /api/stripe/create-payment-intent',
      shipping: 'POST /api/calculate-shipping',
      tax: 'POST /api/calculate-tax'
    },
    documentation: 'https://github.com/dylanjshaw001/r3-nu/tree/main/r3-payment-backend/docs'
  });
});

// Health check endpoint with circuit breaker status
app.get('/health', async (req, res) => {
  try {
    // Check Redis connection with circuit breaker
    const kvCheck = await redisBreaker.call(
      async () => {
        await kv.ping();
        return 'OK';
      },
      async () => 'DEGRADED' // Fallback if Redis is down
    );

    // Get circuit breaker states
    const breakerStates = getAllBreakerStates();

    res.json({
      status: 'healthy',
      kv: kvCheck,
      circuitBreakers: breakerStates,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      circuitBreakers: getAllBreakerStates()
    });
  }
});

// Session validation middleware with retry
async function validateSecureSession(req, res, next) {
  try {
    const sessionToken = req.cookies?.session_token ||
                       req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    // Get session with circuit breaker and retry
    const session = await redisBreaker.call(
      async () => retryRedis(async () => {
        return await getSecureSession(sessionToken, req);
      })
    );

    if (!session.valid) {
      return res.status(401).json({
        error: session.error || 'Invalid session',
        suspicious: session.suspicious
      });
    }

    req.session = session.data;
    req.sessionId = sessionToken;
    next();
  } catch (error) {
    logger.error('Session validation error', { error: error.message });
    res.status(500).json(createSafeError(error, !isProduction));
  }
}

// CSRF validation middleware
function validateCSRF(req, res, next) {
  const csrfToken = req.headers['x-csrf-token'];

  if (!validateCSRFToken(csrfToken, req.session)) {
    return res.status(401).json({ error: 'Invalid CSRF token' });
  }

  next();
}

// Create checkout session with retry
app.post('/api/checkout/session', sessionLimiter, async (req, res) => {
  try {
    const { cartToken, domain, cartTotal } = req.body;

    if (!cartToken) {
      return res.status(400).json({ error: 'Missing cart token' });
    }

    const sanitizedDomain = getDomainFromRequest(req, domain);

    if (!isValidShopifyDomain(sanitizedDomain)) {
      return res.status(400).json({ error: 'Invalid domain' });
    }

    // Validate cart if needed
    // Note: We're using lenient validation for cart tokens
    const cartValidation = await validateCartWithShopify(cartToken, sanitizedDomain, cartTotal);
    if (!cartValidation.valid) {
      logger.warn('Cart validation failed (lenient mode)', {
        cartToken,
        reason: cartValidation.error
      });
    }

    // Generate CSRF token
    const csrfToken = generateCSRFToken();

    // Create session with retry
    const { sessionId, cookieOptions } = await retryRedis(async () => {
      return await createSecureSession({
        cartToken,
        domain: sanitizedDomain,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        csrfToken
      });
    });

    // Set secure HTTP-only cookie
    res.cookie('session_token', sessionId, cookieOptions);

    logger.sessionEvent('Session created', {
      sessionId,
      domain: sanitizedDomain,
      cartValidation: cartValidation.valid ? 'passed' : 'failed'
    });

    res.json({
      success: true,
      sessionToken: sessionId, // For cross-origin requests
      csrfToken, // Client needs this for subsequent requests
      expiresIn: 1800 // 30 minutes in seconds
    });
  } catch (error) {
    logger.error('Session creation error', {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json(createSafeError(error, !isProduction));
  }
});

// Create payment intent with circuit breaker and retry
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

    // Create payment intent with circuit breaker and retry
    const paymentIntent = await stripeBreaker.call(
      async () => retryStripe(async (attempt) => {
        logger.info(`Creating payment intent (attempt ${attempt})`, {
          amount,
          currency,
          sessionId: req.sessionId
        });

        return await stripe.paymentIntents.create({
          amount, // Already in cents from frontend
          currency,
          payment_method_types: req.body.payment_method_types || ['card'],
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString()
          }
        });
      }),
      async () => {
        // Fallback if Stripe is completely down
        logger.error('Stripe circuit breaker open - returning error to client');
        throw new Error('Payment service temporarily unavailable. Please try again in a few minutes.');
      }
    );

    // Track payment intent in session with retry
    await retryRedis(async () => {
      req.session.paymentIntents.push(paymentIntent.id);

      // Update session in KV
      await kv.set(`session:${req.sessionId}`, req.session, {
        ex: Math.floor((req.session.expiresAt - Date.now()) / 1000)
      });
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
    logger.error('Payment intent creation error', {
      error: error.message,
      sessionId: req.sessionId,
      amount: req.body.amount
    });

    // Check if this is a circuit breaker error
    if (error.message.includes('circuit breaker')) {
      return res.status(503).json({
        error: 'Payment service temporarily unavailable',
        retryAfter: 60 // seconds
      });
    }

    res.status(500).json(createSafeError(error, !isProduction));
  }
});

// Calculate shipping with circuit breaker
app.post('/api/calculate-shipping', apiLimiter, validateSecureSession, async (req, res) => {
  try {
    const shipping = await shopifyBreaker.call(
      async () => calculateShipping(req.body),
      async () => {
        // Fallback shipping rates if Shopify is down
        return [{
          id: 'standard',
          label: 'Standard Shipping',
          amount: 10.00,
          description: '5-7 business days'
        }];
      }
    );

    res.json(shipping);
  } catch (error) {
    logger.error('Shipping calculation error', { error: error.message });
    res.status(500).json(createSafeError(error, !isProduction));
  }
});

// Monitoring dashboard
import { monitoringDashboardHandler } from './utils/monitoringDashboard.js';
import { getDashboardData } from './utils/monitoring.js';

app.get('/monitoring', monitoringDashboardHandler(getDashboardData));

// Circuit breaker status endpoint
app.get('/api/circuit-breakers', validateSecureSession, (req, res) => {
  res.json({
    states: getAllBreakerStates(),
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
export default app;

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Reset circuit breakers to allow final operations
  stripeBreaker.reset();
  shopifyBreaker.reset();
  redisBreaker.reset();

  // Allow time for cleanup
  setTimeout(() => {
    process.exit(0);
  }, 5000);
});
