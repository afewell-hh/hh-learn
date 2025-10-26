/**
 * API-level smoke tests for membership-related flows
 *
 * These tests exercise Lambda APIs directly without relying on HubSpot's
 * membership UI login (which is blocked by CSRF in automated browsers).
 *
 * Test Coverage:
 * - /events/track - Enrollment and progress events
 * - /enrollments/list - Verify enrollment persistence
 * - /progress/read - Verify progress persistence
 *
 * Related Issues:
 * - #248: Implement API-level membership smoke tests
 * - #247: HubSpot membership automation research
 * - #242: Public-page authentication alternative (long-term)
 */

import { test, expect } from '@playwright/test';

// API Gateway base URL (from hubspot-project-apps-agent-guide.md)
const API_BASE_URL = process.env.API_BASE_URL || 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com';

// Test contact credentials (from environment or defaults)
const TEST_EMAIL = process.env.HUBSPOT_TEST_EMAIL || process.env.HUBSPOT_TEST_USERNAME;
const TEST_CONTACT_ID = process.env.HUBSPOT_TEST_CONTACT_ID;

test.describe('Membership API Smoke Tests', () => {

  test.beforeAll(async () => {
    // Validate that required environment variables are set
    if (!TEST_EMAIL) {
      throw new Error(
        'TEST_EMAIL is required. Set HUBSPOT_TEST_EMAIL or HUBSPOT_TEST_USERNAME environment variable.'
      );
    }
  });

  test.describe('Course Enrollment Flow', () => {

    test('should enroll in a course and verify via enrollments API', async ({ request }) => {
      const courseSlug = 'api-test-course';
      const timestamp = new Date().toISOString();

      // Step 1: Send enrollment event
      const enrollResponse = await request.post(`${API_BASE_URL}/events/track`, {
        data: {
          eventName: 'learning_course_enrolled',
          contactIdentifier: {
            email: TEST_EMAIL,
            ...(TEST_CONTACT_ID && { contactId: TEST_CONTACT_ID }),
          },
          course_slug: courseSlug,
          enrollment_source: 'api_smoke_test',
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

      // Step 2: Verify enrollment appears in enrollments list
      const enrollmentsResponse = await request.get(
        `${API_BASE_URL}/enrollments/list?email=${encodeURIComponent(TEST_EMAIL!)}`
      );

      expect(enrollmentsResponse.ok()).toBeTruthy();
      const enrollmentsData = await enrollmentsResponse.json();

      // Should have at least our test enrollment
      expect(enrollmentsData.courses).toBeDefined();
      const hasCourse = enrollmentsData.courses.some(
        (c: any) => c.slug === courseSlug || c.course_slug === courseSlug
      );
      expect(hasCourse).toBeTruthy();
    });

    test('should mark course module as started and verify progress', async ({ request }) => {
      const moduleSlug = 'api-test-module-started';
      const courseSlug = 'api-test-course';
      const timestamp = new Date().toISOString();

      // Step 1: Send module started event
      const startResponse = await request.post(`${API_BASE_URL}/events/track`, {
        data: {
          eventName: 'learning_module_started',
          contactIdentifier: {
            email: TEST_EMAIL,
            ...(TEST_CONTACT_ID && { contactId: TEST_CONTACT_ID }),
          },
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

      // Step 2: Verify progress reflects started module
      const progressResponse = await request.get(
        `${API_BASE_URL}/progress/read?email=${encodeURIComponent(TEST_EMAIL!)}`
      );

      expect(progressResponse.ok()).toBeTruthy();
      const progressData = await progressResponse.json();

      // Progress should have modules object with our test module
      expect(progressData.progress).toBeDefined();
      expect(progressData.progress.modules).toBeDefined();
      expect(progressData.progress.modules[moduleSlug]).toBeDefined();
      expect(progressData.progress.modules[moduleSlug].started).toBe(true);
    });

    test('should mark course module as completed and verify progress', async ({ request }) => {
      const moduleSlug = 'api-test-module-completed';
      const courseSlug = 'api-test-course';
      const timestamp = new Date().toISOString();

      // Step 1: Send module completed event
      const completeResponse = await request.post(`${API_BASE_URL}/events/track`, {
        data: {
          eventName: 'learning_module_completed',
          contactIdentifier: {
            email: TEST_EMAIL,
            ...(TEST_CONTACT_ID && { contactId: TEST_CONTACT_ID }),
          },
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

      // Step 2: Verify progress reflects completed module
      const progressResponse = await request.get(
        `${API_BASE_URL}/progress/read?email=${encodeURIComponent(TEST_EMAIL!)}`
      );

      expect(progressResponse.ok()).toBeTruthy();
      const progressData = await progressResponse.json();

      // Progress should show module as completed
      expect(progressData.progress.modules[moduleSlug]).toBeDefined();
      expect(progressData.progress.modules[moduleSlug].completed).toBe(true);
      expect(progressData.progress.modules[moduleSlug].completedAt).toBeDefined();
    });
  });

  test.describe('Pathway Enrollment Flow', () => {

    test('should enroll in a pathway and verify via enrollments API', async ({ request }) => {
      const pathwaySlug = 'api-test-pathway';
      const timestamp = new Date().toISOString();

      // Step 1: Send pathway enrollment event
      const enrollResponse = await request.post(`${API_BASE_URL}/events/track`, {
        data: {
          eventName: 'learning_pathway_enrolled',
          contactIdentifier: {
            email: TEST_EMAIL,
            ...(TEST_CONTACT_ID && { contactId: TEST_CONTACT_ID }),
          },
          pathway_slug: pathwaySlug,
          enrollment_source: 'api_smoke_test',
          payload: {
            ts: timestamp,
          },
        },
      });

      expect(enrollResponse.ok()).toBeTruthy();
      const enrollData = await enrollResponse.json();
      expect(enrollData.status).toBe('persisted');
      expect(enrollData.mode).toBe('authenticated');

      // Step 2: Verify enrollment appears in enrollments list
      const enrollmentsResponse = await request.get(
        `${API_BASE_URL}/enrollments/list?email=${encodeURIComponent(TEST_EMAIL!)}`
      );

      expect(enrollmentsResponse.ok()).toBeTruthy();
      const enrollmentsData = await enrollmentsResponse.json();

      // Should have at least our test enrollment
      expect(enrollmentsData.pathways).toBeDefined();
      const hasPathway = enrollmentsData.pathways.some(
        (p: any) => p.slug === pathwaySlug || p.pathway_slug === pathwaySlug
      );
      expect(hasPathway).toBeTruthy();
    });

    test('should mark pathway module as started and verify progress', async ({ request }) => {
      const moduleSlug = 'api-test-pathway-module';
      const pathwaySlug = 'api-test-pathway';
      const timestamp = new Date().toISOString();

      // Step 1: Send module started event
      const startResponse = await request.post(`${API_BASE_URL}/events/track`, {
        data: {
          eventName: 'learning_module_started',
          contactIdentifier: {
            email: TEST_EMAIL,
            ...(TEST_CONTACT_ID && { contactId: TEST_CONTACT_ID }),
          },
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

      // Step 2: Verify progress reflects started module
      const progressResponse = await request.get(
        `${API_BASE_URL}/progress/read?email=${encodeURIComponent(TEST_EMAIL!)}`
      );

      expect(progressResponse.ok()).toBeTruthy();
      const progressData = await progressResponse.json();

      // Progress should show module as started
      expect(progressData.progress.modules[moduleSlug]).toBeDefined();
      expect(progressData.progress.modules[moduleSlug].started).toBe(true);
    });
  });

  test.describe('Progress Aggregation', () => {

    test('should retrieve course progress aggregate', async ({ request }) => {
      const courseSlug = 'api-test-course';

      const response = await request.get(
        `${API_BASE_URL}/progress/aggregate?` +
        `email=${encodeURIComponent(TEST_EMAIL!)}&` +
        `type=course&` +
        `slug=${encodeURIComponent(courseSlug)}`
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

    test('should retrieve pathway progress aggregate', async ({ request }) => {
      const pathwaySlug = 'api-test-pathway';

      const response = await request.get(
        `${API_BASE_URL}/progress/aggregate?` +
        `email=${encodeURIComponent(TEST_EMAIL!)}&` +
        `type=pathway&` +
        `slug=${encodeURIComponent(pathwaySlug)}`
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

    test('should handle authenticated events with email', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/events/track`, {
        data: {
          eventName: 'learning_page_viewed',
          contactIdentifier: {
            email: TEST_EMAIL,
          },
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

    test('should return 400 for invalid event payload', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/events/track`, {
        data: {
          eventName: 'learning_module_started',
          // Missing required module_slug in payload
          contactIdentifier: { email: TEST_EMAIL },
          payload: {},
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.code).toBe('SCHEMA_VALIDATION_FAILED');
    });

    test('should return 400 for missing contact identifier in enrollments/list', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/enrollments/list`);

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test('should return 400 for invalid email format', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/events/track`, {
        data: {
          eventName: 'learning_page_viewed',
          contactIdentifier: {
            email: 'not-an-email',
          },
          payload: {
            content_type: 'course',
            slug: 'test-course',
          },
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.code).toBe('SCHEMA_VALIDATION_FAILED');
    });
  });
});
