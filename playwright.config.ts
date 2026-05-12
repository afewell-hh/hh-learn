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
      // Layer 1 — Deterministic frontend regression.
      // Intercepts HubDB, /auth/me, /enrollments/list, and shadow JS (byte-identical to
      // committed source) to prove shadow-completion.js and shadow-my-learning.js render
      // the correct UI for all three shadow module types. CDN lag is not a variable here.
      name: 'shadow-deterministic',
      testMatch: ['tests/e2e/shadow-deterministic.spec.ts'],
      use: {
        // Cap individual page loads at 60s so a hung CDN/Lambda call fails fast
        // rather than consuming the full 120s per-test timeout.
        navigationTimeout: 60000,
      },
    },
    {
      // Layer 2 — Live shadow acceptance.
      // Module pages: zero mocks, real CDN JS, real Lambda, real DynamoDB.
      // My Learning: three documented unavoidable mocks (/auth/me, /enrollments/list, HubDB).
      // Includes CDN asset content verification and 6 key-state screenshots.
      name: 'shadow-live',
      testMatch: ['tests/e2e/shadow-live.spec.ts'],
    },
    {
      // Layer 4 — Production smoke (Issue #458, Phase 5A).
      // Hits real https://api.hedgehog.cloud/... with no Cognito setup.
      // Defense-in-depth gate for the production stage of dual-stage assets.
      name: 'production-smoke',
      testMatch: [
        'tests/e2e/admin-test-reset-production.spec.ts',
      ],
    },
    {
      // Layer 1 — Production learner-record deterministic (Issue #459, Phase 5B).
      // Intercepts production JS files + the bare-host /course/status, /pathway/status,
      // /module/progress, /certificates endpoints so the production parity slice
      // renders and is asserted independently of CDN lag.
      name: 'production-learner-record-deterministic',
      testMatch: ['tests/e2e/production-learner-record-deterministic.spec.ts'],
      use: {
        navigationTimeout: 60000,
      },
    },
  ],
});
