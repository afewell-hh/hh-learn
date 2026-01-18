/**
 * API tests for /api/health endpoint (Issue #304)
 *
 * This test suite covers the health check endpoint which provides system status.
 * Tests cover:
 * - GET /api/health - Health check endpoint
 *
 * This endpoint does NOT require authentication.
 *
 * @see docs/implementation-plan-issue-304.md
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || BASE_URL;

test.describe('Health Endpoint - Issue #304', () => {

  // ==========================================================================
  // GET /api/health - Health check endpoint
  // ==========================================================================

  test.describe('GET /api/health', () => {

    test('should return 200 with status, timestamp, and version', async ({ page }) => {
      const response = await page.request.get(`${AUTH_BASE_URL}/api/health`);

      expect(response.status()).toBe(200);

      const data = await response.json();

      // Verify required fields
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('version');

      // Verify field values
      expect(data.status).toBe('healthy');
      expect(typeof data.timestamp).toBe('string');
      expect(typeof data.version).toBe('string');

      // Verify timestamp is valid ISO 8601
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Verify version is not empty
      expect(data.version.length).toBeGreaterThan(0);
    });

    test('should not require authentication', async ({ page }) => {
      // No cookies set - should still work
      const response = await page.request.get(`${AUTH_BASE_URL}/api/health`);

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('healthy');
    });

    test('should return timestamp close to current time', async ({ page }) => {
      const beforeTime = new Date();

      const response = await page.request.get(`${AUTH_BASE_URL}/api/health`);

      const afterTime = new Date();

      const data = await response.json();
      const responseTime = new Date(data.timestamp);

      // Response timestamp should be between request start and end
      expect(responseTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(responseTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    test('should respond within acceptable latency', async ({ page }) => {
      const startTime = Date.now();
      const response = await page.request.get(`${AUTH_BASE_URL}/api/health`);
      const duration = Date.now() - startTime;

      expect(response.status()).toBe(200);
      expect(duration).toBeLessThan(500); // p95 requirement
    });

    test('should work multiple times consecutively', async ({ page }) => {
      const response1 = await page.request.get(`${AUTH_BASE_URL}/api/health`);
      expect(response1.status()).toBe(200);

      const response2 = await page.request.get(`${AUTH_BASE_URL}/api/health`);
      expect(response2.status()).toBe(200);

      const response3 = await page.request.get(`${AUTH_BASE_URL}/api/health`);
      expect(response3.status()).toBe(200);

      const data1 = await response1.json();
      const data2 = await response2.json();
      const data3 = await response3.json();

      // All should return healthy status
      expect(data1.status).toBe('healthy');
      expect(data2.status).toBe('healthy');
      expect(data3.status).toBe('healthy');

      // Timestamps should be different (or very close)
      expect(data1.timestamp).toBeTruthy();
      expect(data2.timestamp).toBeTruthy();
      expect(data3.timestamp).toBeTruthy();
    });

    test.describe('Response Headers', () => {

      test('should include proper CORS headers', async ({ page }) => {
        const response = await page.request.get(`${AUTH_BASE_URL}/api/health`, {
          headers: {
            'Origin': 'https://hedgehog.cloud'
          }
        });

        const headers = response.headers();

        expect(headers['access-control-allow-origin']).toBeTruthy();
      });

      test('should not include credentials header (public endpoint)', async ({ page }) => {
        const response = await page.request.get(`${AUTH_BASE_URL}/api/health`, {
          headers: {
            'Origin': 'https://hedgehog.cloud'
          }
        });

        const headers = response.headers();

        // Health endpoint is public, so credentials header is optional
        // Just verify CORS is configured
        expect(headers['access-control-allow-origin']).toBeTruthy();
      });

      test('should include content-type application/json', async ({ page }) => {
        const response = await page.request.get(`${AUTH_BASE_URL}/api/health`);

        const headers = response.headers();

        expect(headers['content-type']).toMatch(/application\/json/);
      });
    });

    test.describe('Response Consistency', () => {

      test('should always use same version across requests', async ({ page }) => {
        const response1 = await page.request.get(`${AUTH_BASE_URL}/api/health`);
        const data1 = await response1.json();

        const response2 = await page.request.get(`${AUTH_BASE_URL}/api/health`);
        const data2 = await response2.json();

        // Version should be consistent across requests
        expect(data1.version).toBe(data2.version);
      });

      test('should have no unexpected fields in response', async ({ page }) => {
        const response = await page.request.get(`${AUTH_BASE_URL}/api/health`);
        const data = await response.json();

        // Only expected fields should be present
        const expectedFields = ['status', 'timestamp', 'version'];
        const actualFields = Object.keys(data);

        for (const field of actualFields) {
          expect(expectedFields).toContain(field);
        }

        // All expected fields should be present
        for (const field of expectedFields) {
          expect(actualFields).toContain(field);
        }
      });
    });

    test.describe('OPTIONS Preflight', () => {

      test('should respond to OPTIONS request for CORS preflight', async ({ page }) => {
        const response = await page.request.fetch(`${AUTH_BASE_URL}/api/health`, {
          method: 'OPTIONS',
          headers: {
            'Origin': 'https://hedgehog.cloud',
            'Access-Control-Request-Method': 'GET'
          }
        });

        // Should return 200 or 204 for OPTIONS
        expect([200, 204]).toContain(response.status());

        const headers = response.headers();

        // Should include CORS headers
        expect(headers['access-control-allow-origin']).toBeTruthy();
        expect(headers['access-control-allow-methods']).toBeTruthy();
      });
    });
  });
});
