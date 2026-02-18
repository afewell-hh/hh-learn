import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const API_BASE_URL = process.env.E2E_API_BASE_URL || 'https://api.hedgehog.cloud';
const CACHE_BUSTER = process.env.E2E_CACHE_BUSTER || Date.now().toString();

const TEST_COURSE_SLUG = process.env.TEST_COURSE_SLUG || 'network-like-hyperscaler-foundations';
const TEST_PATHWAY_SLUG = process.env.TEST_PATHWAY_SLUG || 'network-like-hyperscaler';
const TEST_MODULE_SLUG = process.env.TEST_MODULE_SLUG || 'fabric-operations-welcome';

const STORAGE_STATE_PATH = path.join(process.cwd(), 'tests', 'e2e', '.auth', 'user.json');
const HAS_STORAGE_STATE = fs.existsSync(STORAGE_STATE_PATH);
const HAS_AUTH_CREDS = !!(process.env.HUBSPOT_TEST_EMAIL || process.env.HUBSPOT_TEST_USERNAME) && !!process.env.HUBSPOT_TEST_PASSWORD;

const PAGES = {
  catalog: `${BASE_URL}/learn/catalog?hsCacheBuster=${CACHE_BUSTER}`,
  coursesList: `${BASE_URL}/learn/courses?hsCacheBuster=${CACHE_BUSTER}`,
  pathwaysList: `${BASE_URL}/learn/pathways?hsCacheBuster=${CACHE_BUSTER}`,
  courseDetail: `${BASE_URL}/learn/courses/${TEST_COURSE_SLUG}?hsCacheBuster=${CACHE_BUSTER}`,
  pathwayDetail: `${BASE_URL}/learn/pathways/${TEST_PATHWAY_SLUG}?hsCacheBuster=${CACHE_BUSTER}`,
  moduleDetail: `${BASE_URL}/learn/modules/${TEST_MODULE_SLUG}?hsCacheBuster=${CACHE_BUSTER}`,
  myLearning: `${BASE_URL}/learn/my-learning?hsCacheBuster=${CACHE_BUSTER}`,
  actionRunnerProgress: `${BASE_URL}/learn/action-runner?action=record_progress&module_slug=${TEST_MODULE_SLUG}&status=started&redirect_url=${encodeURIComponent(`${BASE_URL}/learn/modules/${TEST_MODULE_SLUG}`)}`
};

function requireAuth(testName: string): boolean {
  if (!HAS_AUTH_CREDS || !HAS_STORAGE_STATE) {
    test.skip(true, testName + ' requires HUBSPOT_TEST_* creds and storage state');
    return false;
  }
  return true;
}


// ============================================================================
// Canonical auth URLs
// ============================================================================

test('auth URLs should use canonical domain (not API Gateway)', async ({ page }) => {
  await page.goto(PAGES.catalog, { waitUntil: 'domcontentloaded' });

  const authContext = await page.evaluate(() => {
    const ctx = document.getElementById('hhl-auth-context');
    if (!ctx) return null;
    return {
      authLogin: ctx.getAttribute('data-auth-login-url'),
      authLogout: ctx.getAttribute('data-auth-logout-url'),
      authMe: ctx.getAttribute('data-auth-me-url')
    };
  });

  expect(authContext).toBeTruthy();
  expect(authContext?.authLogin).toContain('https://api.hedgehog.cloud');
  expect(authContext?.authLogout).toContain('https://api.hedgehog.cloud');
  expect(authContext?.authMe).toContain('https://api.hedgehog.cloud');

  const pageHtml = await page.content();
  expect(pageHtml).not.toContain('execute-api.us-west-2.amazonaws.com');
});

// ============================================================================
// Auth state persistence across navigation
// ============================================================================

test.describe('authenticated auth state persistence', () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  test('auth state persists across navigation', async ({ page }) => {
    if (!requireAuth('authenticated test')) return;

    await page.goto(PAGES.courseDetail, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as any).hhIdentity?.isAuthenticated?.(), { timeout: 15000 });

    await page.goto(PAGES.catalog, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as any).hhIdentity?.isAuthenticated?.(), { timeout: 15000 });

    const isAuthenticated = await page.evaluate(() => (window as any).hhIdentity?.isAuthenticated?.());
    expect(isAuthenticated).toBe(true);
  });
});

