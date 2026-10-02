module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  globalSetup: '<rootDir>/jest.global-setup.js',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: { '^.+\\.ts$': ['ts-jest', { diagnostics: false }] },
};
