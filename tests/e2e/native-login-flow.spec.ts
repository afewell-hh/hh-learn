import 'dotenv/config';
import { test, expect } from '@playwright/test';
import { loginViaMembership } from '../helpers/auth';

const COURSE_SLUG = process.env.COURSE_SLUG || 'course-authoring-101';
const SITE_ORIGIN = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const COURSE_PATH = `/learn/courses/${COURSE_SLUG}`;
const COURSE_URL = `${SITE_ORIGIN.replace(/\/$/, '')}${COURSE_PATH}?hs_no_cache=1`;

const TEST_EMAIL = process.env.HUBSPOT_TEST_EMAIL || process.env.HUBSPOT_TEST_USERNAME;
const TEST_PASSWORD = process.env.HUBSPOT_TEST_PASSWORD;

test.describe('Native HubSpot membership authentication', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('CTA redirects to membership login and returns authenticated', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'HUBSPOT_TEST_EMAIL/USERNAME and HUBSPOT_TEST_PASSWORD are required');

    await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded' });

    const ctaButton = page.locator('#hhl-enroll-button');
    await ctaButton.waitFor({ state: 'visible', timeout: 20000 });
    await expect(ctaButton).toHaveText(/sign in/i);

    await Promise.all([
      page.waitForURL((url) => url.toString().includes('/_hcms/mem/login'), { timeout: 30000 }),
      ctaButton.click()
    ]);

    await loginViaMembership(page, {
      email: TEST_EMAIL!,
      password: TEST_PASSWORD!,
      siteOrigin: SITE_ORIGIN,
      redirectPath: `${COURSE_PATH}?hs_no_cache=1`,
      expectRedirectContains: COURSE_PATH
    });

    await page.waitForURL((url) => url.toString().includes(COURSE_PATH), { timeout: 60000 });
    await page.waitForFunction(() => {
      const identity = (window as any).hhIdentity?.get?.();
      return !!identity && (!!identity.email || !!identity.contactId);
    }, null, { timeout: 15000 });

    const authedButtonText = await ctaButton.innerText();
    expect(authedButtonText).not.toMatch(/sign in/i);
  });
});
