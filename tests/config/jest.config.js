module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/config/jest.setup.js'],
  
  // Test patterns
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js'
  ],
  
  // Coverage settings
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/fixtures/',
    '/tests/utils/'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Module paths
  moduleNameMapper: {
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1',
    '^@utils/(.*)$': '<rootDir>/tests/utils/$1',
    '^@config/(.*)$': '<rootDir>/tests/config/$1'
  },
  
  // Timeouts
  testTimeout: 30000,
  
  // Reporters
  reporters: [
    'default',
    ['jest-html-reporter', {
      pageTitle: 'R3 Checkout Test Report',
      outputPath: 'test-results/test-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true
    }]
  ],
  
  // Global variables
  globals: {
    __DEV__: true,
    __TEST__: true
  }
};