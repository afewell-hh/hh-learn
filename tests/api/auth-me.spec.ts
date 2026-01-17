/**
 * API tests for /auth/me endpoint (Issue #303)
 *
 * This test suite covers the /auth/me endpoint which returns the authenticated
 * user's profile from DynamoDB. Tests cover:
 * - Successful profile retrieval with valid token
 * - 401 responses for missing/invalid/expired tokens
 * - JWT validation logic
 * - User profile data structure
 *
 * @see docs/specs/issue-299-external-sso-spec.md
 * @see docs/implementation-plan-issue-299.md
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL || 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com';

test.describe('GET /auth/me - User Profile Endpoint (Issue #303)', () => {

  test.describe('Successful Profile Retrieval', () => {

    test('should return user profile with valid access token cookie', async ({ page, context }) => {
      // Set a valid mock access token cookie
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'valid_test_jwt_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      expect(response.status()).toBe(200);

      const profile = await response.json();

      // Verify profile structure
      expect(profile).toHaveProperty('userId');
      expect(profile).toHaveProperty('email');
      expect(profile).toHaveProperty('displayName');
      expect(profile.userId).toBeTruthy();
      expect(profile.email).toContain('@');
    });

    test('should include all expected profile fields', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'valid_test_jwt_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);
      const profile = await response.json();

      // Required fields
      expect(profile).toHaveProperty('userId');
      expect(profile).toHaveProperty('email');
      expect(profile).toHaveProperty('createdAt');
      expect(profile).toHaveProperty('updatedAt');

      // Optional fields (may or may not be present)
      if (profile.displayName) {
        expect(typeof profile.displayName).toBe('string');
      }
      if (profile.givenName) {
        expect(typeof profile.givenName).toBe('string');
      }
      if (profile.familyName) {
        expect(typeof profile.familyName).toBe('string');
      }
      if (profile.hubspotContactId) {
        expect(typeof profile.hubspotContactId).toBe('string');
      }
    });

    test('should return consistent data on multiple requests', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'valid_test_jwt_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response1 = await page.request.get(`${API_BASE_URL}/auth/me`);
      const profile1 = await response1.json();

      const response2 = await page.request.get(`${API_BASE_URL}/auth/me`);
      const profile2 = await response2.json();

      // Should return same userId and email
      expect(profile1.userId).toBe(profile2.userId);
      expect(profile1.email).toBe(profile2.email);
    });
  });

  test.describe('Authentication Failures (401)', () => {

    test('should return 401 when access token cookie is missing', async ({ page }) => {
      // No cookies set
      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      expect(response.status()).toBe(401);

      const error = await response.json();
      expect(error).toHaveProperty('error');
      expect(error.error).toContain('Unauthorized');
    });

    test('should return 401 with invalid JWT signature', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'invalid.jwt.token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      expect(response.status()).toBe(401);

      const error = await response.json();
      expect(error.error).toMatch(/invalid|unauthorized/i);
    });

    test('should return 401 with expired JWT token', async ({ page, context }) => {
      // JWT with expired timestamp (exp claim in past)
      const expiredJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid_signature';

      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: expiredJWT,
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      expect(response.status()).toBe(401);

      const error = await response.json();
      expect(error.error).toMatch(/expired|unauthorized/i);
    });

    test('should return 401 with malformed JWT', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'not-a-jwt-token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      expect(response.status()).toBe(401);
    });

    test('should return 401 when JWT is from wrong issuer', async ({ page, context }) => {
      // JWT with wrong issuer claim
      const wrongIssuerJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiaXNzIjoiaHR0cHM6Ly93cm9uZy1pc3N1ZXIuY29tIiwiZXhwIjoxOTk5OTk5OTk5fQ.invalid_signature';

      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: wrongIssuerJWT,
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      expect(response.status()).toBe(401);
    });
  });

  test.describe('Error Response Format', () => {

    test('401 errors should have consistent error shape', async ({ page }) => {
      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      expect(response.status()).toBe(401);

      const error = await response.json();

      // Standard error shape
      expect(error).toHaveProperty('error');
      expect(typeof error.error).toBe('string');

      // Optional: statusCode field
      if (error.statusCode) {
        expect(error.statusCode).toBe(401);
      }
    });

    test('should include WWW-Authenticate header on 401', async ({ page }) => {
      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      expect(response.status()).toBe(401);

      const wwwAuth = response.headers()['www-authenticate'];
      expect(wwwAuth).toBeTruthy();
      expect(wwwAuth).toContain('Bearer');
    });
  });

  test.describe('CORS and Security Headers', () => {

    test('should include proper CORS headers', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'valid_test_jwt_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Origin': 'https://hedgehog.cloud'
        }
      });

      const headers = response.headers();

      expect(headers['access-control-allow-origin']).toBeTruthy();
      expect(headers['access-control-allow-credentials']).toBe('true');
    });

    test('should reject requests from unapproved origins', async ({ page }) => {
      const response = await page.request.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Origin': 'https://evil.com'
        }
      });

      // Should either reject CORS or not include access-control-allow-origin
      const headers = response.headers();
      const allowedOrigin = headers['access-control-allow-origin'];

      expect(allowedOrigin).not.toBe('https://evil.com');
    });
  });

  test.describe('User Profile Data from DynamoDB', () => {

    test('should fetch user from DynamoDB users table', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'valid_test_jwt_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);
      const profile = await response.json();

      // userId should be Cognito sub from JWT
      expect(profile.userId).toMatch(/^[a-f0-9-]{36}$/i); // UUID format

      // Email should be from DynamoDB users table
      expect(profile.email).toContain('@');
    });

    test('should return 404 if user not found in DynamoDB', async ({ page, context }) => {
      // Valid JWT but user doesn't exist in users table yet
      const newUserJWT = 'valid_jwt_for_new_user_not_in_db';

      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: newUserJWT,
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      // Could be 404 (user not found) or auto-create and return 200
      // Depends on implementation decision
      expect([200, 404]).toContain(response.status());
    });
  });

  test.describe('Performance and Caching', () => {

    test('should respond within acceptable latency', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'valid_test_jwt_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const startTime = Date.now();
      const response = await page.request.get(`${API_BASE_URL}/auth/me`);
      const duration = Date.now() - startTime;

      expect(response.status()).toBe(200);

      // Should respond within 500ms (p95 requirement)
      expect(duration).toBeLessThan(500);
    });

    test('should not cache user profile responses', async ({ page, context }) => {
      await context.addCookies([
        {
          name: 'hhl_access_token',
          value: 'valid_test_jwt_token',
          domain: new URL(API_BASE_URL).hostname,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        }
      ]);

      const response = await page.request.get(`${API_BASE_URL}/auth/me`);

      const headers = response.headers();

      // Should not cache sensitive user data
      expect(headers['cache-control']).toMatch(/no-cache|no-store|private/i);
    });
  });
});
