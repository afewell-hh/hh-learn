import 'dotenv/config';
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Issue #272 - Native HubSpot Login Flow Verification
 *
 * Tests the new native HubSpot membership authentication flow
 * WITHOUT using JWT helper - this tests the actual user experience
 */

const COURSE_URL = 'https://hedgehog.cloud/learn/courses/course-authoring-101';
const MY_LEARNING_URL = 'https://hedgehog.cloud/learn/my-learning';
const VERIFICATION_DIR = path.join(process.cwd(), 'verification-output', 'issue-272', 'live-test-results');

test.describe('Issue #272 - Native HubSpot Login Flow', () => {
  test('should work with native HubSpot membership login', async ({ page, context }) => {
    const testEmail = process.env.HUBSPOT_TEST_EMAIL;
    const testPassword = process.env.HUBSPOT_TEST_PASSWORD;

    test.skip(!testEmail || !testPassword, 'Test credentials not provided');

    // Ensure verification directory exists
    if (!fs.existsSync(VERIFICATION_DIR)) {
      fs.mkdirSync(VERIFICATION_DIR, { recursive: true });
    }

    // Track console messages
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Clear cookies to start anonymous
    await context.clearCookies();

    console.log('Step 1: Visit course page anonymously');
    await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded' });

    // Wait for page to be fully loaded
    await page.waitForTimeout(2000);

    // Take screenshot of anonymous state
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '1-anonymous-course-page.png'),
      fullPage: true
    });

    // Find the enrollment button
    const ctaButton = page.locator('#hhl-enroll-button');
    await ctaButton.waitFor({ state: 'visible', timeout: 10000 });

    const initialText = await ctaButton.innerText();
    console.log('Initial CTA text (anonymous):', initialText);

    // Verify anonymous state
    expect(initialText.toLowerCase()).toContain('sign in');

    console.log('Step 2: Click "Sign in" button and wait for redirect');

    // Click the sign-in button
    await ctaButton.click();

    // Wait for navigation to HubSpot login page
    await page.waitForURL(/.*\/_hcms\/mem\/login.*/, { timeout: 15000 });

    const loginUrl = page.url();
    console.log('Redirected to login URL:', loginUrl);

    // Verify redirect URL contains the course page
    expect(loginUrl).toContain('/_hcms/mem/login');
    expect(loginUrl).toContain('redirect_url');

    // Take screenshot of login page
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '2-hubspot-login-page.png'),
      fullPage: true
    });

    console.log('Step 3: Fill in HubSpot login form');

    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Fill in email
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(testEmail);

    // Fill in password
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(testPassword);

    // Take screenshot of filled form
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '3-login-form-filled.png'),
      fullPage: true
    });

    console.log('Step 4: Submit login form');

    // Click submit button
    const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
    await submitButton.click();

    // Wait for redirect back to course page
    console.log('Waiting for redirect back to course page...');
    await page.waitForURL(/.*\/learn\/courses\/.*/, { timeout: 30000 });

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    console.log('Step 5: Verify authenticated state on course page');

    // Take screenshot of authenticated state
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '4-authenticated-course-page.png'),
      fullPage: true
    });

    // Check if auth context div has data attributes
    const authContextData = await page.evaluate(() => {
      const authDiv = document.getElementById('hhl-auth-context');
      if (!authDiv) return null;

      return {
        email: authDiv.getAttribute('data-email'),
        contactId: authDiv.getAttribute('data-contact-id'),
        firstname: authDiv.getAttribute('data-firstname'),
        lastname: authDiv.getAttribute('data-lastname')
      };
    });

    console.log('Auth context data attributes:', authContextData);

    // Verify auth context has data
    expect(authContextData).toBeTruthy();
    expect(authContextData?.email).toBeTruthy();
    expect(authContextData?.contactId).toBeTruthy();

    // Check window.hhIdentity
    const identityData = await page.evaluate(() => {
      if (typeof (window as any).hhIdentity === 'undefined') {
        return { error: 'hhIdentity not defined' };
      }

      const identity = (window as any).hhIdentity.get();
      return identity;
    });

    console.log('window.hhIdentity.get():', identityData);

    // Verify identity is populated
    if (!identityData || 'error' in identityData) {
      console.error('Identity error:', identityData);
    } else {
      expect(identityData.email).toBeTruthy();
      expect(identityData.contactId).toBeTruthy();
    }

    // Check CTA button text
    const authenticatedText = await ctaButton.innerText();
    console.log('CTA text after login:', authenticatedText);

    // Should NOT show "Sign in" anymore
    expect(authenticatedText.toLowerCase()).not.toContain('sign in');

    console.log('Step 6: Visit My Learning page');

    await page.goto(MY_LEARNING_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Take screenshot of My Learning
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '5-my-learning-page.png'),
      fullPage: true
    });

    // Verify page loaded
    const myLearningTitle = await page.locator('h1, .page-title').first().textContent();
    console.log('My Learning page title:', myLearningTitle);

    // Save test report
    const report = {
      timestamp: new Date().toISOString(),
      testEmail,
      courseUrl: COURSE_URL,
      testSteps: {
        anonymousState: {
          success: initialText.toLowerCase().includes('sign in'),
          ctaText: initialText
        },
        loginRedirect: {
          success: loginUrl.includes('/_hcms/mem/login'),
          url: loginUrl,
          hasRedirectUrl: loginUrl.includes('redirect_url')
        },
        authContextHydration: {
          success: !!(authContextData?.email && authContextData?.contactId),
          data: authContextData
        },
        identityResolution: {
          success: !!(identityData && !(identityData as any).error),
          data: identityData
        },
        authenticatedState: {
          success: !authenticatedText.toLowerCase().includes('sign in'),
          ctaText: authenticatedText
        },
        myLearningAccess: {
          success: !!myLearningTitle,
          title: myLearningTitle
        }
      },
      consoleLogs,
      consoleErrors,
      overallSuccess: consoleErrors.length === 0 &&
                      authContextData?.email &&
                      identityData &&
                      !(identityData as any).error
    };

    // Write report
    fs.writeFileSync(
      path.join(VERIFICATION_DIR, 'test-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Write console logs
    fs.writeFileSync(
      path.join(VERIFICATION_DIR, 'console-logs.txt'),
      consoleLogs.join('\n')
    );

    if (consoleErrors.length > 0) {
      fs.writeFileSync(
        path.join(VERIFICATION_DIR, 'console-errors.txt'),
        consoleErrors.join('\n')
      );
    }

    console.log('\n✅ Test completed!');
    console.log('Screenshots and logs saved to:', VERIFICATION_DIR);
    console.log('Console errors:', consoleErrors.length);

    // Fail if there were console errors
    expect(consoleErrors.length, 'Should have no console errors').toBe(0);
  });
});
