/**
 * Unit tests for progress payload validation (Issue #214)
 *
 * Tests cover:
 * - Valid payloads for all event types
 * - Invalid payloads (missing fields, type mismatches, oversized)
 * - Edge cases and boundary conditions
 * - Query parameter validation for GET endpoints
 */

import { describe, it, expect } from '@jest/globals';
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

describe('Track Event Validation', () => {
  describe('Valid Payloads', () => {
    it('should accept valid learning_module_started event', () => {
      const payload = {
        eventName: 'learning_module_started',
        contactIdentifier: { email: 'test@example.com' },
        payload: {
          module_slug: 'intro-to-hedgehog',
          pathway_slug: 'getting-started',
        },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.eventName).toBe('learning_module_started');
      }
    });

    it('should accept valid learning_module_completed event', () => {
      const payload = {
        eventName: 'learning_module_completed',
        contactIdentifier: { contactId: '12345' },
        payload: {
          module_slug: 'advanced-networking',
          course_slug: 'network-fundamentals',
        },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(true);
    });

    it('should accept valid learning_pathway_enrolled event', () => {
      const payload = {
        eventName: 'learning_pathway_enrolled',
        pathway_slug: 'getting-started',
        enrollment_source: 'pathway_page',
        contactIdentifier: { email: 'user@test.com' },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(true);
    });

    it('should accept valid learning_course_enrolled event', () => {
      const payload = {
        eventName: 'learning_course_enrolled',
        course_slug: 'kubernetes-basics',
        enrollment_source: 'catalog',
        contactIdentifier: { email: 'learner@test.com' },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(true);
    });

    it('should accept valid learning_page_viewed event', () => {
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
      expect(result.success).toBe(true);
    });

    it('should accept event without contactIdentifier (anonymous)', () => {
      const payload = {
        eventName: 'learning_module_started',
        payload: {
          module_slug: 'intro-module',
          pathway_slug: 'intro-pathway',
        },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(true);
    });

    it('should accept contactIdentifier with both email and contactId', () => {
      const payload = {
        eventName: 'learning_module_started',
        contactIdentifier: {
          email: 'test@example.com',
          contactId: '12345',
        },
        payload: {
          module_slug: 'test-module',
          pathway_slug: 'test-pathway',
        },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Payloads', () => {
    it('should reject invalid event name', () => {
      const payload = {
        eventName: 'invalid_event_type',
        payload: { module_slug: 'test' },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.details).toBeDefined();
        expect(result.details.length).toBeGreaterThan(0);
      }
    });

    it('should reject invalid email format', () => {
      const payload = {
        eventName: 'learning_module_started',
        contactIdentifier: { email: 'not-an-email' },
        payload: { module_slug: 'test', pathway_slug: 'test' },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(false);
    });

    it('should reject module event without module_slug', () => {
      const payload = {
        eventName: 'learning_module_started',
        contactIdentifier: { email: 'test@example.com' },
        payload: {
          // Missing module_slug
          pathway_slug: 'test-pathway',
        },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(false);
    });

    it('should reject pathway enrollment without pathway_slug', () => {
      const payload = {
        eventName: 'learning_pathway_enrolled',
        contactIdentifier: { email: 'test@example.com' },
        // Missing pathway_slug
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(false);
    });

    it('should reject course enrollment without course_slug', () => {
      const payload = {
        eventName: 'learning_course_enrolled',
        contactIdentifier: { email: 'test@example.com' },
        // Missing course_slug
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(false);
    });

    it('should reject page view without content_type or slug', () => {
      const payload = {
        eventName: 'learning_page_viewed',
        contactIdentifier: { email: 'test@example.com' },
        payload: {
          // Missing content_type and slug
        },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(false);
    });

    it('should reject slug exceeding max length', () => {
      const payload = {
        eventName: 'learning_module_started',
        pathway_slug: 'a'.repeat(201), // Exceeds MAX_SLUG_LENGTH
        payload: { module_slug: 'test' },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(false);
    });

    it('should reject email exceeding max length', () => {
      const payload = {
        eventName: 'learning_module_started',
        contactIdentifier: {
          email: 'a'.repeat(250) + '@test.com', // Exceeds MAX_EMAIL_LENGTH
        },
        payload: { module_slug: 'test', pathway_slug: 'test' },
      };

      const result = validatePayload(trackEventSchema, payload, 'test');
      expect(result.success).toBe(false);
    });
  });
});

describe('Quiz Grade Validation', () => {
  it('should accept valid quiz grade payload', () => {
    const payload = {
      module_slug: 'quiz-module',
      answers: [
        { id: 'q1', value: 'answer1' },
        { id: 'q2', value: 42 },
        { id: 'q3', value: true },
      ],
    };

    const result = validatePayload(quizGradeSchema, payload, 'test');
    expect(result.success).toBe(true);
  });

  it('should reject missing module_slug', () => {
    const payload = {
      answers: [{ id: 'q1', value: 'answer' }],
    };

    const result = validatePayload(quizGradeSchema, payload, 'test');
    expect(result.success).toBe(false);
  });

  it('should reject empty module_slug', () => {
    const payload = {
      module_slug: '',
      answers: [{ id: 'q1', value: 'answer' }],
    };

    const result = validatePayload(quizGradeSchema, payload, 'test');
    expect(result.success).toBe(false);
  });

  it('should reject missing answers', () => {
    const payload = {
      module_slug: 'quiz-module',
    };

    const result = validatePayload(quizGradeSchema, payload, 'test');
    expect(result.success).toBe(false);
  });

  it('should reject answers with missing id', () => {
    const payload = {
      module_slug: 'quiz-module',
      answers: [{ value: 'answer' }],
    };

    const result = validatePayload(quizGradeSchema, payload, 'test');
    expect(result.success).toBe(false);
  });

  it('should reject too many answers', () => {
    const payload = {
      module_slug: 'quiz-module',
      answers: Array.from({ length: 101 }, (_, i) => ({ id: `q${i}`, value: 'answer' })),
    };

    const result = validatePayload(quizGradeSchema, payload, 'test');
    expect(result.success).toBe(false);
  });
});

describe('Progress Read Query Validation', () => {
  it('should accept valid email query', () => {
    const query = { email: 'test@example.com' };
    const result = validatePayload(progressReadQuerySchema, query, 'test');
    expect(result.success).toBe(true);
  });

  it('should accept valid contactId query', () => {
    const query = { contactId: '12345' };
    const result = validatePayload(progressReadQuerySchema, query, 'test');
    expect(result.success).toBe(true);
  });

  it('should accept both email and contactId', () => {
    const query = { email: 'test@example.com', contactId: '12345' };
    const result = validatePayload(progressReadQuerySchema, query, 'test');
    expect(result.success).toBe(true);
  });

  it('should accept empty query (anonymous mode)', () => {
    const query = {};
    const result = validatePayload(progressReadQuerySchema, query, 'test');
    expect(result.success).toBe(true);
  });

  it('should reject invalid email format', () => {
    const query = { email: 'not-an-email' };
    const result = validatePayload(progressReadQuerySchema, query, 'test');
    expect(result.success).toBe(false);
  });
});

describe('Progress Aggregate Query Validation', () => {
  it('should accept valid pathway query', () => {
    const query = {
      email: 'test@example.com',
      type: 'pathway',
      slug: 'getting-started',
    };
    const result = validatePayload(progressAggregateQuerySchema, query, 'test');
    expect(result.success).toBe(true);
  });

  it('should accept valid course query', () => {
    const query = {
      contactId: '12345',
      type: 'course',
      slug: 'kubernetes-basics',
    };
    const result = validatePayload(progressAggregateQuerySchema, query, 'test');
    expect(result.success).toBe(true);
  });

  it('should reject missing type', () => {
    const query = {
      email: 'test@example.com',
      slug: 'test-slug',
    };
    const result = validatePayload(progressAggregateQuerySchema, query, 'test');
    expect(result.success).toBe(false);
  });

  it('should reject missing slug', () => {
    const query = {
      email: 'test@example.com',
      type: 'pathway',
    };
    const result = validatePayload(progressAggregateQuerySchema, query, 'test');
    expect(result.success).toBe(false);
  });

  it('should reject invalid type', () => {
    const query = {
      email: 'test@example.com',
      type: 'invalid',
      slug: 'test-slug',
    };
    const result = validatePayload(progressAggregateQuerySchema, query, 'test');
    expect(result.success).toBe(false);
  });

  it('should reject empty slug', () => {
    const query = {
      email: 'test@example.com',
      type: 'pathway',
      slug: '',
    };
    const result = validatePayload(progressAggregateQuerySchema, query, 'test');
    expect(result.success).toBe(false);
  });
});

describe('Enrollments List Query Validation', () => {
  it('should accept valid email query', () => {
    const query = { email: 'test@example.com' };
    const result = validatePayload(enrollmentsListQuerySchema, query, 'test');
    expect(result.success).toBe(true);
  });

  it('should accept valid contactId query', () => {
    const query = { contactId: '12345' };
    const result = validatePayload(enrollmentsListQuerySchema, query, 'test');
    expect(result.success).toBe(true);
  });

  it('should accept both email and contactId', () => {
    const query = { email: 'test@example.com', contactId: '12345' };
    const result = validatePayload(enrollmentsListQuerySchema, query, 'test');
    expect(result.success).toBe(true);
  });

  it('should reject empty query', () => {
    const query = {};
    const result = validatePayload(enrollmentsListQuerySchema, query, 'test');
    expect(result.success).toBe(false);
  });
});

describe('Payload Size Validation', () => {
  it('should accept payload within size limit', () => {
    const payload = JSON.stringify({ small: 'data' });
    expect(checkPayloadSize(payload)).toBe(true);
  });

  it('should reject payload exceeding size limit', () => {
    const largePayload = 'x'.repeat(11000); // Exceeds 10KB default
    expect(checkPayloadSize(largePayload)).toBe(false);
  });

  it('should respect custom size limit', () => {
    const payload = 'x'.repeat(500);
    expect(checkPayloadSize(payload, 1000)).toBe(true);
    expect(checkPayloadSize(payload, 400)).toBe(false);
  });
});

describe('Validation Error Creation', () => {
  it('should create validation error with all fields', () => {
    const error = createValidationError(
      ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
      'Test error',
      ['detail1', 'detail2'],
      { field: 'value' }
    );

    expect(error.code).toBe(ValidationErrorCode.SCHEMA_VALIDATION_FAILED);
    expect(error.message).toBe('Test error');
    expect(error.details).toEqual(['detail1', 'detail2']);
    expect(error.context).toEqual({ field: 'value' });
  });

  it('should create validation error with minimal fields', () => {
    const error = createValidationError(
      ValidationErrorCode.INVALID_JSON,
      'JSON parse error'
    );

    expect(error.code).toBe(ValidationErrorCode.INVALID_JSON);
    expect(error.message).toBe('JSON parse error');
    expect(error.details).toBeUndefined();
    expect(error.context).toBeUndefined();
  });
});
