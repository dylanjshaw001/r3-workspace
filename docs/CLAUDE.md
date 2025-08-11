# R3 Project Assistant Guide (CLAUDE.md)
*Last Updated: August 10, 2025*

## Overview

This document provides comprehensive guidance for AI assistants working with the R3 e-commerce platform. It consolidates project structure, development practices, testing strategies, and critical operational knowledge.

## 📝 Documentation Guidelines

### Core Documentation Principles

1. **Update, Don't Duplicate**: Always update existing documentation instead of creating new files, unless explicitly specified by the user.
2. **Keep Master Documents Current**: When making changes to any repository, update the master documents in r3-workspace/docs to maintain consistency.
3. **Single Source of Truth**: This CLAUDE.md file in r3-workspace is the authoritative guide. Team members should have r3-workspace open alongside their project repositories.
4. **Documentation Locations** (ALL in r3-workspace/docs/):
   - Master docs: `/Users/dylanjshaw/r3/r3-workspace/docs/`
   - Technical Architecture: `TECHNICAL_ARCHITECTURE.md`
   - Business Overview: `BUSINESS_OVERVIEW.md`
   - This guide: `CLAUDE.md`
   - Secrets Management: `SECRETS_MANAGEMENT.md`
   - Backend Secrets: `BACKEND_SECRETS.md` (GitHub Actions secrets)
   - Backend Security: `BACKEND_SECURITY.md` (security guidelines)
   - Backend Session Migration: `BACKEND_SESSION_MIGRATION.md`
   - Backend Security Audit: `BACKEND_SECURITY_AUDIT.md`

## Configuration Management

### 🔧 CRITICAL: Configuration Consolidation (Updated Aug 10, 2025)

**SINGLE SOURCE OF TRUTH:** All configuration now flows through **`r3-workspace/config/shared-constants.js`**

### Configuration Architecture

1. **Master Configuration:** `r3-workspace/config/shared-constants.js`
2. **Symlinks:** Frontend and backend configs are symlinked to workspace
3. **Secrets:** Environment variables only (never in config files)

### Configuration Structure

```
r3-workspace/config/
└── shared-constants.js     # MASTER CONFIG FILE (all non-secret values)

r3-frontend/config/
├── shared-constants.js     # → symlink to ../../r3-workspace/config/shared-constants.js
└── index.js               # Frontend entry point with browser helpers

r3-backend/config/
├── shared-constants.js     # → symlink to ../../r3-workspace/config/shared-constants.js
├── constants-consolidated.js  # Merged backend configuration
└── index.js               # Backend entry point
```

### Making Configuration Changes

**⚠️ IMPORTANT: Only update the master file in r3-workspace!**

1. Edit: `r3-workspace/config/shared-constants.js`
2. Changes automatically propagate via symlinks in development
3. No need to update multiple files
4. Commit the change in r3-workspace repo

### Deployment with Symlinks

**🚀 Critical: Symlinks must be resolved before deployment!**

#### ⚠️ MANDATORY DEPLOYMENT RULES FOR CLAUDE

**ALWAYS USE THESE DEPLOYMENT COMMANDS:**

1. **Backend Development (r3-backend):**
   - **NEVER use:** `git push` alone
   - **ALWAYS use:** `npm run push:dev` (or push:stage, push:prod)
   - **Why:** Automatically handles symlink resolution and restoration

2. **Frontend Development (r3-frontend):**
   - **NEVER push directly to Shopify**
   - **ALWAYS use:** Git workflow first, then theme deployment scripts
   - **For staging:** `./scripts/deploy-to-stage.sh`
   - **For production:** `./scripts/deploy-to-prod.sh`

3. **When to Use Proper Deployment:**
   - **ALWAYS** when pushing configuration changes
   - **ALWAYS** when the directory contains symlinked files
   - **ALWAYS** for production or staging deployments
   - **OPTIONAL** for simple code changes without config updates

#### How It Works

1. **Development:** Symlinks point to `r3-workspace/config/shared-constants.js`
2. **Before Deploy:** Run `npm run prepare-deploy` to replace symlinks with actual files
3. **Production:** Receives real files, not broken symlinks

#### Deployment Commands

**Backend (Vercel):**
```bash
# CORRECT - Use these commands:
npm run push:dev            # Push to dev branch with symlink handling
npm run push:stage          # Push to stage branch with symlink handling  
npm run push:prod           # Push to production with symlink handling
npm run deploy              # Add, commit, and push with symlink handling

# WRONG - Never use these alone:
git push                    # ❌ Breaks symlinks in production
git push origin dev         # ❌ Breaks symlinks in production
```

