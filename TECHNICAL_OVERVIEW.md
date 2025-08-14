# R3 Technical Overview
*Last Updated: August 12, 2025*

## System Architecture

The R3 platform is a custom e-commerce solution built on Shopify with advanced payment processing and session management capabilities.

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   External      │
│   (Shopify)     │◄──►│   (Vercel)      │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
│                      │                      │
│ • Liquid Templates   │ • Node.js/Express   │ • Stripe API
│ • Vanilla JS         │ • Session Mgmt      │ • Shopify Admin
│ • CSS Variables      │ • Payment Logic     │ • Vercel KV Store
│ • Multi-step UI      │ • Webhook Handler   │ • GitHub Actions
│                      │                      │
└──────────────────────┼──────────────────────┴─────────────────┘
                       │
            ┌─────────────────┐
            │  Development    │
            │  Workspace      │
            │ (r3-workspace)  │
            └─────────────────┘
            │
            │ • Documentation
            │ • Test Suite
            │ • Config Management
            │ • Legacy Archive
```

### Core Components

#### 1. Frontend (r3-frontend)
**Technology**: Shopify Liquid Theme
- **Repository**: Custom Shopify theme with advanced checkout
- **Environment**: Deployed via GitHub Actions to Shopify store
- **Key Features**:
  - Multi-step checkout process
  - Session-based authentication
  - Dynamic payment method selection
  - Mobile-first responsive design
  - Real-time cart management

#### 2. Backend (r3-backend)  
**Technology**: Node.js/Express
- **Repository**: Payment processing API hosted on Vercel
- **Environment**: Auto-deployment from GitHub branches
- **Key Features**:
  - Stripe payment integration (cards & ACH)
  - Session management with Redis
  - Webhook processing for order creation
  - Rate limiting and security
  - Multi-store support

#### 3. Development Workspace (r3-workspace)
**Technology**: Documentation & Testing Hub
- **Repository**: Centralized development resources
- **Purpose**: 
  - Single source of truth for documentation
  - Unified test suite for all repositories
  - Configuration management
  - Legacy file archival

### Technology Stack

#### Frontend Stack
- **Theme Engine**: Shopify Liquid
- **JavaScript**: Vanilla ES6+ (no frameworks)
- **CSS**: CSS Variables + BEM methodology
- **Build**: No build process (native browser support)
- **Deployment**: GitHub Actions → Shopify CLI

#### Backend Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Session Store**: Vercel KV (Redis)
- **Payment Processing**: Stripe API
- **Order Management**: Shopify Admin API
- **Hosting**: Vercel (serverless functions)

#### Development Tools
- **Version Control**: Git with branch-based environments
- **CI/CD**: GitHub Actions
- **Testing**: Jest + Custom test runners
- **Code Quality**: ESLint, Prettier
- **Environment Management**: dotenv + environment variables

## Repository Structure

### r3-frontend (Shopify Theme)
```
r3-frontend/
├── assets/                 # CSS, JS, images, icons
│   ├── checkout.js        # Main checkout controller (1,215 lines)
│   ├── checkout-payments.js # Payment processing (1,137 lines) 
│   ├── theme.js           # Cart management & UI
│   ├── theme.css          # Main styles (70KB, 3,800 lines)
│   └── checkout.css       # Checkout-specific styles (45KB)
├── sections/              # Theme sections
│   ├── custom-checkout.liquid # Multi-step checkout UI
│   ├── header.liquid      # Navigation with critical fixes
│   └── footer.liquid      # Site footer
├── templates/             # Page templates (JSON format)
├── layout/                # Page layouts
│   └── theme.liquid       # Main layout with environment detection
├── snippets/              # Reusable code fragments
├── blocks/                # UI components
├── config/                # Configuration (symlinked)
├── scripts/               # Deployment & utility scripts
└── locales/               # Internationalization
```

### r3-backend (Payment API)
```
r3-backend/
├── server-unified.js      # Main Express server (1,651 lines)
├── api/                   # API endpoints
│   ├── webhook-stripe.js  # Stripe webhook handler
│   ├── checkout/          # Checkout session management
│   ├── calculate-shipping.js # Shipping logic
│   └── calculate-tax.js   # Tax calculations
├── utils/                 # Utility modules
│   ├── session.js         # Session management
│   ├── emailService.js    # Email notifications
│   ├── shipping.js        # Shipping calculations
│   └── logger.js          # Logging utilities
├── middleware/            # Express middleware
│   ├── rateLimiter.js     # Rate limiting (production values)
│   ├── cors.js            # CORS configuration
│   └── validation.js      # Input validation
├── config/                # Configuration (symlinked)
├── scripts/               # Utility scripts
└── .env.example          # Environment variable template
```

### r3-workspace (Development Hub)
```
r3-workspace/
├── CLAUDE.md              # AI assistant guide
├── TECHNICAL_OVERVIEW.md  # This document
├── BUSINESS_OVERVIEW.md   # Executive summary
├── BUSINESS_OVERVIEW_SUPER.md # ROI business case
├── config/                # Master configuration
│   └── shared-constants.js # Single source of truth
├── docs/                  # Documentation
│   └── audits/            # Site launch audits
├── tests/                 # Unified test suite
│   ├── run-tests.js       # Test runner
│   ├── unit/              # Unit tests (<100ms)
│   ├── integration/       # Integration tests (<5s)
│   ├── e2e/               # End-to-end tests (<30s)
│   └── shared/            # Test utilities
├── legacy/                # Archived files
│   ├── backend/           # Legacy backend files
│   ├── frontend/          # Legacy frontend files
│   └── tests/             # Legacy test files
└── .github/               # CI/CD workflows
```

## Configuration Management

### Centralized Configuration System

**Master Config**: `/r3-workspace/config/shared-constants.js`

All repositories use symlinks to this master configuration file:
- `r3-frontend/config/shared-constants.js` → `../../r3-workspace/config/shared-constants.js`
- `r3-backend/config/shared-constants.js` → `../../r3-workspace/config/shared-constants.js`

### Configuration Categories

#### Environment Settings
```javascript
ENVIRONMENTS: {
  DEVELOPMENT: 'dev',
  STAGING: 'stage', 
  PRODUCTION: 'prod'
}
```

#### API Endpoints
```javascript
API_ENDPOINTS: {
  DEV: 'http://localhost:3000',
  STAGE: 'https://r3-backend-git-stage-r3.vercel.app',
  PROD: 'https://r3-backend.vercel.app'
}
```

#### Theme Configuration
```javascript
THEME_IDS: {
  STAGING: '153047662834',
  PRODUCTION: '152848597234'
}
```

#### Rate Limiting (Production Values)
```javascript
RATE_LIMITS: {
  API: { requests: 100, window: '15min' },
  SESSIONS: { requests: 20, window: '15min' },
  PAYMENTS: { requests: 30, window: '5min' },
  WEBHOOKS: { requests: 200, window: '1min' }
}
```

### Deployment Configuration

**Critical**: Symlinks must be resolved before deployment using deployment scripts:
- `npm run prepare-deploy` - Resolves symlinks to actual files
- `npm run restore-symlinks` - Restores symlinks after deployment

## Payment Processing Architecture

### Payment Flow Overview

```
Customer → Frontend → Backend → Stripe → Webhook → Shopify Order
    ↓         ↓         ↓        ↓        ↓           ↓
 1. Cart   2. Session 3. Intent 4. Process 5. Update 6. Complete
