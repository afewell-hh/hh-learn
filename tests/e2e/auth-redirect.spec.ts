import { test, expect } from '@playwright/test';

test('Anonymous users get authentication prompt for My Learning', async ({ page }) => {
  // Template fix deployed: my-learning.html now uses configured login_url variable (Issue #258, deployed via Issue #260)
  await page.goto('https://hedgehog.cloud/learn/my-learning', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // My Learning may show auth UI on the page or redirect to login
  // Check multiple authentication indicators:
  const url = page.url();

  // 1. Check for redirect to login pages
  const redirectedToLegacy = url.includes('/_hcms/mem/login');
  const redirectedToJWT = url.includes('/auth/login');

  // 2. Check for meta refresh redirect
  const meta = await page.locator('meta[http-equiv="refresh"]').first();
  const content = (await meta.count()) ? await meta.getAttribute('content') : '';
  const hasLegacyMeta = !!content && /\/_hcms\/mem\/login\?redirect_url=/.test(content);
  const hasJWTMeta = !!content && /\/auth\/login\?redirect_url=/.test(content);

  // 3. Check for auth UI elements on the page itself
  const hasSignInLink = (await page.locator('a:has-text("Sign in"), a:has-text("Sign In"), a:has-text("Login")').count()) > 0;
  const hasLoginButton = (await page.locator('button:has-text("Sign in"), button:has-text("Sign In"), button:has-text("Login")').count()) > 0;

  // At least one authentication mechanism should be present
  const hasAuth = redirectedToLegacy || redirectedToJWT || hasLegacyMeta || hasJWTMeta || hasSignInLink || hasLoginButton;

  expect(hasAuth, 'Anonymous users should see authentication prompt or redirect').toBeTruthy();
});

