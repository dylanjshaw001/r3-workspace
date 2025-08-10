// Main test runner - executes all test suites
import { performance } from 'perf_hooks';
import { circuitBreakerTests } from './circuitBreaker.test.js';
import { sessionTests } from './session.test.js';
import { integrationTests } from './integration.test.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test configuration
const testSuites = [
  { name: 'Circuit Breaker Tests', suite: circuitBreakerTests },
  { name: 'Session Management Tests', suite: sessionTests },
  { name: 'Integration Tests', suite: integrationTests }
];

// Run all tests
async function runAllTests() {
  console.log(`${colors.bright}${colors.blue}R3 Payment Backend - Test Suite${colors.reset}\n`);

  const startTime = performance.now();
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    suites: []
  };

  // Run each test suite
  for (const { name, suite } of testSuites) {
    console.log(`${colors.bright}${colors.cyan}Running ${name}...${colors.reset}`);

    const suiteStart = performance.now();
    const suiteResults = await suite.run();
    const suiteDuration = performance.now() - suiteStart;

    results.total += suiteResults.passed + suiteResults.failed;
    results.passed += suiteResults.passed;
    results.failed += suiteResults.failed;

    results.suites.push({
      name,
      ...suiteResults,
      duration: suiteDuration
    });

    // Suite summary
    if (suiteResults.failed === 0) {
      console.log(`${colors.green}✓ ${name}: All tests passed (${suiteDuration.toFixed(0)}ms)${colors.reset}\n`);
    } else {
      console.log(`${colors.red}✗ ${name}: ${suiteResults.failed} tests failed (${suiteDuration.toFixed(0)}ms)${colors.reset}\n`);
    }
  }

  const totalDuration = performance.now() - startTime;

  // Overall summary
  console.log(`${colors.bright}Test Summary${colors.reset}`);
  console.log('='.repeat(50));

  results.suites.forEach(suite => {
    const status = suite.failed === 0 ? `${colors.green}PASS` : `${colors.red}FAIL`;
    console.log(`${suite.name}: ${status}${colors.reset} (${suite.passed}/${suite.passed + suite.failed} tests)`);
  });

  console.log('='.repeat(50));

  if (results.failed === 0) {
    console.log(`${colors.bright}${colors.green}✓ All tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}✗ ${results.failed} tests failed${colors.reset}`);
  }

  console.log(`\nTotal: ${results.total} tests`);
  console.log(`Passed: ${colors.green}${results.passed}${colors.reset}`);
  console.log(`Failed: ${colors.red}${results.failed}${colors.reset}`);
  console.log(`Time: ${(totalDuration / 1000).toFixed(2)}s`);

  // Generate coverage report (simplified)
  if (process.env.COVERAGE) {
    console.log(`\n${colors.bright}Code Coverage${colors.reset}`);
    console.log('='.repeat(50));
    console.log('Note: For full coverage, use c8 or nyc');
    console.log(`Files tested: ${testSuites.length}`);
    console.log(`Test cases: ${results.total}`);
  }

  return results.failed === 0 ? 0 : 1;
}

// Watch mode
async function runWatchMode() {
  console.log(`${colors.bright}${colors.yellow}Running in watch mode...${colors.reset}\n`);

  const runTests = async () => {
    console.clear();
    await runAllTests();
    console.log(`\n${colors.yellow}Watching for changes... (Press Ctrl+C to exit)${colors.reset}`);
  };

  // Initial run
  await runTests();

  // Watch for file changes (simplified - in production use chokidar)
  if (process.platform !== 'win32') {
    process.on('SIGUSR2', runTests);
    console.log('Send SIGUSR2 to re-run tests');
  }
}

// CI mode - output in standard format
async function runCIMode() {
  const startTime = performance.now();
  let exitCode = 0;

  for (const { name, suite } of testSuites) {
    console.log(`##[group]${name}`);
    const results = await suite.run();
    console.log('##[endgroup]');

    if (results.failed > 0) {
      exitCode = 1;
      console.log(`::error::${name} failed with ${results.failed} errors`);
    }
  }

  const duration = performance.now() - startTime;
  console.log(`::notice::Tests completed in ${(duration / 1000).toFixed(2)}s`);

  return exitCode;
}

// Main execution
const mode = process.argv[2];

async function main() {
  let exitCode = 0;

  try {
    switch (mode) {
      case '--watch':
      case '-w':
        await runWatchMode();
        break;

      case '--ci':
        exitCode = await runCIMode();
        break;

      default:
        exitCode = await runAllTests();
    }
  } catch (error) {
    console.error(`${colors.red}Test runner error: ${error.message}${colors.reset}`);
    exitCode = 1;
  }

  process.exit(exitCode);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}Unhandled rejection: ${error.message}${colors.reset}`);
  process.exit(1);
});

// Run tests
main();
