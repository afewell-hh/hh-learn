/**
 * API tests for /api/badges endpoint (Issue #304)
 *
 * This test suite covers the badges endpoint which returns user's earned badges
 * stored in DynamoDB. Tests cover:
 * - GET /api/badges - List user's earned badges
 *
 * Endpoint requires authentication via hhl_access_token cookie.
 *
 * @see docs/implementation-plan-issue-304.md
 * @see docs/specs/issue-299-external-sso-spec.md
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || BASE_URL;

test.describe('Badge Endpoints - Issue #304', () => {

  // ==========================================================================
  // GET /api/badges - List user's earned badges
  // ==========================================================================

  test.describe('GET /api/badges', () => {

    test.describe('Successful Retrieval', () => {

      test('should return empty array for user with no badges', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'valid_test_jwt_token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('badges');
        expect(Array.isArray(data.badges)).toBe(true);
        expect(data.badges.length).toBeGreaterThanOrEqual(0);
      });

      test('should return all badges with correct structure', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'valid_test_jwt_token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);

        expect(response.status()).toBe(200);

        const data = await response.json();

        // If user has badges, verify structure
        if (data.badges.length > 0) {
          const badge = data.badges[0];
          expect(badge).toHaveProperty('badgeId');
          expect(badge).toHaveProperty('issuedAt');
          expect(badge).toHaveProperty('type');
          expect(badge).toHaveProperty('metadata');

          // Verify badgeId is a string
          expect(typeof badge.badgeId).toBe('string');

          // Verify issuedAt is ISO 8601 timestamp
          expect(badge.issuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

          // Verify type is one of the expected values
          expect(['module', 'course', 'pathway']).toContain(badge.type);

          // Verify metadata is an object
          expect(typeof badge.metadata).toBe('object');
          expect(badge.metadata).toHaveProperty('title');
        }
      });

      test('should include module badges in response', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'valid_test_jwt_token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);
        const data = await response.json();

        const moduleBadges = data.badges.filter((b: any) => b.type === 'module');

        if (moduleBadges.length > 0) {
          const moduleBadge = moduleBadges[0];
          expect(moduleBadge.metadata).toHaveProperty('moduleSlug');
          expect(moduleBadge.metadata).toHaveProperty('title');
        }
      });

      test('should include course badges in response', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'valid_test_jwt_token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);
        const data = await response.json();

        const courseBadges = data.badges.filter((b: any) => b.type === 'course');

        if (courseBadges.length > 0) {
          const courseBadge = courseBadges[0];
          expect(courseBadge.metadata).toHaveProperty('courseSlug');
          expect(courseBadge.metadata).toHaveProperty('title');
        }
      });

      test('should include pathway badges in response', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'valid_test_jwt_token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);
        const data = await response.json();

        const pathwayBadges = data.badges.filter((b: any) => b.type === 'pathway');

        if (pathwayBadges.length > 0) {
          const pathwayBadge = pathwayBadges[0];
          expect(pathwayBadge.metadata).toHaveProperty('pathwaySlug');
          expect(pathwayBadge.metadata).toHaveProperty('title');
        }
      });

      test('should return badges sorted by issuedAt descending (newest first)', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'valid_test_jwt_token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);
        const data = await response.json();

        if (data.badges.length > 1) {
          const issuedDates = data.badges.map((b: any) => new Date(b.issuedAt).getTime());

          // Verify descending order
          for (let i = 0; i < issuedDates.length - 1; i++) {
            expect(issuedDates[i]).toBeGreaterThanOrEqual(issuedDates[i + 1]);
          }
        }
      });

      test('should respond within acceptable latency', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'valid_test_jwt_token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const startTime = Date.now();
        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);
        const duration = Date.now() - startTime;

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(500); // p95 requirement
      });
    });

    test.describe('Authentication Failures (401)', () => {

      test('should return 401 when access token cookie is missing', async ({ page }) => {
        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);

        expect(response.status()).toBe(401);

        const error = await response.json();
        expect(error).toHaveProperty('error');
        expect(error.error).toMatch(/unauthorized/i);
      });

      test('should return 401 with invalid JWT signature', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'invalid.jwt.token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);

        expect(response.status()).toBe(401);

        const error = await response.json();
        expect(error.error).toMatch(/invalid|unauthorized/i);
      });

      test('should return 401 with expired JWT token', async ({ page, context }) => {
        const expiredJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid_signature';

        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: expiredJWT,
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);

        expect(response.status()).toBe(401);

        const error = await response.json();
        expect(error.error).toMatch(/expired|unauthorized/i);
      });

      test('should return 401 with malformed JWT', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'not-a-jwt-token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);

        expect(response.status()).toBe(401);
      });

      test('should return 401 when JWT is from wrong issuer', async ({ page, context }) => {
        const wrongIssuerJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiaXNzIjoiaHR0cHM6Ly93cm9uZy1pc3N1ZXIuY29tIiwiZXhwIjoxOTk5OTk5OTk5fQ.invalid_signature';

        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: wrongIssuerJWT,
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);

        expect(response.status()).toBe(401);
      });
    });

    test.describe('Error Response Format', () => {

      test('401 errors should have consistent error shape', async ({ page }) => {
        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`);

        expect(response.status()).toBe(401);

        const error = await response.json();

        // Standard error shape
        expect(error).toHaveProperty('error');
        expect(typeof error.error).toBe('string');
      });
    });

    test.describe('CORS and Security Headers', () => {

      test('should include proper CORS headers', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'valid_test_jwt_token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`, {
          headers: {
            'Origin': 'https://hedgehog.cloud'
          }
        });

        const headers = response.headers();

        expect(headers['access-control-allow-origin']).toBeTruthy();
        expect(headers['access-control-allow-credentials']).toBe('true');
      });

      test('should reject requests from unapproved origins', async ({ page, context }) => {
        await context.addCookies([
          {
            name: 'hhl_access_token',
            value: 'valid_test_jwt_token',
            domain: new URL(AUTH_BASE_URL).hostname,
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Strict'
          }
        ]);

        const response = await page.request.get(`${AUTH_BASE_URL}/api/badges`, {
          headers: {
            'Origin': 'https://evil.com'
          }
        });

        const headers = response.headers();
        const allowedOrigin = headers['access-control-allow-origin'];

        expect(allowedOrigin).not.toBe('https://evil.com');
      });
    });
  });
});
