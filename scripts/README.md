# R3 Workspace Scripts

This directory contains utility scripts for testing and managing the R3 platform.

## 📁 Script Files

### test-ach-flow.js
**Purpose:** Simulates the complete ACH payment lifecycle for testing webhook handling

**Usage:**
```bash
node test-ach-flow.js [scenario]

# Scenarios:
node test-ach-flow.js success   # Test successful ACH payment
node test-ach-flow.js failure   # Test failed ACH payment  
node test-ach-flow.js dispute   # Test disputed ACH payment
```

**What it does:**
1. Creates a test customer with bank account
2. Initiates ACH payment intent
3. Simulates webhook events for the chosen scenario
4. Verifies draft order creation and updates

### test-ach.sh
**Purpose:** Interactive menu for ACH payment testing

**Usage:**
```bash
./test-ach.sh
```

**Features:**
- Run different test scenarios interactively
- Test with Stripe CLI
- View webhook logs
- Display test account numbers
- Automatically starts backend if needed

## 🧪 Test Account Numbers

Use these Stripe test accounts for different scenarios:

| Scenario | Routing | Account | Result |
|----------|---------|---------|---------|
| Success | 110000000 | 000123456789 | Payment succeeds |
| Account Closed | 110000000 | 000111111113 | Payment fails |
| High Risk | 110000000 | 000000004954 | Blocked for fraud |
| NSF | 110000000 | 000111111116 | Insufficient funds |

## 📋 Prerequisites

- Node.js installed
- Stripe CLI installed (for webhook testing)
- Backend environment variables configured
- Access to r3-backend for webhook processing

## 🔧 Configuration

The scripts use environment variables from the backend:
- `STRIPE_SECRET_KEY_TEST` or `STRIPE_SECRET_KEY_DEV`
- `STRIPE_WEBHOOK_SECRET_DEV`
- `WEBHOOK_URL` (defaults to http://localhost:3000/webhook/stripe)

## 📖 Related Documentation

- Full ACH testing guide: `/docs/ach-testing.md`
- Backend webhook handler: `r3-backend/api/webhook-stripe.js`
- Payment configuration: `/config/shared-constants.js`

## 🚀 Quick Start

1. Ensure backend is running:
   ```bash
   cd ../../r3-backend
   npm run dev
   ```

2. Run interactive test menu:
   ```bash
   cd ../r3-workspace/scripts
   ./test-ach.sh
   ```

3. Select test scenario and follow prompts

## ⚠️ Important Notes

- These scripts create test data in Stripe
- Always use test API keys
- Draft orders will be created in Shopify (tagged as TEST_ORDER)
- Monitor webhook logs to verify proper handling