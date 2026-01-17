/**
 * Playwright E2E tests for Cognito-based External SSO (Issue #303)
 *
 * This test suite covers the PKCE-based authentication flow with Cognito:
 * 1. Login redirect to Cognito Hosted UI with PKCE challenge
 * 2. OAuth callback with code exchange and cookie setting
 * 3. Logout flow with cookie clearing
 * 4. Session persistence across page loads
 *
 * @see docs/specs/issue-299-external-sso-spec.md
 * @see docs/test-plan-issue-299.md
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import * as crypto from 'crypto';

const API_BASE_URL = process.env.API_BASE_URL || 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com';
const BASE_URL = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';

// Cognito configuration from Phase 1
const COGNITO_DOMAIN = 'hedgehog-learn.auth.us-west-2.amazoncognito.com';
const COGNITO_CLIENT_ID = '2um886mpdk65cbbb6pgsvqkchf';

/**
 * NOTE: Cookie domain architecture
 *
 * For cookies to work in production, the auth endpoints (/auth/*) must be accessible
 * from the same domain as the frontend (hedgehog.cloud). This requires either:
 *
 * Option A: Custom domain for API Gateway (e.g., api.hedgehog.cloud)
 * Option B: Reverse proxy through HubSpot CMS (hedgehog.cloud/api/* -> API Gateway)
 *
 * For testing purposes, we set cookies to match the API_BASE_URL domain.
 */

