import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const TEST_COURSE_SLUG = process.env.TEST_COURSE_SLUG || 'network-like-hyperscaler-foundations';
const CACHE_BUSTER = `hsCacheBuster=${Date.now()}`;
const VERIFICATION_DIR = path.join(process.cwd(), 'verification-output', 'issue-355');

async function captureFailureScreenshot(page: Page, name: string): Promise<string> {
  if (!fs.existsSync(VERIFICATION_DIR)) {
    fs.mkdirSync(VERIFICATION_DIR, { recursive: true });
  }
  const filePath = path.join(VERIFICATION_DIR, `${name}-${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

test.describe('Issue #355 Enrollment + My Learning regressions', () => {
  test('logged-in course detail upgrades CTA to a button (not login link)', async ({ page }) => {
    const url = `${BASE_URL}/learn/courses/${TEST_COURSE_SLUG}?${CACHE_BUSTER}`;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      await page.waitForSelector('#hhl-enrollment-cta', { timeout: 12000 });
      await page.waitForSelector('#hhl-enrollment-cta button#hhl-enroll-button', { timeout: 12000 });

      const buttonCount = await page.locator('#hhl-enrollment-cta button#hhl-enroll-button').count();
      const loginLinkCount = await page.locator('#hhl-enrollment-cta a#hhl-enroll-login').count();

      expect(buttonCount).toBeGreaterThan(0);
      expect(loginLinkCount).toBe(0);
    } catch (error) {
      const screenshot = await captureFailureScreenshot(page, 'issue-355-course-cta-button-missing');
      throw new Error(`Issue #355 check failed: expected enrollment button and no login link on course detail. Screenshot: ${screenshot}. Error: ${String(error)}`);
    }
  });

  test('my-learning renders enrolled course modules list with at least one module link', async ({ page }) => {
    const url = `${BASE_URL}/learn/my-learning?${CACHE_BUSTER}`;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      await page.waitForSelector('.enrollment-modules-toggle', { timeout: 15000 });
      await page.locator('.enrollment-modules-summary').first().click();
      await page.waitForSelector('.enrollment-modules-list', { timeout: 15000 });
      await page.waitForSelector('.enrollment-modules-list .enrollment-module-link', { timeout: 15000 });

      const moduleLinkCount = await page.locator('.enrollment-modules-list .enrollment-module-link').count();
      expect(moduleLinkCount).toBeGreaterThan(0);
    } catch (error) {
      const screenshot = await captureFailureScreenshot(page, 'issue-355-my-learning-module-list-missing');
      throw new Error(`Issue #355 check failed: expected enrolled module list with links on My Learning. Screenshot: ${screenshot}. Error: ${String(error)}`);
    }
  });
});
