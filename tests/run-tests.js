#!/usr/bin/env node

/**
 * Unified Test Runner for R3 Project
 * 
 * This replaces all the duplicate test scripts across repos.
 * It provides intelligent test selection based on:
 * - Scope (frontend/backend/all)
 * - Type (unit/integration/e2e)
 * - File changes (git diff)
 * - Environment (dev/stage/prod)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  scope: 'all',
  type: 'all',
  watch: false,
  coverage: false,
  verbose: false,
  bail: false,
  updateSnapshots: false,
  detectChanges: false,
  environment: process.env.NODE_ENV || 'dev'
};

// Process arguments
for (let i = 0; i < args.length; i++) {
  switch(args[i]) {
    case '--scope':
    case '-s':
      options.scope = args[++i];
      break;
    case '--type':
    case '-t':
      options.type = args[++i];
      break;
    case '--watch':
    case '-w':
      options.watch = true;
      break;
    case '--coverage':
    case '-c':
      options.coverage = true;
      break;
    case '--verbose':
    case '-v':
      options.verbose = true;
      break;
    case '--bail':
    case '-b':
      options.bail = true;
      break;
    case '--updateSnapshots':
    case '-u':
      options.updateSnapshots = true;
      break;
    case '--detectChanges':
    case '-d':
      options.detectChanges = true;
      break;
    case '--env':
    case '-e':
      options.environment = args[++i];
      break;
    case '--help':
    case '-h':
      showHelp();
      process.exit(0);
  }
}

function showHelp() {
  console.log(`
R3 Unified Test Runner

Usage: node run-tests.js [options]

Options:
  --scope, -s <scope>      Test scope: frontend, backend, all (default: all)
  --type, -t <type>        Test type: unit, integration, e2e, playwright, backend-e2e, load-test, security-test, all (default: all)
  --watch, -w              Run tests in watch mode
  --coverage, -c           Generate coverage report
  --verbose, -v            Verbose output
  --bail, -b               Stop on first test failure
  --updateSnapshots, -u    Update Jest snapshots
  --detectChanges, -d      Only run tests for changed files
  --env, -e <env>          Environment: dev, stage, prod (default: dev)
  --help, -h               Show this help message

Examples:
  # Run all tests (Jest + Playwright)
  node run-tests.js

  # Run frontend unit tests in watch mode
  node run-tests.js --scope frontend --type unit --watch

  # Run backend integration tests with coverage
  node run-tests.js --scope backend --type integration --coverage

  # Run only Playwright E2E browser tests
  node run-tests.js --type playwright

  # Run backend API E2E tests
  node run-tests.js --type backend-e2e

  # Run load/stress tests
  node run-tests.js --type load-test

  # Run security tests
  node run-tests.js --type security-test

  # Run all E2E tests (Jest + Playwright + Backend E2E)
  node run-tests.js --type e2e --env dev

  # Run frontend tests (includes Playwright)
  node run-tests.js --scope frontend

  # Run backend tests (includes backend E2E)
  node run-tests.js --scope backend

  # Run tests for changed files only
  node run-tests.js --detectChanges
`);
}

// Determine test paths based on options
function getTestPaths() {
  const paths = [];
  
  // Base paths for test types
  const typePaths = {
    unit: ['unit/'],
    integration: ['integration/'],
    e2e: ['e2e/', 'frontend/r3-frontend/e2e/playwright/', 'backend/r3-backend/e2e/'],
    playwright: ['frontend/r3-frontend/e2e/playwright/'],
    'backend-e2e': ['backend/r3-backend/e2e/'],
    'load-test': ['backend/r3-backend/e2e/load-stress.spec.js'],
    'security-test': ['backend/r3-backend/e2e/security-flow.spec.js'],
    all: ['unit/', 'integration/', 'e2e/', 'frontend/r3-frontend/e2e/playwright/', 'backend/r3-backend/e2e/']
  };
  
  // Get paths for selected type
  const selectedTypePaths = typePaths[options.type] || typePaths.all;
  
  // Filter by scope if specified
  if (options.scope === 'frontend') {
    selectedTypePaths.forEach(typePath => {
      paths.push(`${typePath}*frontend*`);
      paths.push(`frontend/${typePath.replace('/', '')}`);
    });
    // Always include Playwright tests for frontend
    paths.push('frontend/r3-frontend/e2e/playwright/');
  } else if (options.scope === 'backend') {
    selectedTypePaths.forEach(typePath => {
      paths.push(`${typePath}*backend*`);
      paths.push(`backend/${typePath.replace('/', '')}`);
    });
    // Always include backend E2E tests for backend scope
    paths.push('backend/r3-backend/e2e/');
  } else {
    paths.push(...selectedTypePaths);
  }
  
  // If detecting changes, filter to changed files
  if (options.detectChanges) {
    return getChangedTestFiles(paths);
  }
  
  return paths;
}

// Get test files that correspond to changed source files
function getChangedTestFiles(basePaths) {
  try {
    const { execSync } = require('child_process');
    const gitDiff = execSync('git diff --name-only HEAD~1', { encoding: 'utf8' });
    const changedFiles = gitDiff.split('\n').filter(Boolean);
    
    const testFiles = [];
    changedFiles.forEach(file => {
      // Map source files to test files
      if (file.includes('r3-frontend/')) {
        testFiles.push('frontend/', 'unit/frontend/', 'integration/*frontend*');
      }
      if (file.includes('r3-backend/')) {
        testFiles.push('backend/', 'unit/backend/', 'integration/*backend*');
      }
    });
    
    return testFiles.length > 0 ? testFiles : basePaths;
  } catch (error) {
    console.warn('Could not detect changed files, running all tests');
    return basePaths;
  }
}

// Detect if we should run Playwright tests
function shouldRunPlaywright() {
  const testPaths = getTestPaths();
  return testPaths.some(path => path.includes('playwright')) || 
         options.type === 'playwright' || 
         options.type === 'e2e' ||
         (options.scope === 'frontend' && (options.type === 'all' || options.type === 'e2e'));
}

// Build Jest command arguments
function buildJestArgs() {
  const testPaths = getTestPaths();
  const jestArgs = [];
  
  // Filter out Playwright paths for Jest (they run separately)
  const jestPaths = testPaths.filter(path => !path.includes('playwright'));
  
  // Add test paths
  jestPaths.forEach(path => jestArgs.push(path));
  
  // Add options
  if (options.watch) jestArgs.push('--watch');
  if (options.coverage) jestArgs.push('--coverage');
  if (options.verbose) jestArgs.push('--verbose');
  if (options.bail) jestArgs.push('--bail');
  if (options.updateSnapshots) jestArgs.push('--updateSnapshots');
  
  // Add environment-specific config
  jestArgs.push('--detectOpenHandles');
  jestArgs.push('--forceExit');
  
  // Set max workers based on test type
  if (options.type === 'unit') {
    jestArgs.push('--maxWorkers=4');
  } else if (options.type === 'e2e') {
    jestArgs.push('--maxWorkers=1'); // E2E tests should run serially
  }
  
  return jestArgs;
}

// Set environment variables
function setEnvironment() {
  process.env.NODE_ENV = options.environment;
  process.env.TEST_ENV = options.environment;
  
  // Set backend URL based on environment
  const backendUrls = {
    dev: 'https://r3-backend-git-dev-r3.vercel.app',
    stage: 'https://r3-backend-git-stage-r3.vercel.app',
    prod: 'https://r3-backend.vercel.app'
  };
  process.env.API_URL = backendUrls[options.environment];
  
  // Set test mode flags
  process.env.USE_TEST_KEYS = options.environment !== 'prod' ? 'true' : 'false';
  process.env.CREATE_DRAFT_ORDERS = options.environment !== 'prod' ? 'true' : 'false';
  
  if (options.verbose) {
    console.log('Test Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      API_URL: process.env.API_URL,
      USE_TEST_KEYS: process.env.USE_TEST_KEYS
    });
  }
}

// Run Playwright tests
async function runPlaywrightTests() {
  return new Promise((resolve, reject) => {
    console.log('🎭 Running Playwright E2E tests...');
    
    const playwrightArgs = [];
    
    // Add Playwright-specific options
    if (options.verbose) {
      playwrightArgs.push('--reporter=list');
    }
    
    if (options.environment === 'production') {
      // Only run critical tests in production
      playwrightArgs.push('--grep="Happy Path"');
    }
    
    // Set environment variables for Playwright
    const playwrightEnv = {
      ...process.env,
      NODE_ENV: options.environment,
      SHOPIFY_STORE_URL: options.environment === 'production' ? 'https://rthree.io' : 'https://sqqpyb-yq.myshopify.com',
      API_URL: process.env.API_URL
    };
    
    const playwright = spawn('npx', ['playwright', 'test', ...playwrightArgs], {
      stdio: 'inherit',
      shell: true,
      env: playwrightEnv
    });
    
    playwright.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Playwright tests completed successfully!');
        resolve();
      } else {
        console.log(`❌ Playwright tests failed with exit code: ${code}`);
        reject(new Error(`Playwright tests failed with code ${code}`));
      }
    });
    
    playwright.on('error', (error) => {
      console.error('Failed to start Playwright:', error);
      reject(error);
    });
  });
}

// Run Jest tests
async function runJestTests() {
  return new Promise((resolve, reject) => {
    const jestArgs = buildJestArgs();
    
    // Skip Jest if no Jest paths to test
    if (jestArgs.length === 0) {
      console.log('ℹ️  No Jest tests to run');
      resolve();
      return;
    }
    
    if (options.verbose) {
      console.log('Jest command:', 'jest', jestArgs.join(' '));
    }
    
    const jest = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      shell: true
    });
    
    jest.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Jest tests completed successfully!');
        resolve();
      } else {
        console.log(`❌ Jest tests failed with exit code: ${code}`);
        reject(new Error(`Jest tests failed with code ${code}`));
      }
    });
    
    jest.on('error', (error) => {
      console.error('Failed to start Jest:', error);
      reject(error);
    });
  });
}

// Main execution
async function runTests() {
  console.log('🧪 R3 Unified Test Runner');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Scope: ${options.scope} | Type: ${options.type} | Environment: ${options.environment}`);
  
  if (options.watch) console.log('📺 Watch mode enabled');
  if (options.coverage) console.log('📊 Coverage reporting enabled');
  if (options.detectChanges) console.log('🔍 Detecting changed files');
  
  const runPlaywright = shouldRunPlaywright();
  const runJest = options.type !== 'playwright'; // Run Jest unless only Playwright requested
  
  if (runPlaywright) console.log('🎭 Playwright E2E tests included');
  if (runJest) console.log('🧪 Jest unit/integration tests included');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Set environment
  setEnvironment();
  
  let jestSuccess = true;
  let playwrightSuccess = true;
  
  try {
    // Run Jest tests first
    if (runJest) {
      await runJestTests();
    }
    
    // Then run Playwright tests
    if (runPlaywright) {
      await runPlaywrightTests();
    }
    
  } catch (error) {
    if (error.message.includes('Jest')) {
      jestSuccess = false;
    } else if (error.message.includes('Playwright')) {
      playwrightSuccess = false;
    }
  }
  
  // Final summary
  console.log('\n🏁 Test Run Summary:');
  if (runJest) {
    console.log(`   Jest Tests: ${jestSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  }
  if (runPlaywright) {
    console.log(`   Playwright Tests: ${playwrightSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  }
  
  const overallSuccess = jestSuccess && playwrightSuccess;
  console.log(`   Overall: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);
  
  process.exit(overallSuccess ? 0 : 1);
}

// Run the tests
runTests();