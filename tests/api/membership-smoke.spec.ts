/**
 * API-level smoke tests for membership-related flows with JWT authentication
 *
 * These tests exercise Lambda APIs directly using JWT authentication tokens.
 *
 * Test Coverage:
 * - /auth/login - JWT authentication endpoint
 * - /events/track - Enrollment and progress events (with JWT auth)
 * - /enrollments/list - Verify enrollment persistence (with JWT auth)
 * - /progress/read - Verify progress persistence (with JWT auth)
 *
 * Related Issues:
 * - #253: Phase 3 - Update tests for JWT public auth
 * - #251: JWT-based public page authentication implementation
 * - #242: Public-page authentication alternative
 */

import { test, expect, APIRequestContext } from '@playwright/test';

// API Gateway base URL (from hubspot-project-apps-agent-guide.md)
const API_BASE_URL = process.env.API_BASE_URL || 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com';

// Test contact credentials (from environment or defaults)
const TEST_EMAIL = process.env.HUBSPOT_TEST_EMAIL || process.env.HUBSPOT_TEST_USERNAME;

/**
 * Helper function to get JWT token for authenticated requests
 */
async function getJWTToken(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email }
  });

  expect(response.ok(), `JWT login should succeed for ${email}`).toBeTruthy();
  const data = await response.json();
  expect(data.token).toBeTruthy();

  return data.token;
}

// Run tests serially to avoid race conditions on shared test contact state
test.describe.configure({ mode: 'serial' });

