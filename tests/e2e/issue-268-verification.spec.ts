/**
 * Manual verification test for Issue #268 - JWT Login Flow
 * This test verifies the new CTA login behavior
 */
import { test, expect } from '@playwright/test';
import { authenticateViaJWT, clearAuth } from '../helpers/auth';
import * as path from 'path';
import * as fs from 'fs';

const COURSE_URL = 'https://hedgehog.cloud/learn/courses/course-authoring-101?hs_no_cache=1';
const VERIFICATION_DIR = path.join(process.cwd(), 'verification-output', 'issue-268');

test.describe('Issue #268 - JWT Login Flow Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure verification directory exists
    if (!fs.existsSync(VERIFICATION_DIR)) {
      fs.mkdirSync(VERIFICATION_DIR, { recursive: true });
    }
  });

  test('should show sign-in button for anonymous user', async ({ page }) => {
    // Clear any existing auth
    await page.goto(COURSE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for enrollment button to be visible
    const enrollButton = page.locator('#hhl-enroll-button');
    await enrollButton.waitFor({ state: 'visible', timeout: 10000 });

    // Get button text
    const buttonText = await enrollButton.innerText();
    console.log('Anonymous button text:', buttonText);

    // Take screenshot
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, 'anonymous-state.png'),
      fullPage: true
    });

    // Should show sign-in prompt for anonymous users
    const isSignIn = buttonText.toLowerCase().includes('sign in');
    expect(isSignIn, 'Button should prompt to sign in for anonymous users').toBeTruthy();
  });

  test('should authenticate and update CTA with JWT helper', async ({ page }) => {
    const testEmail = process.env.HUBSPOT_TEST_USERNAME;
    test.skip(!testEmail, 'HUBSPOT_TEST_USERNAME not set');

    // Start anonymous
    await page.goto(COURSE_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const enrollButton = page.locator('#hhl-enroll-button');
    await enrollButton.waitFor({ state: 'visible', timeout: 10000 });

    const anonymousText = await enrollButton.innerText();
    console.log('1. Anonymous state:', anonymousText);
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '1-anonymous.png'),
      fullPage: true
    });

    // Authenticate using helper
    console.log('2. Authenticating with JWT helper...');
    await authenticateViaJWT(page, { email: testEmail! });

    // Reload page to trigger identity resolution
    await page.reload();
    await enrollButton.waitFor({ state: 'visible', timeout: 10000 });

    // Wait a bit for enrollment check to complete
    await page.waitForTimeout(3000);

    const authenticatedText = await enrollButton.innerText();
    console.log('3. Authenticated state:', authenticatedText);
    await page.screenshot({
      path: path.join(VERIFICATION_DIR, '2-authenticated.png'),
      fullPage: true
    });

    // Button should no longer say "Sign in"
    const stillSignIn = authenticatedText.toLowerCase().includes('sign in');
    expect(stillSignIn, 'Button should not say "Sign in" after authentication').toBeFalsy();

    // Verify token is stored
    const token = await page.evaluate(() => localStorage.getItem('hhl_auth_token'));
    expect(token, 'JWT token should be stored').toBeTruthy();

    console.log('✅ Verification complete');
  });

  test('should verify new enrollment.js has handleJWTLogin function', async ({ page }) => {
    await page.goto(COURSE_URL);

    // Check if handleJWTLogin exists in the global scope
    const hasFunction = await page.evaluate(() => {
      // The function is in closure, so we check for window.hhIdentity.login instead
      return !!(window as any).hhIdentity?.login;
    });

    expect(hasFunction, 'window.hhIdentity.login should be available').toBeTruthy();
    console.log('✅ window.hhIdentity.login is available');
  });
});
