export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['**/api/**/*.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  coveragePathIgnorePatterns: [
    'node_modules',
    'tests',
    'api/mocks',
  ],
  coverageThreshold: {
    global: {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
  },
  coverageReporters: ['json', 'html'],
};