```

### Session Management

#### Session Creation
1. **Frontend** calls `/api/checkout/session`
2. **Backend** creates session in Vercel KV store
3. **Session token** returned to frontend
4. **Token stored** in localStorage and cart attributes

#### Session Structure
```javascript
{
  sessionToken: 'sess_...',
  cartToken: 'cart_token_from_shopify',
  storeDomain: 'sqqpyb-yq.myshopify.com',
  expiresAt: '2025-08-12T15:30:00Z', // 30 minutes
  metadata: {
    rep: 'sales_rep_code',
    source: 'direct'
  }
}
```

#### Session Security
- **30-minute expiration** for security
- **Server-side storage** in Redis (Vercel KV)
- **Token-based authentication** for all API calls
- **Automatic cleanup** of expired sessions

### Payment Methods

#### 1. Card Payments
- **Processing**: Immediate via Stripe
- **Fee Structure**: 2.9% + $0.30
- **Order Creation**: Real-time on successful payment
- **User Experience**: Instant confirmation

#### 2. ACH Payments  
- **Processing**: 1-3 business days
- **Fee Structure**: Lower fees (exact rates in Stripe dashboard)
- **Order Creation**: Draft order created immediately, completed on clearance
- **User Experience**: Immediate draft order, notification on completion

#### 3. Digital Wallets
- **Apple Pay**: Supported via Stripe
- **Google Pay**: Supported via Stripe  
- **PayPal**: Integration available

### Order Management

#### Order Creation Logic
```javascript
// Environment-based order type determination
if (environment === 'prod' && stripeKeyType === 'live') {
  // Create real order
  orderType = 'order';
} else {
  // Create draft order for testing
  orderType = 'draft_order';
}
```

#### Draft Order Tagging System
- **ACH_PENDING**: Payment initiated, awaiting clearance
- **ACH_COMPLETED**: Payment cleared successfully  
- **ACH_FAILED**: Payment failed, customer notification required
- **REP_ATTRIBUTION**: Sales rep tracking for commission

### Webhook Processing

#### Stripe Webhook Events
- **payment_intent.succeeded**: Complete order creation
- **payment_intent.payment_failed**: Handle failed payments
- **charge.dispute.created**: Dispute management
- **invoice.payment_succeeded**: Subscription handling

#### Webhook Security
- **Signature verification** using Stripe webhook secrets
- **Idempotency keys** to prevent duplicate processing
- **Rate limiting** (200 requests/minute)
- **Error handling** with retry logic

## Security Architecture

### Implemented Security Measures

#### Rate Limiting (Production Values)
- **API Requests**: 100 per 15 minutes per IP
- **Session Creation**: 20 per 15 minutes per IP
- **Payment Attempts**: 30 per 5 minutes per IP
- **Webhook Calls**: 200 per minute

#### Authentication & Authorization
- **Session-based authentication** with secure tokens
- **CSRF protection** on all state-changing operations
- **Input validation** on all API endpoints
- **Webhook signature verification**

#### Data Protection
- **No sensitive data storage** (payment details handled by Stripe)
- **Environment variable management** for secrets
- **Secure session storage** in Redis with expiration
- **HTTPS enforcement** across all endpoints

#### Security Headers
```javascript
// CORS Configuration
app.use(cors({
  origin: [
    'https://sqqpyb-yq.myshopify.com',
    'https://rthree.io',
    'http://localhost:9292'
  ],
  credentials: true
}));

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Shopify handles CSP
  crossOriginEmbedderPolicy: false
}));
```

## Environment Management

### Branch-Based Environments

#### Development (`dev` branch)
- **Frontend**: Local theme development
- **Backend**: Local development server
- **Database**: Local/staging data
- **Payments**: Stripe test mode
- **Orders**: Draft orders only

#### Staging (`stage` branch)
- **Frontend**: Staging theme (ID: 153047662834)
- **Backend**: https://r3-backend-git-stage-r3.vercel.app
- **Database**: Staging data
- **Payments**: Stripe test mode
- **Orders**: Draft orders only

#### Production (`prod` branch)
- **Frontend**: Live theme (ID: 152848597234)  
- **Backend**: https://r3-backend.vercel.app
- **Database**: Production data
- **Payments**: Stripe live mode
- **Orders**: Real orders

### Environment Variables

#### Frontend (.env)
```bash
# Not typically needed - frontend uses deployed backend
R3_API_URL=https://r3-backend.vercel.app
SHOPIFY_STORE_DOMAIN=sqqpyb-yq.myshopify.com
```

#### Backend (.env) 
```bash
# Required for local development
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
SESSION_SECRET=your_session_secret
CSRF_SECRET=your_csrf_secret
KV_REST_API_URL=https://...kv.vercel-storage.com
KV_REST_API_TOKEN=...
SHOPIFY_STORE_DOMAIN=sqqpyb-yq.myshopify.com
```

#### Tests (.env)
```bash
# Required for integration testing
TEST_BACKEND_URL=http://localhost:3000
TEST_SHOPIFY_DOMAIN=sqqpyb-yq.myshopify.com
TEST_USER_EMAIL=test@example.com
```

## Testing Architecture

### Test Organization

#### Unit Tests (`<100ms each`)
- **Frontend**: Component logic, utility functions
- **Backend**: API logic, utility functions
- **Coverage**: Individual functions and components

#### Integration Tests (`<5s each`)
- **Session Management**: Token creation, validation, expiration
- **Payment Processing**: Stripe integration, order creation
- **Webhook Handling**: Event processing, idempotency

#### End-to-End Tests (`<30s each`)
- **Checkout Flow**: Complete user journey
- **ACH Payment Flow**: Draft order → payment → completion
- **Error Recovery**: Failed payments, session expiration

### Test Commands

```bash
# Unified test runner
cd r3-workspace/tests
node run-tests.js [options]

