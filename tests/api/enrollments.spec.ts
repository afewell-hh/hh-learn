/**
 * API tests for /api/enrollments endpoints (Issue #304)
 *
 * This test suite covers the enrollment endpoints which manage user course enrollments
 * stored in DynamoDB. Tests cover:
 * - GET /api/enrollments - List user's enrollments
 * - POST /api/enrollments - Create new enrollment
 * - DELETE /api/enrollments/:courseSlug - Remove enrollment
 *
 * All endpoints require authentication via hhl_access_token cookie.
 *
 * @see docs/implementation-plan-issue-304.md
 * @see docs/specs/issue-299-external-sso-spec.md
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || BASE_URL;

test.describe('Enrollment Endpoints - Issue #304', () => {

  // ==========================================================================
  // GET /api/enrollments - List user's enrollments
  // ==========================================================================

  test.describe('GET /api/enrollments', () => {

    test.describe('Successful Retrieval', () => {

      test('should return empty array for new user with no enrollments', async ({ page, context }) => {
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

        const response = await page.request.get(`${AUTH_BASE_URL}/api/enrollments`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('enrollments');
        expect(Array.isArray(data.enrollments)).toBe(true);
        expect(data.enrollments.length).toBeGreaterThanOrEqual(0);
      });

      test('should return all user enrollments with correct structure', async ({ page, context }) => {
        // First create an enrollment
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

        // Create enrollment
        await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: {
            courseSlug: 'test-course-1',
            pathwaySlug: 'test-pathway',
            enrollmentSource: 'catalog'
          }
        });

        // Get enrollments
        const response = await page.request.get(`${AUTH_BASE_URL}/api/enrollments`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.enrollments.length).toBeGreaterThan(0);

        const enrollment = data.enrollments[0];
        expect(enrollment).toHaveProperty('courseSlug');
        expect(enrollment).toHaveProperty('enrolledAt');
        expect(enrollment).toHaveProperty('enrollmentSource');
        expect(enrollment).toHaveProperty('status');
        expect(enrollment.status).toBe('active');
      });

      test('should include pathwaySlug when enrollment is part of pathway', async ({ page, context }) => {
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

        // Create pathway enrollment
        await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: {
            courseSlug: 'test-course-2',
            pathwaySlug: 'hedgehog-vlab',
            enrollmentSource: 'pathway_page'
          }
        });

        const response = await page.request.get(`${AUTH_BASE_URL}/api/enrollments`);
        const data = await response.json();

        const pathwayEnrollment = data.enrollments.find((e: any) => e.pathwaySlug === 'hedgehog-vlab');
        expect(pathwayEnrollment).toBeDefined();
        expect(pathwayEnrollment.pathwaySlug).toBe('hedgehog-vlab');
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
        const response = await page.request.get(`${AUTH_BASE_URL}/api/enrollments`);
        const duration = Date.now() - startTime;

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(500); // p95 requirement
      });
    });

    test.describe('Authentication Failures (401)', () => {

      test('should return 401 when access token cookie is missing', async ({ page }) => {
        const response = await page.request.get(`${AUTH_BASE_URL}/api/enrollments`);

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

        const response = await page.request.get(`${AUTH_BASE_URL}/api/enrollments`);

        expect(response.status()).toBe(401);
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

        const response = await page.request.get(`${AUTH_BASE_URL}/api/enrollments`);

        expect(response.status()).toBe(401);
      });
    });

    test.describe('CORS Headers', () => {

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

        const response = await page.request.get(`${AUTH_BASE_URL}/api/enrollments`, {
          headers: {
            'Origin': 'https://hedgehog.cloud'
          }
        });

        const headers = response.headers();

        expect(headers['access-control-allow-origin']).toBeTruthy();
        expect(headers['access-control-allow-credentials']).toBe('true');
      });
    });
  });

  // ==========================================================================
  // POST /api/enrollments - Create new enrollment
  // ==========================================================================

  test.describe('POST /api/enrollments', () => {

    test.describe('Successful Enrollment Creation', () => {

      test('should create new enrollment successfully', async ({ page, context }) => {
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

        const enrollmentData = {
          courseSlug: 'hedgehog-lab-foundations',
          pathwaySlug: 'hedgehog-vlab',
          enrollmentSource: 'catalog'
        };

        const response = await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: enrollmentData
        });

        expect(response.status()).toBe(201);

        const data = await response.json();
        expect(data).toHaveProperty('enrollment');
        expect(data.enrollment.courseSlug).toBe(enrollmentData.courseSlug);
        expect(data.enrollment.pathwaySlug).toBe(enrollmentData.pathwaySlug);
        expect(data.enrollment.enrollmentSource).toBe(enrollmentData.enrollmentSource);
        expect(data.enrollment.status).toBe('active');
        expect(data.enrollment).toHaveProperty('enrolledAt');
      });

      test('should create standalone course enrollment (no pathway)', async ({ page, context }) => {
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

        const enrollmentData = {
          courseSlug: 'standalone-course',
          enrollmentSource: 'course_page'
        };

        const response = await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: enrollmentData
        });

        expect(response.status()).toBe(201);

        const data = await response.json();
        expect(data.enrollment.courseSlug).toBe(enrollmentData.courseSlug);
        expect(data.enrollment.pathwaySlug).toBeUndefined();
      });

      test('should set enrolledAt timestamp to current time', async ({ page, context }) => {
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

        const beforeTime = new Date();

        const response = await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: {
            courseSlug: 'test-course-timestamp',
            enrollmentSource: 'catalog'
          }
        });

        const afterTime = new Date();

        const data = await response.json();
        const enrolledAt = new Date(data.enrollment.enrolledAt);

        expect(enrolledAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(enrolledAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      });
    });

    test.describe('Validation Errors (400)', () => {

      test('should return 400 for missing courseSlug', async ({ page, context }) => {
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: {
            enrollmentSource: 'catalog'
          }
        });

        expect(response.status()).toBe(400);

        const error = await response.json();
        expect(error.error).toMatch(/courseSlug|required/i);
      });

      test('should return 400 for invalid courseSlug format', async ({ page, context }) => {
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: {
            courseSlug: 'Invalid Course Slug!!!',
            enrollmentSource: 'catalog'
          }
        });

        expect(response.status()).toBe(400);
      });

      test('should return 400 for missing enrollmentSource', async ({ page, context }) => {
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: {
            courseSlug: 'test-course'
          }
        });

        expect(response.status()).toBe(400);

        const error = await response.json();
        expect(error.error).toMatch(/enrollmentSource|required/i);
      });
    });

    test.describe('Conflict Errors (409)', () => {

      test('should return 409 if user already enrolled in course', async ({ page, context }) => {
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

        const enrollmentData = {
          courseSlug: 'duplicate-test-course',
          enrollmentSource: 'catalog'
        };

        // First enrollment should succeed
        const response1 = await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: enrollmentData
        });
        expect(response1.status()).toBe(201);

        // Second enrollment should fail with 409
        const response2 = await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: enrollmentData
        });
        expect(response2.status()).toBe(409);

        const error = await response2.json();
        expect(error.error).toMatch(/already enrolled|conflict/i);
      });
    });

    test.describe('Authentication Failures (401)', () => {

      test('should return 401 when access token missing', async ({ page }) => {
        const response = await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: {
            courseSlug: 'test-course',
            enrollmentSource: 'catalog'
          }
        });

        expect(response.status()).toBe(401);
      });

      test('should return 401 with invalid JWT', async ({ page, context }) => {
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: {
            courseSlug: 'test-course',
            enrollmentSource: 'catalog'
          }
        });

        expect(response.status()).toBe(401);
      });
    });
  });

  // ==========================================================================
  // DELETE /api/enrollments/:courseSlug - Remove enrollment
  // ==========================================================================

  test.describe('DELETE /api/enrollments/:courseSlug', () => {

    test.describe('Successful Deletion', () => {

      test('should delete enrollment successfully with 204 status', async ({ page, context }) => {
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

        // First create an enrollment
        await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: {
            courseSlug: 'delete-test-course',
            enrollmentSource: 'catalog'
          }
        });

        // Then delete it
        const response = await page.request.delete(`${AUTH_BASE_URL}/api/enrollments/delete-test-course`);

        expect(response.status()).toBe(204);

        // Verify empty body
        const body = await response.text();
        expect(body).toBe('');
      });

      test('should remove enrollment from GET /api/enrollments after deletion', async ({ page, context }) => {
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

        const courseSlug = 'verify-delete-test-course';

        // Create enrollment
        await page.request.post(`${AUTH_BASE_URL}/api/enrollments`, {
          data: {
            courseSlug,
            enrollmentSource: 'catalog'
          }
        });

        // Verify it exists
        const listBefore = await page.request.get(`${AUTH_BASE_URL}/api/enrollments`);
        const dataBefore = await listBefore.json();
        const enrollmentBefore = dataBefore.enrollments.find((e: any) => e.courseSlug === courseSlug);
        expect(enrollmentBefore).toBeDefined();

        // Delete it
        await page.request.delete(`${AUTH_BASE_URL}/api/enrollments/${courseSlug}`);

        // Verify it's gone
        const listAfter = await page.request.get(`${AUTH_BASE_URL}/api/enrollments`);
        const dataAfter = await listAfter.json();
        const enrollmentAfter = dataAfter.enrollments.find((e: any) => e.courseSlug === courseSlug);
        expect(enrollmentAfter).toBeUndefined();
      });
    });

    test.describe('Not Found Errors (404)', () => {

      test('should return 404 if enrollment does not exist', async ({ page, context }) => {
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

        const response = await page.request.delete(`${AUTH_BASE_URL}/api/enrollments/non-existent-course`);

        expect(response.status()).toBe(404);

        const error = await response.json();
        expect(error.error).toMatch(/not found/i);
      });
    });

    test.describe('Validation Errors (400)', () => {

      test('should return 400 for invalid courseSlug format', async ({ page, context }) => {
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

        const response = await page.request.delete(`${AUTH_BASE_URL}/api/enrollments/Invalid Course!!!`);

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Authentication Failures (401)', () => {

      test('should return 401 when access token missing', async ({ page }) => {
        const response = await page.request.delete(`${AUTH_BASE_URL}/api/enrollments/test-course`);

        expect(response.status()).toBe(401);
      });

      test('should return 401 with invalid JWT', async ({ page, context }) => {
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

        const response = await page.request.delete(`${AUTH_BASE_URL}/api/enrollments/test-course`);

        expect(response.status()).toBe(401);
      });
    });
  });
});
