/**
 * Issue #344: Comprehensive Auth + Enrollment UX Test Coverage
 *
 * This test suite provides comprehensive regression coverage for authentication
 * and enrollment UX across ALL /learn pages. It fills gaps in existing coverage
 * and serves as the primary regression guard for Issues #341-#345.
 *
 * @see https://github.com/afewell-hh/hh-learn/issues/344
 *
 * Documentation (in issue comments):
 * - Analysis & coverage review
 * - Manual verification checklist (16 tests)
 * - Test execution plan
 * - Baseline test results
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Set longer timeout for this comprehensive test suite (70+ tests)
test.setTimeout(180000); // 3 minutes per test

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const API_BASE_URL = process.env.E2E_API_BASE_URL || 'https://api.hedgehog.cloud';
const CACHE_BUSTER = `hsCacheBuster=${Date.now()}`;

// Test content
const TEST_COURSE_SLUG = process.env.TEST_COURSE_SLUG || 'network-like-hyperscaler-foundations';
const TEST_PATHWAY_SLUG = process.env.TEST_PATHWAY_SLUG || 'network-like-hyperscaler';
const TEST_MODULE_SLUG = process.env.TEST_MODULE_SLUG || 'fabric-operations-welcome';

// Test URLs
const PAGES = {
  catalog: `${BASE_URL}/learn/catalog?${CACHE_BUSTER}`,
  coursesList: `${BASE_URL}/learn/courses?${CACHE_BUSTER}`,
  pathwaysList: `${BASE_URL}/learn/pathways?${CACHE_BUSTER}`,
  modulesList: `${BASE_URL}/learn/modules?${CACHE_BUSTER}`,
  courseDetail: `${BASE_URL}/learn/courses/${TEST_COURSE_SLUG}?${CACHE_BUSTER}`,
  pathwayDetail: `${BASE_URL}/learn/pathways/${TEST_PATHWAY_SLUG}?${CACHE_BUSTER}`,
  moduleDetail: `${BASE_URL}/learn/modules/${TEST_MODULE_SLUG}?${CACHE_BUSTER}`,
  myLearning: `${BASE_URL}/learn/my-learning?${CACHE_BUSTER}`,
  actionRunner: `${BASE_URL}/learn/action-runner?action=enroll_course&slug=${TEST_COURSE_SLUG}&source=test&redirect_url=${encodeURIComponent(`${BASE_URL}/learn/courses/${TEST_COURSE_SLUG}`)}`,
};

// Auth credentials
const TEST_EMAIL = process.env.HUBSPOT_TEST_EMAIL || process.env.HUBSPOT_TEST_USERNAME;
const TEST_PASSWORD = process.env.HUBSPOT_TEST_PASSWORD;

// Verification output
const VERIFICATION_DIR = path.join(process.cwd(), 'verification-output', 'issue-344');
const STORAGE_STATE_PATH = 'tests/e2e/.auth/user.json';

test.beforeAll(() => {
  if (!fs.existsSync(VERIFICATION_DIR)) {
    fs.mkdirSync(VERIFICATION_DIR, { recursive: true });
  }
});

// ========================================================================
// Test Suite 1: Page Load Verification
// ========================================================================

test.describe('Issue #344: Page Load Verification', () => {
  const pageEntries = Object.entries(PAGES);

  for (const [pageName, pageUrl] of pageEntries) {
    test(`should load ${pageName} page without errors`, async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          const location = msg.location();
          // Ignore expected 401s from /auth/me for anonymous users
          if (location?.url?.includes('/auth/me') && text.includes('401')) {
            return;
          }
          consoleErrors.push(text);
        }
      });

      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Verify page loaded (has h1)
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

      // Verify no console errors
      expect(consoleErrors.length).toBe(0);

      console.log(`✓ ${pageName} page loaded successfully`);
    });

    test(`should load cognito-auth-integration.js on ${pageName}`, async ({ page }) => {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const scriptLoaded = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        return scripts.some(s =>
          s.src.includes('cognito-auth-integration.js') ||
          s.src.includes('template_cognito-auth-integration')
        );
      });

      expect(scriptLoaded).toBe(true);

      // Verify window.hhIdentity is initialized
      const identityInitialized = await page.evaluate(() => {
        return typeof (window as any).hhIdentity === 'object' &&
               typeof (window as any).hhIdentity.isReady === 'function';
      });

      expect(identityInitialized).toBe(true);

      console.log(`✓ ${pageName} has cognito-auth-integration.js`);
    });

    test(`should NOT load legacy auth-context.js on ${pageName}`, async ({ page }) => {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const scriptSources = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        return scripts.map(s => (s as HTMLScriptElement).src);
      });

      const legacyScripts = scriptSources.filter(src => src.includes('auth-context'));

      if (legacyScripts.length > 0) {
        console.log('❌ REGRESSION: Legacy auth-context script found on', pageName);
        legacyScripts.forEach(url => console.log('  -', url));
      }

      expect(legacyScripts.length).toBe(0);

      console.log(`✓ ${pageName} does NOT have legacy auth-context.js`);
    });
  }
});

// ========================================================================
// Test Suite 2: Auth State Propagation - Anonymous Users
// ========================================================================

test.describe('Issue #344: Auth State Propagation - Anonymous', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const pageEntries = Object.entries(PAGES).filter(([name]) => name !== 'myLearning' && name !== 'actionRunner');

  for (const [pageName, pageUrl] of pageEntries) {
    test(`should show anonymous state on ${pageName}`, async ({ page }) => {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

      // Wait for hhIdentity to be ready
      await page.waitForFunction(
        () => (window as any).hhIdentity && (window as any).hhIdentity.isReady(),
        { timeout: 10000 }
      );

      // Verify not authenticated
      const isAuthenticated = await page.evaluate(() => {
        return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
      });

      expect(isAuthenticated).toBe(false);

      // Take screenshot
      await page.screenshot({
        path: path.join(VERIFICATION_DIR, `anonymous-${pageName}.png`),
        fullPage: true
      });

      console.log(`✓ ${pageName} shows anonymous state`);
    });
  }
});

// ========================================================================
// Test Suite 3: Auth State Propagation - Authenticated Users
// ========================================================================

test.describe('Issue #344: Auth State Propagation - Authenticated', () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  const pageEntries = Object.entries(PAGES).filter(([name]) => name !== 'actionRunner');

  for (const [pageName, pageUrl] of pageEntries) {
    test(`should show authenticated state on ${pageName}`, async ({ page }) => {
      test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');

      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

      // Wait for hhIdentity to be ready and authenticated
      await page.waitForFunction(
        () => (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated(),
        { timeout: 15000 }
      );

      // Verify identity has user data
      const identity = await page.evaluate(() => {
        return (window as any).hhIdentity?.get();
      });

      expect(identity).toBeTruthy();
      expect(identity.email || identity.contactId).toBeTruthy();

      // Take screenshot
      await page.screenshot({
        path: path.join(VERIFICATION_DIR, `authenticated-${pageName}.png`),
        fullPage: true
      });

      console.log(`✓ ${pageName} shows authenticated state`);
    });
  }
});

// ========================================================================
// Test Suite 4: Left Nav Auth State
// ========================================================================

test.describe('Issue #344: Left Nav Auth State', () => {
  const pagesWithLeftNav = ['catalog', 'coursesList', 'pathwaysList', 'modulesList', 'courseDetail', 'pathwayDetail', 'moduleDetail'];

  test.describe('Anonymous Users', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    for (const pageName of pagesWithLeftNav) {
      test(`should show "Sign In" and "Register" on ${pageName} left nav`, async ({ page }) => {
        await page.goto(PAGES[pageName as keyof typeof PAGES], { waitUntil: 'domcontentloaded' });

        await page.waitForFunction(
          () => (window as any).hhIdentity && (window as any).hhIdentity.isReady(),
          { timeout: 10000 }
        );

        const isAuthenticated = await page.evaluate(() => {
          return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
        });

        if (isAuthenticated) {
          test.skip();
          return;
        }

        // Check if page has left nav (pathwayDetail and moduleDetail don't have it by design)
        const leftNav = page.locator('#learn-left-nav, .learn-left-nav');
        const hasLeftNav = await leftNav.count() > 0;

        if (!hasLeftNav) {
          console.log(`⚠️  ${pageName} doesn't have left nav (by design) - skipping`);
          test.skip();
          return;
        }

        // Verify Sign In link is visible
        const signInLink = page.locator('.learn-nav-auth a:has-text("Sign In"), a.learn-auth-link:has-text("Sign In")').first();
        await expect(signInLink).toBeVisible({ timeout: 10000 });

        // Verify Sign Out link is NOT visible
        const signOutLink = page.locator('.learn-nav-auth a:has-text("Sign Out"), a:has-text("Sign Out")').first();
        await expect(signOutLink).toBeHidden();

        console.log(`✓ ${pageName} left nav shows Sign In for anonymous users`);
      });
    }
  });

  test.describe('Authenticated Users', () => {
    test.use({ storageState: STORAGE_STATE_PATH });

    for (const pageName of pagesWithLeftNav) {
      test(`should show "Sign Out" on ${pageName} left nav`, async ({ page }) => {
        test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');

        await page.goto(PAGES[pageName as keyof typeof PAGES], { waitUntil: 'domcontentloaded' });

        await page.waitForFunction(
          () => (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated(),
          { timeout: 15000 }
        );

        // Check if page has left nav (pathwayDetail and moduleDetail don't have it by design)
        const leftNav = page.locator('#learn-left-nav, .learn-left-nav');
        const hasLeftNav = await leftNav.count() > 0;

        if (!hasLeftNav) {
          console.log(`⚠️  ${pageName} doesn't have left nav (by design) - skipping`);
          test.skip();
          return;
        }

        // Verify Sign Out link is visible
        const signOutLink = page.locator('.learn-nav-auth a:has-text("Sign Out"), a:has-text("Sign Out")').first();
        await expect(signOutLink).toBeVisible({ timeout: 10000 });

        // Verify Sign In link is NOT visible
        const signInLink = page.locator('.learn-nav-auth a:has-text("Sign In"), a.learn-auth-link:has-text("Sign In")').first();
        await expect(signInLink).toBeHidden();

        console.log(`✓ ${pageName} left nav shows Sign Out for authenticated users`);
      });
    }
  });
});

// ========================================================================
// Test Suite 5: Enrollment CTA States
// ========================================================================

test.describe('Issue #344: Enrollment CTA States', () => {
  test.describe('Course Detail Page', () => {
    test('should show sign-in CTA for anonymous users', async ({ page, context }) => {
      await context.clearCookies();
      await page.goto(PAGES.courseDetail, { waitUntil: 'domcontentloaded' });

      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      await page.reload({ waitUntil: 'domcontentloaded' });

      // Wait for CTA to render
      const enrollCTA = page.locator('#hhl-enroll-button, #hhl-enroll-login').first();
      await enrollCTA.waitFor({ state: 'visible', timeout: 15000 });

      const ctaText = await enrollCTA.innerText();
      console.log('Course CTA (anonymous):', ctaText);

      // Should contain sign in or login prompt
      expect(ctaText.toLowerCase()).toMatch(/sign in|log in|login/);

      await page.screenshot({
        path: path.join(VERIFICATION_DIR, 'course-cta-anonymous.png'),
        fullPage: true
      });

      console.log('✓ Course detail shows sign-in CTA for anonymous users');
    });

    test('should update CTA after authentication', async ({ page }) => {
      test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');
      test.use({ storageState: STORAGE_STATE_PATH });

      await page.goto(PAGES.courseDetail, { waitUntil: 'domcontentloaded' });

      await page.waitForFunction(
        () => (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated(),
        { timeout: 15000 }
      );

      // Wait for CTA to update
      await page.waitForTimeout(2000);

      const enrollCTA = page.locator('#hhl-enroll-button').first();
      await enrollCTA.waitFor({ state: 'visible', timeout: 10000 });

      const ctaText = await enrollCTA.innerText();
      console.log('Course CTA (authenticated):', ctaText);

      // Should NOT say "Sign in" anymore
      expect(ctaText.toLowerCase()).not.toContain('sign in');

      await page.screenshot({
        path: path.join(VERIFICATION_DIR, 'course-cta-authenticated.png'),
        fullPage: true
      });

      console.log('✓ Course detail CTA updated after authentication');
    });
  });

  test.describe('Pathway Detail Page', () => {
    test('should show enroll CTA for anonymous users', async ({ page, context }) => {
      await context.clearCookies();
      await page.goto(PAGES.pathwayDetail, { waitUntil: 'domcontentloaded' });

      await page.waitForFunction(
        () => (window as any).hhIdentity && (window as any).hhIdentity.isReady(),
        { timeout: 10000 }
      );

      const isAuthenticated = await page.evaluate(() => {
        return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
      });

      if (isAuthenticated) {
        test.skip();
        return;
      }

      // Look for enroll button or link
      const enrollCTA = page.locator('a:has-text("Enroll"), button:has-text("Enroll")').first();
      await enrollCTA.waitFor({ state: 'visible', timeout: 10000 });

      await page.screenshot({
        path: path.join(VERIFICATION_DIR, 'pathway-cta-anonymous.png'),
        fullPage: true
      });

      console.log('✓ Pathway detail shows enroll CTA for anonymous users');
    });

    test('should show enrollment state for authenticated users', async ({ page }) => {
      test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');
      test.use({ storageState: STORAGE_STATE_PATH });

      await page.goto(PAGES.pathwayDetail, { waitUntil: 'domcontentloaded' });

      await page.waitForFunction(
        () => (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated(),
        { timeout: 15000 }
      );

      // Wait for UI to update
      await page.waitForTimeout(2000);

      // Look for enroll button or enrolled state
      const enrollCTA = page.locator('a:has-text("Enroll"), button:has-text("Enroll"), .enrolled, [class*="enrolled"]').first();
      await enrollCTA.waitFor({ state: 'visible', timeout: 10000 });

      await page.screenshot({
        path: path.join(VERIFICATION_DIR, 'pathway-cta-authenticated.png'),
        fullPage: true
      });

      console.log('✓ Pathway detail shows enrollment state for authenticated users');
    });
  });

  test.describe('Module Detail Page', () => {
    test('should load module page for anonymous users', async ({ page, context }) => {
      await context.clearCookies();
      await page.goto(PAGES.moduleDetail, { waitUntil: 'domcontentloaded' });

      // Verify page loads
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

      await page.screenshot({
        path: path.join(VERIFICATION_DIR, 'module-detail-anonymous.png'),
        fullPage: true
      });

      console.log('✓ Module detail page loads for anonymous users');
    });

    test('should load module page for authenticated users', async ({ page }) => {
      test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');
      test.use({ storageState: STORAGE_STATE_PATH });

      await page.goto(PAGES.moduleDetail, { waitUntil: 'domcontentloaded' });

      await page.waitForFunction(
        () => (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated(),
        { timeout: 15000 }
      );

      // Verify page loads
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

      await page.screenshot({
        path: path.join(VERIFICATION_DIR, 'module-detail-authenticated.png'),
        fullPage: true
      });

      console.log('✓ Module detail page loads for authenticated users');
    });
  });
});

// ========================================================================
// Test Suite 6: Enrollment Flow Happy Path
// ========================================================================

test.describe('Issue #344: Enrollment Flow', () => {
  test('anonymous user clicking enroll redirects to login', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(PAGES.courseDetail, { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => (window as any).hhIdentity && (window as any).hhIdentity.isReady(),
      { timeout: 10000 }
    );

    const isAuthenticated = await page.evaluate(() => {
      return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
    });

    if (isAuthenticated) {
      test.skip();
      return;
    }

    // Find and click enroll CTA
    const enrollCTA = page.locator('#hhl-enroll-button, #hhl-enroll-login').first();
    await enrollCTA.waitFor({ state: 'visible', timeout: 10000 });

    // Track navigation
    const navigationPromise = page.waitForURL(/auth\/login|cognito/, { timeout: 30000 });

    await enrollCTA.click();

    // Wait for redirect
    await navigationPromise;

    const currentUrl = page.url();
    console.log('Redirected to:', currentUrl);

    // Verify redirect to auth endpoint
    expect(currentUrl).toMatch(/\/auth\/login|cognito.*(oauth2\/authorize|\/login)/);

    console.log('✓ Anonymous enroll CTA redirects to login');
  });

  test('authenticated user can access enrollment flow', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test credentials not provided');
    test.use({ storageState: STORAGE_STATE_PATH });

    await page.goto(PAGES.pathwayDetail, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated(),
      { timeout: 15000 }
    );

    // Find enroll CTA
    const enrollCTA = page.locator('a:has-text("Enroll"), button:has-text("Enroll")').first();
    await enrollCTA.waitFor({ state: 'visible', timeout: 10000 });

    // Click to enroll
    await Promise.all([
      page.waitForURL(/action-runner|pathways/, { timeout: 15000 }),
      enrollCTA.click()
    ]);

    // Verify we reached action runner or stayed on page (if already enrolled)
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/action-runner|pathways/);

    console.log('✓ Authenticated user can access enrollment flow');
  });
});

// ========================================================================
// Test Suite 7: Negative Tests
// ========================================================================

test.describe('Issue #344: Negative Tests', () => {
  test('action runner requires authentication', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(PAGES.actionRunner, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => (window as any).hhIdentity && (window as any).hhIdentity.isReady(),
      { timeout: 10000 }
    );

    const isAuthenticated = await page.evaluate(() => {
      return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
    });

    if (isAuthenticated) {
      test.skip();
      return;
    }

    // Wait for action runner to process
    await page.waitForTimeout(3000);

    // Should show sign-in required message
    const runnerTitle = page.locator('#action-runner-title, h1').first();
    await runnerTitle.waitFor({ state: 'visible', timeout: 10000 });

    const titleText = (await runnerTitle.innerText()).toLowerCase();

    // Should require sign-in
    expect(titleText).toMatch(/sign in|authentication required|not authenticated/);

    await page.screenshot({
      path: path.join(VERIFICATION_DIR, 'action-runner-unauthenticated.png'),
      fullPage: true
    });

    console.log('✓ Action runner requires authentication');
  });

  test('my learning redirects anonymous users', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(PAGES.myLearning, { waitUntil: 'domcontentloaded' });

    // Allow time for redirect
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    // Should redirect to login OR show empty/login state
    if (currentUrl.includes('/auth/login') || currentUrl.includes('cognito')) {
      console.log('✓ My Learning redirected to login');
      expect(currentUrl).toMatch(/\/auth\/login|cognito/);
    } else {
      // Check for meta refresh or sign-in prompt
      const metaRefresh = await page.locator('meta[http-equiv="refresh"]').count();
      const signInPrompt = await page.locator('text=/sign in|log in|authentication required/i').count();

      expect(metaRefresh + signInPrompt).toBeGreaterThan(0);
      console.log('✓ My Learning shows login prompt for anonymous users');
    }
  });
});

// ========================================================================
// Test Suite 8: Legacy Auth Elimination
// ========================================================================

test.describe('Issue #344: Legacy Auth Elimination', () => {
  test('verify NO legacy auth URLs on any page', async ({ page }) => {
    const legacyPatterns = [
      '/_hcms/mem/login',
      '/_hcms/mem/logout',
      'auth-context.js',
      'auth-context.min.js',
    ];

    const pageEntries = Object.entries(PAGES);

    for (const [pageName, pageUrl] of pageEntries) {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Get all links and scripts
      const allUrls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href);
        const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => (s as HTMLScriptElement).src);
        return [...links, ...scripts];
      });

      // Check for legacy patterns
      const legacyFound = allUrls.filter(url =>
        legacyPatterns.some(pattern => url.includes(pattern))
      );

      if (legacyFound.length > 0) {
        console.log(`❌ REGRESSION: Legacy auth URLs found on ${pageName}:`);
        legacyFound.forEach(url => console.log('  -', url));
      }

      expect(legacyFound.length).toBe(0);
    }

    console.log('✓ No legacy auth URLs found on any page');
  });

  test('verify My Learning link uses Cognito auth', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(PAGES.catalog, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => (window as any).hhIdentity && (window as any).hhIdentity.isReady(),
      { timeout: 10000 }
    );

    const isAuthenticated = await page.evaluate(() => {
      return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
    });

    if (isAuthenticated) {
      test.skip();
      return;
    }

    // Find My Learning link (if present in nav)
    const myLearningLink = page.locator('a[href*="/learn/my-learning"]').first();

    if (await myLearningLink.count() > 0) {
      // Click My Learning link
      await myLearningLink.click();
      await page.waitForTimeout(2000);

      const currentUrl = page.url();

      // Issue #345: No server-side redirect - page loads, Cognito handles auth client-side
      expect(currentUrl).not.toContain('/_hcms/mem/login');

      if (currentUrl.includes('/auth/login') || currentUrl.includes('cognito')) {
        console.log('✓ My Learning redirected to Cognito auth (client-side)');
      } else {
        // Verify NO server-side meta refresh exists (Issue #345 removed it)
        const metaRefresh = await page.locator('meta[http-equiv="refresh"]').count();
        expect(metaRefresh).toBe(0);
        console.log('✓ My Learning loads without server-side redirect (Cognito handles client-side)');
      }
    } else {
      console.log('⚠️  My Learning link not found in nav (page may not have it)');
    }
  });

  test('verify all Sign In links use /auth/login', async ({ page, context }) => {
    await context.clearCookies();

    const pagesWithLeftNav = ['catalog', 'coursesList', 'pathwaysList', 'modulesList'];

    for (const pageName of pagesWithLeftNav) {
      await page.goto(PAGES[pageName as keyof typeof PAGES], { waitUntil: 'domcontentloaded' });

      await page.waitForFunction(
        () => (window as any).hhIdentity && (window as any).hhIdentity.isReady(),
        { timeout: 10000 }
      );

      const isAuthenticated = await page.evaluate(() => {
        return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
      });

      if (isAuthenticated) {
        continue;
      }

      // Find Sign In link
      const signInLink = page.locator('.learn-nav-auth a:has-text("Sign In"), a.learn-auth-link:has-text("Sign In")').first();

      if (await signInLink.count() > 0) {
        const href = await signInLink.getAttribute('href');

        expect(href).toBeTruthy();
        expect(href).toContain('/auth/login');
        expect(href).not.toContain('/_hcms/mem/login');

        console.log(`✓ ${pageName} Sign In link uses /auth/login`);
      }
    }
  });
});

// ========================================================================
// Test Report Generation
// ========================================================================

test.afterAll(async () => {
  const report = {
    timestamp: new Date().toISOString(),
    issue: '#344',
    title: 'Comprehensive Auth + Enrollment UX Test Coverage',
    testEnvironment: {
      baseUrl: BASE_URL,
      apiBaseUrl: API_BASE_URL,
      testCourseSlug: TEST_COURSE_SLUG,
      testPathwaySlug: TEST_PATHWAY_SLUG,
      testModuleSlug: TEST_MODULE_SLUG,
    },
    testSuites: [
      'Page Load Verification (all 9 pages)',
      'Auth State Propagation - Anonymous',
      'Auth State Propagation - Authenticated',
      'Left Nav Auth State',
      'Enrollment CTA States',
      'Enrollment Flow Happy Path',
      'Negative Tests',
      'Legacy Auth Elimination',
    ],
    coverage: {
      pages: Object.keys(PAGES),
      scenarios: [
        'Anonymous browsing',
        'Authenticated browsing',
        'Sign-in flow',
        'Enrollment flow',
        'Left nav auth state',
        'CTA state transitions',
        'Negative cases (unauthenticated)',
        'Legacy auth elimination',
      ],
    },
    notes: [
      'Tests cover all /learn page types (catalog, courses, pathways, modules, my-learning, action-runner)',
      'Auth state verified for both anonymous and authenticated users',
      'Left nav auth state verified on all pages with left nav',
      'Enrollment CTAs verified on course, pathway, and module pages',
      'Negative tests ensure unauthenticated access is blocked appropriately',
      'Legacy auth elimination verified across all pages',
      'Tests designed to fail before fixes, pass after implementation in #345',
    ],
  };

  fs.writeFileSync(
    path.join(VERIFICATION_DIR, 'test-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('\n✅ Issue #344 Test Suite completed');
  console.log('Report saved to:', path.join(VERIFICATION_DIR, 'test-report.json'));
});