# Specific test types
npm run test:unit
npm run test:integration  
npm run test:e2e
npm run test:coverage

# Environment-specific
NODE_ENV=staging npm test
```

### Test Data & Fixtures

#### Test Cards (Stripe)
```javascript
// Success
4242424242424242

// Decline
4000000000000002

// Requires authentication
4000002500003155
```

#### Test ACH (Stripe)
```javascript
// Success
routing: 110000000
account: 000123456789
```

## Performance Optimization

### Frontend Performance

#### Asset Optimization
- **CSS**: 70KB theme.css (optimized for critical path)
- **JavaScript**: 43KB checkout.js (modular loading)
- **Images**: WebP format with fallbacks
- **Icons**: Inline SVG for critical icons

#### Loading Strategy
```html
<!-- Critical CSS -->
<style>{{ 'critical.css' | asset_url | asset_content }}</style>

<!-- Deferred CSS -->
<link rel="preload" href="{{ 'theme.css' | asset_url }}" as="style" onload="this.onload=null;this.rel='stylesheet'">

<!-- Deferred JavaScript -->
<script src="{{ 'checkout.js' | asset_url }}" defer></script>
```

#### Performance Targets
- **Page Load**: < 3 seconds
- **First Contentful Paint**: < 1.5 seconds
- **Largest Contentful Paint**: < 2.5 seconds
- **Cumulative Layout Shift**: < 0.1

### Backend Performance

#### API Response Times
- **Session Creation**: < 200ms
- **Payment Intent**: < 500ms
- **Shipping Calculation**: < 100ms
- **Webhook Processing**: < 1000ms

#### Caching Strategy
- **Session Data**: 30-minute TTL in Redis
- **Rate Limit Data**: Window-based expiration
- **Configuration**: In-memory caching

#### Database Optimization
- **Connection Pooling**: Managed by Vercel
- **Query Optimization**: Indexed by session token
- **Data Cleanup**: Automatic expired session removal

## Deployment Architecture

### CI/CD Pipeline

#### GitHub Actions Workflow
```yaml
# Triggered on push to stage/prod branches
name: Deploy
on:
  push:
    branches: [stage, prod]

