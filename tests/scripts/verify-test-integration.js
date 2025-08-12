#!/usr/bin/env node

/**
 * Test Integration Verification Script
 * 
 * This script verifies that the unified test runner correctly integrates
 * both Jest and Playwright tests and can run them appropriately based
 * on the specified options.
 */

const { spawn } = require('child_process');
const path = require('path');

// Test configurations to verify
const testConfigurations = [
  {
    name: 'Jest Only (Backend)',
    args: ['--scope', 'backend', '--type', 'unit'],
    expectJest: true,
    expectPlaywright: false
  },
  {
    name: 'Playwright Only',
    args: ['--type', 'playwright'],
    expectJest: false,
    expectPlaywright: true
  },
  {
    name: 'Frontend All (Jest + Playwright)',
    args: ['--scope', 'frontend'],
    expectJest: true,
    expectPlaywright: true
  },
  {
    name: 'E2E All (Jest + Playwright)',
    args: ['--type', 'e2e'],
    expectJest: true,
    expectPlaywright: true
  },
  {
    name: 'All Tests',
    args: [],
    expectJest: true,
    expectPlaywright: true
  }
];

async function runTestConfiguration(config) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Testing: ${config.name}`);
    console.log(`   Args: ${config.args.join(' ') || 'none'}`);
    console.log(`   Expect Jest: ${config.expectJest}`);
    console.log(`   Expect Playwright: ${config.expectPlaywright}`);
    
    const runTestsPath = path.join(__dirname, '..', 'run-tests.js');
    
    const testProcess = spawn('node', [runTestsPath, '--verbose', ...config.args], {
      stdio: 'pipe',
      shell: true
    });
    
    let stdout = '';
    let stderr = '';
    
    testProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    testProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    testProcess.on('close', (code) => {
      const result = {
        name: config.name,
        args: config.args,
        exitCode: code,
        stdout: stdout,
        stderr: stderr,
        jestDetected: stdout.includes('Jest tests') || stdout.includes('jest'),
        playwrightDetected: stdout.includes('Playwright') || stdout.includes('playwright'),
        expectJest: config.expectJest,
        expectPlaywright: config.expectPlaywright
      };
      
      // Determine if the test passed
      result.passed = 
        (result.jestDetected === result.expectJest) && 
        (result.playwrightDetected === result.expectPlaywright);
      
      resolve(result);
    });
    
    testProcess.on('error', (error) => {
      reject({ error, config });
    });
    
    // Kill the process after 30 seconds to avoid hanging
    setTimeout(() => {
      testProcess.kill('SIGKILL');
      reject({ error: new Error('Test timeout'), config });
    }, 30000);
  });
}

async function verifyTestIntegration() {
  console.log('🔍 Verifying Test Runner Integration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const results = [];
  
  for (const config of testConfigurations) {
    try {
      const result = await runTestConfiguration(config);
      results.push(result);
      
      if (result.passed) {
        console.log(`   ✅ PASSED: ${result.name}`);
      } else {
        console.log(`   ❌ FAILED: ${result.name}`);
        console.log(`      Expected Jest: ${result.expectJest}, Got: ${result.jestDetected}`);
        console.log(`      Expected Playwright: ${result.expectPlaywright}, Got: ${result.playwrightDetected}`);
      }
    } catch (error) {
      console.log(`   💥 ERROR: ${error.config.name} - ${error.error.message}`);
      results.push({
        name: error.config.name,
        passed: false,
        error: error.error.message
      });
    }
  }
  
  // Summary
  console.log('\n📊 Integration Test Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅' : result.error ? '💥' : '❌';
    console.log(`${status} ${result.name}`);
  });
  
  console.log(`\n🎯 Overall: ${passed}/${total} configurations passed`);
  
  if (passed === total) {
    console.log('🎉 All test integrations working correctly!');
    process.exit(0);
  } else {
    console.log('⚠️  Some test integrations need attention');
    process.exit(1);
  }
}

// Helper function to check if required dependencies are installed
async function checkDependencies() {
  const dependencies = ['jest', 'playwright'];
  const missing = [];
  
  for (const dep of dependencies) {
    try {
      require.resolve(dep);
    } catch (error) {
      missing.push(dep);
    }
  }
  
  if (missing.length > 0) {
    console.log('❌ Missing dependencies:', missing.join(', '));
    console.log('Run: npm install');
    process.exit(1);
  }
  
  console.log('✅ All required dependencies found');
}

// Check for package.json scripts
function checkPackageScripts() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  try {
    const packageJson = require(packageJsonPath);
    const scripts = packageJson.scripts || {};
    
    const requiredScripts = ['test:e2e', 'test:e2e:chromium'];
    const missingScripts = requiredScripts.filter(script => !scripts[script]);
    
    if (missingScripts.length > 0) {
      console.log('⚠️  Missing package.json scripts:', missingScripts.join(', '));
    } else {
      console.log('✅ All required scripts found in package.json');
    }
  } catch (error) {
    console.log('⚠️  Could not read package.json:', error.message);
  }
}

// Run verification
async function main() {
  console.log('🚀 Starting Test Integration Verification\n');
  
  await checkDependencies();
  checkPackageScripts();
  
  console.log('\n🔧 Environment Check:');
  console.log(`   Node.js: ${process.version}`);
  console.log(`   Working Directory: ${process.cwd()}`);
  console.log(`   Test Runner: ${path.join(__dirname, '..', 'run-tests.js')}`);
  
  await verifyTestIntegration();
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Verification failed:', error);
    process.exit(1);
  });
}

module.exports = {
  verifyTestIntegration,
  checkDependencies
};