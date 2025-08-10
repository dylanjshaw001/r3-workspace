# R3 Project Assistant Guide (CLAUDE.md)
*Last Updated: August 10, 2025*

## Overview

This document provides comprehensive guidance for AI assistants working with the R3 e-commerce platform. It consolidates project structure, development practices, testing strategies, and critical operational knowledge.

## 📝 Documentation Guidelines

### Core Documentation Principles

1. **Update, Don't Duplicate**: Always update existing documentation instead of creating new files, unless explicitly specified by the user.
2. **Keep Master Documents Current**: When making changes to any repository, update the master documents in r3-workspace/docs to maintain consistency.
3. **Single Source of Truth**: This CLAUDE.md file in r3-workspace is the authoritative guide. Team members should have r3-workspace open alongside their project repositories.
4. **Documentation Locations**:
   - Master docs: `/Users/dylanjshaw/r3/r3-workspace/docs/`
   - Technical Architecture: `TECHNICAL_ARCHITECTURE.md`
   - Business Overview: `BUSINESS_OVERVIEW.md`
   - This guide: `CLAUDE.md`
   - Secrets Management: `SECRETS_MANAGEMENT.md`

## Project Structure

### Repository Layout
```
r3/
├── r3-workspace/       # Central development hub (THIS IS PRIMARY)
│   ├── docs/          # All master documentation
│   ├── tests/         # Comprehensive test suite
│   └── .github/       # CI/CD workflows
├── r3-frontend/        # Shopify Liquid theme with custom checkout
├── r3-backend/         # Node.js/Express payment processing API  
└── r3-access/          # Authentication and access control service
```

