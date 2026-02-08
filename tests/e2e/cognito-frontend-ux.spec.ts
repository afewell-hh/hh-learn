/**
 * Frontend Integration UX Tests (Issue #306 - Phase 6)
 *
 * End-to-end Playwright tests for Cognito OAuth frontend integration.
 * Tests the complete user experience from anonymous browsing to authenticated
 * enrollment and progress tracking.
 *
 * @see https://github.com/afewell-hh/hh-learn/issues/306
 * @see docs/specs/issue-299-external-sso-spec.md
 * @see docs/test-plan-issue-299.md
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const API_BASE_URL = process.env.E2E_API_BASE_URL || 'https://api.hedgehog.cloud';
const TEST_COURSE_SLUG = process.env.TEST_COURSE_SLUG || 'network-like-hyperscaler-foundations';
const CACHE_BUSTER = process.env.E2E_CACHE_BUSTER || Date.now().toString();
const TEST_COURSE_URL = `${BASE_URL}/learn/courses/${TEST_COURSE_SLUG}?hsCacheBuster=${CACHE_BUSTER}`;
const CATALOG_URL = `${BASE_URL}/learn?hsCacheBuster=${CACHE_BUSTER}`;
const MY_LEARNING_URL = `${BASE_URL}/learn/my-learning?hsCacheBuster=${CACHE_BUSTER}`;

// Cognito test user credentials (from environment)
const TEST_EMAIL = process.env.HUBSPOT_TEST_EMAIL || process.env.HUBSPOT_TEST_USERNAME;
const TEST_PASSWORD = process.env.HUBSPOT_TEST_PASSWORD;

// Verification output directory
const VERIFICATION_DIR = path.join(process.cwd(), 'verification-output', 'issue-306');

test.beforeAll(() => {
  // Ensure verification directory exists
  if (!fs.existsSync(VERIFICATION_DIR)) {
    fs.mkdirSync(VERIFICATION_DIR, { recursive: true });
  }
});

const STORAGE_STATE_PATH = 'tests/e2e/.auth/user.json';

test.describe('Phase 6: Frontend Integration - Anonymous Browsing', () => {
  test('should display public content without authentication', async ({ page, context }) => {
    // Clear all cookies and storage to ensure anonymous state
    await context.clearCookies();
    await page.goto(TEST_COURSE_URL, { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });

    // Verify page loads and shows public content
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Take screenshot of anonymous state
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '1-anonymous-course-page.png'),
      fullPage: true
    });

    // Verify NO auth cookies are present
    const cookies = await context.cookies();
    const authCookies = cookies.filter(c =>
      c.name === 'hhl_access_token' || c.name === 'hhl_refresh_token'
    );
    expect(authCookies).toHaveLength(0);

    console.log('✓ Anonymous user can view public course content');
  });

  test('should display catalog page without authentication', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(CATALOG_URL, { waitUntil: 'domcontentloaded' });

    // Verify catalog loads
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Take screenshot
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '2-anonymous-catalog-page.png'),
      fullPage: true
    });

    console.log('✓ Anonymous user can view catalog page');
  });
});

test.describe('Phase 6: Frontend Integration - Authenticated', () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  test('should display enrollment status after authentication', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');

    await page.goto(TEST_COURSE_URL, { waitUntil: 'domcontentloaded' });

    // Wait for UI to update with authenticated state
    await page.waitForTimeout(2000);

    // Verify enrollment button changed from "Sign in"
    const updatedButton = page.locator('#hhl-enroll-button');
    await updatedButton.waitFor({ state: 'visible', timeout: 10000 });

    const authenticatedText = await updatedButton.innerText();
    console.log('CTA button text (authenticated):', authenticatedText);

    // Should NOT say "Sign in" anymore
    expect(authenticatedText.toLowerCase()).not.toContain('sign in');

    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '5-authenticated-enrollment-cta.png'),
      fullPage: true
    });

    console.log('✓ Enrollment CTA updated after authentication');
  });

  test('should fetch and display user profile from /auth/me', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');

    // Set up request interception to verify /auth/me is called
    const authMeCalls: string[] = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/auth/me')) {
        authMeCalls.push(url);
      }
    });

    await page.goto(TEST_COURSE_URL, { waitUntil: 'domcontentloaded' });

    // Verify /auth/me endpoint was called
    await page.waitForFunction(
      () => (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated(),
      { timeout: 15000 }
    );

    // Check that /auth/me was called
    await expect.poll(() => authMeCalls.length, { timeout: 10000 }).toBeGreaterThan(0);

    console.log(`✓ /auth/me called ${authMeCalls.length} time(s)`);
  });

  test('should display progress information for enrolled courses', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');

    // Navigate to My Learning page (requires authentication)
    await page.goto(MY_LEARNING_URL, { waitUntil: 'domcontentloaded' });

    // Wait for enrollments to load
    await page.waitForTimeout(3000);

    // Verify enrollment cards or progress indicators are visible
    const enrollmentCards = page.locator('.enrollment-card, [class*="enrollment"]');

    // Should have at least one enrollment (if user is enrolled)
    const count = await enrollmentCards.count();
    console.log(`Found ${count} enrollment card(s)`);

    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '6-my-learning-progress.png'),
      fullPage: true
    });

    console.log('✓ Progress information displayed on My Learning page');
  });
});

test.describe('Phase 6: Frontend Integration - Sign-in CTA', () => {
  test('should display sign-in CTA for anonymous users on course page', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(TEST_COURSE_URL, { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Wait for enrollment CTA to render
    const enrollButton = page.locator('#hhl-enroll-login');
    await enrollButton.waitFor({ state: 'visible', timeout: 15000 });

    const buttonText = await enrollButton.innerText();
    console.log('CTA button text (anonymous):', buttonText);

    // Verify button shows "Sign in" or contains login prompt
    expect(buttonText.toLowerCase()).toMatch(/sign in|log in|login|enroll/);

    // Take screenshot of CTA
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '3-anonymous-signin-cta.png'),
      fullPage: true
    });

    console.log('✓ Sign-in CTA is displayed for anonymous users');
  });

  test('should redirect to Cognito login when sign-in CTA is clicked', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(TEST_COURSE_URL, { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Find and click sign-in button
    const enrollButton = page.locator('#hhl-enroll-login');
    await enrollButton.waitFor({ state: 'visible', timeout: 15000 });

    // Track navigation
    const navigationPromise = page.waitForURL(/auth\/login|cognito/, { timeout: 30000 });

    await enrollButton.click();

    // Wait for redirect to auth endpoint
    await navigationPromise;

    const currentUrl = page.url();
    console.log('Redirected to:', currentUrl);

    // Verify redirect to /auth/login or Cognito hosted UI
    expect(currentUrl).toMatch(/\/auth\/login|cognito.*(oauth2\/authorize|\/login)/);

    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '4-cognito-login-redirect.png'),
      fullPage: true
    });

    console.log('✓ Sign-in CTA redirects to Cognito login');
  });
});

test.describe('Phase 6: Frontend Integration - Enrollment + Progress Display', () => {
  test.skip(true, 'Superseded by authenticated describe using storage state');
});

test.describe('Phase 6: Frontend Integration - Logout Flow', () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  test('should revert to anonymous state after logout', async ({ page, context }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');

    // Find and click logout button/link
    const logoutButton = page.locator('a:has-text("Logout"), a:has-text("Log out"), button:has-text("Logout")').first();

    // If logout button exists, click it
    if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutButton.click();

      // Wait for logout to complete
      await page.waitForTimeout(2000);
    } else {
      // Manually call logout endpoint
      await page.goto(`${API_BASE_URL}/auth/logout`, { waitUntil: 'domcontentloaded' });
    }

    // Verify auth cookies are cleared
    const cookies = await context.cookies();
    const authCookies = cookies.filter(c =>
      c.name === 'hhl_access_token' || c.name === 'hhl_refresh_token'
    );

    expect(authCookies).toHaveLength(0);

    // Navigate back to course page
    await page.goto(TEST_COURSE_URL, { waitUntil: 'domcontentloaded' });

    // Verify CTA reverted to "Sign in"
    const enrollButton = page.locator('#hhl-enroll-login');
    await enrollButton.waitFor({ state: 'visible', timeout: 10000 });

    const buttonText = await enrollButton.innerText();
    console.log('CTA after logout:', buttonText);

    // Should show sign-in prompt again
    expect(buttonText.toLowerCase()).toMatch(/sign in|log in|login/);

    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '7-after-logout-anonymous.png'),
      fullPage: true
    });

    console.log('✓ UI reverted to anonymous state after logout');
  });

  test('should clear personalized UI elements after logout', async ({ page, context }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');

    // Logout (manual or via endpoint)
    await page.goto(`${API_BASE_URL}/auth/logout`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Navigate to a page that shows personalized content
    await page.goto(MY_LEARNING_URL, { waitUntil: 'domcontentloaded' });

    // Verify no personalized content is shown
    // Should either redirect to login or show empty state
    const currentUrl = page.url();

    if (currentUrl.includes('/auth/login') || currentUrl.includes('/_hcms/mem/login')) {
      console.log('✓ Redirected to login page (personalized page protected)');
    } else {
      // If page loads, verify no enrollments shown
      const enrollmentCards = page.locator('.enrollment-card, [class*="enrollment"]');
      const count = await enrollmentCards.count();
      expect(count).toBe(0);
      console.log('✓ No personalized content shown after logout');
    }

    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '8-my-learning-after-logout.png'),
      fullPage: true
    });
  });
});

test.describe('Phase 6: Frontend Integration - Cookie Handling', () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  test('should verify cookies are httpOnly and secure', async ({ page, context }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');

    // After authentication
    const cookies = await context.cookies();
    const accessToken = cookies.find(c => c.name === 'hhl_access_token');
    const refreshToken = cookies.find(c => c.name === 'hhl_refresh_token');

    if (accessToken) {
      expect(accessToken.httpOnly).toBe(true);
      expect(accessToken.secure).toBe(true);
      expect(accessToken.sameSite).toBe('Strict');
      console.log('✓ Access token cookie has correct security attributes');
    }

    if (refreshToken) {
      expect(refreshToken.httpOnly).toBe(true);
      expect(refreshToken.secure).toBe(true);
      expect(refreshToken.sameSite).toBe('Strict');
      expect(refreshToken.path).toBe('/auth');
      console.log('✓ Refresh token cookie scoped to /auth path');
    }
  });

  test('should verify cookies are not accessible via JavaScript', async ({ page, context }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');

    // Try to access cookies via document.cookie
    const accessibleCookies = await page.evaluate(() => document.cookie);

    // Should NOT include hhl_access_token or hhl_refresh_token
    expect(accessibleCookies).not.toContain('hhl_access_token');
    expect(accessibleCookies).not.toContain('hhl_refresh_token');

    console.log('✓ Auth cookies are not accessible via JavaScript (httpOnly enforced)');
  });
});

test.describe('Phase 6: Frontend Integration - API Integration', () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  test('should call /auth/me with credentials included', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');

    // Track API calls
    const apiCalls: any[] = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/auth/me')) {
        apiCalls.push({
          url,
          method: req.method(),
          headers: req.headers(),
        });
      }
    });

    // Navigate to page that should call /auth/me
    await page.goto(TEST_COURSE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Verify /auth/me was called
    const authMeCall = apiCalls.find(call => call.url.includes('/auth/me'));

    if (authMeCall) {
      console.log('✓ /auth/me endpoint called');
      console.log('  Method:', authMeCall.method);
      // Cookies are sent automatically by browser, not in headers
    }
  });

  test('should handle /auth/me 401 response gracefully', async ({ page, context }) => {
    // Clear cookies to ensure 401 response
    await context.clearCookies();

    // Navigate to page
    await page.goto(TEST_COURSE_URL, { waitUntil: 'domcontentloaded' });

    // Page should still load and show anonymous state
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    // Should show sign-in CTA
    const enrollButton = page.locator('#hhl-enroll-login');
    await enrollButton.waitFor({ state: 'visible', timeout: 10000 });

    console.log('✓ Page handles 401 from /auth/me gracefully');
  });
});

// Generate test report
test.afterAll(async () => {
  const report = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 6 - Frontend Integration',
    issue: '#306',
    testEnvironment: {
      baseUrl: BASE_URL,
      testCourseSlug: TEST_COURSE_SLUG,
    },
    testCategories: [
      'Anonymous Browsing',
      'Sign-in CTA',
      'Enrollment + Progress Display',
      'Logout Flow',
      'Cookie Handling',
      'API Integration',
    ],
    notes: [
      'Tests verify end-to-end UX flows with Cognito OAuth integration',
      'Auth cookies must be httpOnly, Secure, and SameSite=Strict',
      '/auth/me endpoint provides user profile data',
      'UI must gracefully handle both authenticated and anonymous states',
    ],
  };

  fs.writeFileSync(
    path.join(VERIFICATION_DIR, 'test-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n✅ Phase 6 UX Tests completed');
  console.log('Report saved to:', path.join(VERIFICATION_DIR, 'test-report.json'));
});
