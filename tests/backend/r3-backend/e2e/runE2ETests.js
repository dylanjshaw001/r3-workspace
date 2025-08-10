// E2E Test Runner
import { checkoutFlowTests, errorScenarioTests } from './checkout.flow.test.js';

async function runE2ETests() {
  console.log('\n🧪 Running End-to-End Tests\n');

  const suites = [
    { name: 'Checkout Flow Tests', suite: checkoutFlowTests },
    { name: 'Error Scenario Tests', suite: errorScenarioTests }
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const { name, suite } of suites) {
    console.log(`\n📋 ${name}`);
    console.log('='.repeat(50));

    const results = await suite.run();
    totalPassed += results.passed;
    totalFailed += results.failed;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('E2E Test Summary:');
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log('='.repeat(50));

  process.exit(totalFailed > 0 ? 1 : 0);
}

runE2ETests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
