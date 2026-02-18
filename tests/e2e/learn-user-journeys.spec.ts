import { expect, test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://hedgehog.cloud';
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.hedgehog.cloud';
const STORAGE_STATE_PATH = 'tests/e2e/.auth/user.json';

const PAGES = {
  catalog: `${BASE_URL}/learn/catalog`,
  pathwayDetail: `${BASE_URL}/learn/pathways/network-like-hyperscaler`,
  myLearning: `${BASE_URL}/learn/my-learning`,
};

function requireAuth(reason: string): boolean {
  if (!process.env.HUBSPOT_TEST_EMAIL || !process.env.HUBSPOT_TEST_PASSWORD) {
    test.skip(`Skipping ${reason}: HUBSPOT_TEST_EMAIL/HUBSPOT_TEST_PASSWORD not set`);
    return false;
  }
  return true;
}

test.describe('Learn user journeys (end-to-end UX)', () => {
  test.describe('anonymous journey', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('sign-in CTA routes to Cognito and enroll CTA prompts login', async ({ page }) => {
      await page.goto(PAGES.catalog, { waitUntil: 'domcontentloaded' });

      const signInLink = page.locator('[data-auth-state="anonymous"] a', { hasText: 'Sign In' });
      await expect(signInLink).toBeVisible();
      const signInHref = await signInLink.getAttribute('href');
      expect(signInHref || '').toContain('/auth/login');

      await signInLink.click();
      await page.waitForURL(/auth\/login|amazoncognito\.com\/login|cognito.*(oauth2\/authorize|\/login)/, { timeout: 30000 });

      await page.goto(PAGES.pathwayDetail, { waitUntil: 'domcontentloaded' });
      const enrollLogin = page.locator('#hhl-enroll-login');
      await expect(enrollLogin).toBeVisible();
      const enrollHref = await enrollLogin.getAttribute('href');
      expect(enrollHref || '').toContain('/auth/login');

      await enrollLogin.click();
      await page.waitForURL(/auth\/login|amazoncognito\.com\/login|cognito.*(oauth2\/authorize|\/login)/, { timeout: 30000 });
    });
  });

  test.describe('authenticated journey', () => {
    test.use({ storageState: STORAGE_STATE_PATH });

    test('auth persists across pages and enrollment + My Learning behave correctly', async ({ page }) => {
      if (!requireAuth('authenticated journey')) return;
      await page.goto(PAGES.pathwayDetail, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        return !!(window.hhIdentity && window.hhIdentity.isAuthenticated && window.hhIdentity.isAuthenticated());
      });

      const enrollButton = page.locator('#hhl-enroll-button');
      await expect(enrollButton).toBeVisible();
      await expect(page.locator('#hhl-enroll-login')).toHaveCount(0);

      const enrollText = (await enrollButton.textContent()) || '';
      const alreadyEnrolled = (await enrollButton.isDisabled()) || enrollText.toLowerCase().includes('enrolled');

      if (!alreadyEnrolled) {
        await enrollButton.click();
        await page.waitForURL('**/learn/action-runner**');

        await page.goto(PAGES.pathwayDetail, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => {
          return !!(window.hhIdentity && window.hhIdentity.isAuthenticated && window.hhIdentity.isAuthenticated());
        });

        const enrolledFlag = await page.evaluate(() => {
          const raw = localStorage.getItem('hh-enrollment-pathway-network-like-hyperscaler');
          if (!raw) return false;
          try {
            const data = JSON.parse(raw);
            return !!data.enrolled;
          } catch (e) {
            return false;
          }
        });
        expect(enrolledFlag).toBeTruthy();
      } else {
        expect(enrollText.toLowerCase()).toContain('enrolled');
      }

      await page.goto(PAGES.myLearning, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        return !!(window.hhIdentity && window.hhIdentity.isAuthenticated && window.hhIdentity.isAuthenticated());
      });

      const enrollmentsResponse = await page.evaluate(async (apiBase) => {
        const identity = window.hhIdentity && window.hhIdentity.get ? window.hhIdentity.get() : null;
        const email = identity && identity.email ? identity.email : '';
        const contactId = identity && identity.contactId ? identity.contactId : '';
        if (!email && !contactId) return null;
        const query = contactId ? `contactId=${encodeURIComponent(contactId)}` : `email=${encodeURIComponent(email)}`;
        const res = await fetch(`${apiBase}/enrollments/list?${query}`, { credentials: 'include' });
        return res.ok ? res.json() : null;
      }, API_BASE_URL);

      expect(enrollmentsResponse).toBeTruthy();
      expect(enrollmentsResponse.mode).toBe('authenticated');
      expect(enrollmentsResponse.enrollments).toBeTruthy();
    });
  });
});