**Frontend (Shopify):**
```bash
# Theme deployment with automatic symlink handling
npm run theme:push           # Resolves symlinks, pushes theme, restores symlinks
npm run theme:push:stage     # Push to staging theme
npm run theme:push:prod      # Push to production theme

# Or use deployment scripts (recommended):
./scripts/deploy-to-stage.sh  # Complete staging deployment workflow
./scripts/deploy-to-prod.sh   # Production deployment with safety checks

# Manual restoration if needed
npm run restore-symlinks     # Restore symlinks after deployment
```

#### Manual Resolution (if needed)

```bash
# Backend or Frontend
npm run prepare-deploy       # Resolve symlinks to real files

# Check what changed
git status config/

# Commit if deploying manually
git add -A
git commit -m "build: resolve symlinks for deployment"
git push
```

### What Goes in Config Files
- URLs and domains (shopify store, backend URLs)
- Theme IDs (staging: 153047662834, production: 152848597234)
- Ports and timeouts
- Feature flags
- API endpoint paths
- Public keys (Stripe publishable keys)
- Environment mappings (dev/stage/prod)
- ACH configuration
- Shipping rules
- Rate limits

### Environment Files (.env) - Secrets Only

**IMPORTANT: Most developers don't need .env files!**

**When .env Files Are Needed:**

| Repository | When Needed | Who Needs It |
|------------|------------|--------------|
| r3-frontend | **NEVER** | Nobody - frontend uses deployed backend |
| r3-backend | Only for local backend development | Backend developers only |
| r3-workspace/tests | Only for integration tests against local backend | Test developers |

### Development Workflows

#### Frontend Development (Most Common)
```bash
cd r3-frontend
shopify theme dev
# That's it! No .env file needed
# Frontend automatically connects to deployed backend
```

#### Backend Development (When Needed)
```bash
cd r3-backend
cp .env.example .env
# Add secrets from vault (only ~10 values)
npm run dev
```

#### What Secrets Are Needed for Backend?
```bash
# Only these secrets (from team vault):
STRIPE_SECRET_KEY         # Payment processing
STRIPE_WEBHOOK_SECRET     # Webhook verification
SHOPIFY_ADMIN_ACCESS_TOKEN # Order creation
SESSION_SECRET            # Session signing
CSRF_SECRET              # CSRF protection
KV_REST_API_URL          # Redis connection
KV_REST_API_TOKEN        # Redis auth
```

### How Secrets Work in Different Environments

| Environment | How Secrets Are Provided |
|------------|-------------------------|
| **Local Frontend Dev** | Not needed - uses deployed backend |
| **Local Backend Dev** | From .env file (manual setup) |
| **Vercel Deployment** | Automatically injected by Vercel |
| **GitHub Actions** | From GitHub Secrets |

### Configuration Examples

```javascript
// Backend: Import from config
import { CONFIG, DOMAINS, THEME_IDS } from './config/constants.js';

const shopifyDomain = CONFIG.DOMAINS.SHOPIFY_STORE; // 'sqqpyb-yq.myshopify.com'
const prodTheme = CONFIG.THEME_IDS.PRODUCTION; // '152848597234'

// Frontend: Use window.R3_CONFIG
const backendUrl = window.R3_CONFIG.getBackendUrl();
const stripeKey = window.R3_CONFIG.STRIPE_PUBLIC_KEYS.TEST;

// Tests: Import test config
import { TEST_CONFIG } from '../config/constants.js';
const testEmail = TEST_CONFIG.USER.EMAIL;
```

### When to Update What

| Change Type | Update Location |
|------------|----------------|
| New URL/domain | shared-constants.js |
| Theme ID change | shared-constants.js → THEME_IDS |
| New API endpoint | shared-constants.js → API_ENDPOINTS |
| Port/timeout change | shared-constants.js |
| New secret needed | .env.example + documentation |
| Feature flag | config files → FEATURES |

### Key Principles

1. **Config files for configuration** - All non-secret values
2. **.env files for secrets only** - And only for local backend dev
3. **Frontend needs no .env** - Connects to deployed backend
4. **Vercel handles production secrets** - No .env in deployment

## Project Structure

