/**
 * Playwright authentication helpers for JWT-based login (Issue #269)
 *
 * This module provides utilities for authenticating test users via the
 * /auth/login JWT endpoint, allowing automated tests to set up authenticated
 * sessions without navigating HubSpot's membership form.
 *
 * @see https://github.com/afewell/hh-learn/issues/269
 */

import { Page } from '@playwright/test';

export interface JWTAuthOptions {
  /** Email address of the user to authenticate */
  email: string;
  /** Base URL for API calls (default: from process.env.API_BASE_URL) */
  apiBaseUrl?: string;
  /** Whether to verify session after login (default: false) */
  verifySession?: boolean;
}

export interface JWTAuthResult {
  /** JWT token */
  token: string;
  /** User email */
  email: string;
  /** HubSpot contact ID */
  contactId: string;
  /** User's first name */
  firstname?: string;
  /** User's last name */
  lastname?: string;
}

/**
 * Authenticate a user via JWT and set up browser session
 *
 * This helper:
 * 1. Calls POST /auth/login with the provided email
 * 2. Stores the returned JWT token in localStorage
 * 3. Stores identity information for immediate use by client-side code
 * 4. Optionally verifies the session by checking /auth/session (if implemented)
 *
 * @param page - Playwright page instance
 * @param options - Authentication options
 * @returns Promise resolving to auth result with token and user data
 *
 * @example
 * ```typescript
 * import { authenticateViaJWT } from './helpers/auth';
 *
 * test('should access protected content', async ({ page }) => {
 *   await authenticateViaJWT(page, {
 *     email: process.env.HUBSPOT_TEST_USERNAME
 *   });
 *
 *   await page.goto('https://hedgehog.cloud/learn/my-learning');
 *   // User is now authenticated
 * });
 * ```
 *
 * @throws Error if login fails or API returns non-OK status
 */
export async function authenticateViaJWT(
  page: Page,
  options: JWTAuthOptions
): Promise<JWTAuthResult> {
  const apiBaseUrl = options.apiBaseUrl || process.env.API_BASE_URL || 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com';
  const loginUrl = `${apiBaseUrl}/auth/login`;

  // Call /auth/login endpoint
  const response = await page.request.post(loginUrl, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: options.email }
  });

  if (!response.ok()) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`JWT login failed for ${options.email}: ${error.error || response.statusText()}`);
  }

  const data = await response.json();

  // Store JWT token in localStorage with 24h expiry
  await page.evaluate((token) => {
    localStorage.setItem('hhl_auth_token', token);
    localStorage.setItem('hhl_auth_token_expires', String(Date.now() + (24 * 60 * 60 * 1000)));
  }, data.token);

  // Store identity for immediate use by window.hhIdentity
  const identity = {
    email: data.email,
    contactId: String(data.contactId || ''),
    firstname: data.firstname || '',
    lastname: data.lastname || ''
  };

  await page.evaluate((identityData) => {
    localStorage.setItem('hhl_identity_from_jwt', JSON.stringify(identityData));
  }, identity);

  // Optionally verify session (when /auth/session endpoint exists)
  if (options.verifySession) {
    const sessionUrl = `${apiBaseUrl}/auth/session`;
    const sessionResponse = await page.request.get(sessionUrl, {
      headers: {
        'Authorization': `Bearer ${data.token}`
      }
    });

    if (!sessionResponse.ok()) {
      throw new Error(`Session verification failed: ${sessionResponse.statusText()}`);
    }
  }

  return {
    token: data.token,
    email: data.email,
    contactId: String(data.contactId || ''),
    firstname: data.firstname,
    lastname: data.lastname
  };
}

