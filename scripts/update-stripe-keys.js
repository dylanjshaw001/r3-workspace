#!/usr/bin/env node

/**
 * Stripe Key Update Script
 * 
 * This script updates the Stripe public keys in the shared configuration.
 * It ensures the changes are properly propagated to all repositories.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'shared-constants.js');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  log('\n=== Stripe Key Update Tool ===\n', 'blue');
  
  // Read current config
  let configContent;
  try {
    configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
  } catch (error) {
    log(`✗ Failed to read config file: ${error.message}`, 'red');
    process.exit(1);
  }
  
  // Extract current keys
  const testKeyMatch = configContent.match(/TEST:\s*'(pk_test_[^']+)'/);
  const liveKeyMatch = configContent.match(/LIVE:\s*'(pk_live_[^']+)'/);
  
  log('Current Stripe Keys:', 'blue');
  if (testKeyMatch) {
    log(`  Test: ${testKeyMatch[1].substring(0, 30)}...${testKeyMatch[1].slice(-10)}`, 'yellow');
  }
  if (liveKeyMatch) {
    log(`  Live: ${liveKeyMatch[1].substring(0, 30)}...${liveKeyMatch[1].slice(-10)}`, 'yellow');
  }
  
  // Ask what to update
  const updateChoice = await question('\nWhat would you like to update? (test/live/both/cancel): ');
  
  if (updateChoice === 'cancel') {
    log('\nCancelled.', 'yellow');
    rl.close();
    return;
  }
  
  let newTestKey = null;
  let newLiveKey = null;
  
  if (updateChoice === 'test' || updateChoice === 'both') {
    newTestKey = await question('\nEnter new TEST key (or press Enter to skip): ');
    if (newTestKey && !newTestKey.startsWith('pk_test_')) {
      log('✗ Invalid test key format. Must start with pk_test_', 'red');
      rl.close();
      return;
    }
  }
  
  if (updateChoice === 'live' || updateChoice === 'both') {
    newLiveKey = await question('\nEnter new LIVE key (or press Enter to skip): ');
    if (newLiveKey && !newLiveKey.startsWith('pk_live_')) {
      log('✗ Invalid live key format. Must start with pk_live_', 'red');
      rl.close();
      return;
    }
  }
  
  // Update config content
  let updatedContent = configContent;
  let changes = [];
  
  if (newTestKey) {
    updatedContent = updatedContent.replace(
      /TEST:\s*'pk_test_[^']+'/,
      `TEST: '${newTestKey}'`
    );
    changes.push('Test key');
  }
  
  if (newLiveKey) {
    updatedContent = updatedContent.replace(
      /LIVE:\s*'pk_live_[^']+'/,
      `LIVE: '${newLiveKey}'`
    );
    changes.push('Live key');
  }
  
  if (changes.length === 0) {
    log('\nNo changes to make.', 'yellow');
    rl.close();
    return;
  }
  
  // Write updated config
  try {
    fs.writeFileSync(CONFIG_PATH, updatedContent, 'utf8');
    log(`\n✓ Updated: ${changes.join(', ')}`, 'green');
  } catch (error) {
    log(`\n✗ Failed to write config: ${error.message}`, 'red');
    rl.close();
    return;
  }
  
  // Run sync to verify
  log('\nRunning configuration sync...', 'blue');
  const { exec } = require('child_process');
  
  exec('npm run sync-config', { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
    if (error) {
      log(`\n✗ Sync failed: ${error.message}`, 'red');
    } else {
      log(stdout, 'green');
    }
    
    log('\n✓ Stripe keys updated successfully!', 'green');
    log('\nNext steps:', 'blue');
    log('  1. Test the changes locally', 'yellow');
    log('  2. Run "npm run deploy-config" to push to Git', 'yellow');
    
    rl.close();
  });
}

main();