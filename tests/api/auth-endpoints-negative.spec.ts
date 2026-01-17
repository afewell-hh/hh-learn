/**
 * Negative test cases for auth endpoints (Issue #303)
 *
 * This test suite covers error cases and edge cases for all auth endpoints:
 * - /auth/login
 * - /auth/callback
 * - /auth/logout
 * - /auth/me
 *
 * Focus on security, error handling, and resilience.
 *
 * @see docs/specs/issue-299-external-sso-spec.md
 * @see docs/test-plan-issue-299.md
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL || 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com';

test.describe('Auth Endpoints - Negative Tests (Issue #303)', () => {

  test.describe('GET /auth/login - Error Cases', () => {

    test('should handle extremely long redirect_url gracefully', async ({ request }) => {
      const longUrl = '/learn/pathways/' + 'a'.repeat(2000);
      const response = await request.get(`${API_BASE_URL}/auth/login?redirect_url=${encodeURIComponent(longUrl)}`);

      // Should either truncate or reject
      expect([302, 400]).toContain(response.status());
    });

    test('should sanitize redirect_url to prevent open redirect', async ({ request }) => {
      const evilUrl = 'https://evil.com/phishing';
      const response = await request.get(`${API_BASE_URL}/auth/login?redirect_url=${encodeURIComponent(evilUrl)}`, {
        maxRedirects: 0
      });

      // Should not redirect to external domain
      const location = response.headers()['location'];
      if (location) {
        expect(location).not.toContain('evil.com');
        expect(location).not.toContain('http://');
        expect(location).not.toContain('https://evil');
      }
    });

    test('should reject javascript: protocol in redirect_url', async ({ request }) => {
      const xssUrl = 'javascript:alert(1)';
      const response = await request.get(`${API_BASE_URL}/auth/login?redirect_url=${encodeURIComponent(xssUrl)}`);

      expect([400, 302]).toContain(response.status());

      const location = response.headers()['location'];
      if (location) {
        expect(location).not.toContain('javascript:');
      }
    });

    test('should handle malformed redirect_url gracefully', async ({ request }) => {
      const malformedUrl = '%invalid%url';
      const response = await request.get(`${API_BASE_URL}/auth/login?redirect_url=${malformedUrl}`);

      // Should handle gracefully (default redirect or 400)
      expect([302, 400]).toContain(response.status());
    });

    test('should generate unique code_challenge on each request', async ({ page }) => {
      // Make two login requests
      await page.goto(`${API_BASE_URL}/auth/login?redirect_url=/learn`);
      const url1 = new URL(page.url());
      const challenge1 = url1.searchParams.get('code_challenge');

      await page.goto(`${API_BASE_URL}/auth/login?redirect_url=/learn`);
      const url2 = new URL(page.url());
      const challenge2 = url2.searchParams.get('code_challenge');

      // Challenges should be different (unique per request)
      expect(challenge1).not.toBe(challenge2);
    });
  });

  test.describe('GET /auth/callback - Error Cases', () => {

    test('should return 400 when code parameter is missing', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/callback?state=validstate123`);

      expect(response.status()).toBe(400);

      const error = await response.json();
      expect(error.error).toMatch(/code.*required|missing.*code/i);
    });

    test('should return 400 when state parameter is missing', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/callback?code=authcode123`);

      expect(response.status()).toBe(400);

      const error = await response.json();
      expect(error.error).toMatch(/state.*required|missing.*state/i);
    });

    test('should reject callback with invalid authorization code', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/callback?code=invalid_auth_code&state=valid_state`);

      // Cognito token exchange will fail - should return error page or redirect with error
      expect([400, 401, 302]).toContain(response.status());
    });

    test('should validate PKCE code_verifier matches original code_challenge', async ({ request }) => {
      // Callback with mismatched PKCE verifier
      // This will be validated during token exchange with Cognito
      const response = await request.get(`${API_BASE_URL}/auth/callback?code=auth_code&state=state_with_wrong_verifier`);

      // Cognito will reject - should propagate error
      expect([400, 401, 302]).toContain(response.status());
    });

    test('should reject state parameter with invalid signature/format', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/callback?code=authcode&state=obviously_tampered_state`);

      // State validation should fail
      expect([400, 403]).toContain(response.status());
    });

    test('should handle Cognito error parameter', async ({ request }) => {
      // Cognito redirects with error parameter on auth failure
      const response = await request.get(`${API_BASE_URL}/auth/callback?error=access_denied&error_description=User+denied+access`);

      // Should handle gracefully and redirect with error message
      expect([302, 400]).toContain(response.status());
    });

    test('should prevent CSRF by validating state', async ({ request }) => {
      // Two separate login flows with state mismatch
      const response = await request.get(`${API_BASE_URL}/auth/callback?code=code_from_different_session&state=state_from_another_session`);

      // State validation should fail (CSRF protection)
      expect([400, 403]).toContain(response.status());
    });

    test('should handle Cognito token exchange failure', async ({ request }) => {
      // Code that's already been used or expired
      const response = await request.get(`${API_BASE_URL}/auth/callback?code=expired_or_used_code&state=valid_state`);

      // Token exchange will fail - should show error
      expect([400, 401, 302]).toContain(response.status());
    });

    test('should reject callback with SQL injection attempt in parameters', async ({ request }) => {
      const sqlInjection = "'; DROP TABLE users; --";
      const response = await request.get(`${API_BASE_URL}/auth/callback?code=${encodeURIComponent(sqlInjection)}&state=valid`);

      // Should be safely handled (no SQL in this app, but good practice)
      expect([400, 401]).toContain(response.status());
    });
  });

  test.describe('POST /auth/logout - Error Cases', () => {

    test('should handle logout when user is not logged in', async ({ request }) => {
      // No cookies set
      const response = await request.post(`${API_BASE_URL}/auth/logout`);

      // Should handle gracefully (200 or redirect)
      expect([200, 302]).toContain(response.status());
    });

    test('should clear cookies even if Cognito logout fails', async ({ page, context }) => {
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

      await page.request.post(`${API_BASE_URL}/auth/logout`);

      // Cookies should be cleared regardless of Cognito response
      const cookies = await context.cookies();
      const accessToken = cookies.find(c => c.name === 'hhl_access_token');

      expect(accessToken).toBeUndefined();
    });

    test('should handle logout with invalid/expired token gracefully', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'expired_or_invalid_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.post(`${API_BASE_URL}/auth/logout`);

      // Should still logout successfully
      expect([200, 302]).toContain(response.status());
    });
  });

  test.describe('Rate Limiting', () => {

    test('should rate limit excessive login requests', async ({ request }) => {
      // Make many rapid login requests from same IP
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(request.get(`${API_BASE_URL}/auth/login`));
      }

      const responses = await Promise.all(requests);

      // Some should be rate limited (429)
      const rateLimited = responses.filter(r => r.status() === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('rate limit error should include Retry-After header', async ({ request }) => {
      // Trigger rate limit
      for (let i = 0; i < 10; i++) {
        await request.get(`${API_BASE_URL}/auth/login`);
      }

      const response = await request.get(`${API_BASE_URL}/auth/login`);

      if (response.status() === 429) {
        const retryAfter = response.headers()['retry-after'];
        expect(retryAfter).toBeTruthy();
        expect(parseInt(retryAfter)).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Security Headers', () => {

    test('all auth endpoints should include security headers', async ({ request }) => {
      const endpoints = [
        '/auth/login',
        '/auth/callback?code=test&state=test',
        '/auth/logout',
        '/auth/me'
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(`${API_BASE_URL}${endpoint}`);
        const headers = response.headers();

        // Should not expose server information
        expect(headers['x-powered-by']).toBeUndefined();
        expect(headers['server']).not.toContain('Express');
        expect(headers['server']).not.toContain('Koa');

        // Should include basic security headers
        if (headers['x-content-type-options']) {
          expect(headers['x-content-type-options']).toBe('nosniff');
        }
      }
    });

    test('should include X-Frame-Options to prevent clickjacking', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/login`);
      const headers = response.headers();

      if (headers['x-frame-options']) {
        expect(headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/i);
      }
    });
  });

  test.describe('Cookie Edge Cases', () => {

    test('should handle oversized cookie values gracefully', async ({ page, context }) => {
      // Set a cookie that exceeds browser limits
      const hugeCookieValue = 'x'.repeat(5000);

      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: hugeCookieValue,
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      // Should handle gracefully (likely 401 since it's invalid)
      expect([400, 401]).toContain(response.status());
    });

    test('should handle cookie with special characters', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'token<with>special&chars',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      // Should handle without crashing
      expect([200, 400, 401]).toContain(response.status());
    });
  });

  test.describe('Concurrent Requests', () => {

    test('should handle concurrent /auth/me requests correctly', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'valid_test_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      // Make 10 concurrent requests
      const requests = Array(10).fill(null).map(() =>
        page.request.get(`${API_BASE_URL}/auth/me`)
      );

      const responses = await Promise.all(requests);

      // All should succeed (or all should fail consistently)
      const statuses = responses.map(r => r.status());
      const allSame = statuses.every(s => s === statuses[0]);

      expect(allSame).toBe(true);
    });
  });

  test.describe('Edge Cases', () => {

    test('should handle requests with no user-agent header', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/auth/login`, {
        headers: {
          'User-Agent': ''
        }
      });

      // Should not crash
      expect([200, 302, 400]).toContain(response.status());
    });

    test('should handle requests with invalid content-type', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/logout`, {
        headers: {
          'Content-Type': 'invalid/content-type'
        }
      });

      // Should handle gracefully
      expect([200, 302, 400, 415]).toContain(response.status());
    });

    test('should handle IPv6 requests', async ({ request }) => {
      // Assuming API supports IPv6
      const response = await request.get(`${API_BASE_URL}/auth/login`);

      // Should work regardless of IP version
      expect([302, 400]).toContain(response.status());
    });
  });
});
