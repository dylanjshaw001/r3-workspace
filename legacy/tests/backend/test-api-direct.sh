#!/bin/bash

# First create a session
echo "Creating session..."
SESSION_RESPONSE=$(curl -s -X POST https://r3-backend-git-dev-r3.vercel.app/api/checkout/session \
  -H "Content-Type: application/json" \
  -d '{
    "cartToken": "test-'$(date +%s)'",
    "domain": "dev-test",
    "cartTotal": 10000
  }')

echo "Session response: $SESSION_RESPONSE"
SESSION_TOKEN=$(echo $SESSION_RESPONSE | jq -r '.sessionToken')

if [ "$SESSION_TOKEN" = "null" ] || [ -z "$SESSION_TOKEN" ]; then
  echo "Failed to get session token"
  exit 1
fi

echo "Got session token: $SESSION_TOKEN"

# Now test shipping calculation
echo -e "\nTesting shipping for 11 Classic Naloxone Emergency Kit..."
curl -X POST https://r3-backend-git-dev-r3.vercel.app/api/calculate-shipping \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{
    "items": [
      {
        "title": "Classic Naloxone Emergency Kit",
        "handle": "classic-naloxone-emergency-kit",
        "quantity": 11
      }
    ],
    "address": {
      "postal_code": "10001"
    }
  }' | jq .

echo -e "\nExpected: price: 3000 (cents) = $30.00 for 11 units (1 case + 1 unit)"