# ACH Payment Testing Guide

## Overview

This guide explains how to test the full ACH (Automated Clearing House) payment lifecycle in our R3 backend system. ACH payments are bank transfers that typically take 1-3 business days to clear, but we can simulate the entire flow instantly for testing.

## ACH Payment Lifecycle

### 1. Payment Initiation (`payment_intent.processing`)
- Customer enters bank account details
- Payment intent is created and confirmed
- Status: `processing`
- **Our Action**: Create draft order with `ACH_PENDING` tag

### 2. Payment Clearing (`payment_intent.succeeded` or `charge.succeeded`)
- Bank transfer completes successfully (1-3 days in production, instant in test)
- Status: `succeeded`
- **Our Action**: Update draft order tags from `ACH_PENDING` to `ACH_COMPLETED`

### 3. Payment Failure (`charge.failed`)
- Bank transfer fails (insufficient funds, closed account, etc.)
- Status: `failed`
- **Our Action**: Keep draft order for records, send failure notification

## Test Account Numbers

Stripe provides specific test account numbers for different scenarios:

| Scenario | Routing Number | Account Number | Result |
|----------|---------------|----------------|---------|
| Success | 110000000 | 000123456789 | Payment succeeds |
| Account Closed | 110000000 | 000111111113 | Payment fails - account closed |
| High Risk | 110000000 | 000000004954 | Payment blocked - fraud risk |
| Insufficient Funds | 110000000 | 000111111116 | Payment fails - NSF |

## Testing Methods

### Method 1: Manual Testing via Checkout

1. Navigate to your stage theme checkout
2. Add items to cart
3. At payment, select "Bank Transfer (ACH)"
4. Enter test account details:
   - Routing: `110000000`
   - Account: `000123456789`
5. Complete checkout
6. Monitor logs and Shopify draft orders

### Method 2: Stripe CLI Webhook Simulation

```bash
# Terminal 1: Start webhook listener
cd /Users/dylanjshaw/r3/r3-backend
npm run dev

# Terminal 2: Forward webhooks
stripe listen --forward-to http://localhost:3000/webhook/stripe

# Terminal 3: Trigger events
stripe trigger payment_intent.processing
stripe trigger payment_intent.succeeded
```

### Method 3: Test Script

We've created a comprehensive test script that simulates the entire ACH lifecycle:

```bash
cd /Users/dylanjshaw/r3/r3-workspace/scripts

# Test successful payment
node test-ach-flow.js success

# Test failed payment
node test-ach-flow.js failure  

# Test disputed payment
node test-ach-flow.js dispute
```

## Webhook Event Sequence

### Successful ACH Payment
1. `payment_intent.created` - Payment intent initialized
2. `payment_intent.processing` - ACH transfer initiated
3. `payment_intent.succeeded` - Transfer completed
4. `charge.succeeded` - Funds available

### Failed ACH Payment
1. `payment_intent.created` - Payment intent initialized
2. `payment_intent.processing` - ACH transfer initiated
3. `charge.failed` - Transfer failed
4. `payment_intent.payment_failed` - Payment marked as failed

## Verification Checklist

After running tests, verify the following:

- [ ] **Draft Order Creation**
  - Draft order created immediately when ACH payment initiated
  - Tagged with `ACH_PAYMENT` and `ACH_PENDING`
  - Note includes warning about pending clearance

- [ ] **Payment Success Flow**
  - Tags updated from `ACH_PENDING` to `ACH_COMPLETED`
  - Note updated to show payment cleared
  - Success email sent to customer

- [ ] **Payment Failure Flow**
  - Draft order remains for record keeping
  - Failure email sent with reason
  - Order can be manually cancelled if needed

- [ ] **Idempotency**
  - Multiple webhook events for same payment don't create duplicate orders
  - Payment intent ID is used as unique identifier

## Environment Configuration

### Required Environment Variables

```bash
# Stripe Keys (in Vercel)
STRIPE_SECRET_KEY_DEV=sk_test_...
STRIPE_SECRET_KEY_STAGE=sk_test_...
STRIPE_SECRET_KEY_PROD=sk_live_...

# Webhook Secrets (in Vercel)
STRIPE_WEBHOOK_SECRET_DEV=whsec_...
STRIPE_WEBHOOK_SECRET_STAGE=whsec_...
STRIPE_WEBHOOK_SECRET_PROD=whsec_...

# Shopify Config (in Vercel)
SHOPIFY_ACCESS_TOKEN=shpat_...
SHOPIFY_DOMAIN=sqqpyb-yq.myshopify.com
```

### Vercel KV Setup
- Idempotency tracking uses Vercel KV
- Keys expire after 24 hours automatically
- Pattern: `idempotency:{eventId}:{eventType}`

## Monitoring & Logs

### Key Log Messages to Watch

```javascript
// Successful ACH processing
"ACH payment processing - creating draft order immediately"
"Successfully updated draft order for ACH completion"

// Duplicate prevention
"ACH payment already has a draft order, updating status"

// Failures
"ACH Charge Failed"
"Failed to update draft order for ACH completion"
```

### Shopify Draft Order Tags

- `ACH_PAYMENT` - Identifies ACH payment method
- `ACH_PENDING` - Payment initiated, awaiting clearance
- `ACH_COMPLETED` - Payment successfully cleared
- `TEST_ORDER` - Added in non-production environments

## Troubleshooting

### Issue: Draft order not created
**Check:**
- Webhook signature validation
- Environment matching (dev/stage/prod)
- Stripe webhook secret configuration

### Issue: Draft order not updating when payment clears
**Check:**
- Payment intent ID tracking in Vercel KV
- Store configuration for environment
- Shopify API token permissions

### Issue: Duplicate orders created
**Check:**
- Idempotency key generation
- Vercel KV connection
- Multiple webhook endpoints receiving same events

### Issue: Webhooks not received
**Check:**
- Stripe webhook endpoint configuration
- Vercel deployment status
- Network/firewall settings

## Best Practices

1. **Always test in stage first** before deploying to production
2. **Use test Stripe keys** for all non-production environments
3. **Monitor webhook logs** during testing to catch issues early
4. **Verify email notifications** are sent at appropriate stages
5. **Check draft order notes** for clear payment status indicators

## Additional Resources

- [Stripe ACH Documentation](https://docs.stripe.com/payments/ach-direct-debit)
- [Stripe Testing Guide](https://docs.stripe.com/testing)
- [Shopify Draft Orders API](https://shopify.dev/docs/api/admin-rest/2024-01/resources/draftorder)
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)

## Support

For issues or questions:
1. Check webhook logs in Vercel dashboard
2. Review Stripe dashboard for payment details
3. Verify Shopify draft orders for proper tags
4. Contact team lead for environment-specific issues