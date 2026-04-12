/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/unit/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  // Strip .js extension so ts-jest can resolve TypeScript source files
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
