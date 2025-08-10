module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/config/jest.setup.js'],
  testMatch: [
    '**/r3-frontend/**/*.test.js'
  ],
  moduleNameMapper: {
    '^@fixtures$': '<rootDir>/shared/fixtures/index.js',
    '^@fixtures/(.*)$': '<rootDir>/shared/fixtures/$1',
    '^@helpers/(.*)$': '<rootDir>/shared/helpers/$1',
    '^@mocks/(.*)$': '<rootDir>/shared/mocks/$1',
    '^@config/(.*)$': '<rootDir>/config/$1'
  },
  globals: {
    'window': {},
    'document': {}
  }
};