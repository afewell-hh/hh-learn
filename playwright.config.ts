import { defineConfig } from '@playwright/test';
export default defineConfig({
  timeout: 120000,
  expect: { timeout: 30000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: ['tests/e2e/auth.setup.ts'],
    },
    {
      name: 'e2e',
      dependencies: ['setup'],
      use: {
        storageState: 'tests/e2e/.auth/user.json',
      },
    },
    {
      // Shadow E2E suite uses test-bypass token auth — no Cognito setup required.
      // Runs against the live shadow site at hedgehog.cloud/learn-shadow/*.
      name: 'shadow',
      testMatch: ['tests/e2e/issue-424-shadow-e2e.spec.ts'],
    },
  ],
});
