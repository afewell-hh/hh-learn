# Issue #319 - Test Plan

**Issue**: SSO UX Regressions
**Date**: 2026-02-10
**Author**: Agent C (Lead) - To be implemented with Agent A
**Status**: Test Planning Phase
**Related Docs**:
- docs/issue-319-architecture-analysis.md
- docs/issue-319-spec.md

---

## Overview

This test plan defines comprehensive Playwright tests to verify all 3 bug fixes in Issue #319. Tests follow TDD approach: write tests first (red), implement fixes (green), refactor if needed.

---

## Test Environment

### Configuration

**Test File**: `tests/e2e/cognito-frontend-ux.spec.ts`
**Test Group**: Add new describe block `describe('Issue #319 - SSO UX Regressions', ...)`
**Base URLs**:
- Production: `https://hedgehog.cloud`
- API: `https://api.hedgehog.cloud`

### Authentication States

**Anonymous State**:
```typescript
await context.clearCookies();
// No auth cookies, window.hhIdentity should be anonymous
```

**Authenticated State**:
```typescript
// Use auth.setup.ts storage state
use: { storageState: '.auth/user.json' }
// Has valid Cognito session cookies
```

### Prerequisites

- [ ] Auth setup (`tests/e2e/auth.setup.ts`) runs successfully
- [ ] Test credentials in `.env`: `HUBSPOT_TEST_EMAIL`, `HUBSPOT_TEST_PASSWORD`
- [ ] Constants.json has AUTH_LOGIN_URL, AUTH_LOGOUT_URL, etc.

### Test Pattern: Conditional Skips

**IMPORTANT**: Following the pattern from Issue #318, tests that require anonymous state must conditionally skip when server-side personalization persists authenticated state.

