# R3 Test Suite

Comprehensive testing framework for the R3 e-commerce platform.

> 📍 **Location**: This is part of the [r3-workspace](../) repository.

## Overview

This test suite contains all unit, integration, and end-to-end tests for the R3 platform:
- **frontend/**: Shopify theme and checkout UI tests
- **backend/**: Payment processing and API tests  
- **integration/**: Cross-component integration tests

## Quick Start

### Prerequisites
- Node.js >= 16.0.0
- npm >= 8.0.0
- Access to development environment variables (via team vault)

### Installation

```bash
# Navigate to test directory (from r3-workspace root)
cd tests

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your development keys from vault (see Secret Management section)
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:frontend    # Frontend tests only
npm run test:backend     # Backend tests only
npm run test:integration # Integration tests only

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Development Setup

### Step 1: Clone All Repositories

```bash
# Create workspace directory
mkdir ~/r3 && cd ~/r3

# Clone all repositories
git clone https://github.com/dylanjshaw001/r3-frontend.git
git clone https://github.com/dylanjshaw001/r3-backend.git
git clone https://github.com/dylanjshaw001/r3-workspace.git
```

### Step 2: Configure Environment Variables

```bash
# Copy templates
cd r3-workspace/tests
cp .env.example .env

cd ../r3-backend
cp .env.example .env
```

### Step 3: Get Development Secrets

Access development secrets from the team vault:

1. **Request Vault Access**
   - Contact team admin for vault access
   - Join the `r3-dev-secrets` vault
   - Copy development keys only

2. **Required Keys for Development**

```bash
# r3-backend/.env (get from vault)
NODE_ENV=development
PORT=3000

# Stripe (Test Keys)
STRIPE_PUBLIC_KEY_TEST=pk_test_51QfuVo2MiCAheYVMWMHg8qhGhCLRnLhOrnZupzJxppag93BnJhMFCCwg1xC2X4aH9vzonCpcpf8z3avoYINOvzaI00u9n0Xx7F
STRIPE_SECRET_KEY_TEST=<from-vault>
STRIPE_WEBHOOK_SECRET_TEST=<from-vault>

# Shopify
SHOPIFY_DOMAIN=sqqpyb-yq.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=<from-vault>

# Redis/Session Storage
KV_REST_API_URL=<from-vault>
KV_REST_API_TOKEN=<from-vault>
```

### Step 4: Verify Setup

```bash
# Test backend connection
cd r3-backend
npm run dev

# Run test suite
cd ../r3-workspace/tests
npm test -- --testNamePattern="Health Check"
```

## Test Structure

```
tests/
├── frontend/           # Frontend component tests
│   ├── unit/          # Individual component tests
│   ├── integration/   # Feature integration tests
│   └── e2e/          # End-to-end user flows
├── backend/           # Backend API tests
│   ├── unit/         # Utility function tests
│   ├── integration/  # API endpoint tests
│   └── e2e/         # Full API flows
├── integration/       # Cross-repository tests
├── shared/           # Shared test utilities
│   ├── fixtures/     # Test data
│   ├── helpers/      # Test helpers
│   └── mocks/       # API mocks
└── config/           # Test configuration
```

## Development Workflow

### Local Development

1. **Start Backend Server**
```bash
cd r3-backend
npm run dev
```

2. **Start Frontend Theme**
```bash
cd r3-frontend
shopify theme dev --store sqqpyb-yq
```

3. **Run Tests in Watch Mode**
```bash
cd r3-workspace/tests
npm run test:watch
```

### Test-Driven Development (TDD)

```bash
# 1. Create test file
touch r3-workspace/tests/frontend/r3-frontend/my-feature.test.js

# 2. Write failing test
npm test -- my-feature.test.js

# 3. Implement feature in main repository

# 4. Verify test passes
npm test -- my-feature.test.js
```

## Secret Management

### Vault Structure
```
r3-dev-secrets/
├── stripe/
│   ├── test-keys
│   └── webhook-secrets
├── shopify/
│   ├── admin-tokens
│   └── theme-tokens
└── infrastructure/
    ├── redis
    └── vercel
```

### Security Best Practices
- **Never hardcode secrets** in code
- **Use environment variables** exclusively
- **Access vault** for latest keys
- **Rotate keys** regularly
- **Report concerns** immediately

### Public Keys (Safe to Share)
- Stripe publishable keys (pk_*)
- Shopify store domain
- Public API endpoints

### Private Keys (Vault Only)
- Stripe secret keys (sk_*)
- Shopify admin tokens
- Database credentials
- Webhook secrets

## Environment Configuration

### Environment Testing Matrix

| Environment | API URL | Mocking | Tests Run | Timeout | Purpose |
|------------|---------|---------|-----------|---------|---------|
| **Development** | `http://localhost:3000` | ✅ Payments<br>✅ Webhooks | All tests | 30s | Local development |
| **Staging** | `https://r3-backend-git-stage-r3.vercel.app` | ❌ Payments<br>❌ Webhooks | All tests | 45s | Pre-production validation |
| **Production** | `https://r3-backend.vercel.app` | ❌ Payments<br>❌ Webhooks | Happy path only | 60s | Smoke tests, monitoring |

### Running Environment-Specific Tests

```bash
# Development (default) - Full test suite with mocking
npm test

# Staging - Full test suite against staging services
NODE_ENV=staging npm test

# Production - Limited read-only tests (Happy Path only)
NODE_ENV=production npm test

# Specific suites per environment
npm run test:env:dev         # All development tests
npm run test:env:staging     # All staging tests  
npm run test:env:prod        # Production happy path only
```

### Environment Feature Flags

| Flag | Development | Staging | Production | Purpose |
|------|------------|---------|------------|---------|
| `ENABLE_MOCK_PAYMENTS` | ✅ | ❌ | ❌ | Mock Stripe API calls |
| `ENABLE_WEBHOOK_MOCKING` | ✅ | ❌ | ❌ | Mock webhook endpoints |
| `SKIP_RATE_LIMITING` | ✅ | ✅ | ❌ | Bypass rate limits for tests |
| `ENABLE_DEBUG_LOGGING` | ✅ | ❌ | ❌ | Verbose test output |
| `ENABLE_ALL_TESTS` | ✅ | ✅ | ❌ | Run destructive tests |

### Environment URLs

#### Development
- **API**: `http://localhost:3000` (primary)
- **Alternatives**: `localhost:3001`, `localhost:9292`, ngrok tunnels
- **Shopify**: `sqqpyb-yq.myshopify.com`

#### Staging  
- **API**: `https://r3-backend-git-stage-r3.vercel.app`
- **Shopify**: `sqqpyb-yq.myshopify.com`
- **KV Store**: Vercel KV (staging)

#### Production
- **API**: `https://r3-backend.vercel.app`
- **Shopify**: `sqqpyb-yq.myshopify.com` (migrating to `rthree.io`)
- **KV Store**: Vercel KV (production)

### Test Limitations by Environment

#### Development
- ✅ All tests enabled
- ✅ Can create/modify test data
- ✅ Full mocking capabilities
- ✅ No rate limiting

#### Staging
- ✅ All tests enabled
- ✅ Real API calls (test mode)
- ⚠️ Rate limiting may apply
- ❌ No production data access

#### Production
- ⚠️ Read-only tests only
- ⚠️ Happy path validation only
- ❌ No data modifications
- ❌ No destructive operations
- ❌ Strict rate limiting

## Testing Strategy

### Test Categories

#### Unit Tests
- **Purpose**: Test individual functions and components in isolation
- **Location**: `r3-frontend/unit/`, `r3-backend/unit/`
- **Mocking**: Heavy use of mocks for external dependencies
- **Speed**: Fast (< 100ms per test)
- **Coverage Target**: 90%+

#### Integration Tests
- **Purpose**: Test interactions between multiple components
- **Location**: `r3-frontend/integration/`, `r3-backend/integration/`
- **Mocking**: Limited to external services (Stripe, Shopify)
- **Speed**: Medium (100ms - 1s per test)
- **Coverage Target**: 80%+

#### End-to-End Tests
- **Purpose**: Test complete user workflows
- **Location**: `r3-frontend/e2e/`, `r3-backend/e2e/`
- **Mocking**: None - tests against real services (test mode)
- **Speed**: Slow (1s - 10s per test)
- **Coverage Target**: Critical paths only

### Test Pyramid
```
      /\
     /E2E\     <- 10% (Critical paths)
    /------\
   /Integr. \  <- 30% (API, UI flows)
  /----------\
 /   Unit     \ <- 60% (Functions, components)
/--------------\
```

### Test-Driven Development (TDD) Process

1. **RED Phase**: Write failing test first
   ```javascript
   // Write test that defines expected behavior
   it('should calculate shipping correctly', () => {
     const result = calculateShipping({weight: 1000, zone: 'US'});
     expect(result).toBe(10.00);
   });
   ```

2. **GREEN Phase**: Write minimal code to pass
   ```javascript
   // Implement just enough to make test pass
   function calculateShipping({weight, zone}) {
     return zone === 'US' ? 10.00 : 20.00;
   }
   ```

3. **REFACTOR Phase**: Improve code while keeping tests green
   ```javascript
   // Refactor for better structure
   const SHIPPING_RATES = { US: 10.00, INT: 20.00 };
   function calculateShipping({weight, zone}) {
     return SHIPPING_RATES[zone] || SHIPPING_RATES.INT;
   }
   ```

### Writing Tests

#### Test File Naming
- Unit tests: `*.test.js`
- Integration tests: `*.integration.test.js`
- E2E tests: `*.e2e.test.js`

#### Test Structure Best Practices

```javascript
// Good test structure
describe('CheckoutFlow', () => {
  // Group related tests
  describe('when user has items in cart', () => {
    let mockCart;
    
    beforeEach(() => {
      // Setup shared state
      mockCart = { items: [{ id: 1, price: 100 }] };
    });
    
    it('should display cart total', () => {
      // Single assertion per test
      expect(getCartTotal(mockCart)).toBe(100);
    });
    
    it('should enable checkout button', () => {
      // Descriptive test names
      expect(isCheckoutEnabled(mockCart)).toBe(true);
    });
    
    afterEach(() => {
      // Clean up
      jest.clearAllMocks();
    });
  });
});
```

### Mocking Strategy

#### What to Mock
- External APIs (Stripe, Shopify)
- Database calls in unit tests
- Time-dependent functions
- Random number generators

#### What NOT to Mock
- Business logic being tested
- Simple utility functions
- Data transformations
- Critical path validations

### Test Data Management

#### Using Fixtures
```javascript
const fixtures = require('@fixtures');

// Use predefined test data
const validCart = fixtures.valid.cart.basic;
const expiredSession = fixtures.sessions.expired;
```

#### Test Isolation
- Each test should be independent
- No shared state between tests
- Use `beforeEach` for setup
- Use `afterEach` for cleanup

### Performance Testing

#### Load Testing
```bash
# Run load tests
npm run test:load

# Monitor performance metrics
npm run test:performance
```

#### Benchmarks
- API response time < 200ms
- UI interaction < 100ms
- Full checkout flow < 30s

## Common Development Tasks

### Testing Webhooks Locally
```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Update webhook URL in Stripe dashboard to ngrok URL
```

### Debugging Tests
```bash
# Run with debugging
npm run test:debug

# Run specific test with verbose output
npm test -- --verbose my-test.test.js
```

## Troubleshooting

### Common Issues

#### Tests Failing with 401
- Check if session token is expired
- Verify environment variables are set
- Ensure backend server is running

#### Cannot Connect to Backend
- Verify backend is running on port 3000
- Check API_URL in test environment
- Ensure CORS is configured

#### Stripe Webhook Errors
- Verify webhook secret matches environment
- Check signature validation
- Ensure webhook endpoint is accessible

### Getting Help
1. Check [SECRETS_MANAGEMENT.md](./docs/SECRETS_MANAGEMENT.md)
2. Search existing issues on GitHub
3. Ask in team Slack channel
4. Create GitHub issue with details

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Merges to main
- Scheduled daily runs

See `.github/workflows/test.yml` for configuration.

## Contributing

1. Create a feature branch
2. Write tests for new functionality (TDD)
3. Ensure all tests pass
4. Maintain > 80% coverage for critical paths
5. Submit pull request

## License

Proprietary - R3 Commerce Inc.