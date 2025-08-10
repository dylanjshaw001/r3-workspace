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

#### 1. **r3-frontend** (Shopify Theme)
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

## Security Architecture

### Authentication & Authorization

#### Session Security
- Redis-backed sessions with 30-minute TTL
- Cryptographically secure token generation
- Domain validation for multi-store support
- CSRF protection on state-changing operations

#### API Security
```javascript
// Security middleware stack
app.use(helmet()); // Security headers
app.use(cors(corsOptions)); // CORS protection
app.use(rateLimiter); // Rate limiting
app.use(validateSession); // Session validation
app.use(validateCSRF); // CSRF protection
```

### Data Protection

#### Sensitive Data Handling
- No PII stored in frontend
- Payment details handled by Stripe.js
- Session data encrypted in transit
- Webhook signatures verified

#### Environment Variables
```
# Production secrets (Vercel)
STRIPE_SECRET_KEY_PROD
STRIPE_WEBHOOK_SECRET_PROD
SHOPIFY_ADMIN_ACCESS_TOKEN_PROD
KV_REST_API_TOKEN

# Scoped by branch in Vercel
- dev branch → *_DEV variables
- stage branch → *_STAGE variables
- prod branch → *_PROD variables
```

### Input Validation
```javascript
// Example validation
if (!/^\d{5}(-\d{4})?$/.test(postalCode)) {
  return res.status(400).json({ error: 'Invalid postal code' });
}
```

## Testing Infrastructure

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
vim frontend/new-feature.test.js

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
- **Total Tests**: 63
- **Passing**: 48
- **Coverage**: ~75% (target: 80%+)
- **Test Runner**: Jest with MSW for API mocking
- **Module Aliases**: @fixtures, @helpers, @mocks, @config
- **Environment**: Uses `config/test.env` for test-specific variables
- **Custom Matchers**: toBeValidSession, toBeValidPaymentIntent

### Centralized Test Organization
```
r3-workspace/tests/
├── r3-frontend/           # Frontend tests
│   ├── unit/             # Component and function tests
│   ├── integration/      # Feature integration tests
│   ├── e2e/             # End-to-end user flows
│   ├── cart-drawer.test.js
│   ├── checkout-flow.test.js
│   ├── ach-hybrid-mode.test.js
│   ├── ach-financial-connections.test.js
│   ├── ach-manual-entry.test.js
│   └── manual-test-checklist.md
├── r3-backend/           # Backend API tests
│   ├── integration/
│   │   ├── session/     # Session management tests
│   │   ├── payment/     # Payment processing tests
│   │   ├── webhooks/    # Webhook handling tests
│   │   └── security/    # Security validation tests
│   └── e2e/             # Complete API workflows
├── integration/          # Cross-repository tests
│   ├── full-checkout/   # Complete checkout flows
│   ├── ach-hybrid-checkout-flow.test.js
│   └── order-consistency.test.js
├── shared/              # Shared test resources
│   ├── fixtures/        # Test data and fixtures
│   ├── helpers/         # Test utilities
│   ├── mocks/          # MSW handlers and mock data
│   └── config/         # Jest configuration
└── config/
    └── test.env        # Test environment variables
```

### Test Execution Strategy

#### Test-Driven Development Mode
```bash
# Continuous testing during development
cd r3-workspace/tests
npm run test:watch          # Auto-runs tests on file changes

# Test specific features while developing
npm test -- --watch cart-drawer.test.js
```

#### Standard Test Execution
```bash
# From any repository (delegates to r3-tests)
npm test                    # Run all relevant tests
npm run test:frontend       # Frontend tests only
npm run test:backend        # Backend tests only
npm run test:integration    # Cross-repo integration tests

# Specific test categories
npm run test:session        # Session management tests
npm run test:payment        # Payment processing tests
npm run test:security       # Security validation tests
npm run test:checkout       # Checkout flow tests
npm run test:ach           # All ACH payment tests
npm run test:order-consistency  # Order creation consistency

# From r3-tests directly
cd r3-workspace/tests
npm test                    # Run all tests
npm run test:coverage       # With coverage report
```

#### Continuous Integration Requirements
- **Pre-commit**: Run relevant test suite
- **Pre-push**: Full test suite must pass
- **Pull Request**: Coverage report required
- **Merge to main branches**: All tests must pass

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