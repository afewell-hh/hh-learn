import 'dotenv/config';
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const COURSE_SLUG = process.env.COURSE_SLUG || 'course-authoring-101';
const COURSE_URL = process.env.COURSE_URL || `https://hedgehog.cloud/learn/courses/${COURSE_SLUG}?hs_no_cache=1`;
const MY_LEARNING_URL = 'https://hedgehog.cloud/learn/my-learning?hs_no_cache=1';
const API_BASE_URL = process.env.API_BASE_URL || 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com';
const VERIFICATION_DIR = path.join(process.cwd(), 'verification-output', 'issue-242');

/**
 * Helper function to authenticate via JWT
 * Calls /auth/login endpoint and stores token in localStorage
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

test.describe('Course enrollment flow with JWT auth (Issue #242 - Phase 3)', () => {
  test('should authenticate via JWT and enroll in course', async ({ page, context }) => {
    const testEmail = process.env.HUBSPOT_TEST_USERNAME as string;
    test.skip(!testEmail, 'HUBSPOT_TEST_USERNAME not provided');

    // Ensure verification directory exists
    if (!fs.existsSync(VERIFICATION_DIR)) {
      fs.mkdirSync(VERIFICATION_DIR, { recursive: true });
    }

    // Track all relevant network calls
    const enrollmentsCalls: string[] = [];
    const trackCalls: string[] = [];
    const authLoginCalls: string[] = [];

    page.on('request', req => {
      const url = req.url();
      if (url.includes('/enrollments/list')) enrollmentsCalls.push(url);
      if (url.includes('/events/track') && req.method() === 'POST') trackCalls.push(url);
      if (url.includes('/auth/login')) authLoginCalls.push(url);
    });

    // Enable console logging
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[auth') || text.includes('[hhl') || text.includes('identity') || text.includes('JWT')) {
        consoleLogs.push(`[${msg.type()}] ${text}`);
      }
    });

    // Start from clean state
    await context.clearCookies();

    // Step 1: Visit public course page (anonymous)
    await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    const ctaButton = page.locator('#hhl-enroll-button');
    await ctaButton.waitFor({ state: 'visible', timeout: 20000 });
    const initialText = await ctaButton.innerText();

    console.log('Initial CTA text (anonymous):', initialText);

    // Verify anonymous state shows "Sign in"
    expect(initialText).toContain('Sign in');

    // Take screenshot of anonymous state
    await page.screenshot({ path: path.join(VERIFICATION_DIR, '1-anonymous-state.png'), fullPage: true });

    // Step 2: Authenticate via JWT
    console.log('Authenticating via JWT with email:', testEmail);
    await authenticateViaJWT(page, testEmail);

    // Verify token was stored
    const storedToken = await page.evaluate(() => localStorage.getItem('hhl_auth_token'));
    expect(storedToken, 'JWT token should be stored in localStorage').toBeTruthy();

    console.log('JWT token stored successfully');

    // Step 3: Reload page to trigger identity resolution
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for identity to be resolved from JWT token
    await page.waitForFunction(() => {
      const identity = (window as any).hhIdentity?.get();
      return identity && (identity.email || identity.contactId);
    }, { timeout: 10000 });

    // Capture window.hhIdentity (should be populated from JWT)
    const windowIdentity = await page.evaluate(() => {
      return (window as any).hhIdentity?.get() || null;
    });

    console.log('window.hhIdentity.get():', windowIdentity);

    // Verify identity is populated
    expect(windowIdentity, 'Identity should be resolved from JWT').toBeTruthy();
    expect((windowIdentity as any).email).toBe(testEmail);
    expect((windowIdentity as any).contactId).toBeTruthy();

    // Take screenshot showing authenticated state
    await page.screenshot({ path: path.join(VERIFICATION_DIR, '2-authenticated-via-jwt.png'), fullPage: true });

    // Step 4: Verify CTA changed from "Sign in" to "Start Course" or "Enroll"
    await expect(ctaButton).not.toHaveText(/Sign in/i, { timeout: 10000 });

    const postAuthText = await ctaButton.innerText();
    console.log('Post-auth CTA text:', postAuthText);

    // Check if already enrolled
    const alreadyEnrolled = postAuthText.match(/Enrolled|Continue/i);

    if (!alreadyEnrolled) {
      // Step 5: Click to enroll
      console.log('Enrolling in course...');
      await ctaButton.click();

      // Wait for enrollment to complete
      await page.waitForTimeout(3000);

      // Take screenshot of enrollment state
      await page.screenshot({ path: path.join(VERIFICATION_DIR, '3-post-enrollment.png'), fullPage: true });

      // Verify enrollment event was tracked
      await expect.poll(() => trackCalls.length, { timeout: 20000 }).toBeGreaterThan(0);
      console.log(`Tracked ${trackCalls.length} events`);
    } else {
      console.log('Already enrolled, skipping enrollment step');
      await page.screenshot({ path: path.join(VERIFICATION_DIR, '3-already-enrolled.png'), fullPage: true });
    }

    // Step 6: Verify enrollments API was called
    await expect.poll(() => enrollmentsCalls.length, { timeout: 15000 }).toBeGreaterThan(0);
    console.log(`Enrollments API called ${enrollmentsCalls.length} times`);

    // Step 7: Visit My Learning page
    console.log('Visiting My Learning page...');
    await page.goto(MY_LEARNING_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Take screenshot of My Learning page
    await page.screenshot({ path: path.join(VERIFICATION_DIR, '4-my-learning.png'), fullPage: true });

    // Verify enrolled course appears
    const enrollmentCard = page.locator('.enrollment-card, [class*="enrollment"]').filter({ hasText: new RegExp(COURSE_SLUG, 'i') });
    await expect(enrollmentCard).toBeVisible({ timeout: 20000 });

    console.log('Course appears in My Learning page');

    // Save verification report
    const report = {
      timestamp: new Date().toISOString(),
      testUser: testEmail,
      courseSlug: COURSE_SLUG,
      authMethod: 'JWT',
      jwtTokenStored: !!storedToken,
      identityResolved: windowIdentity,
      consoleLogs,
      networkCalls: {
        authLogin: authLoginCalls,
        enrollments: enrollmentsCalls,
        track: trackCalls
      },
      assertions: {
        anonymousStateVerified: initialText.includes('Sign in'),
        jwtAuthenticationSucceeded: !!storedToken,
        identityPopulated: !!windowIdentity && !!(windowIdentity as any).email,
        ctaUpdatedAfterAuth: !postAuthText.includes('Sign in'),
        enrollmentPersisted: trackCalls.length > 0 || alreadyEnrolled,
        myLearningVisible: true
      }
    };

    fs.writeFileSync(
      path.join(VERIFICATION_DIR, 'e2e-test-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n✅ JWT E2E Test completed successfully!');
    console.log('Verification artifacts saved to:', VERIFICATION_DIR);
  });
});
