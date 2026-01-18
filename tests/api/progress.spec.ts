/**
 * API tests for /api/progress endpoints (Issue #304)
 *
 * This test suite covers the progress endpoints which track module completion
 * progress stored in DynamoDB. Tests cover:
 * - GET /api/progress/:courseSlug - Get progress for specific course
 * - POST /api/progress - Update module progress
 *
 * All endpoints require authentication via hhl_access_token cookie.
 *
 * @see docs/implementation-plan-issue-304.md
 * @see docs/specs/issue-299-external-sso-spec.md
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || BASE_URL;

test.describe('Progress Endpoints - Issue #304', () => {

  // ==========================================================================
  // GET /api/progress/:courseSlug - Get progress for specific course
  // ==========================================================================

  test.describe('GET /api/progress/:courseSlug', () => {

    test.describe('Successful Retrieval', () => {

      test('should return empty modules object for course with no progress', async ({ page, context }) => {
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

        const response = await page.request.get(`${AUTH_BASE_URL}/api/progress/new-course-no-progress`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('courseSlug');
        expect(data.courseSlug).toBe('new-course-no-progress');
        expect(data).toHaveProperty('modules');
        expect(typeof data.modules).toBe('object');
      });

      test('should return all module progress with correct structure', async ({ page, context }) => {
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

        const courseSlug = 'progress-test-course';
        const moduleId = 'test-module-1';

        // First create some progress
        await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug,
            moduleId,
            eventType: 'started'
          }
        });

        // Get progress
        const response = await page.request.get(`${AUTH_BASE_URL}/api/progress/${courseSlug}`);
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.courseSlug).toBe(courseSlug);
        expect(data.modules).toHaveProperty(moduleId);

        const moduleProgress = data.modules[moduleId];
        expect(moduleProgress).toHaveProperty('started');
        expect(moduleProgress).toHaveProperty('startedAt');
        expect(moduleProgress.started).toBe(true);
      });

      test('should include completed status when module is completed', async ({ page, context }) => {
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

        const courseSlug = 'completed-progress-test';
        const moduleId = 'completed-module';

        // Start module
        await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug,
            moduleId,
            eventType: 'started'
          }
        });

        // Complete module
        await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug,
            moduleId,
            eventType: 'completed'
          }
        });

        // Get progress
        const response = await page.request.get(`${AUTH_BASE_URL}/api/progress/${courseSlug}`);
        const data = await response.json();

        const moduleProgress = data.modules[moduleId];
        expect(moduleProgress.started).toBe(true);
        expect(moduleProgress.completed).toBe(true);
        expect(moduleProgress).toHaveProperty('startedAt');
        expect(moduleProgress).toHaveProperty('completedAt');
      });

      test('should return multiple modules when course has multiple', async ({ page, context }) => {
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

        const courseSlug = 'multi-module-course';

        // Create progress for multiple modules
        await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: { courseSlug, moduleId: 'module-1', eventType: 'started' }
        });

        await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: { courseSlug, moduleId: 'module-2', eventType: 'started' }
        });

        const response = await page.request.get(`${AUTH_BASE_URL}/api/progress/${courseSlug}`);
        const data = await response.json();

        expect(Object.keys(data.modules).length).toBe(2);
        expect(data.modules).toHaveProperty('module-1');
        expect(data.modules).toHaveProperty('module-2');
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
        const response = await page.request.get(`${AUTH_BASE_URL}/api/progress/test-course`);
        const duration = Date.now() - startTime;

        expect(response.status()).toBe(200);
        expect(duration).toBeLessThan(500); // p95 requirement
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

        const response = await page.request.get(`${AUTH_BASE_URL}/api/progress/Invalid Course!!!`);

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Authentication Failures (401)', () => {

      test('should return 401 when access token missing', async ({ page }) => {
        const response = await page.request.get(`${AUTH_BASE_URL}/api/progress/test-course`);

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

        const response = await page.request.get(`${AUTH_BASE_URL}/api/progress/test-course`);

        expect(response.status()).toBe(401);
      });

      test('should return 401 with expired JWT', async ({ page, context }) => {
        const expiredJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNjAwMDAwMDAwfQ.invalid';

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

        const response = await page.request.get(`${AUTH_BASE_URL}/api/progress/test-course`);

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

        const response = await page.request.get(`${AUTH_BASE_URL}/api/progress/test-course`, {
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
  // POST /api/progress - Update module progress
  // ==========================================================================

  test.describe('POST /api/progress', () => {

    test.describe('Successful Progress Updates', () => {

      test('should update module progress to started', async ({ page, context }) => {
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

        const progressData = {
          courseSlug: 'update-test-course',
          moduleId: 'update-test-module',
          eventType: 'started'
        };

        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: progressData
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('success');
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('progress');
        expect(data.progress.moduleId).toBe(progressData.moduleId);
        expect(data.progress.started).toBe(true);
        expect(data.progress).toHaveProperty('startedAt');
      });

      test('should update module progress to completed', async ({ page, context }) => {
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

        const courseSlug = 'complete-test-course';
        const moduleId = 'complete-test-module';

        // Start module first
        await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug,
            moduleId,
            eventType: 'started'
          }
        });

        // Complete module
        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug,
            moduleId,
            eventType: 'completed'
          }
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.progress.completed).toBe(true);
        expect(data.progress).toHaveProperty('completedAt');
      });

      test('should persist progress across multiple updates', async ({ page, context }) => {
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

        const courseSlug = 'persist-test-course';
        const moduleId = 'persist-test-module';

        // Start module
        const startResponse = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: { courseSlug, moduleId, eventType: 'started' }
        });
        expect(startResponse.status()).toBe(200);

        // Complete module
        const completeResponse = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: { courseSlug, moduleId, eventType: 'completed' }
        });
        expect(completeResponse.status()).toBe(200);

        // Verify both started and completed are set
        const getResponse = await page.request.get(`${AUTH_BASE_URL}/api/progress/${courseSlug}`);
        const data = await getResponse.json();

        const moduleProgress = data.modules[moduleId];
        expect(moduleProgress.started).toBe(true);
        expect(moduleProgress.completed).toBe(true);
        expect(moduleProgress.startedAt).toBeTruthy();
        expect(moduleProgress.completedAt).toBeTruthy();
      });

      test('should set timestamps to current time', async ({ page, context }) => {
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug: 'timestamp-test-course',
            moduleId: 'timestamp-test-module',
            eventType: 'started'
          }
        });

        const afterTime = new Date();

        const data = await response.json();
        const startedAt = new Date(data.progress.startedAt);

        expect(startedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(startedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            moduleId: 'test-module',
            eventType: 'started'
          }
        });

        expect(response.status()).toBe(400);

        const error = await response.json();
        expect(error.error).toMatch(/courseSlug|required/i);
      });

      test('should return 400 for missing moduleId', async ({ page, context }) => {
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug: 'test-course',
            eventType: 'started'
          }
        });

        expect(response.status()).toBe(400);

        const error = await response.json();
        expect(error.error).toMatch(/moduleId|required/i);
      });

      test('should return 400 for missing eventType', async ({ page, context }) => {
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug: 'test-course',
            moduleId: 'test-module'
          }
        });

        expect(response.status()).toBe(400);

        const error = await response.json();
        expect(error.error).toMatch(/eventType|required/i);
      });

      test('should return 400 for invalid eventType', async ({ page, context }) => {
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug: 'test-course',
            moduleId: 'test-module',
            eventType: 'invalid-event-type'
          }
        });

        expect(response.status()).toBe(400);

        const error = await response.json();
        expect(error.error).toMatch(/eventType|invalid/i);
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug: 'Invalid Course!!!',
            moduleId: 'test-module',
            eventType: 'started'
          }
        });

        expect(response.status()).toBe(400);
      });

      test('should return 400 for invalid moduleId format', async ({ page, context }) => {
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug: 'test-course',
            moduleId: 'Invalid Module!!!',
            eventType: 'started'
          }
        });

        expect(response.status()).toBe(400);
      });
    });

    test.describe('Authentication Failures (401)', () => {

      test('should return 401 when access token missing', async ({ page }) => {
        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug: 'test-course',
            moduleId: 'test-module',
            eventType: 'started'
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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          data: {
            courseSlug: 'test-course',
            moduleId: 'test-module',
            eventType: 'started'
          }
        });

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

        const response = await page.request.post(`${AUTH_BASE_URL}/api/progress`, {
          headers: {
            'Origin': 'https://hedgehog.cloud'
          },
          data: {
            courseSlug: 'test-course',
            moduleId: 'test-module',
            eventType: 'started'
          }
        });

        const headers = response.headers();
        expect(headers['access-control-allow-origin']).toBeTruthy();
        expect(headers['access-control-allow-credentials']).toBe('true');
      });
    });
  });
});
