import { defineConfig } from '@playwright/test';

/**
 * Browser tests for the `compare` primitive (issue #525). Self-contained: the page is built in the
 * test from the committed CSS, JS and fixture, so no server, auth, HubSpot or network is involved.
 * Uses the system Chrome (HH_CHROME_PATH, default /usr/bin/google-chrome) so no browser download is needed.
 */
export default defineConfig({
  testDir: 'tests/compare',
  timeout: 60000,
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      executablePath: process.env.HH_CHROME_PATH || '/usr/bin/google-chrome',
      args: ['--no-sandbox'],
    },
  },
});
