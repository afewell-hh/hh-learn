import { test } from '@playwright/test';

const BASE = 'https://hedgehog.cloud';

test.describe('Spot-check after #151/#156', () => {
  test('learn desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/learn`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#learn-left-nav');
    await page.screenshot({ path: 'screenshots/issue-156/learn-desktop.png', fullPage: true });
  });

  test('learn mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/learn`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#learn-left-nav');
    await page.screenshot({ path: 'screenshots/issue-156/learn-mobile.png', fullPage: true });
  });
});