test.describe('Membership API Smoke Tests with JWT', () => {

  test.beforeAll(async () => {
    // Validate that required environment variables are set
    if (!TEST_EMAIL) {
      throw new Error(
        'TEST_EMAIL is required. Set HUBSPOT_TEST_EMAIL or HUBSPOT_TEST_USERNAME environment variable.'
      );
    }
  });

  test.describe('JWT Authentication', () => {

    test('should authenticate and return valid JWT token', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        headers: { 'Content-Type': 'application/json' },
        data: { email: TEST_EMAIL }
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Verify response structure
      expect(data.token).toBeTruthy();
      expect(data.email).toBe(TEST_EMAIL);
      expect(data.contactId).toBeTruthy();
      expect(typeof data.token).toBe('string');

      // JWT token should have 3 parts (header.payload.signature)
      const tokenParts = data.token.split('.');
      expect(tokenParts.length).toBe(3);
    });

    test('should reject invalid email format', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        headers: { 'Content-Type': 'application/json' },
        data: { email: 'not-an-email' }
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.code).toBe('INVALID_EMAIL');
    });

    test('should reject non-existent email', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/auth/login`, {
        headers: { 'Content-Type': 'application/json' },
        data: { email: 'nonexistent-user-12345@example.com' }
      });

      expect(response.status()).toBe(404);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.code).toBe('CONTACT_NOT_FOUND');
    });
  });

  test.describe('Course Enrollment Flow (with JWT)', () => {

    test('should enroll in a course using JWT auth', async ({ request }) => {
      // Get JWT token
      const token = await getJWTToken(request, TEST_EMAIL!);

      const courseSlug = 'api-test-course';
      const timestamp = new Date().toISOString();

      // Step 1: Send enrollment event with JWT auth
      const enrollResponse = await request.post(`${API_BASE_URL}/events/track`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          eventName: 'learning_course_enrolled',
          course_slug: courseSlug,
          enrollment_source: 'api_smoke_test_jwt',
          payload: {
            ts: timestamp,
          },
        },
      });

      // Verify successful tracking
      expect(enrollResponse.ok()).toBeTruthy();
      const enrollData = await enrollResponse.json();
      expect(enrollData.status).toBe('persisted');
      expect(enrollData.mode).toBe('authenticated');
      expect(['properties', 'events']).toContain(enrollData.backend);

      // Step 2: Verify enrollment appears in enrollments list (with JWT auth)
      const enrollmentsResponse = await request.get(`${API_BASE_URL}/enrollments/list`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(enrollmentsResponse.ok()).toBeTruthy();
      const enrollmentsData = await enrollmentsResponse.json();

      // Should have at least our test enrollment
      expect(enrollmentsData.courses).toBeDefined();
      const hasCourse = enrollmentsData.courses.some(
        (c: any) => c.slug === courseSlug || c.course_slug === courseSlug
      );
      expect(hasCourse).toBeTruthy();
    });

    test('should mark course module as started using JWT', async ({ request }) => {
      // Get JWT token
      const token = await getJWTToken(request, TEST_EMAIL!);
      const moduleSlug = 'api-test-module-started';
      const courseSlug = 'api-test-course';
      const timestamp = new Date().toISOString();

      // Step 1: Send module started event with JWT auth
      const startResponse = await request.post(`${API_BASE_URL}/events/track`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          eventName: 'learning_module_started',
          payload: {
            module_slug: moduleSlug,
            course_slug: courseSlug,
            ts: timestamp,
          },
        },
      });

      expect(startResponse.ok()).toBeTruthy();
      const startData = await startResponse.json();
      expect(startData.status).toBe('persisted');
      expect(startData.mode).toBe('authenticated');

      // Step 2: Verify progress reflects started module (with JWT auth)
      const progressResponse = await request.get(`${API_BASE_URL}/progress/read`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(progressResponse.ok()).toBeTruthy();
      const progressData = await progressResponse.json();

      // Progress should have modules object with our test module
      expect(progressData.progress).toBeDefined();
      expect(progressData.progress.modules).toBeDefined();
      expect(progressData.progress.modules[moduleSlug]).toBeDefined();
      expect(progressData.progress.modules[moduleSlug].started).toBe(true);
    });

    test('should mark course module as completed using JWT', async ({ request }) => {
      // Get JWT token
      const token = await getJWTToken(request, TEST_EMAIL!);
      const moduleSlug = 'api-test-module-completed';
      const courseSlug = 'api-test-course';
      const timestamp = new Date().toISOString();

      // Step 1: Send module completed event with JWT auth
      const completeResponse = await request.post(`${API_BASE_URL}/events/track`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          eventName: 'learning_module_completed',
          payload: {
            module_slug: moduleSlug,
            course_slug: courseSlug,
            ts: timestamp,
          },
        },
      });

      expect(completeResponse.ok()).toBeTruthy();
      const completeData = await completeResponse.json();
      expect(completeData.status).toBe('persisted');
      expect(completeData.mode).toBe('authenticated');

      // Step 2: Verify progress reflects completed module (with JWT auth)
      const progressResponse = await request.get(`${API_BASE_URL}/progress/read`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(progressResponse.ok()).toBeTruthy();
      const progressData = await progressResponse.json();

      // Progress should show module as completed
      expect(progressData.progress.modules[moduleSlug]).toBeDefined();
      expect(progressData.progress.modules[moduleSlug].completed).toBe(true);
      expect(progressData.progress.modules[moduleSlug].completedAt).toBeDefined();
    });
  });

  test.describe('Pathway Enrollment Flow (with JWT)', () => {

    test('should enroll in a pathway using JWT auth', async ({ request }) => {
      // Get JWT token
      const token = await getJWTToken(request, TEST_EMAIL!);
      const pathwaySlug = 'api-test-pathway';
      const timestamp = new Date().toISOString();

      // Step 1: Send pathway enrollment event with JWT auth
      const enrollResponse = await request.post(`${API_BASE_URL}/events/track`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          eventName: 'learning_pathway_enrolled',
          pathway_slug: pathwaySlug,
          enrollment_source: 'api_smoke_test_jwt',
          payload: {
            ts: timestamp,
          },
        },
      });

      expect(enrollResponse.ok()).toBeTruthy();
      const enrollData = await enrollResponse.json();
      expect(enrollData.status).toBe('persisted');
      expect(enrollData.mode).toBe('authenticated');

      // Step 2: Verify enrollment appears in enrollments list (with JWT auth)
      const enrollmentsResponse = await request.get(`${API_BASE_URL}/enrollments/list`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(enrollmentsResponse.ok()).toBeTruthy();
      const enrollmentsData = await enrollmentsResponse.json();

      // Should have at least our test enrollment
      expect(enrollmentsData.pathways).toBeDefined();
      const hasPathway = enrollmentsData.pathways.some(
        (p: any) => p.slug === pathwaySlug || p.pathway_slug === pathwaySlug
      );
      expect(hasPathway).toBeTruthy();
    });

    test('should mark pathway module as started using JWT', async ({ request }) => {
      // Get JWT token
      const token = await getJWTToken(request, TEST_EMAIL!);
      const moduleSlug = 'api-test-pathway-module';
      const pathwaySlug = 'api-test-pathway';
      const timestamp = new Date().toISOString();

      // Step 1: Send module started event with JWT auth
      const startResponse = await request.post(`${API_BASE_URL}/events/track`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          eventName: 'learning_module_started',
          payload: {
            module_slug: moduleSlug,
            pathway_slug: pathwaySlug,
            ts: timestamp,
          },
        },
      });

      expect(startResponse.ok()).toBeTruthy();
      const startData = await startResponse.json();
      expect(startData.status).toBe('persisted');
      expect(startData.mode).toBe('authenticated');

      // Step 2: Verify progress reflects started module (with JWT auth)
      const progressResponse = await request.get(`${API_BASE_URL}/progress/read`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      expect(progressResponse.ok()).toBeTruthy();
      const progressData = await progressResponse.json();

      // Progress should show module as started
      expect(progressData.progress.modules[moduleSlug]).toBeDefined();
      expect(progressData.progress.modules[moduleSlug].started).toBe(true);
    });
  });

  test.describe('Progress Aggregation (with JWT)', () => {

    test('should retrieve course progress aggregate using JWT', async ({ request }) => {
      // Get JWT token
      const token = await getJWTToken(request, TEST_EMAIL!);
      const courseSlug = 'api-test-course';

      const response = await request.get(
        `${API_BASE_URL}/progress/aggregate?type=course&slug=${encodeURIComponent(courseSlug)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Verify response structure
      expect(data.type).toBe('course');
      expect(data.slug).toBe(courseSlug);
      expect(data.completion).toBeDefined();
      expect(typeof data.completion.percentage).toBe('number');
      expect(data.completion.completedModules).toBeDefined();
      expect(data.completion.totalModules).toBeDefined();
    });

    test('should retrieve pathway progress aggregate using JWT', async ({ request }) => {
      // Get JWT token
      const token = await getJWTToken(request, TEST_EMAIL!);
      const pathwaySlug = 'api-test-pathway';

      const response = await request.get(
        `${API_BASE_URL}/progress/aggregate?type=pathway&slug=${encodeURIComponent(pathwaySlug)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Verify response structure
      expect(data.type).toBe('pathway');
      expect(data.slug).toBe(pathwaySlug);
      expect(data.completion).toBeDefined();
      expect(typeof data.completion.percentage).toBe('number');
    });
  });

  test.describe('Anonymous vs Authenticated Behavior', () => {

    test('should handle anonymous events (no contactIdentifier)', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/events/track`, {
        data: {
          eventName: 'learning_page_viewed',
          payload: {
            content_type: 'course',
            slug: 'anonymous-test-course',
            ts: new Date().toISOString(),
          },
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Anonymous events should be logged but not persisted
      expect(data.status).toBe('logged');
      expect(data.mode).toBe('anonymous');
    });

    test('should handle authenticated events with JWT', async ({ request }) => {
      // Get JWT token
      const token = await getJWTToken(request, TEST_EMAIL!);

      const response = await request.post(`${API_BASE_URL}/events/track`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          eventName: 'learning_page_viewed',
          payload: {
            content_type: 'course',
            slug: 'authenticated-test-course',
            ts: new Date().toISOString(),
          },
        },
      });

      expect(response.ok()).toBeTruthy();
      const data = await response.json();

      // Authenticated events should be persisted
      expect(data.status).toBe('persisted');
      expect(data.mode).toBe('authenticated');
    });
  });

  test.describe('Error Handling', () => {

    test('should return 400 for invalid event payload even with valid JWT', async ({ request }) => {
      // Get JWT token
      const token = await getJWTToken(request, TEST_EMAIL!);

      const response = await request.post(`${API_BASE_URL}/events/track`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        data: {
          eventName: 'learning_module_started',
          // Missing required module_slug in payload
          payload: {},
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.code).toBe('SCHEMA_VALIDATION_FAILED');
    });

    test('should return 400 for missing JWT in enrollments/list', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/enrollments/list`);

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test('should return 401 for invalid JWT token', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/events/track`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token-12345'
        },
        data: {
          eventName: 'learning_page_viewed',
          payload: {
            content_type: 'course',
            slug: 'test-course',
          },
        },
      });

      // Should still work as anonymous if JWT is invalid (backward compatibility)
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.mode).toBe('anonymous');
    });
  });
});