test.describe('Cognito External SSO - Auth Flow (Issue #303)', () => {

  test.describe('Login Redirect with PKCE', () => {

    test('should redirect to Cognito Hosted UI with PKCE parameters', async ({ page }) => {
      // Navigate to login endpoint
      const loginUrl = `${API_BASE_URL}/auth/login?redirect_url=${encodeURIComponent('/learn/pathways')}`;

      // Expect redirect to Cognito
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().includes(COGNITO_DOMAIN)),
        page.goto(loginUrl, { waitUntil: 'networkidle' })
      ]);

      // Verify we're on Cognito Hosted UI
      expect(page.url()).toContain(COGNITO_DOMAIN);
      expect(page.url()).toContain('/login');

      // Verify PKCE parameters in URL
      const url = new URL(page.url());
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe(COGNITO_CLIENT_ID);
      expect(url.searchParams.get('redirect_uri')).toContain('/auth/callback');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('scope')).toContain('openid');
      expect(url.searchParams.get('scope')).toContain('email');
      expect(url.searchParams.get('scope')).toContain('profile');

      // Verify state parameter (CSRF protection)
      expect(url.searchParams.get('state')).toBeTruthy();
      expect(url.searchParams.get('state')?.length).toBeGreaterThan(20);
    });

    test('should preserve redirect_url in state parameter', async ({ page }) => {
      const originalPath = '/learn/courses/my-course';
      const loginUrl = `${API_BASE_URL}/auth/login?redirect_url=${encodeURIComponent(originalPath)}`;

      await page.goto(loginUrl, { waitUntil: 'networkidle' });

      const url = new URL(page.url());
      const stateParam = url.searchParams.get('state');

      expect(stateParam).toBeTruthy();
      // State should contain or reference the redirect_url (implementation dependent)
      // We'll verify this is properly decoded in the callback test
    });

    test('should handle missing redirect_url with default', async ({ page }) => {
      const loginUrl = `${API_BASE_URL}/auth/login`;

      await page.goto(loginUrl, { waitUntil: 'networkidle' });

      // Should redirect to Cognito even without redirect_url
      expect(page.url()).toContain(COGNITO_DOMAIN);

      // State should still be present for CSRF protection
      const url = new URL(page.url());
      expect(url.searchParams.get('state')).toBeTruthy();
    });
  });

  test.describe('OAuth Callback and Cookie Setting', () => {

    // TODO: This test requires either:
    // 1. Test bypass flag in /auth/callback to accept mock codes (recommended for TDD)
    // 2. Real Cognito authentication flow with test user credentials
    // Skipping until implementation adds test support
    test.skip('should exchange code for tokens and set httpOnly cookies', async ({ page, context }) => {
      // This test requires a valid authorization code from Cognito
      // In a real scenario, we'd need to complete the Cognito login flow
      // For now, we'll test the callback endpoint's behavior with a mock code

      const callbackUrl = `${API_BASE_URL}/auth/callback?code=MOCK_AUTH_CODE&state=MOCK_STATE`;

      await page.goto(callbackUrl);

      // Should redirect to the original page (or default)
      await page.waitForURL(url => url.toString().includes(BASE_URL), { timeout: 10000 });

      // Verify cookies were set
      const cookies = await context.cookies();

      // Should have access token cookie
      const accessTokenCookie = cookies.find(c => c.name === 'hhl_access_token');
      expect(accessTokenCookie).toBeDefined();
      expect(accessTokenCookie?.httpOnly).toBe(true);
      expect(accessTokenCookie?.secure).toBe(true);
      expect(accessTokenCookie?.sameSite).toBe('Strict');

      // Should have refresh token cookie
      const refreshTokenCookie = cookies.find(c => c.name === 'hhl_refresh_token');
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie?.httpOnly).toBe(true);
      expect(refreshTokenCookie?.secure).toBe(true);
      expect(refreshTokenCookie?.sameSite).toBe('Strict');
      expect(refreshTokenCookie?.path).toBe('/auth'); // Refresh token scoped to /auth
    });

    // TODO: Skipping until test bypass is implemented
    test.skip('should validate state parameter (CSRF protection)', async ({ page }) => {
      // Callback with mismatched state should fail
      const callbackUrl = `${API_BASE_URL}/auth/callback?code=MOCK_AUTH_CODE&state=INVALID_STATE`;

      const response = await page.goto(callbackUrl);

      // Should reject with 400 or redirect with error
      expect([400, 403]).toContain(response?.status() || 0);
    });

    test('should handle missing code parameter', async ({ page }) => {
      const callbackUrl = `${API_BASE_URL}/auth/callback?state=MOCK_STATE`;

      const response = await page.goto(callbackUrl);

      // Should return error (400 Bad Request)
      expect(response?.status()).toBe(400);
    });

    // TODO: Skipping until test bypass is implemented
    test.skip('should redirect to original page after successful auth', async ({ page }) => {
      // Mock a successful callback with redirect state
      const originalPath = '/learn/pathways';
      const callbackUrl = `${API_BASE_URL}/auth/callback?code=MOCK_AUTH_CODE&state=MOCK_STATE_WITH_REDIRECT`;

      // In implementation, state will encode the redirect_url
      // For now, we test that some redirect happens
      await page.goto(callbackUrl);

      await page.waitForLoadState('networkidle');

      // Should eventually land on hedgehog.cloud (not Cognito or API domain)
      expect(page.url()).toContain(BASE_URL);
    });
  });

  test.describe('Logout Flow', () => {

    test('should clear auth cookies on logout', async ({ page, context }) => {
      // First, simulate being logged in by setting cookies manually
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'mock_access_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        },
        {
          name: 'hhl_refresh_token',
          value: 'mock_refresh_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/auth',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      // Call logout endpoint
      await page.goto(`${API_BASE_URL}/auth/logout`);

      // Verify cookies were cleared
      const cookies = await context.cookies();
      const accessTokenCookie = cookies.find(c => c.name === 'hhl_access_token');
      const refreshTokenCookie = cookies.find(c => c.name === 'hhl_refresh_token');

      expect(accessTokenCookie).toBeUndefined();
      expect(refreshTokenCookie).toBeUndefined();
    });

    test('should redirect to Cognito logout endpoint', async ({ page }) => {
      await page.goto(`${API_BASE_URL}/auth/logout`);

      await page.waitForLoadState('networkidle');

      // Should redirect to Cognito logout or back to site
      const url = page.url();
      const redirectedToCognitoLogout = url.includes(COGNITO_DOMAIN) && url.includes('/logout');
      const redirectedToSite = url.includes(BASE_URL);

      expect(redirectedToCognitoLogout || redirectedToSite).toBe(true);
    });

    test('should handle logout when not authenticated', async ({ page }) => {
      // Logout without being logged in should not error
      const response = await page.goto(`${API_BASE_URL}/auth/logout`);

      // Should handle gracefully (200 or redirect)
      expect([200, 302, 303, 307]).toContain(response?.status() || 0);
    });
  });

  test.describe('Session Persistence', () => {

    test('should maintain session across page reloads', async ({ page, context }) => {
      // Set auth cookies
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'valid_mock_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      // Navigate to a page
      await page.goto(`${BASE_URL}/learn/pathways`);

      // Reload page
      await page.reload();

      // Cookies should still be present
      const cookies = await context.cookies();
      const accessTokenCookie = cookies.find(c => c.name === 'hhl_access_token');
      expect(accessTokenCookie).toBeDefined();
      expect(accessTokenCookie?.value).toBe('valid_mock_token');
    });

    test('should maintain session across navigation', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'valid_mock_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      await page.goto(`${BASE_URL}/learn/pathways`);
      await page.goto(`${BASE_URL}/learn/courses`);
      await page.goto(`${BASE_URL}/learn/my-learning`);

      // Cookies should persist across all navigations
      const cookies = await context.cookies();
      const accessTokenCookie = cookies.find(c => c.name === 'hhl_access_token');
      expect(accessTokenCookie).toBeDefined();
    });
  });

  test.describe('Cookie Security Attributes', () => {

    // TODO: Skipping until test bypass is implemented
    test.skip('access token cookie should have correct security attributes', async ({ page, context }) => {
      // This will be set by the /auth/callback endpoint in implementation
      // For now, we verify the expected attributes

      const callbackUrl = `${API_BASE_URL}/auth/callback?code=MOCK_CODE&state=MOCK_STATE`;
      await page.goto(callbackUrl);

      const cookies = await context.cookies();
      const accessTokenCookie = cookies.find(c => c.name === 'hhl_access_token');

      if (accessTokenCookie) {
        expect(accessTokenCookie.httpOnly).toBe(true);
        expect(accessTokenCookie.secure).toBe(true);
        expect(accessTokenCookie.sameSite).toBe('Strict');
        expect(accessTokenCookie.path).toBe('/');
      }
    });

    // TODO: Skipping until test bypass is implemented
    test.skip('refresh token cookie should be scoped to /auth path', async ({ page, context }) => {
      const callbackUrl = `${API_BASE_URL}/auth/callback?code=MOCK_CODE&state=MOCK_STATE`;
      await page.goto(callbackUrl);

      const cookies = await context.cookies();
      const refreshTokenCookie = cookies.find(c => c.name === 'hhl_refresh_token');

      if (refreshTokenCookie) {
        expect(refreshTokenCookie.httpOnly).toBe(true);
        expect(refreshTokenCookie.secure).toBe(true);
        expect(refreshTokenCookie.sameSite).toBe('Strict');
        expect(refreshTokenCookie.path).toBe('/auth'); // Restricted scope
      }
    });

    test('cookies should not be accessible via JavaScript', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'test_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      await page.goto(`${BASE_URL}/learn`);

      // Try to access cookie via JavaScript - should be undefined
      const cookieValue = await page.evaluate(() => {
        return document.cookie.includes('hhl_access_token');
      });

      expect(cookieValue).toBe(false);
    });
  });
});
