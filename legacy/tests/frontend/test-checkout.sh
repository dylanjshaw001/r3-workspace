#!/bin/bash

# Test checkout flow locally
# Runs a series of tests to ensure checkout is working

set -e

echo "🧪 Testing checkout flow..."

# 1. Start local dev server if not running
if ! lsof -i:9292 > /dev/null; then
    echo "Starting Shopify dev server..."
    shopify theme dev --store sqqpyb-yq &
    THEME_PID=$!
    sleep 5
else
    echo "✓ Dev server already running"
fi

# 2. Test backend health (use dev backend for dev branch)
echo ""
echo "📡 Testing backend health..."

# Allow override via environment variable
if [ ! -z "$BACKEND_URL" ]; then
    echo "Using custom backend URL from environment"
else
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" = "dev" ]; then
        BACKEND_URL="https://r3-backend-git-dev-r3.vercel.app"
    elif [ "$CURRENT_BRANCH" = "stage" ]; then
        BACKEND_URL="https://r3-backend-git-stage-r3.vercel.app"
    else
        BACKEND_URL="https://r3-backend.vercel.app"
    fi
fi
echo "Using backend: $BACKEND_URL"
HEALTH=$(curl -s "$BACKEND_URL/health" | grep -o '"status":"healthy"' || echo "failed")
if [[ $HEALTH == *"healthy"* ]]; then
    echo "✅ Backend healthy"
else
    echo "❌ Backend issue detected"
    curl "$BACKEND_URL/health"
    exit 1
fi

# 3. Test session creation
echo ""
echo "🔐 Testing session creation..."
SESSION_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/checkout/session" \
  -H "Content-Type: application/json" \
  -d '{"cartToken": "test-'$(date +%s)'", "domain": "localhost:9292", "cartTotal": 5000}')

if [[ $SESSION_RESPONSE == *"sessionToken"* ]]; then
    echo "✅ Session creation working"
    SESSION_TOKEN=$(echo $SESSION_RESPONSE | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)
    echo "   Token: ${SESSION_TOKEN:0:20}..."
else
    echo "❌ Session creation failed:"
    echo $SESSION_RESPONSE
    exit 1
fi

# 4. Test payment intent creation
echo ""
echo "💳 Testing payment intent creation..."
PAYMENT_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/stripe/create-payment-intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{
    "amount": 5000,
    "currency": "usd",
    "metadata": {
      "test": "true",
      "store_domain": "localhost:9292"
    }
  }')

if [[ $PAYMENT_RESPONSE == *"clientSecret"* ]]; then
    echo "✅ Payment intent creation working"
else
    echo "❌ Payment intent creation failed:"
    echo $PAYMENT_RESPONSE
fi

echo ""
echo "🎉 Checkout backend tests complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Open http://localhost:9292"
echo "  2. Add items to cart"
echo "  3. Go to checkout"
echo "  4. Use test card: 4242 4242 4242 4242"
echo "  5. Check Stripe dashboard for payment"
echo "  6. Check Shopify admin for order"

# Kill theme dev if we started it
if [ ! -z "$THEME_PID" ]; then
    echo ""
    read -p "Keep dev server running? (Y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        kill $THEME_PID
        echo "Dev server stopped"
    fi
fi