### Repository Layout
```
r3/
├── r3-workspace/       # Central development hub (THIS IS PRIMARY)
│   ├── config/        # SINGLE SOURCE OF TRUTH for all configuration
│   │   └── shared-constants.js  # Master configuration file
│   ├── docs/          # ALL master documentation (single source of truth)
│   ├── tests/         # Comprehensive test suite for all repos
│   │   ├── run-tests.js   # Unified test runner (replaces duplicates)
│   │   ├── unit/          # Unit tests (<100ms)
│   │   ├── integration/   # Integration tests (<5s)
│   │   └── e2e/          # End-to-end tests (<30s)
│   └── .github/       # Workspace CI/CD workflows
├── r3-frontend/        # Shopify Liquid theme with custom checkout
│   ├── config/        # Symlinked to r3-workspace/config
│   ├── assets/        # Theme assets (JS, CSS, images)
│   ├── scripts/       # ALL frontend utility scripts (.sh, .js)
│   └── templates/     # Liquid templates
├── r3-backend/         # Node.js/Express payment processing API
│   ├── config/        # Symlinked to r3-workspace/config
│   ├── api/           # API endpoints
│   ├── scripts/       # ALL backend utility scripts (.sh, .js)
│   └── utils/         # Backend utilities
└── r3-access/          # Authentication and access control service
```

