#!/usr/bin/env node

/**
 * Fast Test Runner for Development
 * 
 * Usage:
 *   npm run test:fast                    # Run all tests with dev config
 *   npm run test:fast -- --grep "Cart"   # Run tests matching pattern
 *   npm run test:fast -- cart.spec.js    # Run specific test file
 */

const { execSync } = require('child_process');
const path = require('path');

// Use the fast development config
const configPath = path.join(__dirname, '..', 'playwright.dev.config.js');

// Get command line arguments (everything after --)
const args = process.argv.slice(2);

// Build the playwright command
let command = `npx playwright test --config ${configPath}`;

// Add any additional arguments
if (args.length > 0) {
  // Preserve quoted arguments
  const quotedArgs = args.map(arg => {
    if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
      return `"${arg}";`
    }
    return arg;
  });
  command += ` ${quotedArgs.join(' ')}`;
}

// Add reporter for better output
command += ' --reporter=list';

console.log('🚀 Running fast Playwright tests...');
console.log(`📋 Command: ${command}`);

try {
  execSync(command, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('❌ Tests failed');
  process.exit(1);
}