// ============================================================================
// Enrollment CTA rendering after auth
// ============================================================================

test.describe('authenticated enrollment CTA', () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  test('enroll button renders after auth', async ({ page }) => {
    if (!requireAuth('authenticated test')) return;

    await page.goto(PAGES.courseDetail, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as any).hhIdentity?.isAuthenticated?.(), { timeout: 15000 });

    const enrollButton = page.locator('#hhl-enroll-button');
    await expect(enrollButton).toBeVisible({ timeout: 15000 });

    const loginLink = page.locator('#hhl-enroll-login');
    await expect(loginLink).toBeHidden({ timeout: 5000 });
  });

  test('enrollment state persists after refresh (local cache)', async ({ page }) => {
    if (!requireAuth('authenticated test')) return;

    await page.goto(PAGES.courseDetail, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window as any).hhIdentity?.isAuthenticated?.(), { timeout: 15000 });

    await page.evaluate((slug) => {
      const key = `hh-enrollment-course-${slug}`;
      localStorage.setItem(key, JSON.stringify({ enrolled: true, enrolled_at: new Date().toISOString() }));
    }, TEST_COURSE_SLUG);

    await page.reload({ waitUntil: 'domcontentloaded' });

    const enrollButton = page.locator('#hhl-enroll-button');
    await expect(enrollButton).toBeVisible({ timeout: 15000 });
    await expect(enrollButton).toContainText('Enrolled', { timeout: 15000 });
  });
});

// ============================================================================
// Cookie-based auth checks on API calls
// ============================================================================

test.describe('cookie-based auth on API calls', () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  test('progress tracking uses cookies (no Authorization header)', async ({ page }) => {
    if (!requireAuth('authenticated test')) return;

    const requests: Array<{ url: string; headers: Record<string, string> }> = [];

    page.on('request', (req) => {
      if (req.url().includes('/events/track')) {
        requests.push({ url: req.url(), headers: req.headers() });
      }
    });

    await page.goto(PAGES.actionRunnerProgress, { waitUntil: 'domcontentloaded' });

    await page.waitForTimeout(5000);

    expect(requests.length).toBeGreaterThan(0);
    const trackRequest = requests[0];

    const cookieHeader = trackRequest.headers['cookie'] || trackRequest.headers['Cookie'];
    const authHeader = trackRequest.headers['authorization'] || trackRequest.headers['Authorization'];

    expect(cookieHeader).toBeTruthy();
    expect(authHeader).toBeFalsy();
  });

  test('my learning requests include cookies', async ({ page }) => {
    if (!requireAuth('authenticated test')) return;

    let enrollmentsRequest: { headers: Record<string, string> } | null = null;

    page.on('request', (req) => {
      if (req.url().includes('/enrollments/list')) {
        enrollmentsRequest = { headers: req.headers() };
      }
    });

    await page.goto(PAGES.myLearning, { waitUntil: 'domcontentloaded' });

    await page.waitForTimeout(5000);

    expect(enrollmentsRequest).toBeTruthy();
    const headers = enrollmentsRequest?.headers || {};
    const cookieHeader = headers['cookie'] || headers['Cookie'];
    const authHeader = headers['authorization'] || headers['Authorization'];

    expect(cookieHeader).toBeTruthy();
    expect(authHeader).toBeFalsy();
  });
});

// ============================================================================
// API base usage by client scripts
// ============================================================================

test('client API usage should prefer canonical API base', async ({ page }) => {
  await page.goto(PAGES.pathwayDetail, { waitUntil: 'domcontentloaded' });

  const apiUrls = await page.evaluate(() => {
    const ctx = document.getElementById('hhl-auth-context');
    if (!ctx) return [];
    return [
      ctx.getAttribute('data-auth-login-url') || '',
      ctx.getAttribute('data-auth-logout-url') || '',
      ctx.getAttribute('data-auth-me-url') || ''
    ];
  });

  for (const url of apiUrls) {
    expect(url).toContain('https://api.hedgehog.cloud');
    expect(url).not.toContain('execute-api');
  }
});
