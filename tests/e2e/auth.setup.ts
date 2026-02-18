import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const TEST_COURSE_SLUG = process.env.TEST_COURSE_SLUG || 'network-like-hyperscaler-foundations';
const CACHE_BUSTER = process.env.E2E_CACHE_BUSTER || Date.now().toString();
const LOGIN_START_URL = `${BASE_URL}/learn/courses/${TEST_COURSE_SLUG}?hsCacheBuster=${CACHE_BUSTER}`;

const TEST_EMAIL = process.env.HUBSPOT_TEST_EMAIL || process.env.HUBSPOT_TEST_USERNAME;
const TEST_PASSWORD = process.env.HUBSPOT_TEST_PASSWORD;

const STORAGE_STATE_PATH = path.join(process.cwd(), 'tests', 'e2e', '.auth', 'user.json');

test('authenticate and save storage state', async ({ page }) => {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.log('⚠ Skipping auth setup: HUBSPOT_TEST_EMAIL/HUBSPOT_TEST_PASSWORD not provided');
    console.log('  Tests requiring authentication will be skipped');
    test.skip();
    return;
  }

  await page.goto(LOGIN_START_URL, { waitUntil: 'domcontentloaded' });

  // Try enrollment CTA sign-in link first, fallback to nav sign-in link
  const enrollLink = page.locator('#hhl-enroll-login').first();
  const navSignInLink = page.locator('a:has-text("Sign In"), a:has-text("Sign in")').first();

  const enrollVisible = await enrollLink.isVisible({ timeout: 5000 }).catch(() => false);

  if (enrollVisible) {
    await enrollLink.click();
  } else {
    // Fallback to navigation sign-in link
    await expect(navSignInLink).toBeVisible({ timeout: 10000 });
    await navSignInLink.click();
  }

  await page.waitForURL(/cognito.*(oauth2\/authorize|\/login)/, { timeout: 30000 });

  const usernameInput = page.locator('#signInFormUsername, input[name="username"], input[type="email"]').first();
  const passwordInput = page.locator('#signInFormPassword, input[name="password"], input[type="password"]').first();

  const emailPanel = page.locator('text=Sign in with your email and password').first();
  if (await emailPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailPanel.click();
  }

  await usernameInput.waitFor({ state: 'attached', timeout: 30000 });
  await passwordInput.waitFor({ state: 'attached', timeout: 30000 });

  await page.evaluate(
    ({ email, password }) => {
      function isVisible(el: HTMLElement | null) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      }

      const userCandidates = Array.from(
        document.querySelectorAll<HTMLInputElement>('#signInFormUsername, input[name="username"], input[type="email"]')
      );
      const passCandidates = Array.from(
        document.querySelectorAll<HTMLInputElement>('#signInFormPassword, input[name="password"], input[type="password"]')
      );

      const userInput = userCandidates.find(isVisible) || userCandidates[0] || null;
      const passInput = passCandidates.find(isVisible) || passCandidates[0] || null;

      if (userInput) {
        userInput.value = email;
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        userInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (passInput) {
        passInput.value = password;
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const submitCandidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          '#signInSubmitButton, input[name="signInSubmitButton"], button[type="submit"], input[type="submit"]'
        )
      );
      const submitButton = submitCandidates.find(isVisible) || submitCandidates[0] || null;
      if (submitButton) {
        submitButton.click();
        return;
      }

      const form =
        (userInput && userInput.closest('form')) ||
        (passInput && passInput.closest('form')) ||
        document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    },
    { email: TEST_EMAIL, password: TEST_PASSWORD }
  );

  try {
    const callbackResponse = await page.waitForResponse(
      (res) => res.url().includes('/auth/callback'),
      { timeout: 30000 }
    );
    const callbackStatus = callbackResponse.status();
    if (callbackStatus >= 400) {
      console.warn(`Auth callback returned ${callbackStatus}; waiting for final redirect before failing`);
    }
  } catch (error) {
    console.warn('Auth callback response not captured; continuing to final redirect check');
  }

  // Wait for redirect back to a /learn/courses/ page.
  // IMPORTANT: also assert the host domain so this cannot silently pass if the callback
  // redirects to api.hedgehog.cloud/learn/... (the {"message":"Not Found"} regression —
  // see issue #361 / PR fix/callback-absolute-redirect-361).
  await page.waitForURL(/\/learn\/courses\//, { timeout: 30000 });

  const postCallbackUrl = page.url();

  // Must land on hedgehog.cloud, never on api.hedgehog.cloud
  if (!postCallbackUrl.startsWith('https://hedgehog.cloud/') && !postCallbackUrl.startsWith('https://www.hedgehog.cloud/')) {
    throw new Error(
      `Auth callback redirect landed on wrong domain.\n` +
      `Expected: https://hedgehog.cloud/learn/courses/...\n` +
      `Actual:   ${postCallbackUrl}\n` +
      `This means /auth/callback returned a relative Location header that resolved to api.hedgehog.cloud (issue #361).`
    );
  }

  // Must not be an API Gateway error page
  const pageContent = await page.content();
  if (pageContent.includes('"message":"Not Found"') || pageContent.includes('{"message":"Not Found"}')) {
    throw new Error(
      `Auth callback redirect landed on an API Gateway error page ({"message":"Not Found"}).\n` +
      `URL: ${postCallbackUrl}\n` +
      `This is the regression described in issue #361.`
    );
  }

  console.log(`✓ Auth setup: callback redirected to correct domain: ${postCallbackUrl}`);

  await fs.promises.mkdir(path.dirname(STORAGE_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
