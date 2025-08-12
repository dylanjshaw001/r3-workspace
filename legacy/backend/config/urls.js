/**
 * URL Configuration for R3 Payment Backend
 * Centralizes all external URLs and API endpoints
 */

import { CONFIG } from './constants.js';

export const URLS = {
  // Frontend URLs (allowed origins for CORS)
  frontend: {
    production: [
      `https://${CONFIG.DOMAINS.SHOPIFY_STORE}`,
      `https://${CONFIG.DOMAINS.PRODUCTION}`,
      `https://${CONFIG.DOMAINS.PRODUCTION_WWW}`,
      `https://${CONFIG.DOMAINS.ALTERNATE_1}`,
      `https://${CONFIG.DOMAINS.ALTERNATE_2}`
    ],
    staging: [
      `https://${CONFIG.DOMAINS.SHOPIFY_STORE}` // Same store, different theme
    ],
    development: [
      `http://localhost:${CONFIG.PORTS.FRONTEND_DEV}`,
      `https://localhost:${CONFIG.PORTS.FRONTEND_DEV}`,
      `http://127.0.0.1:${CONFIG.PORTS.FRONTEND_DEV}`
    ]
  },

  // Shopify API endpoints (from constants)
  shopify: CONFIG.SHOPIFY_API,

  // Stripe Webhook Endpoints (configured in Stripe Dashboard)
  webhooks: {
    production: CONFIG.BACKEND_URLS.PRODUCTION + CONFIG.API_ENDPOINTS.STRIPE_WEBHOOK,
    staging: CONFIG.BACKEND_URLS.STAGING + CONFIG.API_ENDPOINTS.STRIPE_WEBHOOK,
    development: CONFIG.BACKEND_URLS.DEVELOPMENT + CONFIG.API_ENDPOINTS.STRIPE_WEBHOOK,
    local: CONFIG.BACKEND_URLS.LOCAL + CONFIG.API_ENDPOINTS.STRIPE_WEBHOOK
  },

  // Vercel API (from constants)
  vercel: CONFIG.VERCEL,

  // External Services
  external: {
    // Email service (future)
    sendgrid: {
      api: 'https://api.sendgrid.com/v3'
    },
    
    // SMS service (future)
    twilio: {
      api: 'https://api.twilio.com/2010-04-01'
    },
    
    // Analytics (future)
    analytics: {
      google: 'https://www.google-analytics.com/collect',
      segment: 'https://api.segment.io/v1'
    }
  },

  // Health Check URLs (for monitoring)
  monitoring: {
    uptimeRobot: 'https://api.uptimerobot.com/v2',
    statusPage: 'https://api.statuspage.io/v1'
  }
};

// Helper functions
export function getShopifyApiUrl(domain, endpoint) {
  const baseUrl = `https://${domain}`;
  const endpointPath = URLS.shopify.endpoints[endpoint];
  
  if (!endpointPath) {
    throw new Error(`Unknown Shopify endpoint: ${endpoint}`);
  }
  
  return baseUrl + endpointPath;
}

export function getAllowedOrigins(environment = 'production') {
  const origins = [];
  
  // Always include production origins
  origins.push(...URLS.frontend.production);
  
  // Add environment-specific origins
  if (environment === 'staging') {
    origins.push(...URLS.frontend.staging);
  } else if (environment === 'development') {
    origins.push(...URLS.frontend.development);
    origins.push(...URLS.frontend.staging); // Allow staging in dev
  }
  
  // Add Shopify preview domains
  origins.push('https://*.shopifypreview.com');
  
  return origins;
}

export function getWebhookUrl(environment = 'production') {
  return URLS.webhooks[environment] || URLS.webhooks.production;
}

export function getVercelApiUrl(endpoint, params = {}) {
  let url = URLS.vercel.api + URLS.vercel.endpoints[endpoint];
  
  // Replace parameters in URL
  Object.keys(params).forEach(key => {
    url = url.replace(`:${key}`, params[key]);
  });
  
  return url;
}