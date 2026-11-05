/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { useESM: true, tsconfig: '<rootDir>/tsconfig.jest.json' },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(uuid)/)'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  testTimeout: 120_000,
};
