// Security Test Runner
import { securityTests } from './security.test.js';

async function runSecurityTests() {
  console.log('\n🔒 Running Security Tests\n');
  console.log('='.repeat(50));

  const results = await securityTests.run();

  console.log(`\n${'='.repeat(50)}`);
  console.log('Security Test Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log('='.repeat(50));

  if (results.failed > 0) {
    console.log('\n⚠️  Security vulnerabilities detected!');
  } else {
    console.log('\n✅ All security tests passed');
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

runSecurityTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