### Active Development Repositories
- **r3-workspace**: Documentation hub and test suite (https://github.com/dylanjshaw001/r3-workspace)
- **r3-frontend**: Customer-facing Shopify theme
- **r3-backend**: Payment processing and order management
- **r3-access**: Credential storage (not in version control)

## Critical Development Rules

### 1. Branch Management
**ALWAYS use the new branch names:**
- `dev` → Development environment
- `stage` → Staging environment  
- `prod` → Production environment

**NEVER use old branch names:**
- ~~r3-dev~~, ~~r3-stage~~, ~~r3-prod~~ (deprecated)

### 2. Deployment Order
**Golden Rule: ALWAYS deploy in this sequence:**
1. Make local changes
2. Git commit with descriptive message
3. Push to GitHub (backend auto-deploys via Vercel)
4. Deploy theme to Shopify

**NEVER push directly to theme without Git!**

### 3. Testing Requirements
Before marking any task complete:
- Run `npm run lint` if available
- Run `npm run typecheck` for TypeScript projects
- Run relevant tests from r3-workspace/tests
- Verify checkout flow works end-to-end
- Check for console errors

**CRITICAL for Production Deployments:**
- **100% test pass rate required** before pushing to prod branch
- Run `cd r3-workspace/tests && npm test` and ensure ALL tests pass
- No exceptions - fix all failing tests before production deployment

## Environment Configuration

### Development
```bash
# Frontend
cd r3-frontend && shopify theme dev

# Backend
cd r3-backend && npm run dev
```

### Staging
- URL: https://sqqpyb-yq.myshopify.com?preview_theme_id=153047662834
- Theme ID: 153047662834
- Uses test Stripe keys
- Creates draft orders only

### Production
- URL: rthree.io (future)
- Uses live Stripe keys
- Creates real orders

## Secrets Management

### Vault Structure Reference
Secrets are managed via team vault with the following structure:
```
r3-dev-secrets/          # Development environment
├── stripe/
│   ├── test-keys       # sk_test_*, webhook secrets
│   └── public-keys     # pk_test_* (safe to share)
├── shopify/
│   ├── admin-tokens    # Admin API access tokens
│   └── theme-tokens    # Theme deployment tokens
└── infrastructure/
    ├── redis           # KV_REST_API_URL, KV_REST_API_TOKEN
    └── vercel          # Deployment tokens

r3-stage-secrets/        # Staging environment (senior devs)
└── [similar structure]

r3-prod-secrets/         # Production (admin only)
└── [similar structure with live keys]
```

### Public Keys (Safe to Reference)
```javascript
// Stripe Test Publishable Key
STRIPE_PUBLIC_KEY_TEST = 'pk_test_51QfuVo2MiCAheYVMWMHg8qhGhCLRnLhOrnZupzJxppag93BnJhMFCCwg1xC2X4aH9vzonCpcpf8z3avoYINOvzaI00u9n0Xx7F'

// Shopify Store Domain
SHOPIFY_DOMAIN = 'sqqpyb-yq.myshopify.com'

// Theme IDs
STAGING_THEME_ID = '153047662834'
```

### Secret References (Get from Vault)
- `STRIPE_SECRET_KEY_TEST`: Vault → r3-dev-secrets → stripe → test-keys
- `STRIPE_WEBHOOK_SECRET`: Vault → r3-dev-secrets → stripe → webhook-secrets
- `SHOPIFY_ADMIN_TOKEN`: Vault → r3-dev-secrets → shopify → admin-tokens
- `KV_REST_API_URL`: Vault → r3-dev-secrets → infrastructure → redis
- `KV_REST_API_TOKEN`: Vault → r3-dev-secrets → infrastructure → redis

## Payment Processing

### Card Payments
- Instant processing through Stripe
- Order created immediately
- 2.9% + $0.30 transaction fee

### ACH Payments
Two modes available:
1. **Financial Connections** (Instant verification)
   - Customer logs into bank
   - Immediate verification
   - Order created right away

2. **Manual Entry**
   - Customer enters routing/account numbers
   - Microdeposit verification (1-2 days)
   - Order created after verification

### Order Creation Rules
- **Production + Live Payment** → Real order
- **Staging/Dev + Any Payment** → Draft order
- **Exactly 1 order per payment** (idempotency enforced)

## Shipping Calculation

### ONEbox Products
Server-side calculation only:
- **Units**: $5.00 each
- **Case (10 units)**: $25.00
- Example: 13 units = 1 case ($25) + 3 units ($15) = $40

### Standard Products
- FREE shipping on all non-ONEbox items
- No minimum order requirement

## Session Management

### Checkout Sessions
- Created on checkout page load
- 30-minute TTL in Redis/Vercel KV
- Token stored in localStorage and cart.attributes
- Required for all API calls: `Authorization: Bearer {token}`

### Session Recovery
If session expires:
1. Call `ensureValidSession()` 
2. Creates new session if needed
3. Preserves cart data

## Testing Strategy

### Centralized Testing
All tests live in `r3-workspace/tests/`:
```bash
# From any repository
npm test                # Delegates to r3-workspace/tests
npm run test:frontend   # Frontend tests only
npm run test:backend    # Backend tests only

# Specific categories
npm run test:ach        # ACH payment tests
npm run test:checkout   # Checkout flow tests
npm run test:session    # Session management
```

### Test Organization
- `r3-workspace/tests/frontend/` - UI and e2e tests
- `r3-workspace/tests/backend/` - API and webhook tests
- `r3-workspace/tests/integration/` - Cross-repo tests
- `r3-workspace/tests/shared/` - Fixtures, helpers, mocks

### Running Tests
```bash
cd r3-workspace/tests
npm test                    # All tests
npm run test:coverage       # With coverage report
```

### Production Deployment Testing
```bash
# REQUIRED before pushing to prod
cd r3-workspace/tests
npm test                    # Must show 100% pass rate

# If any tests fail:
# 1. Fix the failing tests
# 2. Re-run entire suite
# 3. Only proceed when all tests pass
```

## Common Issues & Solutions

### Webhook Failures
- **500 Error**: Check environment variables match branch names
- **No Draft Order**: Verify getCurrentEnvironment() recognizes branch
- **Duplicate Orders**: Check idempotency key implementation

### Cart UI Issues
- **Items not showing**: Check updateCartUI() bidirectional sync
- **Quantities wrong**: Verify DOM manipulation in theme.js
- **Cart not updating**: Check 1.5s throttling isn't blocking

### Session Problems
- **401 Unauthorized**: Session expired (30 min TTL)
- **Missing token**: Check localStorage and cart.attributes
- **Invalid session**: Verify Redis/Vercel KV connection

### Deployment Issues
- **GitHub Actions failing**: Check billing is active ($30/month allocated)
- **Theme not updating**: Clear browser cache, check preview_theme_id
- **Backend not deploying**: Verify Vercel scope is set to 'r3'

## Critical Files & Functions

### Frontend
- `assets/checkout.js` - Main checkout controller
- `assets/checkout-payments.js` - Payment processing
- `assets/theme.js` - Cart UI management
- `templates/custom-checkout.liquid` - Checkout template

### Backend
- `server-unified.js` - Main Express server
- `api/webhook-stripe.js` - Webhook processing
- `utils/session.js` - Session management
- `utils/shipping.js` - Shipping calculation

### Key Functions
- `initializeSession()` - Creates checkout session
- `processCardPayment()` - Handles card payments
- `processACHPayment()` - Handles ACH transfers
- `updateCartUI()` - Synchronizes cart display
- `getCurrentEnvironment()` - Determines dev/stage/prod

## Test-Driven Development (TDD) Workflow

### Core TDD Process

**IMPORTANT**: All development must follow test-driven principles. When behavioral expectations are specified, tests must be created BEFORE implementation.

#### 1. New Feature Development
```bash
# Step 1: Write the test first
cd r3-workspace/tests
# Create test file: frontend/r3-frontend/feature-name.test.js or backend/r3-backend/feature-name.test.js

# Step 2: Run test to verify it fails (Red Phase)
npm test -- feature-name.test.js
# Expected: Test fails because feature doesn't exist yet

# Step 3: Implement minimal code to pass test
cd ../r3-frontend  # or r3-backend
# Write implementation

# Step 4: Run test to verify it passes (Green Phase)
cd ../r3-workspace/tests && npm test -- feature-name.test.js
# Expected: Test passes

# Step 5: Refactor while keeping tests green
# Improve code quality, then re-run tests

# Step 6: Run full test suite to check for regressions
npm test
```

#### 2. Bug Fix Process
```bash
# Step 1: Write a failing test that reproduces the bug
cd r3-workspace/tests
# Add test case to existing test file or create new one

# Step 2: Verify test fails with current code
npm test -- affected-test.js

# Step 3: Fix the bug
cd ../r3-frontend  # or r3-backend
# Implement fix

# Step 4: Verify test now passes
cd ../r3-workspace/tests && npm test -- affected-test.js

# Step 5: Run related test suites
npm run test:frontend  # or test:backend
```

#### 3. Behavioral Changes
When changing expected behavior:
1. **Update existing tests** to reflect new behavior
2. **Add new tests** for edge cases
3. **Run tests** to verify they fail with old code
4. **Implement changes**
5. **Verify all tests pass**
6. **Document the behavioral change** in commit message

### Test Categories & Commands

#### Quick Test Reference
```bash
# From any repository (delegates to r3-workspace/tests)
npm test                    # Run relevant tests for current repo
npm run test:watch          # TDD mode - auto-runs on changes

# Frontend-specific tests
npm run test:checkout       # Checkout flow tests
npm run test:ui            # UI component tests
npm run test:recovery      # Error recovery tests

# Backend-specific tests
npm run test:session       # Session management tests
npm run test:payment       # Payment processing tests
npm run test:webhooks      # Webhook handling tests
npm run test:security      # Security validation tests

# Cross-cutting tests
npm run test:ach           # All ACH payment tests
npm run test:integration   # Cross-repo integration tests
npm run test:coverage      # Generate coverage report
```

### Behavioral Expectation Protocol

When a user specifies expected behavior, follow this protocol:

1. **Create/Update Test**
   ```javascript
   // Example: User wants cart to show free shipping for orders over $100
   describe('Cart Shipping Calculation', () => {
     it('should show free shipping for orders over $100', async () => {
       const cart = { total: 10100 }; // $101.00 in cents
       const shipping = await calculateShipping(cart);
       expect(shipping.cost).toBe(0);
       expect(shipping.label).toBe('FREE SHIPPING');
     });
   });
   ```

2. **Show Test to User**
   - Display the test code
   - Explain what behavior it validates
   - Get confirmation before proceeding

3. **Run Test (Expect Failure)**
   ```bash
   npm test -- shipping-calculation.test.js
   # Should fail if feature doesn't exist yet
   ```

4. **Implement Feature**
   - Write minimal code to satisfy test
   - Focus on making test pass

5. **Verify Test Passes**
   ```bash
   npm test -- shipping-calculation.test.js
   # Should pass after implementation
   ```

6. **Check for Regressions**
   ```bash
   npm run test:all
   # Ensure no other tests broke
   ```

### Test Organization

```
r3-workspace/tests/
├── frontend/r3-frontend/
│   ├── unit/              # Individual function/component tests
│   │   └── cart-utils.test.js
│   ├── integration/       # Feature integration tests
│   │   └── checkout-flow.test.js
│   └── e2e/              # Full user journey tests
│       └── complete-purchase.test.js
├── backend/r3-backend/
│   ├── unit/             # Utility function tests
│   │   └── shipping-calc.test.js
│   ├── integration/      # API endpoint tests
│   │   └── session-creation.test.js
│   └── e2e/             # Full API flow tests
│       └── payment-to-order.test.js
└── integration/          # Cross-repository tests
    └── full-checkout-flow.test.js
```

### Common Test Patterns

#### Testing Cart Behavior
```javascript
describe('Cart Updates', () => {
  beforeEach(() => {
    // Setup mock cart
  });
  
  it('should update UI when item added', async () => {
    // Test implementation
  });
});
```

#### Testing API Endpoints
```javascript
describe('POST /api/checkout/session', () => {
  it('should create session with valid data', async () => {
    const response = await request(app)
      .post('/api/checkout/session')
      .send(validData);
    expect(response.status).toBe(200);
    expect(response.body.sessionToken).toBeDefined();
  });
});
```

#### Testing Payment Flows
```javascript
describe('ACH Payment Processing', () => {
  it('should create draft order immediately', async () => {
    // Test ACH payment creates order before clearing
  });
});
```

### Test Validation Requirements

**Before marking ANY task complete:**
1. ✅ Relevant tests must pass
2. ✅ No regression in existing tests
3. ✅ Coverage maintained above 80% for critical paths
4. ✅ New features have corresponding tests
5. ✅ Bug fixes include regression tests

### Breaking Change Protocol

When intentionally changing behavior:
1. **Document the breaking change** in PR/commit
2. **Update tests FIRST** to reflect new behavior
3. **Show test changes** to user for approval
4. **Implement the change**
5. **Verify all updated tests pass**
6. **Use conventional commit**: `feat!:` or `fix!:` for breaking changes

### Continuous Testing in Development

```bash
# Terminal 1: Run tests in watch mode
cd r3-workspace/tests
npm run test:watch

# Terminal 2: Make changes
cd r3-frontend
# Edit files - tests auto-run

# Terminal 3: Monitor coverage
cd r3-workspace/tests
npm run test:coverage -- --watch
```

### Test-Driven Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/cart-free-shipping

# 2. Write test first (in r3-workspace/tests/)
# 3. Commit the failing test
git add r3-workspace/tests/frontend/r3-frontend/cart-free-shipping.test.js
git commit -m "test: add test for free shipping over $100"

# 4. Implement feature (in r3-frontend/)
# 5. Commit implementation
git add r3-frontend/assets/shipping.js
git commit -m "feat: add free shipping for orders over $100"

# 6. Verify all tests pass
cd r3-workspace/tests && npm test

# 7. For production deployment:
cd r3-workspace/tests && npm test  # MUST be 100% pass rate
git checkout prod
git merge stage
git push origin prod  # Only if all tests pass
```

## Development Best Practices

### Code Style
- Match existing code conventions
- Use established libraries (don't add new ones without checking)
- Follow security best practices
- Never store sensitive data
- Always validate user input
- **Write tests for new code**
- **Update tests when changing behavior**

### Git Workflow
```bash
# 1. Create feature branch
git checkout -b feature/your-feature

# 2. Make changes and test
npm test

# 3. Commit with clear message
git add -A
git commit -m "feat: add new payment method"

# 4. Push to appropriate environment
git checkout stage
git merge feature/your-feature
git push origin stage

# 5. Deploy theme if needed
shopify theme push --theme 153047662834
```

### Documentation
- **Update existing docs** - Don't create new documentation files unless explicitly requested
- Update this CLAUDE.md file when adding major features
- Keep TECHNICAL_ARCHITECTURE.md current with system changes
- Keep BUSINESS_OVERVIEW.md updated with business logic changes
- Document breaking changes in commit messages
- Include examples in code comments
- **Master documents in r3-workspace/docs/** are the single source of truth

## Security Checklist

### API Security
- [ ] All endpoints require authentication
- [ ] Session tokens validated
- [ ] Input sanitization implemented
- [ ] Rate limiting enabled
- [ ] CORS properly configured

### Payment Security
- [ ] Webhook signatures verified
- [ ] No card data stored
- [ ] Stripe tokens used exclusively
- [ ] Idempotency keys implemented
- [ ] Environment detection accurate

### Frontend Security
- [ ] No API keys in client code
- [ ] Shipping calculated server-side
- [ ] Form validation on submit
- [ ] XSS prevention measures
- [ ] CSRF tokens implemented

## Monitoring & Debugging

### Health Checks
```bash
# Backend health
curl https://r3-backend.vercel.app/health

# Check order type detection
curl https://r3-backend.vercel.app/api/debug/check-order-type

# View logs
vercel logs --follow
```

### Debug Endpoints
- `/health` - System health
- `/api/debug/check-order-type` - Environment detection
- `/api/circuit-breakers` - Circuit breaker status

### Performance Monitoring
- Page load: < 3 seconds target
- API response: < 500ms target
- Checkout completion: < 30 seconds
- Cart updates: 1.5s throttle

## Scripts Documentation

### Script Organization
All utility scripts are now organized in their respective repository's `/scripts` folder:
- **r3-frontend/scripts/** - Theme deployment, testing, and sync utilities
- **r3-backend/scripts/** - Backend utilities, rate limiting, and Vercel management

### Frontend Scripts (r3-frontend/scripts/)

#### Deployment Scripts
| Script | Purpose | Usage |
|--------|---------|-------|
| `deploy-to-stage.sh` | Deploy current branch to staging theme | `./scripts/deploy-to-stage.sh` |
| `deploy-to-prod.sh` | Deploy to production with safety checks | `./scripts/deploy-to-prod.sh` |
| `auto-deploy.sh` | Automated deployment helper | `./scripts/auto-deploy.sh` |

#### Branch Management
| Script | Purpose | Usage |
|--------|---------|-------|
| `sync-branches.sh` | Merge changes through branch pipeline | `./scripts/sync-branches.sh` |
| `sync-from-stage.sh` | Pull changes from staging branch | `./scripts/sync-from-stage.sh` |
| `sync-from-prod.sh` | Pull changes from production branch | `./scripts/sync-from-prod.sh` |

#### Testing & Debugging
| Script | Purpose | Usage |
|--------|---------|-------|
| `test-checkout.sh` | Test full checkout flow with backend | `./scripts/test-checkout.sh` |
| `test-checkout.js` | Node.js checkout testing utility | `node scripts/test-checkout.js` |
| `debug-cart.js` | Debug cart functionality in browser | Include in theme or run in console |

#### Setup & Protection
| Script | Purpose | Usage |
|--------|---------|-------|
| `setup-branch-protection.sh` | Configure GitHub branch protection | `./scripts/setup-branch-protection.sh` |
| `setup-branch-protection-api.sh` | API-based branch protection setup | `./scripts/setup-branch-protection-api.sh` |

### Backend Scripts (r3-backend/scripts/)

#### Utilities
| Script | Purpose | Usage |
|--------|---------|-------|
| `clear-rate-limits.js` | Clear rate limits from Vercel KV | `node scripts/clear-rate-limits.js` |
| `check-vercel-settings.sh` | Verify Vercel configuration | `./scripts/check-vercel-settings.sh` |
| `vercel-api-utils.sh` | Vercel API management utilities | `./scripts/vercel-api-utils.sh` |
| `test-session-auth.html` | Test session authentication in browser | Open in browser |

### Script Usage Examples

#### Deploy to Staging
```bash
cd r3-frontend
./scripts/deploy-to-stage.sh
# Checks for uncommitted changes
# Pulls latest from GitHub
# Deploys theme to staging
# Provides test URLs
```

#### Clear Rate Limits (When Testing)
```bash
cd r3-backend
node scripts/clear-rate-limits.js
# Clears all rate limit entries from Vercel KV
# Useful when rate limits block legitimate testing
```

#### Test Checkout Flow
```bash
cd r3-frontend
./scripts/test-checkout.sh
# Tests backend health
# Creates test session
# Verifies payment intent creation
# Provides manual test steps
```

#### Sync Branches (Dev → Stage → Prod)
```bash
cd r3-frontend
./scripts/sync-branches.sh
# Interactive menu to merge changes
# Option 1: dev → stage
# Option 2: stage → prod (creates PR)
# Option 3: Custom sync
```

### Important Script Notes

1. **Always run scripts from repository root** (r3-frontend or r3-backend)
2. **Deployment scripts check for GitHub Actions** to avoid conflicts
3. **Scripts require proper environment variables** (check .env files)
4. **Production deployments require manual confirmation** for safety
5. **Rate limit clearing should only be used during development/testing**

## Quick Commands Reference

### Development
```bash
# Start frontend dev
cd r3-frontend && shopify theme dev

# Start backend dev
cd r3-backend && npm run dev

# Run tests
npm test

# Check code quality
npm run lint
npm run typecheck
```

### Deployment
```bash
# Deploy to staging (use script)
cd r3-frontend && ./scripts/deploy-to-stage.sh

# Deploy to production (use script with safety checks)
cd r3-frontend && ./scripts/deploy-to-prod.sh

# Or use GitHub push (triggers Actions)
git push origin stage  # Auto-deploys to staging
git push origin prod   # Requires approval for production
```

### Troubleshooting
```bash
# Clear Redis cache
redis-cli FLUSHALL

# Check Vercel deployment
vercel ls
vercel logs

# Validate theme
shopify theme check

# Test webhook locally
ngrok http 3000
```

## Important Reminders

1. **Always test checkout flow** after making changes
2. **Never commit sensitive data** (API keys, passwords)
3. **Update tests** when changing functionality  
4. **Document breaking changes** in commit messages
5. **Check both environments** (staging and production behavior)
6. **Verify webhook signatures** for security
7. **Monitor GitHub Actions billing** ($30/month allocated)
8. **Keep sessions under 30 minutes** for security
9. **Use draft orders for testing** in dev/stage
10. **Follow deployment order** (Git → Vercel → Shopify)

## Contact & Support

- **Documentation**: r3-workspace/docs/ (all master documents)
- **Test Results**: r3-workspace/tests/coverage/
- **Repository**: https://github.com/dylanjshaw001/r3-workspace
- **Deployment Status**: https://vercel.com/r3
- **Theme Preview**: Shopify admin → Online Store → Themes

---

## r3-frontend Theme-Specific Guidelines

### ⚠️ CRITICAL: Theme Sync Requirements

**r3-frontend uses ONE-WAY sync from GitHub to Shopify via GitHub Actions.**

Any changes made directly in Shopify's theme editor MUST be synced back to Git:
```bash
# Pull theme changes from Shopify
shopify theme pull --theme=[THEME_ID]
# Commit and push to Git
git add -A && git commit -m "Sync theme changes from Shopify" && git push
```

### Theme Structure
- `/assets` - CSS, JS, images, SVG icons
  - `critical.css` - Essential CSS loaded first
  - `theme.css/js` - Main theme styles and scripts
  - `checkout.css/js` - Custom checkout functionality
  - `checkout-payments.js` - Payment integrations
- `/blocks` - Reusable UI components (group.liquid, text.liquid)
- `/sections` - Full-width page components
  - `custom-checkout.liquid` - Multi-step checkout with payment options
- `/snippets` - Reusable code fragments
- `/templates` - Page templates (JSON format)
- `/layout` - Page layout wrappers
- `/locales` - Internationalization files

### Key Development Rules

**Liquid Syntax**
- Use `{%- -%}` and `{{- -}}` for whitespace control
- Valid tags: `if`, `unless`, `elsif`, `else`, `case`, `when`, `for`, `tablerow`, `capture`, `assign`, `increment`, `decrement`, `include`, `section`, `form`, `paginate`, `comment`, `raw`, `liquid`, `echo`, `render`, `javascript`, `stylesheet`
- Always use `| default:` filter when outputting settings

**CSS Guidelines**
- Maximum specificity: 0-1-0 (one class)
- Use CSS variables from `css-variables.liquid`
- BEM naming: `.block__element--modifier`
- Scope CSS to sections: `.section-{{ section.id }}`
- No element selectors without classes

**JavaScript Guidelines**
- Use `defer` attribute on scripts
- Prefer custom elements/web components
- Module pattern for organization
- No direct DOM manipulation without proper scoping

### File Architecture

**Active Files:**
- `assets/checkout.js` - Main checkout logic
- `assets/checkout-payments.js` - Payment processing extension
- `sections/custom-checkout.liquid` - Checkout UI template

**Legacy/Unused Files:**
- `assets/checkout-payments-secure.js` - Old implementation (DO NOT USE)
- `assets/checkout-premium.js` - UI enhancements (commented out)
- `assets/checkout-session-integration.js` - Migration guide (reference only)

### Critical Integration Points

1. **Session Token Flow**
   ```javascript
   Frontend: localStorage → cart.attributes.checkout_session
   Backend: req.headers.authorization → Bearer {token}
   Redis: session:{token} → {cartToken, domain, expiresAt}
   ```

2. **Payment Metadata**
   All payment intents MUST include:
   - `store_domain` - For multi-store support
   - `items` - JSON stringified cart items
   - `shipping_address` - JSON stringified address
   - `customer_email/first_name/last_name`
   - `rep` - Sales rep tracking (if present)

3. **Environment Variables Required**
   - `KV_REST_API_URL` - Redis connection
   - `KV_REST_API_TOKEN` - Redis auth
   - `STRIPE_SECRET_KEY` - Payment processing
   - `STRIPE_WEBHOOK_SECRET` - Webhook verification
   - `SHOPIFY_ADMIN_ACCESS_TOKEN` - Order creation

### Common Commands

```bash
# Start development server
shopify theme dev

# Run theme linting
shopify theme check

# Initialize new theme (if needed)
shopify theme init
```

### Critical Fixes (DO NOT REMOVE)

#### 1. Navbar Padding Fix
The navbar requires specific padding `padding: 16px 10px` that must be preserved. This is implemented in:
- `/assets/critical-fixes.css` - With !important to override any other styles
- This padding provides the correct vertical and horizontal spacing

#### 2. Theme Toggle Transform Fix
The theme toggle button has a critical fix to prevent vertical shifting on click/tap. This fix is implemented in:
1. `/sections/header.liquid` - Main implementation with comments
2. `/assets/critical-fixes.css` - Backup implementation with extensive documentation
3. Both files contain `transform: none !important` for all states on mobile devices

**Never remove these fixes** as they ensure proper UI behavior.

#### 3. Product Page Background
The product page (`.product-page`) should NOT have a background color set. It should inherit the page background color. Do not add `background: #0a0a0a` or any other background color to this class.

---

*This document should be updated whenever significant changes are made to the project structure, workflows, or critical functionality.*