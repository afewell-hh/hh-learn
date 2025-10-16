import { test, expect } from '@playwright/test';

test('Anonymous users get membership login redirect for My Learning', async ({ page }) => {
  await page.goto('https://hedgehog.cloud/learn/my-learning', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const redirected = page.url().includes('/_hcms/mem/login');
  const meta = await page.locator('meta[http-equiv="refresh"]').first();
  const content = (await meta.count()) ? await meta.getAttribute('content') : '';
  const hasMeta = !!content && /\/_hcms\/mem\/login\?redirect_url=/.test(content);
  expect(redirected || hasMeta).toBeTruthy();
});

