import 'dotenv/config';
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const COURSE_SLUG = process.env.COURSE_SLUG || 'network-like-hyperscaler-101';
const PATHWAY_SLUG = process.env.PATHWAY_SLUG || 'publish-network-like-hyperscaler-complete';
const COURSE_URL = `https://hedgehog.cloud/learn/courses/${COURSE_SLUG}?hs_no_cache=1`;
const PATHWAY_URL = `https://hedgehog.cloud/learn/pathways/${PATHWAY_SLUG}?hs_no_cache=1`;
const ACTION_RUNNER_URL = 'https://hedgehog.cloud/learn/action-runner';
const API_BASE_URL = process.env.API_BASE_URL || 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com';
const VERIFICATION_DIR = path.join(process.cwd(), 'verification-output', 'issue-276');

/**
 * Helper function to authenticate via JWT
 */
async function authenticateViaJWT(page: Page, email: string): Promise<void> {
  const response = await page.request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email }
  });

  expect(response.ok(), `JWT login should succeed for ${email}`).toBeTruthy();

  const data = await response.json();

  // Store token in localStorage
  await page.evaluate((token) => {
    localStorage.setItem('hhl_auth_token', token);
    localStorage.setItem('hhl_auth_token_expires', String(Date.now() + (24 * 60 * 60 * 1000)));
  }, data.token);

  // Store identity for immediate use
  await page.evaluate((identity) => {
    localStorage.setItem('hhl_identity_from_jwt', JSON.stringify(identity));
  }, {
    email: data.email,
    contactId: data.contactId,
    firstname: data.firstname || '',
    lastname: data.lastname || ''
  });
}

/**
 * Helper to clear enrollment state for testing
 */
async function clearEnrollmentState(page: Page, contentType: 'course' | 'pathway', slug: string): Promise<void> {
  await page.evaluate(({ type, slug }) => {
    const key = `hh-enrollment-${type}-${slug}`;
    localStorage.removeItem(key);
    sessionStorage.removeItem('hhl_last_action');
  }, { type: contentType, slug });
}

