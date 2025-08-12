import fetch from 'node-fetch';

// Test the tax API endpoint
async function testTaxAPI() {
  const apiUrl = 'http://localhost:3000/api/calculate-tax';
  
  const testData = {
    subtotal: 300,
    shipping: 10,
    state: 'MA'
  };
  
  console.log('Testing tax API endpoint...');
  console.log('Request:', JSON.stringify(testData, null, 2));
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('\nResponse:', JSON.stringify(result, null, 2));
    
    // Verify the result
    if (result.totalTax === 19.38) {
      console.log('\n✅ Tax calculation is correct!');
      console.log('   Expected: $19.38');
      console.log('   Received: $' + result.totalTax);
    } else {
      console.log('\n❌ Tax calculation mismatch!');
      console.log('   Expected: $19.38');
      console.log('   Received: $' + (result.totalTax || 'null'));
    }
  } catch (error) {
    console.error('\n❌ Error testing API:', error.message);
    console.log('\nMake sure the server is running on port 3000');
  }
}

testTaxAPI();