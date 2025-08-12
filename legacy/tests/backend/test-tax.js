import { calculateTax } from './utils/tax.js';

// Test MA tax calculation with the exact data from frontend
const subtotal = 300;  // $300
const shipping = 10;   // $10
const address = { state: 'MA' };

console.log('Testing tax calculation for Massachusetts:');
console.log('Input:', { subtotal, shipping, state: address.state });

const result = calculateTax(subtotal, shipping, address);

console.log('Result:', JSON.stringify(result, null, 2));
console.log('\nExpected:');
console.log('- State tax rate: 6.25%');
console.log('- MA taxes shipping: Yes');
console.log('- Taxable amount: $310 (subtotal + shipping)');
console.log('- Expected tax: $19.38 (310 * 0.0625)');