jobs:
  deploy:
    - Resolve symlinks
    - Run tests (must pass 100%)
    - Deploy to Vercel
    - Update theme (frontend only)
    - Verify deployment
```

#### Deployment Safety Checks
- **Test Suite**: Must pass 100% before deployment
- **Symlink Resolution**: Automatic handling
- **Environment Validation**: Correct secrets and config
- **Rollback Capability**: Previous version preservation

### Infrastructure

#### Hosting
- **Frontend**: Shopify (theme hosting)
- **Backend**: Vercel (serverless functions)
- **Database**: Vercel KV (Redis)
- **CDN**: Shopify + Vercel edge network

#### Scaling
- **Frontend**: Shopify's global CDN
- **Backend**: Vercel auto-scaling
- **Database**: Vercel KV with built-in scaling
- **Rate Limiting**: Distributed across edge nodes

#### Monitoring
- **Uptime**: Vercel dashboard
- **Performance**: Custom monitoring
- **Errors**: Vercel logs + custom alerting
- **Security**: Rate limit monitoring

## Development Workflow

### Getting Started

#### Prerequisites
- **Node.js**: 18+
- **Git**: Latest version
- **Shopify CLI**: For theme development
- **Vercel CLI**: For backend deployment (optional)

#### Setup Process
```bash
# 1. Clone workspace
git clone https://github.com/dylanjshaw001/r3-workspace.git
cd r3-workspace