test.describe('Action Runner - Enrollment Persistence (Issue #276)', () => {

  test.beforeEach(async ({ page }) => {
    // Ensure verification directory exists
    if (!fs.existsSync(VERIFICATION_DIR)) {
      fs.mkdirSync(VERIFICATION_DIR, { recursive: true });
    }
  });

  test('action-runner page should exist and be accessible', async ({ page }) => {
    // Verify the action-runner page exists (not 404)
    const response = await page.goto(ACTION_RUNNER_URL);

    expect(response?.status()).toBe(200);

    // Verify page contains expected elements
    await expect(page.locator('.spinner, .container')).toBeVisible({ timeout: 5000 });

    // Verify page title
    const title = await page.title();
    expect(title).toContain('Processing');

    console.log('✅ Action runner page exists and loads successfully');
  });

  test('should redirect to action-runner and persist course enrollment to CRM', async ({ page, context }) => {
    const testEmail = process.env.HUBSPOT_TEST_USERNAME as string;
    test.skip(!testEmail, 'HUBSPOT_TEST_USERNAME not provided');

    // Track network calls
    const trackCalls: Array<{ url: string; payload: any }> = [];
    const actionRunnerVisits: string[] = [];

    page.on('request', async req => {
      const url = req.url();

      // Track /events/track POST calls
      if (url.includes('/events/track') && req.method() === 'POST') {
        try {
          const payload = req.postDataJSON();
          trackCalls.push({ url, payload });
          console.log('[TRACK] Event:', payload?.eventName, 'Slug:', payload?.course_slug || payload?.slug);
        } catch (e) {
          trackCalls.push({ url, payload: null });
        }
      }

      // Track action-runner visits
      if (url.includes('/learn/action-runner')) {
        actionRunnerVisits.push(url);
        console.log('[ACTION-RUNNER] Visit:', url);
      }
    });

    // Start from clean state
    await context.clearCookies();
    await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    // Authenticate
    console.log('Authenticating with email:', testEmail);
    await authenticateViaJWT(page, testEmail);

    // Clear enrollment state to test fresh enrollment
    await clearEnrollmentState(page, 'course', COURSE_SLUG);

    // Reload to initialize enrollment UI
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for identity resolution
    await page.waitForFunction(() => {
      const identity = (window as any).hhIdentity?.get();
      return identity && identity.email;
    }, { timeout: 10000 });

    const ctaButton = page.locator('#hhl-enroll-button');
    await ctaButton.waitFor({ state: 'visible', timeout: 15000 });

    // Wait for button to show "Start Course" (not "Checking enrollment...")
    await expect(ctaButton).not.toHaveText(/Checking enrollment/i, { timeout: 10000 });

    const buttonText = await ctaButton.innerText();
    console.log('CTA button text:', buttonText);

    // Only test enrollment if not already enrolled
    const alreadyEnrolled = buttonText.match(/Enrolled/i);

    if (alreadyEnrolled) {
      console.log('⚠️ Course already enrolled - skipping enrollment test');
      console.log('To test enrollment, clear CRM state for this contact first');
      test.skip();
      return;
    }

    // Take screenshot before enrollment
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, 'test-1-before-enrollment.png'),
      fullPage: true
    });

    // Click enrollment button
    console.log('Clicking enrollment button...');
    await ctaButton.click();

    // Wait for redirect to action-runner
    console.log('Waiting for action-runner redirect...');
    await page.waitForURL(/\/learn\/action-runner/, { timeout: 15000 });

    // Verify we're on action-runner page
    const currentUrl = page.url();
    expect(currentUrl).toContain('/learn/action-runner');
    console.log('✅ Redirected to action-runner:', currentUrl);

    // Verify URL parameters
    const url = new URL(currentUrl);
    expect(url.searchParams.get('action')).toBe('enroll_course');
    expect(url.searchParams.get('slug')).toBe(COURSE_SLUG);
    expect(url.searchParams.has('redirect_url')).toBeTruthy();

    console.log('✅ Action runner URL parameters correct');

    // Wait for action-runner to process and redirect back
    console.log('Waiting for redirect back to course page...');
    await page.waitForURL(/\/learn\/courses\//i, { timeout: 20000 });

    console.log('✅ Redirected back to course page');

    // Take screenshot after enrollment
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, 'test-2-after-enrollment.png'),
      fullPage: true
    });

    // Verify enrollment event was tracked
    await page.waitForTimeout(2000); // Allow time for network calls to complete

    expect(trackCalls.length).toBeGreaterThan(0);
    console.log(`✅ ${trackCalls.length} event(s) tracked`);

    // Verify learning_course_enrolled event was sent
    const enrollmentEvent = trackCalls.find(call =>
      call.payload?.eventName === 'learning_course_enrolled'
    );

    expect(enrollmentEvent, 'learning_course_enrolled event should be sent').toBeTruthy();
    expect(enrollmentEvent?.payload?.course_slug || enrollmentEvent?.payload?.slug).toBe(COURSE_SLUG);

    console.log('✅ Enrollment event payload verified:', enrollmentEvent?.payload);

    // Verify button shows enrolled state
    await expect(ctaButton).toHaveText(/Enrolled/i, { timeout: 10000 });
    await expect(ctaButton).toBeDisabled();

    console.log('✅ Button shows enrolled state');

    // Verify sessionStorage has success result
    const lastAction = await page.evaluate(() => {
      const raw = sessionStorage.getItem('hhl_last_action');
      return raw ? JSON.parse(raw) : null;
    });

    expect(lastAction).toBeTruthy();
    expect(lastAction.status).toBe('success');
    expect(lastAction.action).toBe('enroll_course');

    console.log('✅ Session storage shows success result');

    // Save test report
    const report = {
      timestamp: new Date().toISOString(),
      testType: 'course_enrollment_via_action_runner',
      testUser: testEmail,
      courseSlug: COURSE_SLUG,
      assertions: {
        actionRunnerPageAccessible: true,
        redirectedToActionRunner: actionRunnerVisits.length > 0,
        urlParametersCorrect: true,
        redirectedBackToCourse: true,
        enrollmentEventTracked: !!enrollmentEvent,
        buttonShowsEnrolled: true,
        sessionStorageHasSuccess: lastAction?.status === 'success'
      },
      networkCalls: {
        actionRunnerVisits,
        trackCalls: trackCalls.map(c => ({
          eventName: c.payload?.eventName,
          slug: c.payload?.course_slug || c.payload?.slug
        }))
      },
      sessionStorage: lastAction
    };

    fs.writeFileSync(
      path.join(VERIFICATION_DIR, 'e2e-action-runner-course-test.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n✅ Course enrollment via action-runner test completed!');
    console.log('Report saved to:', path.join(VERIFICATION_DIR, 'e2e-action-runner-course-test.json'));
  });

  test('should redirect to action-runner and persist pathway enrollment to CRM', async ({ page, context }) => {
    const testEmail = process.env.HUBSPOT_TEST_USERNAME as string;
    test.skip(!testEmail, 'HUBSPOT_TEST_USERNAME not provided');

    // Track network calls
    const trackCalls: Array<{ url: string; payload: any }> = [];
    const actionRunnerVisits: string[] = [];

    page.on('request', async req => {
      const url = req.url();

      if (url.includes('/events/track') && req.method() === 'POST') {
        try {
          const payload = req.postDataJSON();
          trackCalls.push({ url, payload });
          console.log('[TRACK] Event:', payload?.eventName, 'Slug:', payload?.pathway_slug || payload?.slug);
        } catch (e) {
          trackCalls.push({ url, payload: null });
        }
      }

      if (url.includes('/learn/action-runner')) {
        actionRunnerVisits.push(url);
        console.log('[ACTION-RUNNER] Visit:', url);
      }
    });

    // Start from clean state
    await context.clearCookies();
    await page.goto(PATHWAY_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    // Authenticate
    console.log('Authenticating with email:', testEmail);
    await authenticateViaJWT(page, testEmail);

    // Clear enrollment state
    await clearEnrollmentState(page, 'pathway', PATHWAY_SLUG);

    // Reload
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for identity resolution
    await page.waitForFunction(() => {
      const identity = (window as any).hhIdentity?.get();
      return identity && identity.email;
    }, { timeout: 10000 });

    const ctaButton = page.locator('#hhl-enroll-button');
    await ctaButton.waitFor({ state: 'visible', timeout: 15000 });

    await expect(ctaButton).not.toHaveText(/Checking enrollment/i, { timeout: 10000 });

    const buttonText = await ctaButton.innerText();
    console.log('CTA button text:', buttonText);

    const alreadyEnrolled = buttonText.match(/Enrolled/i);

    if (alreadyEnrolled) {
      console.log('⚠️ Pathway already enrolled - skipping enrollment test');
      test.skip();
      return;
    }

    // Click enrollment button
    console.log('Clicking pathway enrollment button...');
    await ctaButton.click();

    // Wait for redirect to action-runner
    console.log('Waiting for action-runner redirect...');
    await page.waitForURL(/\/learn\/action-runner/, { timeout: 15000 });

    const currentUrl = page.url();
    expect(currentUrl).toContain('/learn/action-runner');

    // Verify URL parameters for pathway enrollment
    const url = new URL(currentUrl);
    expect(url.searchParams.get('action')).toBe('enroll_pathway');
    expect(url.searchParams.get('slug')).toBe(PATHWAY_SLUG);

    console.log('✅ Pathway enrollment URL parameters correct');

    // Wait for redirect back
    await page.waitForURL(/\/learn\/pathways\//i, { timeout: 20000 });
    console.log('✅ Redirected back to pathway page');

    // Verify enrollment event
    await page.waitForTimeout(2000);

    const enrollmentEvent = trackCalls.find(call =>
      call.payload?.eventName === 'learning_pathway_enrolled'
    );

    expect(enrollmentEvent, 'learning_pathway_enrolled event should be sent').toBeTruthy();
    expect(enrollmentEvent?.payload?.pathway_slug || enrollmentEvent?.payload?.slug).toBe(PATHWAY_SLUG);

    console.log('✅ Pathway enrollment event verified');

    // Verify button state
    await expect(ctaButton).toHaveText(/Enrolled/i, { timeout: 10000 });

    console.log('✅ Pathway enrollment test completed!');
  });

  test('should verify CRM persistence across browser sessions', async ({ browser }) => {
    const testEmail = process.env.HUBSPOT_TEST_USERNAME as string;
    test.skip(!testEmail, 'HUBSPOT_TEST_USERNAME not provided');

    // Browser A: Enroll in course
    const contextA = await browser.newContext();
    const pageA = contextA.newPage();

    console.log('[Browser A] Authenticating and enrolling...');

    await pageA.goto(COURSE_URL, { waitUntil: 'domcontentloaded' });
    await pageA.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    await authenticateViaJWT(pageA, testEmail);
    await pageA.reload({ waitUntil: 'domcontentloaded' });

    await pageA.waitForFunction(() => {
      const identity = (window as any).hhIdentity?.get();
      return identity && identity.email;
    }, { timeout: 10000 });

    const ctaButtonA = pageA.locator('#hhl-enroll-button');
    await ctaButtonA.waitFor({ state: 'visible', timeout: 15000 });
    await expect(ctaButtonA).not.toHaveText(/Checking enrollment/i, { timeout: 10000 });

    const buttonTextA = await ctaButtonA.innerText();
    const alreadyEnrolledA = buttonTextA.match(/Enrolled/i);

    if (!alreadyEnrolledA) {
      console.log('[Browser A] Clicking enroll button...');
      await ctaButtonA.click();

      // Wait for action-runner flow
      await pageA.waitForURL(/\/learn\/action-runner/, { timeout: 15000 });
      await pageA.waitForURL(/\/learn\/courses\//i, { timeout: 20000 });

      // Verify enrolled state
      await expect(ctaButtonA).toHaveText(/Enrolled/i, { timeout: 10000 });
      console.log('[Browser A] ✅ Enrollment complete');
    } else {
      console.log('[Browser A] Already enrolled');
    }

    await pageA.screenshot({
      path: path.join(VERIFICATION_DIR, 'test-3-browser-a-enrolled.png'),
      fullPage: true
    });

    await contextA.close();

    // Wait a bit for CRM write to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Browser B: New session, should see enrolled state from CRM
    const contextB = await browser.newContext();
    const pageB = contextB.newPage();

    console.log('[Browser B] Opening course in fresh browser...');

    await pageB.goto(COURSE_URL, { waitUntil: 'domcontentloaded' });
    await pageB.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    // Authenticate same user
    console.log('[Browser B] Authenticating same user...');
    await authenticateViaJWT(pageB, testEmail);
    await pageB.reload({ waitUntil: 'domcontentloaded' });

    await pageB.waitForFunction(() => {
      const identity = (window as any).hhIdentity?.get();
      return identity && identity.email;
    }, { timeout: 10000 });

    const ctaButtonB = pageB.locator('#hhl-enroll-button');
    await ctaButtonB.waitFor({ state: 'visible', timeout: 15000 });

    // Give time for CRM fetch
    await pageB.waitForTimeout(3000);

    await pageB.screenshot({
      path: path.join(VERIFICATION_DIR, 'test-4-browser-b-should-see-enrolled.png'),
      fullPage: true
    });

    // Verify enrolled state persisted from CRM
    const buttonTextB = await ctaButtonB.innerText();
    console.log('[Browser B] Button text:', buttonTextB);

    // This is the key assertion: Browser B should see enrolled state from CRM
    expect(buttonTextB).toMatch(/Enrolled/i);
    await expect(ctaButtonB).toBeDisabled();

    console.log('[Browser B] ✅ Enrollment state persisted from CRM!');

    await contextB.close();

    // Save cross-browser test report
    const report = {
      timestamp: new Date().toISOString(),
      testType: 'cross_browser_crm_persistence',
      testUser: testEmail,
      courseSlug: COURSE_SLUG,
      assertions: {
        browserAEnrolled: true,
        browserBShowsEnrolledFromCRM: buttonTextB.match(/Enrolled/i) !== null
      },
      conclusion: 'Enrollment persisted to CRM and synced across browser sessions'
    };

    fs.writeFileSync(
      path.join(VERIFICATION_DIR, 'e2e-cross-browser-persistence-test.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n✅ Cross-browser CRM persistence test completed!');
    console.log('This confirms Issue #276 is resolved - enrollments persist across browsers via CRM');
  });
});
