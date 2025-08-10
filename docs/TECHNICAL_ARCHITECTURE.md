# R3 Platform Technical Architecture
*Last Updated: August 10, 2025*

## Table of Contents
1. [System Overview](#system-overview)
2. [Repository Structure](#repository-structure)
3. [Technology Stack](#technology-stack)
4. [Architecture Patterns](#architecture-patterns)
5. [Deployment Infrastructure](#deployment-infrastructure)
6. [API Architecture](#api-architecture)
7. [Payment Processing](#payment-processing)
8. [Security Architecture](#security-architecture)
9. [Testing Infrastructure](#testing-infrastructure)
10. [Environment Configuration](#environment-configuration)
11. [Monitoring & Logging](#monitoring--logging)
12. [Development Workflow](#development-workflow)

## System Overview

R3 is a modern e-commerce platform built on Shopify's infrastructure with custom checkout and payment processing capabilities. The system consists of a Shopify Liquid theme frontend, Node.js/Express backend services deployed on Vercel, and comprehensive payment processing through Stripe.

### High-Level Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Shopify CDN   │────▶│  R3 Frontend     │────▶│   R3 Backend    │
│   (Theme Host)  │     │  (Liquid Theme)  │     │ (Vercel/Express)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                           │
                               ▼                           ▼
                        ┌──────────────┐           ┌──────────────┐
                        │   Browser    │           │  Vercel KV   │
                        │  JavaScript  │           │   (Redis)    │
                        └──────────────┘           └──────────────┘
                               │                           │
                               └──────────┬───────────────┘
                                          ▼
                               ┌─────────────────────┐
                               │   Stripe API        │
                               │ (Payments/Webhooks) │
                               └─────────────────────┘
```

## Repository Structure

### Active Repositories

#### 1. **r3-workspace** (Development Hub)
- **Location**: `/Users/dylanjshaw/r3/r3-workspace`
- **Repository**: https://github.com/dylanjshaw001/r3-workspace
- **Purpose**: Central hub for documentation, tests, and team collaboration
- **Key Components**:
  - `/docs`: All platform documentation (Technical Architecture, Business Overview, Claude Guide, Secrets Management)
  - `/tests`: Comprehensive test suite for all platform components
  - `/.github/workflows`: CI/CD pipelines for automated testing
  - **Created**: August 10, 2025 (migrated from r3-tests)

#### 2. **r3-frontend** (Shopify Theme)
- **Location**: `/Users/dylanjshaw/r3/r3-frontend`
- **Purpose**: Shopify Liquid theme with custom checkout
- **Key Components**:
  - `/assets`: JavaScript, CSS, images
  - `/sections`: Reusable page sections
  - `/templates`: Page templates (JSON format)
  - `/snippets`: Reusable Liquid code
  - `/layout`: Theme layouts
  - `/locales`: Internationalization

#### 2. **r3-backend** (API Services)
- **Location**: `/Users/dylanjshaw/r3/r3-backend`
- **Version**: 1.0.2
- **Purpose**: Payment processing, order management, calculations
- **Key Components**:
  - `/api`: Vercel serverless functions
  - `/utils`: Shared utilities
  - `/config`: Environment configurations
  - `/templates`: Email templates
  - `/dev`: Development tools

#### 3. **r3-workspace** (Development Hub)
- **Location**: `/Users/dylanjshaw/r3/r3-workspace`
- **Purpose**: Centralized development resources, documentation, and testing
- **Structure**:
  - `/docs`: All platform documentation
    - `TECHNICAL_ARCHITECTURE.md`: This document
    - `BUSINESS_OVERVIEW.md`: Business context and requirements
    - `CLAUDE.md`: AI assistant instructions
    - `SECRETS_MANAGEMENT.md`: Security and vault documentation
  - `/tests`: Comprehensive test suites
    - `/backend`: Backend API tests
    - `/frontend`: Frontend UI tests
    - `/integration`: Cross-system tests
    - `/shared`: Common test utilities
    - `/config`: Test environment configurations
  - `/.github/workflows`: CI/CD pipelines

#### 4. **r3-access** (Credentials)
- **Location**: `/Users/dylanjshaw/r3/r3-access`
- **Purpose**: Secure credential storage (not in version control)
- **Contains**: API keys, tokens, webhook secrets

## Technology Stack

### Frontend Technologies
- **Shopify Liquid**: Template engine (v2.0)
- **JavaScript**: Vanilla ES6+ (no framework)
- **CSS**: Custom CSS with BEM methodology
- **Build Tools**: Shopify CLI 3.x

### Backend Technologies
- **Runtime**: Node.js 18.x
- **Framework**: Express.js 4.x
- **Deployment**: Vercel Serverless Functions
- **Database**: Vercel KV (Redis)
- **Dependencies**:
  - stripe: Payment processing
  - @vercel/kv: Redis client
  - express-rate-limit: API throttling
  - helmet: Security headers
  - winston: Logging

### Infrastructure
- **CDN**: Shopify CDN for theme assets
- **Hosting**: Vercel for backend services
- **DNS**: Managed via domain registrar
- **SSL**: Automatic via Shopify/Vercel

## Architecture Patterns

### Frontend Patterns

#### 1. **Custom Checkout Flow**
```javascript
// Checkout initialization flow
CustomCheckout.init()
  ├── loadCart()
  ├── initializeSession() → Backend API
  ├── validateSession()
  ├── initializeStripe()
  └── calculateItemBasedShipping() → Backend API
```

#### 2. **Session Management**
- Session tokens stored in cart attributes
- 30-minute TTL with automatic renewal
- Bearer token authentication for API calls

#### 3. **Progressive Enhancement**
- Core functionality works without JavaScript
- Enhanced features layer on top
- Loading states with spinners

### Backend Patterns

#### 1. **Serverless Functions**
Each API endpoint is a separate serverless function:
```
/api/checkout/session → Session management
/api/stripe/create-payment-intent → Payment initiation
/api/calculate-shipping → Shipping calculation
/api/calculate-tax → Tax calculation
/webhook/stripe → Order creation webhook
```

#### 2. **Circuit Breaker Pattern**
Protection against service failures:
```javascript
const CircuitBreaker = {
  CLOSED: Normal operation
  OPEN: Service failing, use fallback
  HALF_OPEN: Testing if service recovered
}
```

#### 3. **Idempotency**
Webhook processing with idempotency keys prevents duplicate orders

## Deployment Infrastructure

### Branch Strategy
```
dev → stage → prod
│      │       │
│      │       └── Production (manual approval)
│      └────────── Staging (auto-deploy)
└────────────────── Development (auto-deploy)
```

### GitHub Actions Workflows

#### Frontend Deployment (.github/workflows/deploy-theme.yml)
```yaml
Triggers:
  - Push to dev/stage/prod branches
  - Manual workflow dispatch

Jobs:
  1. Determine target theme
  2. Run theme checks
  3. Deploy to Shopify
  4. Production approval gate
  5. Validate deployment
```

#### Backend Deployment (Vercel)
- Automatic deployment on git push
- Preview deployments for all branches
- Production deployment on `prod` branch

### Environment Mapping
| Branch | Frontend Theme | Backend URL | Stripe Mode |
|--------|---------------|-------------|-------------|
| dev | Development | r3-backend-git-dev-r3.vercel.app | Test |
| stage | Staging | r3-backend-git-stage-r3.vercel.app | Test |
| prod | Production | r3-backend.vercel.app | Live |

## API Architecture

### Authentication Flow
```
1. Frontend → POST /api/checkout/session
2. Backend creates session in Redis
3. Returns session token
4. Frontend includes token in Authorization header
5. Backend validates token from Redis
```

### Core Endpoints

#### Session Management
```http
POST /api/checkout/session
Authorization: Not required
Body: {
  cartToken: string,
  domain: string,
  cartTotal: number
}
Response: {
  success: boolean,
  sessionToken: string,
  expiresIn: number
}
```

#### Payment Processing
```http
POST /api/stripe/create-payment-intent
Authorization: Bearer {sessionToken}
Body: {
  amount: number,
  payment_method_types: ['card', 'us_bank_account'],
  metadata: {
    customer_email: string,
    shipping_address: object,
    items: string (JSON)
  }
}
```

#### Calculations
```http
POST /api/calculate-shipping
Authorization: Bearer {sessionToken}
Body: {
  items: array,
  postalCode: string,
  country: string
}
Response: {
  shipping: {
    price: number (cents),
    method: string,
    description: string
  }
}
```

### Webhook Processing

#### Stripe Webhook Flow
```
1. Stripe → POST /webhook/stripe
2. Verify webhook signature
3. Process event type:
   - payment_intent.processing → Create draft order (ACH)
   - payment_intent.succeeded → Create/update order
   - charge.failed → Handle failure
4. Update order status in Shopify
5. Send confirmation emails
```

## Payment Processing

### Credit Card Flow
```
1. Customer enters card details
2. Stripe.js tokenizes card
3. Frontend → Backend create payment intent
4. Stripe confirms payment
5. Webhook creates Shopify order
6. Customer redirected to success page
```

### ACH Payment Flows

#### Instant Verification (Plaid)
```
1. Customer connects bank via Plaid
2. Instant account verification
3. Payment intent created (status: processing)
4. Draft order created immediately
5. Payment clears in 1-3 days
6. Order status updated to completed
```

#### Manual Entry (Micro-deposits)
```
1. Customer enters routing/account numbers
2. Payment intent created (status: requires_action)
3. Stripe sends micro-deposits (1-2 days)
4. Customer verifies amounts
5. Payment processes (1-3 days)
6. Order created on success
```

### Order Creation Logic
```javascript
// Determine order type
if (environment === 'production' && livemode === true) {
  createRealOrder();
} else {
  createDraftOrder(); // Test environments, test payments, ACH
}
```

## Session Architecture

### Current Implementation

Sessions are critical for maintaining checkout state and preventing fraud. We use Redis-backed sessions with secure token generation.

#### Session Lifecycle
1. **Creation**: Customer lands on checkout page
2. **Validation**: Every API request validates session
3. **Update**: Session updated with each step
4. **Expiration**: Auto-cleanup after 30 minutes
5. **Completion**: Cleared after successful order

#### Session Storage Structure
```javascript
// Redis key format: session:{token}
{
  sessionId: string,        // Unique session identifier
  cartToken: string,        // Shopify cart token
  domain: string,           // Validated store domain
  ipAddress: string,        // For session binding
  userAgent: string,        // For device fingerprint
  csrfToken: string,        // CSRF protection token
  requestCount: number,     // Rate limiting counter
  createdAt: timestamp,
  expiresAt: timestamp,
  metadata: {
    cartTotal: number,
    itemCount: number,
    customerId: string
  }
}
```

### Secure Session Migration (Future)

We're migrating from token-based to cookie-based sessions for enhanced security.

#### Current System (Phase Out)
- Session tokens in cart attributes
- Bearer token authentication
- Client-side token storage
- No CSRF protection

#### New System (Rolling Out)
- HTTP-only secure cookies
- Automatic session management
- CSRF tokens for mutations
- Session binding to device

#### Migration Strategy
```javascript
// Dual support during transition
if (req.cookies.sessionId) {
  // New cookie-based flow
  validateCookieSession(req.cookies.sessionId);
} else if (req.headers.authorization) {
  // Legacy token-based flow
  validateBearerToken(req.headers.authorization);
}
```

## Configuration & Secrets Management

### Overview

The R3 platform uses a two-layer configuration system that separates public configuration from secrets:

1. **Configuration Files** (Git-tracked) - All non-sensitive configuration values
2. **Environment Variables** (Platform-managed) - Secrets and credentials only

### Configuration Files Architecture

```
r3-workspace/
├── config/
│   └── shared-constants.js      # Master configuration (single source of truth)
│
r3-backend/
├── config/
│   ├── constants.js             # Imports shared + adds backend-specific
│   ├── domains.js               # Store configuration
│   └── urls.js                  # URL management
│
r3-frontend/
├── config/
│   └── constants.js             # Browser-safe configuration (no imports)
│
r3-workspace/tests/
├── config/
│   └── constants.js             # Test configuration
```

### Configuration Values

**Stored in Config Files:**
- API URLs and endpoints
- Domain names (sqqpyb-yq.myshopify.com, rthree.io)
- Theme IDs (staging: 153047662834, production: 152848597234)
- Port numbers (backend: 3000, frontend: 9292)
- Feature flags
- Rate limits
- Timeouts
- Public keys (Stripe publishable keys)

**Stored in Environment Variables:**
- API secret keys (Stripe, Shopify)
- Webhook secrets
- Session secrets
- Database/Redis credentials
- Monitoring tokens

### Environment Variable Management

#### Local Development (.env files)

**Backend Only** - Frontend doesn't need .env files:

```bash
# r3-backend/.env (Local development only)
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
SESSION_SECRET=...
CSRF_SECRET=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

#### Production/Staging (Platform-Managed)

**Vercel Environment Variables:**
- Set via Vercel Dashboard → Settings → Environment Variables
- Branch-specific (prod branch gets production secrets)
- Automatically injected at runtime
- No .env files in deployment

**GitHub Actions Secrets:**
- Set via Repository → Settings → Secrets
- Used for CI/CD workflows
- Referenced as `${{ secrets.SECRET_NAME }}`

### Secret Storage Hierarchy

```
Production Secrets (Vercel)
├── STRIPE_SECRET_KEY_PROD       # Live Stripe key
├── STRIPE_WEBHOOK_SECRET_PROD   # Production webhook
└── SHOPIFY_ADMIN_ACCESS_TOKEN   # Production store

Staging Secrets (Vercel)
├── STRIPE_SECRET_KEY_TEST       # Test Stripe key
├── STRIPE_WEBHOOK_SECRET_STAGE  # Staging webhook
└── SHOPIFY_ADMIN_ACCESS_TOKEN   # Same store, different theme

Development Secrets (Local .env)
├── From team vault (1Password)
└── Test keys only
```

### Configuration Loading Pattern

```javascript
// Backend: config/constants.js
import sharedConstants from '../../r3-workspace/config/shared-constants.js';

export const CONFIG = {
  // Non-secret config from shared constants
  DOMAINS: sharedConstants.DOMAINS,
  THEME_IDS: sharedConstants.THEME_IDS,
  
  // Secrets from environment variables
  SECRETS: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
  }
};

// Usage
const domain = CONFIG.DOMAINS.SHOPIFY_STORE;  // From config file
const apiKey = CONFIG.SECRETS.STRIPE_SECRET_KEY; // From env var
```

### Development Workflows

#### Frontend Development (No Secrets Needed)

```bash
cd r3-frontend
shopify theme dev
# Connects to https://r3-backend-git-dev-r3.vercel.app
# Backend already has all secrets from Vercel
```

#### Backend Development (Secrets Required)

```bash
cd r3-backend
cp .env.example .env
# Add secrets from vault
npm run dev
# Backend runs locally with secrets from .env
```

### Security Best Practices

1. **Never commit secrets** - .env files are gitignored
2. **Use vault for sharing** - Team members get secrets from 1Password
3. **Minimal secret exposure** - Only ~10 secrets needed for backend
4. **Environment isolation** - Different secrets per environment
5. **Automatic rotation** - Update via Vercel Dashboard
6. **Audit trail** - Vercel logs all secret access

### Configuration Update Procedures

| Change Type | Update Location | Deployment |
|------------|-----------------|------------|
| Add new URL | shared-constants.js | Git push → Auto-deploy |
| Change theme ID | shared-constants.js → THEME_IDS | Git push → Auto-deploy |
| Add new secret | Vercel Dashboard + .env.example | Immediate in Vercel |
| Update secret | Vercel Dashboard only | Immediate, no code change |
| Add feature flag | config files → FEATURES | Git push → Auto-deploy |

## Security Architecture

### Defense in Depth Strategy

Our security implementation follows a multi-layered approach with fail-closed defaults.

### Authentication & Authorization

#### Session Management
- **Storage**: Redis-backed sessions with 30-minute TTL
- **Token Generation**: Cryptographically secure using `crypto.randomBytes(32)`
- **Session Binding**: Bound to IP + User-Agent fingerprint
- **CSRF Protection**: Token required for all state-changing operations
- **Session Rotation**: New session ID on privilege escalation
- **Automatic Cleanup**: Expired sessions purged automatically

#### API Security Layers
```javascript
// Security middleware stack (order matters)
app.use(helmet());           // Security headers (HSTS, CSP, etc.)
app.use(cors(corsOptions));  // CORS with whitelist validation
app.use(rateLimiter);        // Rate limiting per IP/session
app.use(validateDomain);     // Domain validation from headers
app.use(validateSession);    // Session validation & binding check
app.use(validateCSRF);       // CSRF token validation
app.use(sanitizeInput);      // Input sanitization
```

### Rate Limiting

| Endpoint Type | Limit | Window | Purpose |
|--------------|-------|---------|---------|
| API endpoints | 100 req | 15 min | General API protection |
| Session creation | 10 req | 15 min | Prevent session flooding |
| Payment attempts | 20 req | 5 min | Prevent payment abuse |
| Webhooks | 100 req | 1 min | Handle Stripe retries |

### Input Validation & Sanitization

#### Cart Validation
- Amount validation against Shopify cart
- Line item verification
- Inventory checks
- Price manipulation detection

#### Customer Data Sanitization
```javascript
// All user input sanitized
sanitizeInput(data) {
  // Remove script tags, SQL keywords
  // Validate email formats
  // Sanitize phone numbers
  // Validate postal codes
}
```

### Webhook Security

#### Stripe Webhook Verification
- Signature verification using `stripe.webhooks.constructEvent()`
- Idempotency handling (24-hour window)
- Duplicate prevention using event IDs
- Comprehensive audit logging

### Data Protection

#### Sensitive Data Handling
- **No PII Storage**: Customer data flows through, not stored
- **Payment Tokenization**: Stripe.js handles all card data
- **Session Encryption**: All session data encrypted at rest
- **Log Masking**: Sensitive data masked in logs
- **Secure Headers**: HTTPS-only, no cache for sensitive pages

### Security Monitoring

#### Audit Logging
- All authentication attempts
- Payment processing events
- Admin actions
- Security violations
- Rate limit violations

#### Alert Triggers
- Failed authentication spikes
- Unusual payment patterns
- Session hijacking attempts
- Rate limit violations
- Webhook signature failures

### Incident Response

#### Security Event Handling
1. **Detection**: Automated monitoring alerts
2. **Assessment**: Severity classification
3. **Containment**: Automatic blocking if critical
4. **Investigation**: Log analysis
5. **Recovery**: Service restoration
6. **Documentation**: Incident report

### Security Improvements History

#### Critical Issues Fixed
- ✅ Session tokens no longer exposed in JavaScript
- ✅ Sessions bound to device fingerprint
- ✅ Cart validation fails closed (blocks invalid)
- ✅ CSRF protection implemented
- ✅ Domain extracted from headers, not client
- ✅ Per-session request limiting

#### Remaining Hardening (Roadmap)
- 🟡 Implement request signing
- 🟡 Add API versioning
- 🟡 Enhanced monitoring dashboard
- 🟡 Automated security scanning

## Testing Infrastructure

### Test Suite Organization

All tests are centralized in the `r3-workspace/tests` directory:

```
r3-workspace/tests/
├── frontend/             # Frontend tests
│   └── r3-frontend/     # Theme tests
│       ├── unit/        # Component tests
│       ├── integration/ # Feature tests
│       └── e2e/        # End-to-end tests
├── backend/             # Backend tests
│   └── r3-backend/     # API tests
│       ├── unit/       # Function tests
│       ├── integration/# API endpoint tests
│       └── e2e/        # Flow tests
├── integration/         # Cross-repo tests
├── shared/             # Test utilities
│   ├── fixtures/       # Test data
│   ├── helpers/        # Helper functions
│   └── mocks/         # Mock services
└── config/             # Jest configuration
```

### Running Tests

```bash
# From any repository (r3-frontend or r3-backend)
npm test              # Runs tests for that repo via r3-workspace

# From r3-workspace/tests directory
npm test              # Run all tests
npm run test:frontend # Frontend only
npm run test:backend  # Backend only
npm run test:coverage # With coverage report
npm run test:watch    # Auto-run on file changes
```

### Test Categories

| Category | Command | Purpose |
|----------|---------|---------|
| Unit | `npm run test:unit` | Individual function/component tests |
| Integration | `npm run test:integration` | Feature and API tests |
| E2E | `npm run test:e2e` | Full user journey tests |
| ACH | `npm run test:ach` | ACH payment flow tests |
| Session | `npm run test:session` | Session management tests |
| Security | `npm run test:security` | Security validation tests |
| Checkout | `npm run test:checkout` | Checkout flow tests |
| Webhooks | `npm run test:webhooks` | Webhook handling tests |

### Test-Driven Development (TDD) Process

#### Core TDD Workflow
The R3 platform follows strict test-driven development principles:

1. **Red Phase** - Write a failing test that defines expected behavior
2. **Green Phase** - Write minimal code to make the test pass
3. **Refactor Phase** - Improve code quality while maintaining passing tests

#### Development Requirements
- **All new features** must have tests written BEFORE implementation
- **All bug fixes** must include regression tests
- **Behavioral changes** require updating existing tests first
- **Coverage minimum**: 80% for critical paths
- **No task is complete** until tests pass

#### TDD Command Flow
```bash
# 1. Write test first
cd r3-workspace/tests
vim frontend/r3-frontend/new-feature.test.js

# 2. Verify test fails
npm test -- new-feature.test.js  # RED

# 3. Implement feature
cd ../../r3-frontend
vim assets/new-feature.js

# 4. Verify test passes
cd ../r3-workspace/tests
npm test -- new-feature.test.js  # GREEN

# 5. Refactor and verify
npm test -- new-feature.test.js  # Still GREEN

# 6. Run full suite for regressions
npm test  # All tests should pass
```

#### Behavioral Expectation Testing
When requirements specify behavior:
```javascript
// Requirement: "Cart should apply 10% discount for orders over $200"
describe('Cart Discount Logic', () => {
  it('should apply 10% discount for orders over $200', () => {
    const cart = { subtotal: 20100 }; // $201 in cents
    const discount = calculateDiscount(cart);
    expect(discount.amount).toBe(2010); // 10% of $201
    expect(discount.reason).toBe('10% off orders over $200');
  });
  
  it('should not apply discount for orders under $200', () => {
    const cart = { subtotal: 19900 }; // $199 in cents
    const discount = calculateDiscount(cart);
    expect(discount.amount).toBe(0);
    expect(discount.reason).toBeNull();
  });
});
```

#### Breaking Change Protocol
1. **Identify** the behavioral change needed
2. **Update tests** to reflect new expected behavior
3. **Run tests** to confirm they fail with current code
4. **Implement** the change
5. **Verify** all updated tests pass
6. **Document** with `feat!:` or `fix!:` in commit message

### Test Statistics
- **Total Tests**: 203
- **Passing**: 185
- **Coverage**: ~82% (target: 80%+)
- **Test Runner**: Jest with MSW for API mocking
- **Module Aliases**: @fixtures, @helpers, @mocks, @config
- **Environment**: Uses `config/test.env` for test-specific variables
- **Custom Matchers**: toBeValidSession, toBeValidPaymentIntent

### CI/CD Integration

#### GitHub Actions Workflows
Located in `r3-workspace/.github/workflows/`:

- **test.yml** - Runs full test suite on push/PR
- **coverage.yml** - Generates and publishes coverage reports
- **integration.yml** - Runs cross-repository integration tests

#### Automated Testing Pipeline
```yaml
# Triggers
- Push to main branch
- Pull requests
- Daily scheduled runs (3 AM UTC)

# Test Matrix
- Node versions: 16.x, 18.x, 20.x
- Environments: development, staging

# Steps
1. Checkout code
2. Install dependencies
3. Run linters
4. Execute test suite
5. Generate coverage report
6. Upload artifacts
```

#### Test Requirements for Merge
- All tests must pass
- Coverage must not decrease
- No new security vulnerabilities
- Linting checks pass

#### Production Deployment Requirements
- **100% test pass rate required** before pushing to prod branch
- Run complete test suite: `cd r3-workspace/tests && npm test`
- Zero tolerance for failing tests in production deployments
- Fix all failing tests before proceeding with production release

### Testing Tools & Configuration
- **Jest**: Unit and integration test framework
- **MSW (Mock Service Worker)**: API mocking for consistent test data
- **Supertest**: HTTP assertions for API testing
- **Playwright**: E2E browser tests (planned)
- **Custom Matchers**: Domain-specific assertions
- **Module Aliases**: Simplified imports with @-prefixed paths

### Test Data Management
- **Centralized Fixtures**: All test data in `r3-workspace/tests/shared/fixtures/`
- **Mock Handlers**: Stripe, Shopify API mocks in `shared/mocks/`
- **Test Environment**: Isolated test.env configuration
- **Session Mocking**: Redis/Vercel KV test instances

## Environment Configuration

### Development Environment
```bash
# Local development
cd r3-frontend && shopify theme dev
cd r3-backend && vercel dev

# Environment variables (.env.local)
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_xxx
```

### Staging Environment
- Branch: `stage`
- Auto-deploys on push
- Test Stripe keys
- Draft orders only

### Production Environment
- Branch: `prod`
- Manual approval required
- Live Stripe keys
- Real order creation

### Environment Detection
```javascript
// Backend environment detection
const getCurrentEnvironment = () => {
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  const branchEnvMap = {
    'prod': 'production',
    'stage': 'staging',
    'dev': 'development'
  };
  return branchEnvMap[branch] || 'production';
};
```

## Monitoring & Logging

### Logging Infrastructure
```javascript
// Winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});
```

### Key Metrics Tracked
- Payment success/failure rates
- ACH payment processing times
- API response times
- Circuit breaker states
- Webhook processing status

### Error Handling
```javascript
// Centralized error handling
app.use((error, req, res, next) => {
  logger.error('Request failed', {
    error: error.message,
    stack: error.stack,
    requestId: req.id
  });
  res.status(500).json(createSafeError(error));
});
```

## Disaster Recovery & Business Continuity

### Rollback Procedures

#### Frontend Rollback
```bash
# Quick rollback to previous theme version
shopify theme push --theme <previous-theme-id>

# Or use GitHub to revert
git revert HEAD
git push origin prod
# GitHub Actions will auto-deploy
```

#### Backend Rollback
```bash
# Vercel automatic rollback
vercel rollback

# Or promote previous deployment
vercel promote <deployment-url>
```

### Recovery Time Objectives (RTO)

| Component | RTO | RPO | Strategy |
|-----------|-----|-----|----------|
| Frontend | 5 min | 0 | GitHub + Shopify theme versioning |
| Backend API | 2 min | 0 | Vercel instant rollback |
| Sessions | 30 min | 30 min | Redis persistence |
| Orders | 0 | 0 | Shopify handles persistence |

### Backup Strategy

#### Code Backups
- GitHub: Full version history
- Shopify: Theme version history
- Vercel: Deployment history

#### Data Backups
- Orders: Shopify automatic backups
- Sessions: Redis persistence (30-min window)
- Logs: Vercel retains for 7 days

### Incident Response Plan

1. **Detection** (< 2 min)
   - Automated health checks
   - Vercel monitoring
   - Customer reports

2. **Assessment** (< 5 min)
   - Check Vercel logs
   - Review error rates
   - Identify affected components

3. **Mitigation** (< 10 min)
   - Rollback if needed
   - Scale resources
   - Enable maintenance mode

4. **Resolution** (varies)
   - Deploy fix
   - Verify resolution
   - Clear caches

5. **Post-Mortem**
   - Document incident
   - Update runbooks
   - Implement preventions

### Failover Scenarios

#### Payment Provider Failure
- Stripe outage: Show maintenance message
- Fallback: Queue orders for later processing

#### Session Store Failure
- Redis down: Degrade to stateless checkout
- Fallback: Direct Shopify checkout

#### API Failure
- Backend down: Static error page
- Fallback: Queue requests for replay

## Performance Benchmarks

### Target Metrics

| Metric | Target | Current | Alert Threshold |
|--------|--------|---------|-----------------|
| Page Load | < 3s | 2.8s | > 5s |
| API Response | < 500ms | 450ms | > 1s |
| Checkout Completion | < 30s | 25s | > 60s |
| Session Creation | < 200ms | 180ms | > 500ms |
| Payment Processing | < 5s | 4s | > 10s |

### API Rate Limits

> ⚠️ **IMPORTANT**: Current limits are set very high for testing/validation. These MUST be reduced before production launch. See TODO comments in `/r3-backend/middleware/rateLimiter.js`

| Endpoint Type | Current Limit (Testing) | Target Limit (Production) | Window | Status Code |
|--------------|------------------------|---------------------------|---------|-------------|
| General API (`/api/*`) | 1000 requests | 100 requests | 15 minutes | 429 |
| Session Creation (`/api/checkout/session`) | 500 requests | 10-20 requests | 15 minutes | 429 |
| Payment Processing (`/api/stripe/*`) | 200 requests | 20-30 requests | 5 minutes | 429 |
| Webhooks (`/webhook/stripe`) | 1000 requests | 100 requests | 1 minute | 429 |

**Pre-Production Checklist:**
- [ ] Review and reduce all rate limits in `rateLimiter.js`
- [ ] Test with production-like limits in staging
- [ ] Ensure monitoring alerts for rate limit violations
- [ ] Document rate limit headers in API responses

### Scaling Limits

- **Concurrent Sessions**: 10,000
- **Orders per Hour**: 1,000
- **Webhook Queue**: 1,000 events
- **Redis Memory**: 256MB
- **Vercel Functions**: 10s timeout

## Automation Scripts

### Script Organization
Utility scripts are organized within each repository's `/scripts` folder for better context and maintainability.

#### Frontend Scripts (`r3-frontend/scripts/`)
**Deployment & Sync**
- `deploy-to-stage.sh` - Automated staging deployment with safety checks
- `deploy-to-prod.sh` - Production deployment with multiple confirmations
- `sync-branches.sh` - Interactive branch merging (dev→stage→prod)
- `sync-from-stage.sh` / `sync-from-prod.sh` - Pull upstream changes

**Testing & Debugging**
- `test-checkout.sh` - End-to-end checkout flow testing
- `test-checkout.js` - Node.js-based checkout validation
- `debug-cart.js` - Browser-based cart debugging utility

**Setup & Configuration**
- `setup-branch-protection.sh` - Configure GitHub branch protection rules
- `auto-deploy.sh` - Automated deployment helper

#### Backend Scripts (`r3-backend/scripts/`)
**Maintenance & Utilities**
- `clear-rate-limits.js` - Clear Vercel KV rate limit entries
- `check-vercel-settings.sh` - Verify Vercel project configuration
- `vercel-api-utils.sh` - Vercel API management utilities
- `test-session-auth.html` - Browser-based session testing

### GitHub Actions Integration
Automated workflows complement manual scripts:
- **deploy-theme.yml** - Automatic theme deployment on branch push
- **theme-checks.yml** - Quality validation on pull requests
- **deploy-backend.yml** - Backend deployment via Vercel integration

Scripts check for running GitHub Actions to prevent deployment conflicts.

## Development Workflow

### Local Development Setup
```bash
# 1. Clone repositories
git clone https://github.com/dylanjshaw001/r3-frontend
git clone https://github.com/dylanjshaw001/r3-backend

# 2. Install dependencies
cd r3-backend && npm install
cd r3-frontend && npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Start development servers
shopify theme dev # Frontend
vercel dev # Backend
```

### Code Standards

#### JavaScript
- ES6+ syntax
- Async/await for asynchronous code
- Proper error handling
- JSDoc comments for functions

#### CSS
- BEM methodology
- CSS variables for theming
- Mobile-first responsive design
- Maximum specificity: 0-1-0

#### Git Workflow
```bash
# Feature development
git checkout dev
git pull origin dev
git checkout -b feature/your-feature

# Make changes
git add -A
git commit -m "feat: descriptive message"
git push origin feature/your-feature

# Create PR to dev branch
# After review, merge to dev
# dev → stage (auto)
# stage → prod (manual approval)
```

### Debugging Tools

#### Backend Debugging
```bash
# Check Vercel logs
vercel logs r3-backend

# Test endpoints
curl https://r3-backend-git-stage-r3.vercel.app/health

# Check Redis sessions
vercel env pull # Get KV credentials
redis-cli # Connect to Redis
```

#### Frontend Debugging
```javascript
// Debug helpers in console
window.checkoutDebug = {
  session: () => localStorage.getItem('checkoutSession'),
  cart: () => fetch('/cart.js').then(r => r.json()),
  shipping: () => window.checkout?.shipping
};
```

## Recent Updates (August 2025)

### Major Changes
1. **Repository Renaming**: r3-nu → r3-frontend, r3-payment-backend → r3-backend
2. **Branch Renaming**: r3-dev/r3-stage/r3-prod → dev/stage/prod
3. **Vercel Team Migration**: dylans-projects → r3
4. **ACH Order Creation**: Fixed to create draft orders immediately
5. **Shipping Calculation**: Moved from frontend to backend API
6. **Cart Drawer Fix**: Fixed new items not appearing immediately

### Migration Considerations
- Old branch names still supported for backwards compatibility
- Environment variables re-scoped to new branch names
- Webhook URLs updated to new Vercel team structure

## Troubleshooting

### Common Issues

#### Session Expired (401)
- Session TTL is 30 minutes
- Automatic renewal on API calls
- Check Redis connection

#### Webhook Failures
- Verify webhook secret matches
- Check environment detection
- Review idempotency keys

#### Deployment Issues
- GitHub Actions billing must be active
- Shopify CLI authentication required
- Vercel scope must be set to 'r3'

### Debug Endpoints
```http
GET /health - System health check
GET /api/debug/check-order-type - Order type detection
GET /api/circuit-breakers - Circuit breaker status
```

## Performance Considerations

### Caching Strategy
- Shipping rates cached for 1 hour
- Tax rates cached for 24 hours
- Customer data cached for 5 minutes
- Redis-backed with memory cache fallback

### Optimization Techniques
- Request throttling (1.5s between cart updates)
- Circuit breakers prevent cascade failures
- CDN delivery for all theme assets
- Lazy loading for non-critical resources
- DOM synchronization checks for cart UI updates
- Bidirectional cart state validation

## Checkout Architecture

### File Dependencies
```
checkout.js (main controller)
├── Loads cart data from Shopify
├── Creates/manages sessions with backend
├── Handles form validation
└── Calls checkout-payments.js methods

checkout-payments.js (payment extension)
├── Extends CustomCheckout prototype
├── Handles Stripe integration
├── Processes card and ACH payments
└── Includes rep tracking metadata

custom-checkout.liquid (template)
├── Loads checkout.js (deferred)
├── Loads checkout-payments.js (deferred)
└── Contains HTML structure
```

### Session Flow
1. **Page Load**: checkout.js constructor initializes session
2. **Session Creation**: Backend generates token, stores in Redis
3. **Storage**: Token saved in localStorage and cart.attributes
4. **API Calls**: All requests include `Authorization: Bearer {token}`
5. **Validation**: Backend validates token via Redis lookup
6. **Expiry**: 30-minute TTL with auto-renewal on activity

### Critical Integration Points
- **Session Creation**: checkout.js:29-67
- **Payment Processing**: checkout-payments.js:364-479
- **Webhook Order Creation**: server-session.js:150-218
- **Metadata Requirements**: Full customer/cart data in payment intent

## Security Checklist

- [ ] All API endpoints require authentication
- [ ] Webhook signatures verified
- [ ] Input validation on all user data
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers via Helmet
- [ ] No sensitive data in frontend code
- [ ] Environment variables properly scoped
- [ ] HTTPS enforced everywhere
- [ ] Regular dependency updates

## Contact & Support

### Development Team
- GitHub: @dylanjshaw001
- Repositories: https://github.com/dylanjshaw001

### Key Documentation
- This document: `/r3-docs/TECHNICAL_ARCHITECTURE.md`
- Business overview: `/r3-docs/BUSINESS_OVERVIEW.md`
- API Reference: `/r3-docs/api/`
- Deployment Guide: `/r3-docs/deployment/`

---

*This document represents the current state of the R3 platform as of August 10, 2025. For updates, check the git history or documentation repository.*