# 2. Set up environment variables
cp .env.example .env
# Edit .env with vault secrets

# 3. Install dependencies
cd tests && npm install

# 4. Verify setup
npm test
```

### Development Process

#### Feature Development
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Write tests first (TDD)
cd r3-workspace/tests
# Create test files

# 3. Implement feature
cd ../r3-frontend  # or r3-backend
# Write implementation

# 4. Verify tests pass
cd ../r3-workspace/tests
npm test

# 5. Commit and push
git add -A
git commit -m "feat: add new feature"
git push origin feature/new-feature
```

#### Code Quality Checks
```bash
# Linting
npm run lint

# Type checking (if TypeScript)
npm run typecheck

# Security audit
npm audit

# Test coverage
npm run test:coverage
```

### Debugging

#### Frontend Debugging
```javascript
// Environment detection
console.log('Environment:', window.R3_ENVIRONMENT);

// Session status  
console.log('Session:', localStorage.getItem('checkout_session'));

// Cart data
console.log('Cart:', window.cart);
```

#### Backend Debugging
```bash
# Health check
curl https://r3-backend.vercel.app/health

# Environment check
curl https://r3-backend.vercel.app/api/debug/check-order-type

# View logs
vercel logs --follow
```

#### Common Issues

1. **Symlink Problems**
   ```bash
   # Check symlink status
   ls -la config/shared-constants.js
   
   # Recreate if broken
   ln -sf ../../r3-workspace/config/shared-constants.js config/shared-constants.js
   ```

2. **Session Issues**
   ```bash
   # Clear rate limits
   cd r3-backend
   node scripts/clear-rate-limits.js
   ```

3. **Theme Sync Issues**
   ```bash
   # Pull latest from Shopify
   shopify theme pull --theme=153047662834
   
   # Commit changes
   git add -A && git commit -m "sync: pull theme changes"
   ```

## Integration Points

### Shopify Integration

#### Admin API Usage
- **Order Creation**: Draft orders → real orders
- **Inventory Management**: Stock level checking
- **Customer Data**: Profile and preferences
- **Discount Codes**: Validation and application

#### Theme Integration
- **Cart API**: Real-time cart updates
- **Checkout Extensions**: Custom payment flows
- **Customer Accounts**: Authentication integration
- **Order Status**: Real-time updates

### Stripe Integration

#### Payment Processing
- **Payment Intents**: Card and ACH processing
- **Webhooks**: Event-driven order completion
- **Customer Management**: Payment method storage
- **Dispute Handling**: Automated dispute management

#### Security Features
- **3D Secure**: Automatic fraud protection
- **Radar**: Machine learning fraud detection
- **PCI Compliance**: Stripe handles PCI requirements
- **Webhook Security**: Signature verification

### Third-Party Services

#### Vercel KV (Redis)
- **Session Storage**: 30-minute TTL
- **Rate Limiting**: Distributed counters
- **Cache Management**: Automatic cleanup

#### GitHub Actions
- **Automated Testing**: On pull requests
- **Deployment**: Branch-based deployment
- **Security Scanning**: Dependency audits

## API Reference

### Authentication

All API requests require session token:
```javascript
headers: {
  'Authorization': 'Bearer sess_...',
  'Content-Type': 'application/json'
}
```

### Core Endpoints

#### Session Management
```http
POST /api/checkout/session
Content-Type: application/json

{
  "cartToken": "cart_token_from_shopify",
  "storeDomain": "sqqpyb-yq.myshopify.com"
}

Response:
{
  "sessionToken": "sess_...",
  "expiresAt": "2025-08-12T15:30:00Z"
}
```