### Script Organization Rules
**CRITICAL**: Each repository maintains its own `/scripts` folder:
- **r3-frontend/scripts/**: All frontend deployment, testing, and utility scripts
- **r3-backend/scripts/**: All backend utilities, admin tools, and deployment scripts
- **r3-workspace**: NO scripts folder - only docs and tests
- **Never scatter scripts** outside the scripts/ folder in each repo
- **Documentation lives in r3-workspace/docs/** - not in individual repos

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

### Quick Environment Setup (First Time)

**IMPORTANT**: After cloning any repository, you MUST set up environment variables:

1. **Check existing .env files** (should already exist):
   ```bash
   # Verify .env files exist
   ls r3-frontend/.env
   ls r3-backend/.env  
   ls r3-workspace/tests/.env
   ```

2. **If .env files are missing**, copy from examples:
   ```bash
   # Frontend
   cd r3-frontend
   cp .env.example .env
   
   # Backend
   cd ../r3-backend
   cp .env.example .env
   
   # Tests
   cd ../r3-workspace/tests
   cp .env.example .env
   ```

3. **Get secrets from vault** (see SECRETS_MANAGEMENT.md):
   - Replace all `<get-from-vault>` values in .env files
   - Contact team admin for vault access
   - Never commit real secrets to git

4. **Verify setup works**:
   ```bash
   # Test backend can start
   cd r3-backend && npm run dev
   
   # Test frontend can start (in new terminal)
   cd r3-frontend && shopify theme dev
   
   # Test environment variables load
   node -e "console.log(process.env.SHOPIFY_STORE_DOMAIN)"
   ```

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
// Stripe Test Publishable Keys
// NOTE: Two keys exist - verify which one is active in Stripe Dashboard
STRIPE_PUBLIC_KEY_TEST_1 = 'pk_test_51QfuVo2MiCAheYVMWMHg8qhGhCLRnLhOrnZupzJxppag93BnJhMFCCwg1xC2X4aH9vzonCpcpf8z3avoYINOvzaI00u9n0Xx7F' // In .env files
STRIPE_PUBLIC_KEY_TEST_2 = 'pk_test_51QfuVo2MiCAheYVMBOUaLAoiI6ROiGeETTSMo2n6wz27euMLGlinvxg2dZcWaiH1QV8WcIdAjDxnxc3xV2GIL9GC00uJtwkzZL' // In settings_data.json

// Shopify Store Domain
SHOPIFY_DOMAIN = 'sqqpyb-yq.myshopify.com'

// Theme IDs
STAGING_THEME_ID = '153047662834'
PRODUCTION_THEME_ID = '152848597234'
```

### Stripe Key Management

The frontend uses a dynamic Stripe key selection mechanism:

1. **Primary Method**: `window.STRIPE_PUBLIC_KEY_OVERRIDE` 
   - Set by the theme based on environment settings
   - Allows dynamic switching between test/live keys

2. **Fallback Method**: Dataset attribute from container
   - Uses `data-stripe-key` attribute on the checkout container
   - Applied if no override is set

3. **Key Selection in checkout.js**:
   ```javascript
   // Environment-based key selection
   if (window.STRIPE_PUBLIC_KEY_OVERRIDE) {
     this.stripePublicKey = window.STRIPE_PUBLIC_KEY_OVERRIDE;
   } else {
     // Fallback to production key if no override
     this.stripePublicKey = container?.dataset.stripeKey;
   }
   ```

4. **To Switch Keys**:
   - Update the theme settings in Shopify admin
   - Or set the environment variable in .env files
   - The frontend will automatically use the correct key

### Secret References (Get from Vault)
- `STRIPE_SECRET_KEY_TEST`: Vault → r3-dev-secrets → stripe → test-keys
- `STRIPE_WEBHOOK_SECRET`: Vault → r3-dev-secrets → stripe → webhook-secrets
- `SHOPIFY_ADMIN_TOKEN`: Vault → r3-dev-secrets → shopify → admin-tokens
- `KV_REST_API_URL`: Vault → r3-dev-secrets → infrastructure → redis
- `KV_REST_API_TOKEN`: Vault → r3-dev-secrets → infrastructure → redis

## Payment Processing

For detailed payment information, see:
- **Business perspective**: BUSINESS_OVERVIEW.md → Payment Processing section
- **Technical implementation**: TECHNICAL_ARCHITECTURE.md → Payment Endpoints section

### Quick Reference
- **Card payments**: Instant, 2.9% + $0.30 fee
- **ACH payments**: 1-3 days, lower fees
- **Order creation**: Production + Live = Real order, else Draft order

## Shipping Calculation

See BUSINESS_OVERVIEW.md → Shipping & Fulfillment section for details.

**Quick Reference**:
- ONEbox: $5/unit or $25/case (10 units)
- Standard products: FREE shipping

## Session Management

For full session architecture, see TECHNICAL_ARCHITECTURE.md → Session Architecture section.

**Quick Reference**:
- Sessions expire after 30 minutes
- Token required for all API calls
- Auto-recovery with `ensureValidSession()`

## Testing Strategy

### 🧪 Unified Testing Architecture (Updated Aug 10, 2025)

**SINGLE TEST RUNNER:** Use `r3-workspace/tests/run-tests.js` for all testing

### Test Organization
```
r3-workspace/tests/
├── run-tests.js         # Unified test runner (replaces 30+ duplicate scripts)
├── unit/                # Fast, isolated tests (<100ms each)
│   ├── frontend/        # Frontend unit tests
│   └── backend/         # Backend unit tests
├── integration/         # Component interaction tests (<5s each)
│   ├── session/         # Session management tests
│   ├── payment/         # Payment processing tests
│   └── webhooks/        # Webhook handling tests
├── e2e/                 # Full system tests (<30s each)
│   ├── checkout-flow/   # Complete checkout scenarios
│   └── ach-payment/     # ACH payment flows
└── shared/
    ├── config.js        # Single test configuration
    ├── helpers.js       # All test utilities (no duplicates)
    └── fixtures.js      # Standardized test data
```

### Running Tests

**Use the unified test runner:**
```bash
# From r3-workspace/tests/
node run-tests.js [options]

# Options:
--scope frontend|backend|all    # Test scope
--type unit|integration|e2e     # Test type
--watch                          # Watch mode
--coverage                       # Coverage report
--env dev|stage|prod            # Environment

# Examples:
node run-tests.js --scope frontend --type unit --watch
node run-tests.js --type e2e --env stage
node run-tests.js --coverage
```

**Simplified package.json scripts:**
```bash
# From r3-frontend or r3-backend
npm test              # Runs relevant tests for that repo
npm test:watch        # Watch mode for that repo
```

### Test Categories

1. **Unit Tests** (Target: <100ms each)
   - Individual functions/components
   - No external dependencies
   - Run on every save in watch mode

2. **Integration Tests** (Target: <5s each)
   - Component interactions
   - Mocked external services
   - Run on commit

3. **E2E Tests** (Target: <30s each)
   - Full user flows
   - Real test environment
   - Run on PR/deploy

### No More Duplication

**REMOVED:**
- 30+ duplicate test scripts across package.json files
- Multiple test helper implementations
- Redundant environment detection logic
- Scattered test data generators

**CONSOLIDATED INTO:**
- Single test runner: `run-tests.js`
- Single config: `shared/config.js`
- Single helpers: `shared/helpers.js`
- Single fixtures: `shared/fixtures.js`

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

### Configuration & Deployment Issues
- **Broken symlinks in production**: Run `npm run prepare-deploy` before pushing
- **Config changes not reflecting**: Check symlinks are properly created
- **Vercel build fails**: Ensure `vercel-build` script runs `prepare-deploy`
- **Shopify theme has old config**: Use `npm run theme:push` instead of direct `shopify theme push`

### Symlink Troubleshooting
```bash
# Check if file is a symlink
ls -la config/shared-constants.js

# If it shows -> ../../r3-workspace/config/shared-constants.js, it's a symlink
# If not, recreate it:
cd r3-backend/config  # or r3-frontend/config
rm shared-constants.js
ln -s ../../r3-workspace/config/shared-constants.js shared-constants.js

# Test symlink is working
node -e "import('./shared-constants.js').then(m => console.log('Works!', m.ENVIRONMENTS))"
```

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

### Environment Variable Issues
- **"Cannot connect to backend"**: Check R3_API_URL in frontend/.env
- **"Missing environment variable"**: Verify .env files exist and contain required values
- **"Invalid Shopify domain"**: Check SHOPIFY_STORE_DOMAIN is set correctly
- **"Stripe key not found"**: Replace `<get-from-vault>` with actual keys from vault
- **"Session creation failed"**: Verify SESSION_SECRET and CSRF_SECRET are set
- **Tests failing**: Check r3-workspace/tests/.env has correct test configuration

#### Environment Variable Debugging:
```bash
# Check if .env files are loaded
node -e "console.log('SHOPIFY_STORE_DOMAIN:', process.env.SHOPIFY_STORE_DOMAIN)"

# Verify backend can read environment
cd r3-backend && node -e "console.log(require('dotenv').config())"

# Test specific variable loading
grep "SHOPIFY_STORE_DOMAIN" r3-frontend/.env
```

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
- **NEVER hardcode values** - use environment variables and configuration files

### No-Hardcoding Guidelines

**CRITICAL:** All hardcoded values create brittleness and deployment issues. Always use configuration.

#### ❌ NEVER hardcode these values:
- **URLs and domains**: `sqqpyb-yq.myshopify.com`, `rthree.io`
- **Theme IDs**: `153047662834`, `152848597234`
- **Ports**: `3000`, `9292`
- **Branch names**: `stage`, `dev`, `prod`
- **API endpoints**: `localhost:3000`, `https://r3-backend.vercel.app`
- **Store IDs, webhook URLs, deployment URLs**

#### ✅ Instead use environment variables:
```javascript
// ❌ Bad
const url = 'https://sqqpyb-yq.myshopify.com';
const themeId = '153047662834';

// ✅ Good  
const url = process.env.SHOPIFY_STORE_DOMAIN || 'sqqpyb-yq.myshopify.com';
const themeId = process.env.SHOPIFY_THEME_ID_STAGING || '153047662834';
```

#### Configuration Sources:
1. **Environment Variables**: Use `.env` files with fallbacks
2. **Shared Constants**: Use `/docs/config/shared-constants.js`
3. **Configuration Files**: `config/urls.js`, `config/domains.js`

#### Before Committing:
- Search codebase for hardcoded values: `grep -r "sqqpyb-yq" .`
- Verify all URLs use environment variables
- Check deployment scripts use configurable values
- Test with different environment configurations

#### Common Hardcoding Violations:
- Deployment scripts with hardcoded store domains
- Test files with hardcoded API URLs
- Configuration files with hardcoded theme IDs
- GitHub Actions with hardcoded branch-specific values

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
shopify theme push --theme "${SHOPIFY_THEME_ID_STAGING:-153047662834}"
```

### Documentation
- **Update existing docs** - Don't create new documentation files unless explicitly requested
- Update this CLAUDE.md file when adding major features
- Keep TECHNICAL_ARCHITECTURE.md current with system changes
- Keep BUSINESS_OVERVIEW.md updated with business logic changes
- Document breaking changes in commit messages
- Include examples in code comments
- **Master documents in r3-workspace/docs/** are the single source of truth

## Security Quick Reminders

For comprehensive security architecture, see TECHNICAL_ARCHITECTURE.md → Security Architecture section.

**Key Security Rules**:
- Never commit secrets to git
- Always validate input server-side
- Use environment variables for all sensitive data
- Verify webhook signatures
- Keep sessions server-side only

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

### Script Organization Rules
**IMPORTANT**: Each repository maintains ALL its scripts in its own `/scripts` folder:
- **r3-frontend/scripts/** - Theme deployment, testing, sync utilities (9 scripts)
- **r3-backend/scripts/** - Backend utilities, rate limiting, Vercel management (4 scripts)
- **r3-workspace** - NO scripts (only docs and tests)

**Never place scripts outside the `/scripts` folder** - this keeps each repo organized and self-contained.

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
11. **Check rate limits before production** - Current limits are HIGH for testing (1000 req/15min). Must reduce per TODOs in `r3-backend/middleware/rateLimiter.js`

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