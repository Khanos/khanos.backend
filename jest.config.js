const jestConfigs = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['**/api/**/*.js'],
  transform: {},
  coveragePathIgnorePatterns: [
    'node_modules',
    'tests',
    'api/mocks',
  ],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  coverageReporters: ['json', 'html'],
};

module.exports = jestConfigs;