#### Payment Processing
```http
POST /api/stripe/create-payment-intent
Authorization: Bearer sess_...

{
  "amount": 10000,
  "currency": "usd",
  "paymentMethod": "card",
  "customerInfo": {
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "shippingAddress": {
    "line1": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "postal_code": "12345",
    "country": "US"
  }
}

Response:
{
  "clientSecret": "pi_...client_secret",
  "paymentIntentId": "pi_..."
}
```

#### Shipping Calculation
```http
POST /api/calculate-shipping
Authorization: Bearer sess_...

{
  "items": [
    {
      "variant_id": 123456,
      "quantity": 2,
      "title": "ONEbox"
    }
  ],
  "shippingAddress": {
    "country": "US",
    "province": "CA",
    "zip": "12345"
  }
}

Response:
{
  "shippingRates": [
    {
      "title": "Standard Shipping",
      "price": 500,
      "code": "standard"
    }
  ]
}
```

### Webhook Endpoints

#### Stripe Webhooks
```http
POST /webhook/stripe
Stripe-Signature: t=...,v1=...

{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_...",
      "metadata": {
        "store_domain": "sqqpyb-yq.myshopify.com",
        "items": "[{...}]",
        "shipping_address": "{...}"
      }
    }
  }
}
```

## Troubleshooting Guide

### Common Error Patterns

#### 1. Session Expired (401)
```javascript
// Frontend handling
if (response.status === 401) {
  // Clear expired session
  localStorage.removeItem('checkout_session');
  
  // Create new session
  await this.ensureValidSession();
  
  // Retry request
  return this.retryRequest(originalRequest);
}
```

#### 2. Rate Limited (429)
```javascript
// Backend response
{
  "error": "Too many requests",
  "retryAfter": 900, // seconds
  "message": "Please try again later"
}
```

#### 3. Webhook Verification Failed
```bash
# Check webhook secret
echo $STRIPE_WEBHOOK_SECRET

# Verify endpoint URL in Stripe dashboard
# Should match: https://r3-backend.vercel.app/webhook/stripe
```

### Performance Issues

#### Slow API Responses
1. **Check Vercel function logs**
2. **Verify database connection**
3. **Monitor rate limiting**
4. **Check external API status** (Stripe, Shopify)

#### Frontend Loading Issues
1. **Clear browser cache**
2. **Check CDN status**
3. **Verify asset URLs**
4. **Monitor console errors**

### Deployment Issues

#### Symlink Resolution
```bash
# Before deployment
npm run prepare-deploy

# After deployment  
npm run restore-symlinks
```

#### Environment Variable Missing
```bash
# Check Vercel environment variables
vercel env ls

# Add missing variables
vercel env add VARIABLE_NAME
```

## Future Roadmap

### Immediate Enhancements

#### Performance Optimization
- **CSS Code Splitting**: Reduce initial bundle size
- **JavaScript Modules**: Lazy loading for non-critical features
- **Image Optimization**: WebP conversion and compression
- **Service Worker**: Caching strategy for repeat visitors

#### SEO Implementation
- **Google Verification**: Site verification setup
- **Structured Data**: Product and review schemas
- **Meta Tag Optimization**: Dynamic meta tags
- **Sitemap Generation**: Automated sitemap updates

### Medium-Term Features

#### User Experience
- **Customer Reviews**: User-submitted product reviews
- **Saved Payment Methods**: Stripe customer profiles
- **Order History**: Customer account integration
- **Wishlist Functionality**: Product favorites

#### Business Intelligence
- **Analytics Integration**: Enhanced tracking
- **A/B Testing**: Conversion optimization
- **Customer Segmentation**: Personalized experiences
- **Sales Rep Attribution**: Commission tracking

### Advanced Features

#### Technical Enhancements
- **Multi-Currency**: International support
- **Multi-Language**: Internationalization
- **Progressive Web App**: Offline capabilities
- **Real-Time Updates**: WebSocket integration

#### Integration Expansion
- **CRM Integration**: Customer relationship management
- **Email Marketing**: Automated campaigns
- **Inventory Management**: Advanced stock tracking
- **Fulfillment Integration**: Shipping partners

---

*This technical overview should be updated as the system evolves and new features are implemented.*