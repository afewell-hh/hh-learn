import { test } from '@playwright/test';

const BASE = 'https://hedgehog.cloud';

test.describe('Screenshots for catalog polish and pathways', () => {
  test('learn page — desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/learn`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/issue-150/learn-desktop.png', fullPage: true });
  });

  test('learn page — mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/learn`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/issue-150/learn-mobile.png', fullPage: true });
  });

  test('pathways list', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/learn/pathways`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/issue-150/pathways-list.png', fullPage: true });
  });

  test('authoring-foundations detail', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/learn/pathways/authoring-foundations`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/issue-150/pathway-authoring-foundations.png', fullPage: true });
  });

  test('lab-onboarding detail', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(`${BASE}/learn/pathways/lab-onboarding`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/issue-150/pathway-lab-onboarding.png', fullPage: true });
  });
});

