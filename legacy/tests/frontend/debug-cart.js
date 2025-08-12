// Debug script to check cart functionality
console.log('=== Cart Debug Script ===');

// Check if CartDrawer class exists
if (typeof CartDrawer !== 'undefined') {
    console.log('✓ CartDrawer class found');
} else {
    console.error('✗ CartDrawer class NOT found');
}

// Check if cart drawer instance exists
if (typeof cartDrawerInstance !== 'undefined') {
    console.log('✓ cartDrawerInstance found');
    console.log('  - throttleDelay:', cartDrawerInstance.throttleDelay);
    console.log('  - retryDelay:', cartDrawerInstance.retryDelay);
    console.log('  - maxRetryAttempts:', cartDrawerInstance.maxRetryAttempts);
} else {
    console.error('✗ cartDrawerInstance NOT found');
}

// Check for cart drawer elements
const cartDrawer = document.querySelector('[data-cart-drawer]');
if (cartDrawer) {
    console.log('✓ Cart drawer element found');
} else {
    console.error('✗ Cart drawer element NOT found');
}

// Test adding to cart
async function testAddToCart() {
    console.log('\n=== Testing Add to Cart ===');
    
    const formData = new FormData();
    formData.append('id', '47643640955122'); // Personal Protective Equipment Kit variant
    formData.append('quantity', '1');
    
    try {
        const response = await fetch('/cart/add.js', {
            method: 'POST',
            body: formData
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✓ Successfully added to cart:', result);
        } else {
            const text = await response.text();
            console.error('✗ Failed to add to cart:', response.status, text);
        }
    } catch (error) {
        console.error('✗ Error adding to cart:', error);
    }
}

// Check for any console errors
window.addEventListener('error', (e) => {
    console.error('Window error:', e.message, e.filename, e.lineno, e.colno);
});

// Run test after a short delay
setTimeout(testAddToCart, 1000);