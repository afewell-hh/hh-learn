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
    expect(href!).toContain('/_hcms/mem/login');
    expect(href!).toContain('redirect_url=');
    // encoded current path+query should be present
    const encoded = encodeURIComponent('/learn/courses?debug=1');
    expect(href!).toContain(encoded);
  });

  test('Anonymous My Learning redirects to login with redirect_url', async ({ page }) => {
    await page.goto(`${BASE}/learn/my-learning`, { waitUntil: 'domcontentloaded' });
    // Allow meta refresh to trigger, if used
    await page.waitForTimeout(1500);
    const cur = page.url();
    const redirected = cur.includes('/_hcms/mem/login');
    if (!redirected) {
      // Fallback: check meta refresh content
      const meta = await page.locator('meta[http-equiv="refresh"]').first();
      const content = (await meta.count()) ? await meta.getAttribute('content') : '';
      expect(content && content.includes('/_hcms/mem/login')).toBeTruthy();
      expect(content).toContain(encodeURIComponent('/learn/my-learning'));
    } else {
      expect(cur).toContain('redirect_url=');
      expect(cur).toContain(encodeURIComponent('/learn/my-learning'));
    }
  });

  test.skip('Logout preserves return and redirects back after login (fixture needed)', async () => {
    // TODO: Implement using a safe fixture account once available.
    // Steps:
    // 1) Log in, land on page, click Sign Out (should include redirect_url)
    // 2) After logout, ensure redirect back to original page
  });
});