/**
 * Clear authentication state from browser
 *
 * Removes JWT token and identity information from localStorage.
 * Useful for testing logout flows or resetting state between tests.
 *
 * @param page - Playwright page instance
 *
 * @example
 * ```typescript
 * import { clearAuth } from './helpers/auth';
 *
 * test('should handle logout', async ({ page }) => {
 *   await authenticateViaJWT(page, { email: 'test@example.com' });
 *   // ... perform actions ...
 *   await clearAuth(page);
 *   await page.reload();
 *   // User is now anonymous
 * });
 * ```
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('hhl_auth_token');
    localStorage.removeItem('hhl_auth_token_expires');
    localStorage.removeItem('hhl_identity_from_jwt');
  });
}

/**
 * Get authentication status from browser
 *
 * Checks if a valid JWT token exists in localStorage.
 * Does not validate token signature or expiry server-side.
 *
 * @param page - Playwright page instance
 * @returns Promise resolving to true if token exists, false otherwise
 *
 * @example
 * ```typescript
 * import { isAuthenticated } from './helpers/auth';
 *
 * test('should maintain session', async ({ page }) => {
 *   await authenticateViaJWT(page, { email: 'test@example.com' });
 *   const authed = await isAuthenticated(page);
 *   expect(authed).toBe(true);
 * });
 * ```
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const token = localStorage.getItem('hhl_auth_token');
    const expires = localStorage.getItem('hhl_auth_token_expires');

    if (!token || !expires) {
      return false;
    }

    // Check if token is expired
    const expiryTime = parseInt(expires, 10);
    return Date.now() < expiryTime;
  });
}

export interface MembershipLoginOptions {
  /** Email used for HubSpot membership login (defaults to HUBSPOT_TEST_EMAIL / USERNAME) */
  email?: string;
  /** Password for HubSpot membership login (defaults to HUBSPOT_TEST_PASSWORD) */
  password?: string;
  /** Site origin, e.g. https://hedgehog.cloud (defaults to env E2E_BASE_URL or production) */
  siteOrigin?: string;
  /** Redirect path after login (defaults to current page or /learn) */
  redirectPath?: string;
  /** Explicit login URL override (useful if already on the login page) */
  loginUrl?: string;
  /** Expected redirect substring after login (defaults to redirectPath) */
  expectRedirectContains?: string;
}

/**
 * Authenticate a user via HubSpot native membership login.
 *
 * Automates the `/ _hcms/mem/login` form so Playwright tests can exercise the
 * same flow that real users experience. Supports configurable selectors and
 * falls back to robust defaults that match HubSpot's standard membership form.
 */
export async function loginViaMembership(
  page: Page,
  options: MembershipLoginOptions = {}
): Promise<void> {
  const origin =
    options.siteOrigin ||
    process.env.E2E_BASE_URL ||
    'https://hedgehog.cloud';

  const email =
    options.email ||
    process.env.HUBSPOT_TEST_EMAIL ||
    process.env.HUBSPOT_TEST_USERNAME;
  const password = options.password || process.env.HUBSPOT_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Membership login requires HUBSPOT_TEST_EMAIL (or HUBSPOT_TEST_USERNAME) and HUBSPOT_TEST_PASSWORD environment variables.'
    );
  }

  const redirectPath =
    options.redirectPath ||
    (() => {
      try {
        const current = new URL(page.url());
        return current.pathname + current.search + current.hash;
      } catch {
        return '/learn';
      }
    })();

  const loginUrl =
    options.loginUrl ||
    `${origin.replace(/\/$/, '')}/_hcms/mem/login?redirect_url=${encodeURIComponent(
      redirectPath
    )}`;

  // Only navigate if we're not already on a membership login page
  if (!page.url().includes('/_hcms/mem/login')) {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  }

  // HubSpot occasionally performs an intermediate redirect to login.hubspot.com.
  // Wait for the form fields to be visible even if domain changes.
  const emailField = page
    .locator(
      'input[type="email"], input[name="email"], input[name="username"], input#email'
    )
    .first();
  await emailField.waitFor({ state: 'visible', timeout: 30000 });
  await emailField.fill(email);

  const passwordField = page
    .locator(
      'input[type="password"], input[name="password"], input#password'
    )
    .first();
  await passwordField.waitFor({ state: 'visible', timeout: 30000 });
  await passwordField.fill(password);

  const submitButton = page
    .locator(
      'button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in")'
    )
    .first();

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }),
    submitButton.click()
  ]);

  // Allow any intermediate redirects or post-login landing pages to settle
  const expectedSubstring =
    options.expectRedirectContains || redirectPath.replace(origin, '');
  await page.waitForURL(
    (url) => {
      const urlString = url.toString();
      return urlString.includes(expectedSubstring);
    },
    { timeout: 60000 }
  );
}
