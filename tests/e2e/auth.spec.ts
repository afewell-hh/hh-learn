import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';

test.describe('Auth links and redirects', () => {
  test('Anonymous courses list shows Register/Sign In with redirect_url', async ({ page }) => {
    const url = `${BASE}/learn/courses?debug=1`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Register link present
    const register = page.locator('a.learn-auth-link', { hasText: 'Register' });
    await expect(register).toHaveCount(1);

    // Sign In link has redirect_url back to full path+query
    const signin = page.locator('a.learn-auth-link', { hasText: 'Sign In' }).first();
    const href = await signin.getAttribute('href');
    expect(href).toBeTruthy();
    // Support both legacy HubSpot membership login and new /auth/login
    const hasLegacyLogin = href!.includes('/_hcms/mem/login');
    const hasNewAuthLogin = href!.includes('/auth/login');
    expect(hasLegacyLogin || hasNewAuthLogin, 'Should contain either legacy or JWT login URL').toBeTruthy();
    expect(href!).toContain('redirect_url=');
    // Check if target path is in redirect_url (may be single or double-encoded via auth-handshake)
    const targetPath = '/learn/courses?debug=1';
    const singleEncoded = encodeURIComponent(targetPath);
    const doubleEncoded = encodeURIComponent(encodeURIComponent(targetPath));
    const hasTargetPath = href!.includes(singleEncoded) || href!.includes(doubleEncoded);
    expect(hasTargetPath, 'Should contain target path in redirect_url').toBeTruthy();
  });

  test('Anonymous My Learning redirects to login with redirect_url', async ({ page }) => {
    await page.goto(`${BASE}/learn/my-learning`, { waitUntil: 'domcontentloaded' });
    // Allow meta refresh to trigger, if used
    await page.waitForTimeout(2000);
    const cur = page.url();
    // Support both legacy HubSpot membership login and new /auth/login
    const redirectedToLegacy = cur.includes('/_hcms/mem/login');
    const redirectedToJWT = cur.includes('/auth/login');
    const targetPath = '/learn/my-learning';
    const singleEncoded = encodeURIComponent(targetPath);
    const doubleEncoded = encodeURIComponent(encodeURIComponent(targetPath));

    if (!redirectedToLegacy && !redirectedToJWT) {
      // Fallback: check meta refresh content
      const meta = await page.locator('meta[http-equiv="refresh"]').first();
      const content = (await meta.count()) ? await meta.getAttribute('content') : '';
      const hasLegacyInMeta = content && content.includes('/_hcms/mem/login');
      const hasJWTInMeta = content && content.includes('/auth/login');
      expect(hasLegacyInMeta || hasJWTInMeta, 'Should redirect to either legacy or JWT login').toBeTruthy();
      const hasTargetPath = content && (content.includes(singleEncoded) || content.includes(doubleEncoded));
      expect(hasTargetPath, 'Should contain target path in meta refresh').toBeTruthy();
    } else {
      expect(cur).toContain('redirect_url=');
      const hasTargetPath = cur.includes(singleEncoded) || cur.includes(doubleEncoded);
      expect(hasTargetPath, 'Should contain target path in redirect URL').toBeTruthy();
    }
  });

  test.skip('Logout preserves return and redirects back after login (fixture needed)', async () => {
    // TODO: Implement using a safe fixture account once available.
    // Steps:
    // 1) Log in, land on page, click Sign Out (should include redirect_url)
    // 2) After logout, ensure redirect back to original page
  });
});

