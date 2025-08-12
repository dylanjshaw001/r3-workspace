import fetch from 'node-fetch';

async function testAuthenticatedTax() {
  console.log('Testing authenticated tax endpoint...\n');
  
  // First, create a session
  console.log('1. Creating session...');
  const sessionResponse = await fetch('https://r3-backend-git-dev-r3.vercel.app/api/checkout/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cartToken: 'test-cart-' + Date.now(),
      domain: 'sqqpyb-yq.myshopify.com',
      fingerprint: 'test-fingerprint'
    })
  });
  
  if (!sessionResponse.ok) {
    console.error('Failed to create session:', await sessionResponse.text());
    return;
  }
  
  const sessionData = await sessionResponse.json();
  const sessionId = sessionResponse.headers.get('set-cookie')?.match(/sessionId=([^;]+)/)?.[1];
  console.log('Session created:', { sessionId: sessionId?.substring(0, 8) + '...', csrfToken: sessionData.csrfToken?.substring(0, 8) + '...' });
  
  // Now test the tax endpoint
  console.log('\n2. Testing tax calculation...');
  const taxResponse = await fetch('https://r3-backend-git-dev-r3.vercel.app/api/calculate-tax', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `sessionId=${sessionId}`,
      'x-csrf-token': sessionData.csrfToken
    },
    body: JSON.stringify({
      subtotal: 3150,
      shipping: 55,
      state: 'MA'
    })
  });
  
  if (!taxResponse.ok) {
    console.error('Tax request failed:', taxResponse.status, await taxResponse.text());
    return;
  }
  
  const taxData = await taxResponse.json();
  console.log('\nTax response:', JSON.stringify(taxData, null, 2));
  
  // Compare with test endpoint
  console.log('\n3. Comparing with test endpoint...');
  const testResponse = await fetch('https://r3-backend-git-dev-r3.vercel.app/api/test-tax', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subtotal: 3150,
      shipping: 55,
      state: 'MA'
    })
  });
  
  const testData = await testResponse.json();
  console.log('\nTest endpoint response:', JSON.stringify(testData.result, null, 2));
  
  console.log('\n=== COMPARISON ===');
  console.log('Authenticated endpoint tax:', taxData.totalTax);
  console.log('Test endpoint tax:', testData.result.totalTax);
  console.log('Match:', taxData.totalTax === testData.result.totalTax * 100);
}

testAuthenticatedTax().catch(console.error);