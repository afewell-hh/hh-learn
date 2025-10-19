/**
 * Unit tests for progress payload validation (Issue #214)
 * Run with: npm run build && node dist/tests/run-validation-tests.js
 */

import {
  trackEventSchema,
  quizGradeSchema,
  progressReadQuerySchema,
  progressAggregateQuerySchema,
  enrollmentsListQuerySchema,
  validatePayload,
  checkPayloadSize,
  ValidationErrorCode,
  createValidationError,
} from '../src/shared/validation.js';

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  testsRun++;
  if (condition) {
    testsPassed++;
    console.log(`✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`✗ ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  testsRun++;
  if (actual === expected) {
    testsPassed++;
    console.log(`✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`✗ ${message} (expected: ${expected}, got: ${actual})`);
  }
}

console.log('========================================');
console.log('Validation Tests (Issue #214)');
console.log('========================================\n');

// Test Group 1: Track Event Validation - Valid Payloads
console.log('Test Group 1: Valid Track Event Payloads');
console.log('------------------------------------------');

{
  const payload = {
    eventName: 'learning_module_started',
    contactIdentifier: { email: 'test@example.com' },
    payload: {
      module_slug: 'intro-to-hedgehog',
      pathway_slug: 'getting-started',
    },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(result.success, 'Valid learning_module_started event');
}

{
  const payload = {
    eventName: 'learning_module_completed',
    contactIdentifier: { contactId: '12345' },
    payload: {
      module_slug: 'advanced-networking',
      course_slug: 'network-fundamentals',
    },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(result.success, 'Valid learning_module_completed event');
}

{
  const payload = {
    eventName: 'learning_pathway_enrolled',
    pathway_slug: 'getting-started',
    enrollment_source: 'pathway_page',
    contactIdentifier: { email: 'user@test.com' },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(result.success, 'Valid learning_pathway_enrolled event');
}

{
  const payload = {
    eventName: 'learning_course_enrolled',
    course_slug: 'kubernetes-basics',
    enrollment_source: 'catalog',
    contactIdentifier: { email: 'learner@test.com' },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(result.success, 'Valid learning_course_enrolled event');
}

{
  const payload = {
    eventName: 'learning_page_viewed',
    contactIdentifier: { email: 'visitor@test.com' },
    payload: {
      content_type: 'pathway',
      slug: 'network-like-hyperscaler',
      ts: new Date().toISOString(),
    },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(result.success, 'Valid learning_page_viewed event');
}

{
  const payload = {
    eventName: 'learning_module_started',
    payload: {
      module_slug: 'intro-module',
      pathway_slug: 'intro-pathway',
    },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(result.success, 'Event without contactIdentifier (anonymous)');
}

console.log('');

// Test Group 2: Track Event Validation - Invalid Payloads
console.log('Test Group 2: Invalid Track Event Payloads');
console.log('--------------------------------------------');

{
  const payload = {
    eventName: 'invalid_event_type',
    payload: { module_slug: 'test' },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(!result.success, 'Rejects invalid event name');
}

{
  const payload = {
    eventName: 'learning_module_started',
    contactIdentifier: { email: 'not-an-email' },
    payload: { module_slug: 'test', pathway_slug: 'test' },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(!result.success, 'Rejects invalid email format');
}

{
  const payload = {
    eventName: 'learning_module_started',
    contactIdentifier: { email: 'test@example.com' },
    payload: {
      pathway_slug: 'test-pathway',
    },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(!result.success, 'Rejects module event without module_slug');
}

{
  const payload = {
    eventName: 'learning_pathway_enrolled',
    contactIdentifier: { email: 'test@example.com' },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(!result.success, 'Rejects pathway enrollment without pathway_slug');
}

{
  const payload = {
    eventName: 'learning_course_enrolled',
    contactIdentifier: { email: 'test@example.com' },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(!result.success, 'Rejects course enrollment without course_slug');
}

{
  const payload = {
    eventName: 'learning_page_viewed',
    contactIdentifier: { email: 'test@example.com' },
    payload: {},
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(!result.success, 'Rejects page view without content_type/slug');
}

{
  const payload = {
    eventName: 'learning_module_started',
    pathway_slug: 'a'.repeat(201),
    payload: { module_slug: 'test' },
  };
  const result = validatePayload(trackEventSchema, payload, 'test');
  assert(!result.success, 'Rejects slug exceeding max length');
}

console.log('');

// Test Group 3: Quiz Grade Validation
console.log('Test Group 3: Quiz Grade Validation');
console.log('-------------------------------------');

{
  const payload = {
    module_slug: 'quiz-module',
    answers: [
      { id: 'q1', value: 'answer1' },
      { id: 'q2', value: 42 },
      { id: 'q3', value: true },
    ],
  };
  const result = validatePayload(quizGradeSchema, payload, 'test');
  assert(result.success, 'Valid quiz grade payload');
}

{
  const payload = {
    answers: [{ id: 'q1', value: 'answer' }],
  };
  const result = validatePayload(quizGradeSchema, payload, 'test');
  assert(!result.success, 'Rejects missing module_slug');
}

{
  const payload = {
    module_slug: '',
    answers: [{ id: 'q1', value: 'answer' }],
  };
  const result = validatePayload(quizGradeSchema, payload, 'test');
  assert(!result.success, 'Rejects empty module_slug');
}

{
  const payload = {
    module_slug: 'quiz-module',
  };
  const result = validatePayload(quizGradeSchema, payload, 'test');
  assert(!result.success, 'Rejects missing answers');
}

{
  const payload = {
    module_slug: 'quiz-module',
    answers: Array.from({ length: 101 }, (_, i) => ({ id: `q${i}`, value: 'answer' })),
  };
  const result = validatePayload(quizGradeSchema, payload, 'test');
  assert(!result.success, 'Rejects too many answers');
}

console.log('');

// Test Group 4: Query Parameter Validation
console.log('Test Group 4: Query Parameter Validation');
console.log('------------------------------------------');

{
  const query = {
    email: 'test@example.com',
    type: 'pathway',
    slug: 'getting-started',
  };
  const result = validatePayload(progressAggregateQuerySchema, query, 'test');
  assert(result.success, 'Valid progress aggregate query');
}

{
  const query = {
    email: 'test@example.com',
    slug: 'test-slug',
  };
  const result = validatePayload(progressAggregateQuerySchema, query, 'test');
  assert(!result.success, 'Rejects aggregate query missing type');
}

{
  const query = {
    email: 'test@example.com',
    type: 'pathway',
  };
  const result = validatePayload(progressAggregateQuerySchema, query, 'test');
  assert(!result.success, 'Rejects aggregate query missing slug');
}

{
  const query = {};
  const result = validatePayload(enrollmentsListQuerySchema, query, 'test');
  assert(!result.success, 'Rejects enrollments query without identifier');
}

{
  const query = { email: 'test@example.com' };
  const result = validatePayload(enrollmentsListQuerySchema, query, 'test');
  assert(result.success, 'Valid enrollments query with email');
}

console.log('');

// Test Group 5: Payload Size Validation
console.log('Test Group 5: Payload Size Validation');
console.log('---------------------------------------');

{
  const payload = JSON.stringify({ small: 'data' });
  assert(checkPayloadSize(payload), 'Accepts payload within size limit');
}

{
  const largePayload = 'x'.repeat(11000);
  assert(!checkPayloadSize(largePayload), 'Rejects payload exceeding size limit');
}

{
  const payload = 'x'.repeat(500);
  assert(checkPayloadSize(payload, 1000), 'Respects custom size limit (within)');
  assert(!checkPayloadSize(payload, 400), 'Respects custom size limit (exceeds)');
}

console.log('');

// Test Group 6: Validation Error Creation
console.log('Test Group 6: Validation Error Creation');
console.log('----------------------------------------');

{
  const error = createValidationError(
    ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
    'Test error',
    ['detail1', 'detail2'],
    { field: 'value' }
  );
  assertEqual(error.code, ValidationErrorCode.SCHEMA_VALIDATION_FAILED, 'Error code set correctly');
  assertEqual(error.message, 'Test error', 'Error message set correctly');
  assert(error.details?.length === 2, 'Error details set correctly');
  assert(error.context?.field === 'value', 'Error context set correctly');
}

console.log('');

// Summary
console.log('========================================');
console.log('Test Summary');
console.log('========================================');
console.log(`Total: ${testsRun}`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log('');

if (testsFailed === 0) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.log(`✗ ${testsFailed} test(s) failed`);
  process.exit(1);
}
