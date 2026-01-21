import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const STORAGE_STATE_PATH = 'tests/e2e/.auth/user.json';

test.describe('Issue #320 Regressions', () => {

  test.describe('Regression 1: Catalog Tag Overflow', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE}/learn/catalog`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#catalog-grid', { timeout: 10000 });
    });

    test('catalog card tags should not overflow card bounds', async ({ page }) => {
      // Wait for catalog cards to load
      const catalogCards = page.locator('.catalog-card');
      await expect(catalogCards.first()).toBeVisible();

      // Get all catalog cards
      const cardCount = await catalogCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Check each card for overflow
      for (let i = 0; i < Math.min(cardCount, 10); i++) {
        const card = catalogCards.nth(i);
        const metaContainer = card.locator('.catalog-card-meta');

        if (await metaContainer.count() > 0) {
          // Get bounding boxes
          const cardBox = await card.boundingBox();
          const metaBox = await metaContainer.boundingBox();

          // Both should exist
          expect(cardBox).not.toBeNull();
          expect(metaBox).not.toBeNull();

          if (cardBox && metaBox) {
            // Meta container should not exceed card width
            const cardRight = cardBox.x + cardBox.width;
            const metaRight = metaBox.x + metaBox.width;

            // Allow for small rounding errors (1px tolerance)
            expect(metaRight).toBeLessThanOrEqual(cardRight + 1);

            // Meta container left edge should not be before card left edge
            expect(metaBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
          }
        }
      }
    });

    test('catalog card meta items should have proper overflow styling', async ({ page }) => {
      const metaItems = page.locator('.catalog-meta-item');
      await expect(metaItems.first()).toBeVisible();

      // Check CSS properties on first meta item
      const firstItem = metaItems.first();

      // Verify overflow-wrap is set
      const overflowWrap = await firstItem.evaluate((el) =>
        window.getComputedStyle(el).overflowWrap
      );
      expect(overflowWrap).toBe('break-word');

      // Verify word-break is set
      const wordBreak = await firstItem.evaluate((el) =>
        window.getComputedStyle(el).wordBreak
      );
      expect(wordBreak).toBe('break-word');
    });

    test('catalog cards should be responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${BASE}/learn/catalog`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#catalog-grid', { timeout: 10000 });

      // Check first few cards
      const catalogCards = page.locator('.catalog-card');
      const cardCount = await catalogCards.count();

      for (let i = 0; i < Math.min(cardCount, 5); i++) {
        const card = catalogCards.nth(i);
        const metaContainer = card.locator('.catalog-card-meta');

        if (await metaContainer.count() > 0) {
          const cardBox = await card.boundingBox();
          const metaBox = await metaContainer.boundingBox();

          if (cardBox && metaBox) {
            const cardRight = cardBox.x + cardBox.width;
            const metaRight = metaBox.x + metaBox.width;

            // Tags should not overflow on mobile either
            expect(metaRight).toBeLessThanOrEqual(cardRight + 1);
          }
        }
      }
    });
  });

  test.describe('Regression 2: Left Nav Auth State on Index Pages', () => {

    test.describe('Authenticated User State', () => {
      test.use({ storageState: STORAGE_STATE_PATH });

      test('modules index should show Sign Out for authenticated users', async ({ page }) => {
        await page.goto(`${BASE}/learn/modules`, { waitUntil: 'domcontentloaded' });

        // Wait for auth integration to run
        await page.waitForTimeout(1500);

        // Check that Sign Out link is visible
        const signOutLink = page.locator('.learn-auth-link:has-text("Sign Out")');
        await expect(signOutLink).toBeVisible();

        // Check that Sign In and Register are hidden
        const signInLink = page.locator('.learn-auth-link:has-text("Sign In")');
        const registerLink = page.locator('.learn-auth-link:has-text("Register")');
        await expect(signInLink).toBeHidden();
        await expect(registerLink).toBeHidden();

        // Verify authenticated state container is visible
        const authStateAuth = page.locator('[data-auth-state="authenticated"]');
        await expect(authStateAuth).toBeVisible();

        // Verify anonymous state container is hidden
        const authStateAnon = page.locator('[data-auth-state="anonymous"]');
        await expect(authStateAnon).toBeHidden();
      });

      test('courses index should show Sign Out for authenticated users', async ({ page }) => {
        await page.goto(`${BASE}/learn/courses`, { waitUntil: 'domcontentloaded' });

        // Wait for auth integration to run
        await page.waitForTimeout(1500);

        // Check that Sign Out link is visible
        const signOutLink = page.locator('.learn-auth-link:has-text("Sign Out")');
        await expect(signOutLink).toBeVisible();

        // Check that Sign In and Register are hidden
        const signInLink = page.locator('.learn-auth-link:has-text("Sign In")');
        const registerLink = page.locator('.learn-auth-link:has-text("Register")');
        await expect(signInLink).toBeHidden();
        await expect(registerLink).toBeHidden();
      });

      test('pathways index should show Sign Out for authenticated users', async ({ page }) => {
        await page.goto(`${BASE}/learn/pathways`, { waitUntil: 'domcontentloaded' });

        // Wait for auth integration to run
        await page.waitForTimeout(1500);

        // Check that Sign Out link is visible
        const signOutLink = page.locator('.learn-auth-link:has-text("Sign Out")');
        await expect(signOutLink).toBeVisible();

        // Check that Sign In and Register are hidden
        const signInLink = page.locator('.learn-auth-link:has-text("Sign In")');
        const registerLink = page.locator('.learn-auth-link:has-text("Register")');
        await expect(signInLink).toBeHidden();
        await expect(registerLink).toBeHidden();
      });

      test('catalog should show Sign Out for authenticated users (control test)', async ({ page }) => {
        await page.goto(`${BASE}/learn/catalog`, { waitUntil: 'domcontentloaded' });

        // Wait for auth integration to run
        await page.waitForTimeout(1500);

        // Check that Sign Out link is visible
        const signOutLink = page.locator('.learn-auth-link:has-text("Sign Out")');
        await expect(signOutLink).toBeVisible();
      });

      test('My Learning should show Sign Out for authenticated users (control test)', async ({ page }) => {
        await page.goto(`${BASE}/learn/my-learning`, { waitUntil: 'domcontentloaded' });

        // Wait for auth integration to run
        await page.waitForTimeout(1500);

        // Check that Sign Out link is visible
        const signOutLink = page.locator('.learn-auth-link:has-text("Sign Out")');
        await expect(signOutLink).toBeVisible();
      });
    });

    test.describe('Anonymous User State', () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test('modules index should show Sign In and Register for anonymous users', async ({ page }) => {
        await page.goto(`${BASE}/learn/modules`, { waitUntil: 'domcontentloaded' });

        // Wait for auth integration to run
        await page.waitForTimeout(1500);

        // Check that Sign In and Register are visible
        const signInLink = page.locator('.learn-auth-link:has-text("Sign In")');
        const registerLink = page.locator('.learn-auth-link:has-text("Register")');
        await expect(signInLink).toBeVisible();
        await expect(registerLink).toBeVisible();

        // Check that Sign Out is hidden
        const signOutLink = page.locator('.learn-auth-link:has-text("Sign Out")');
        await expect(signOutLink).toBeHidden();
      });

      test('courses index should show Sign In and Register for anonymous users', async ({ page }) => {
        await page.goto(`${BASE}/learn/courses`, { waitUntil: 'domcontentloaded' });

        // Wait for auth integration to run
        await page.waitForTimeout(1500);

        // Check that Sign In and Register are visible
        const signInLink = page.locator('.learn-auth-link:has-text("Sign In")');
        const registerLink = page.locator('.learn-auth-link:has-text("Register")');
        await expect(signInLink).toBeVisible();
        await expect(registerLink).toBeVisible();

        // Check that Sign Out is hidden
        const signOutLink = page.locator('.learn-auth-link:has-text("Sign Out")');
        await expect(signOutLink).toBeHidden();
      });

      test('pathways index should show Sign In and Register for anonymous users', async ({ page }) => {
        await page.goto(`${BASE}/learn/pathways`, { waitUntil: 'domcontentloaded' });

        // Wait for auth integration to run
        await page.waitForTimeout(1500);

        // Check that Sign In and Register are visible
        const signInLink = page.locator('.learn-auth-link:has-text("Sign In")');
        const registerLink = page.locator('.learn-auth-link:has-text("Register")');
        await expect(signInLink).toBeVisible();
        await expect(registerLink).toBeVisible();

        // Check that Sign Out is hidden
        const signOutLink = page.locator('.learn-auth-link:has-text("Sign Out")');
        await expect(signOutLink).toBeHidden();
      });
    });

    test.describe('Auth Integration Script Loaded', () => {
      test('modules index should load cognito-auth-integration script', async ({ page }) => {
        await page.goto(`${BASE}/learn/modules`, { waitUntil: 'domcontentloaded' });

        // Check that auth context div exists
        const authContext = page.locator('#hhl-auth-context');
        await expect(authContext).toBeAttached();

        // Verify auth context has required data attributes
        await expect(authContext).toHaveAttribute('data-auth-me-url');
        await expect(authContext).toHaveAttribute('data-auth-login-url');
        await expect(authContext).toHaveAttribute('data-auth-logout-url');
      });

      test('courses index should load cognito-auth-integration script', async ({ page }) => {
        await page.goto(`${BASE}/learn/courses`, { waitUntil: 'domcontentloaded' });

        // Check that auth context div exists
        const authContext = page.locator('#hhl-auth-context');
        await expect(authContext).toBeAttached();

        // Verify auth context has required data attributes
        await expect(authContext).toHaveAttribute('data-auth-me-url');
        await expect(authContext).toHaveAttribute('data-auth-login-url');
        await expect(authContext).toHaveAttribute('data-auth-logout-url');
      });

      test('pathways index should load cognito-auth-integration script', async ({ page }) => {
        await page.goto(`${BASE}/learn/pathways`, { waitUntil: 'domcontentloaded' });

        // Check that auth context div exists
        const authContext = page.locator('#hhl-auth-context');
        await expect(authContext).toBeAttached();

        // Verify auth context has required data attributes
        await expect(authContext).toHaveAttribute('data-auth-me-url');
        await expect(authContext).toHaveAttribute('data-auth-login-url');
        await expect(authContext).toHaveAttribute('data-auth-logout-url');
      });
    });
  });
});