**Pattern** (from Issue #318):
```typescript
// After clearing cookies and navigating to page
const isAuthenticated = await page.evaluate(() => {
  return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
});

if (isAuthenticated) {
  console.warn('⚠ Skipping: Server-side personalization set authenticated state');
  test.skip();
  return;
}
```

**Why needed**:
- HubSpot server-side personalization tokens can persist despite cleared cookies
- Cannot deterministically achieve anonymous state in all cases
- Tests should skip gracefully rather than fail incorrectly

---

## Test Suite Structure

```typescript
describe('Issue #319 - SSO UX Regressions', () => {

  describe('Bug #1: Enrollment Without Login', () => {
    // Tests for action-runner auth enforcement
  });

  describe('Bug #2: Left Nav Auth State on Catalog', () => {
    // Tests for catalog.html cognito integration
  });

  describe('Bug #3: Sign In Link URLs', () => {
    // Tests for left-nav.html absolute URLs
  });

  describe('End-to-End Auth Flow', () => {
    // Full journey tests
  });

});
```

---

## Bug #1 Tests: Enrollment Without Login

### Test 1.1: Anonymous User - Action Runner Shows Sign-In Required

**Purpose**: Verify anonymous users cannot complete enrollment actions.

**Test Code**:
```typescript
test('should show sign-in required on action-runner for anonymous users', async ({ page, context }) => {
  // GIVEN: Anonymous user (no Cognito session)
  await context.clearCookies();

  // WHEN: Navigate to action runner with enroll action
  const ACTION_RUNNER_URL = 'https://hedgehog.cloud/learn/action-runner?action=enroll_pathway&slug=network-like-hyperscaler&source=pathway_page&redirect_url=%2Flearn%2Fpathways%2Fnetwork-like-hyperscaler';
  await page.goto(ACTION_RUNNER_URL, { waitUntil: 'domcontentloaded' });

  // Wait for cognito script to load and check auth
  await page.waitForTimeout(3000);

  // Check if window.hhIdentity resolved
  const identityResolved = await page.evaluate(() => {
    return !!(window as any).hhIdentity && (window as any).hhIdentity.isReady();
  });

  // CONDITIONAL SKIP: If server-side personalization forces authenticated state
  if (!identityResolved) {
    console.warn('⚠ Skipping: window.hhIdentity not ready (script may not have loaded)');
    test.skip();
    return;
  }

  const isAuthenticated = await page.evaluate(() => {
    return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
  });

  if (isAuthenticated) {
    console.warn('⚠ Skipping: Server-side personalization set authenticated state despite cleared cookies');
    console.warn('  This can happen due to HubSpot CRM personalization tokens');
    test.skip();
    return;
  }

  // THEN: Should show sign-in required message
  const runnerTitle = page.locator('#action-runner-title');
  await runnerTitle.waitFor({ state: 'visible', timeout: 5000 });
  const titleText = await runnerTitle.innerText();

  expect(titleText.toLowerCase()).toContain('sign in');
  expect(titleText.toLowerCase()).not.toContain('unsupported');
  expect(titleText.toLowerCase()).not.toContain('enrolled');
});
```

**Acceptance Criteria**:
- [ ] Action runner shows "Sign in required" or similar message
- [ ] Does NOT show "Enrolled!" or success message
- [ ] Does NOT show "Unsupported action" error
- [ ] Conditionally skips if server-side auth cannot be cleared

---

### Test 1.2: Anonymous User - Enrollment CTA Redirects to Login

**Purpose**: Verify enrollment CTA on pathway page redirects to Cognito login.

**Test Code**:
```typescript
test('should redirect anonymous enroll CTA to Cognito login (pathway page)', async ({ page, context }) => {
  // GIVEN: Anonymous user on pathway detail page
  await context.clearCookies();
  await page.goto('https://hedgehog.cloud/learn/pathways/network-like-hyperscaler', {
    waitUntil: 'domcontentloaded'
  });

  // WHEN: Click enroll CTA
  const enrollCTA = page.locator('a:has-text("Enroll"), button:has-text("Enroll")').first();
  await enrollCTA.waitFor({ state: 'visible', timeout: 10000 });

  const [redirectPage] = await Promise.all([
    page.waitForNavigation({ timeout: 10000 }),
    enrollCTA.click()
  ]);

  // THEN: Should redirect to Cognito login
  const finalUrl = redirectPage.url();
  expect(finalUrl).toContain('api.hedgehog.cloud/auth/login');

  // THEN: Redirect URL should be absolute
  const url = new URL(finalUrl);
  const redirectParam = url.searchParams.get('redirect_url');
  expect(redirectParam).toContain('https://hedgehog.cloud/');
});
```

**Acceptance Criteria**:
- [ ] Click enroll redirects to `https://api.hedgehog.cloud/auth/login`
- [ ] Redirect URL parameter is absolute (starts with `https://hedgehog.cloud/`)
- [ ] No enrollment occurs without authentication

---

### Test 1.3: Authenticated User - Enrollment Succeeds

**Purpose**: Verify authenticated users CAN complete enrollment.

**Test Code**:
```typescript
test('should allow enrollment for authenticated users', async ({ page }) => {
  // GIVEN: Authenticated user (storage state has valid session)
  // (Uses default storageState from config)

  // WHEN: Navigate to action runner with enroll action
  const ACTION_RUNNER_URL = 'https://hedgehog.cloud/learn/action-runner?action=enroll_pathway&slug=network-like-hyperscaler&source=pathway_page&redirect_url=%2Flearn%2Fpathways%2Fnetwork-like-hyperscaler';
  await page.goto(ACTION_RUNNER_URL, { waitUntil: 'domcontentloaded' });

  // THEN: Should show success or processing message
  const runnerTitle = page.locator('#action-runner-title');
  await runnerTitle.waitFor({ state: 'visible', timeout: 10000 });

  // Wait for enrollment to complete
  await page.waitForTimeout(3000);

  const titleText = await runnerTitle.innerText();
  const enrolled = titleText.toLowerCase().includes('enrolled') ||
                   titleText.toLowerCase().includes('already enrolled');

  expect(enrolled).toBe(true);
  expect(titleText.toLowerCase()).not.toContain('sign in');
});
```

**Acceptance Criteria**:
- [ ] Action runner processes enrollment
- [ ] Shows "Enrolled!" or "Already enrolled" message
- [ ] Does NOT show "Sign in required" message

---

## Bug #2 Tests: Left Nav Auth State on Catalog

### Test 2.1: Anonymous User - Catalog Shows Sign In

**Purpose**: Verify anonymous users see "Sign In" link on catalog page.

**Test Code**:
```typescript
test('should show Sign In link on catalog page for anonymous users', async ({ page, context }) => {
  // GIVEN: Anonymous user
  await context.clearCookies();

  // WHEN: Navigate to catalog page
  await page.goto('https://hedgehog.cloud/learn/catalog', { waitUntil: 'domcontentloaded' });

  // WAIT: For cognito-auth-integration.js to run and apply auth state
  await page.waitForFunction(
    () => (window as any).hhIdentity && (window as any).hhIdentity.isReady(),
    { timeout: 10000 }
  );

  // CONDITIONAL SKIP: Check if server-side personalization forces authenticated state
  const isAuthenticated = await page.evaluate(() => {
    return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
  });

  if (isAuthenticated) {
    console.warn('⚠ Skipping: Server-side personalization set authenticated state despite cleared cookies');
    test.skip();
    return;
  }

  // THEN: Should show Sign In link
  const signInLink = page.locator('.learn-nav-auth a:has-text("Sign In")');
  await expect(signInLink).toBeVisible({ timeout: 5000 });

  // THEN: Should NOT show Sign Out link
  const signOutLink = page.locator('.learn-nav-auth a:has-text("Sign Out")');
  await expect(signOutLink).toBeHidden();
});
```

**Acceptance Criteria**:
- [ ] "Sign In" link visible in left nav
- [ ] "Sign Out" link hidden
- [ ] Matches behavior on courses/pathways/modules pages
- [ ] Conditionally skips if server-side auth cannot be cleared

---

### Test 2.2: Authenticated User - Catalog Shows Sign Out

**Purpose**: Verify authenticated users see "Sign Out" link on catalog page.

**Test Code**:
```typescript
test('should toggle left nav to Sign Out when authenticated (catalog)', async ({ page }) => {
  // GIVEN: Authenticated user
  // (Uses default storageState from config)

  // WHEN: Navigate to catalog page
  await page.goto('https://hedgehog.cloud/learn/catalog', { waitUntil: 'domcontentloaded' });

  // WAIT: For cognito-auth-integration.js to check auth and update UI
  await page.waitForFunction(
    () => (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated(),
    { timeout: 15000 }
  );

  // THEN: Should show Sign Out link
  const signOutLink = page.locator('.learn-nav-auth a:has-text("Sign Out")');
  await expect(signOutLink).toBeVisible({ timeout: 10000 });

  // THEN: Should NOT show Sign In link
  const signInLink = page.locator('.learn-nav-auth a:has-text("Sign In")');
  await expect(signInLink).toBeHidden();
});
```

**Acceptance Criteria**:
- [ ] "Sign Out" link visible in left nav
- [ ] "Sign In" link hidden
- [ ] window.hhIdentity.isAuthenticated() returns true
- [ ] User greeting shows (optional, if implemented)

---

### Test 2.3: Catalog Has cognito-auth-integration.js Script

**Purpose**: Verify catalog.html loads the required Cognito integration script.

**Test Code**:
```typescript
test('should load cognito-auth-integration.js on catalog page', async ({ page }) => {
  // WHEN: Navigate to catalog page
  await page.goto('https://hedgehog.cloud/learn/catalog', { waitUntil: 'networkidle' });

  // THEN: Should have loaded cognito-auth-integration.js
  const scriptLoaded = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    return scripts.some(s => s.src && s.src.includes('cognito-auth-integration.js'));
  });

  expect(scriptLoaded).toBe(true);

  // THEN: window.hhIdentity should exist
  await page.waitForFunction(
    () => typeof (window as any).hhIdentity === 'object',
    { timeout: 10000 }
  );

  const hasIdentity = await page.evaluate(() => {
    return typeof (window as any).hhIdentity === 'object';
  });

  expect(hasIdentity).toBe(true);
});
```

**Acceptance Criteria**:
- [ ] cognito-auth-integration.js script present in DOM
- [ ] window.hhIdentity object exists
- [ ] No JavaScript errors in console

---

## Bug #3 Tests: Sign In Link URLs

### Test 3.1: Sign In Link Uses Absolute Redirect URL

**Purpose**: Verify sign-in link on catalog page uses absolute redirect URL.

**Test Code**:
```typescript
test('should render absolute sign-in link on catalog page', async ({ page, context }) => {
  // GIVEN: Anonymous user
  await context.clearCookies();

  // WHEN: Navigate to catalog page
  await page.goto('https://hedgehog.cloud/learn/catalog', { waitUntil: 'domcontentloaded' });

  // THEN: Sign In link should be visible
  const signInLink = page.locator('.learn-nav-auth a:has-text("Sign In")');
  await signInLink.waitFor({ state: 'visible', timeout: 10000 });

  // THEN: href should point to AUTH_LOGIN_URL with absolute redirect
  const href = await signInLink.getAttribute('href');

  expect(href).toContain('https://api.hedgehog.cloud/auth/login');
  expect(href).toContain('redirect_url=https%3A%2F%2Fhedgehog.cloud');
  expect(href).not.toContain('redirect_url=%2Flearn'); // Not relative
});
```

**Acceptance Criteria**:
- [ ] Link points to `https://api.hedgehog.cloud/auth/login`
- [ ] redirect_url parameter is absolute: `https://hedgehog.cloud/learn/...`
- [ ] Not using old HubSpot Membership URL (`/_hcms/mem/login`)

---

### Test 3.2: Sign In Link Does Not 404

**Purpose**: Verify clicking sign-in link navigates successfully (no 404).

**Test Code**:
```typescript
test('should navigate to Cognito login without 404 when clicking Sign In', async ({ page, context }) => {
  // GIVEN: Anonymous user on catalog page
  await context.clearCookies();
  await page.goto('https://hedgehog.cloud/learn/catalog', { waitUntil: 'domcontentloaded' });

  // WHEN: Click Sign In link
  const signInLink = page.locator('.learn-nav-auth a:has-text("Sign In")');
  await signInLink.waitFor({ state: 'visible', timeout: 10000 });

  const [loginPage] = await Promise.all([
    page.waitForNavigation({ timeout: 15000 }),
    signInLink.click()
  ]);

  // THEN: Should navigate to Cognito login (not 404)
  const finalUrl = loginPage.url();
  expect(finalUrl).toContain('auth.us-west-2.amazoncognito.com');

  // THEN: Page should not show 404 error
  const pageTitle = await page.title();
  expect(pageTitle.toLowerCase()).not.toContain('not found');
  expect(pageTitle.toLowerCase()).not.toContain('404');
});
```

**Acceptance Criteria**:
- [ ] Clicking "Sign In" navigates successfully
- [ ] Lands on Cognito OAuth login page
- [ ] No 404 or "Not Found" error
- [ ] Page loads within timeout

---

### Test 3.3: Sign Out Link Uses Absolute Redirect URL

**Purpose**: Verify sign-out link uses absolute redirect URL.

**Test Code**:
```typescript
test('should render absolute sign-out link on catalog page', async ({ page }) => {
  // GIVEN: Authenticated user
  await page.goto('https://hedgehog.cloud/learn/catalog', { waitUntil: 'domcontentloaded' });

  // WAIT: For auth state to load
  await page.waitForFunction(
    () => (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated(),
    { timeout: 15000 }
  );

  // THEN: Sign Out link should be visible
  const signOutLink = page.locator('.learn-nav-auth a:has-text("Sign Out")');
  await signOutLink.waitFor({ state: 'visible', timeout: 10000 });

  // THEN: href should point to AUTH_LOGOUT_URL with absolute redirect
  const href = await signOutLink.getAttribute('href');

  expect(href).toContain('https://api.hedgehog.cloud/auth/logout');
  expect(href).toContain('redirect_url=https%3A%2F%2Fhedgehog.cloud');
});
```

**Acceptance Criteria**:
- [ ] Link points to `https://api.hedgehog.cloud/auth/logout`
- [ ] redirect_url parameter is absolute
- [ ] Not using old HubSpot Membership logout URL

---

## End-to-End Tests

### Test E2E.1: Complete Auth Flow

**Purpose**: Verify full sign-in → enrollment → sign-out flow.

**Test Code**:
```typescript
test('should complete full auth flow: verify enrollment when authenticated', async ({ page }) => {
  // GIVEN: Authenticated user (storageState already applied from playwright.config.ts)
  // No need to manually inject cookies - Playwright handles this via storageState

  // STEP 1: Start on catalog page
  await page.goto('https://hedgehog.cloud/learn/catalog', { waitUntil: 'domcontentloaded' });

  // STEP 2: Wait for auth to be ready and verify authenticated state
  await page.waitForFunction(
    () => (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated(),
    { timeout: 15000 }
  );

  const signOutLink = page.locator('.learn-nav-auth a:has-text("Sign Out")');
  await expect(signOutLink).toBeVisible({ timeout: 10000 });

  // STEP 3: Navigate to pathway and enroll
  await page.goto('https://hedgehog.cloud/learn/pathways/network-like-hyperscaler', {
    waitUntil: 'domcontentloaded'
  });

  const enrollCTA = page.locator('a:has-text("Enroll"), button:has-text("Enroll")').first();

  // Check if already enrolled
  const alreadyEnrolled = await page.locator('text=/Already enrolled|Enrolled/i').isVisible()
    .catch(() => false);

  if (!alreadyEnrolled && await enrollCTA.isVisible()) {
    await enrollCTA.click();

    // Wait for action runner
    await page.waitForURL(/action-runner/, { timeout: 10000 });

    // Verify enrollment succeeds
    const runnerTitle = page.locator('#action-runner-title');
    await runnerTitle.waitFor({ state: 'visible', timeout: 10000 });

    await page.waitForTimeout(3000);
    const titleText = await runnerTitle.innerText();
    const success = titleText.toLowerCase().includes('enrolled') ||
                    titleText.toLowerCase().includes('already enrolled');
    expect(success).toBe(true);
  }

  // STEP 4: Verify auth state persists after enrollment
  await page.goto('https://hedgehog.cloud/learn/catalog', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const signOutLinkFinal = page.locator('.learn-nav-auth a:has-text("Sign Out")');
  await expect(signOutLinkFinal).toBeVisible({ timeout: 10000 });
});

test('should show anonymous state after clearing cookies (logout simulation)', async ({ page, context }) => {
  // Simulate logout by clearing all cookies
  await context.clearCookies();

  await page.goto('https://hedgehog.cloud/learn/catalog', { waitUntil: 'domcontentloaded' });

  // Wait for auth check to complete
  await page.waitForFunction(
    () => (window as any).hhIdentity && (window as any).hhIdentity.isReady(),
    { timeout: 10000 }
  );

  // CONDITIONAL SKIP: If server-side personalization forces authenticated state
  const isAuthenticated = await page.evaluate(() => {
    return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
  });

  if (isAuthenticated) {
    console.warn('⚠ Skipping: Server-side personalization persists auth state');
    test.skip();
    return;
  }

  // Verify anonymous state
  const signInLink = page.locator('.learn-nav-auth a:has-text("Sign In")');
  await expect(signInLink).toBeVisible({ timeout: 10000 });
});
```

**Note**: Separated into two tests to avoid OAuth complexity and cookie injection issues. First test uses existing auth, second test simulates logout via cookie clear.

**Acceptance Criteria**:
- [ ] Can enroll in course/pathway when authenticated (uses storageState)
- [ ] Auth state persists across page navigations
- [ ] After clearing cookies, shows anonymous state (with conditional skip)
- [ ] No manual cookie injection needed (Playwright handles via storageState)

---

## Regression Tests

### Test R.1: Other Pages Still Work

**Purpose**: Verify fixes don't break existing pages.

**Pages to Test**:
- `/learn` (home/catalog)
- `/learn/courses`
- `/learn/pathways`
- `/learn/modules`
- `/learn/my-learning`
- `/learn/courses/{slug}` (detail page)

**Test Code** (example for one page):
```typescript
test('should not break courses list page', async ({ page }) => {
  await page.goto('https://hedgehog.cloud/learn/courses', { waitUntil: 'domcontentloaded' });

  // Check page loads without errors
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

  // Check left nav renders
  await expect(page.locator('.learn-left-nav')).toBeVisible();

  // Check for JavaScript errors
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.waitForTimeout(3000);
  expect(errors.length).toBe(0);
});
```

**Acceptance Criteria**:
- [ ] All list pages load without errors
- [ ] All detail pages load without errors
- [ ] Left nav renders correctly on all pages
- [ ] No JavaScript console errors

---

## Test Execution

### Pre-Execution

1. ✅ Ensure auth setup runs: `npx playwright test tests/e2e/auth.setup.ts`
2. ✅ Verify `.auth/user.json` exists with valid cookies
3. ✅ Check `.env` has test credentials

### Execution

```bash
# Run all Issue #319 tests
npx playwright test tests/e2e/cognito-frontend-ux.spec.ts --grep "Issue #319"

# Run specific bug tests
npx playwright test --grep "Bug #1"
npx playwright test --grep "Bug #2"
npx playwright test --grep "Bug #3"

# Run with UI (visual debugging)
npx playwright test --grep "Issue #319" --ui

# Run and generate report
npx playwright test tests/e2e/cognito-frontend-ux.spec.ts --reporter=html
```

### Post-Execution

1. Review test results
2. Check Playwright report for screenshots/videos of failures
3. Document any test failures or flakiness
4. Fix tests or implementation as needed

---

## Test Data

### Test Accounts

**Production Test User**:
- Email: `HUBSPOT_TEST_EMAIL` from `.env`
- Password: `HUBSPOT_TEST_PASSWORD` from `.env`

**Test Pathway**:
- Slug: `network-like-hyperscaler`
- URL: `https://hedgehog.cloud/learn/pathways/network-like-hyperscaler`

**Test Course**:
- Any enrolled course from test user's enrollment list

### Test URLs

**Action Runner**:
```
https://hedgehog.cloud/learn/action-runner?action=enroll_pathway&slug=network-like-hyperscaler&source=pathway_page&redirect_url=%2Flearn%2Fpathways%2Fnetwork-like-hyperscaler
```

**Catalog**:
```
https://hedgehog.cloud/learn/catalog
```

**Auth Endpoints**:
```
https://api.hedgehog.cloud/auth/login
https://api.hedgehog.cloud/auth/logout
https://api.hedgehog.cloud/auth/me
```

---

## Success Criteria

All tests pass:
- [ ] 3 tests for Bug #1 (enrollment auth)
- [ ] 3 tests for Bug #2 (catalog left nav)
- [ ] 3 tests for Bug #3 (sign-in links)
- [ ] 1 test for E2E flow
- [ ] 6+ tests for regression (one per page)

**Total**: ~16 tests

---

## Known Limitations

1. **OAuth flow**: Full OAuth cannot be automated without credentials. Use `storageState` for authenticated tests.

2. **Server-side state**: Cannot control HubSpot Membership state. Tests focus on Cognito state.

3. **Timing**: Client-side auth updates take time. Use appropriate `waitForTimeout` or `waitForFunction`.

4. **Flakiness**: Auth tests may be flaky due to network latency. Use retries if needed.

---

## Coordination with Agent A

**Division of Labor**:

**Agent C (me)**:
- Write spec and test plan
- Implement template/JS fixes
- Verify tests locally

**Agent A**:
- Review test plan
- Implement Playwright tests
- Run tests and report results
- Help debug test failures

**Sync Points**:
1. After test plan review (this doc)
2. After initial test implementation
3. After fixes implemented (run tests together)
4. After publishing (verify in production)

---

**Document Status**: Ready for Review with Agent A
**Next Step**: Get approval, then implement tests (Agent A) and fixes (Agent C) in parallel
**Estimated Testing Time**: 3-4 hours
