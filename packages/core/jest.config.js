/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 50000,
  roots: [
    '<rootDir>',
  ],
  testMatch: ["<rootDir>/tests/*.(test).{js,jsx,ts,tsx}",
              "<rootDir>/tests/?(*.)(spec|test).{js,jsx,ts,tsx}"],
  collectCoverageFrom: ["<rootDir>/src/**"],
  coverageDirectory: "<rootDir>/tests/coverage"
};
