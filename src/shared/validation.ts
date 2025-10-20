/**
 * Validation schemas for progress tracking payloads
 *
 * This module defines comprehensive JSON schemas using Zod to validate
 * incoming progress tracking requests, ensuring data integrity and providing
 * helpful error messages when validation fails.
 */

import { z } from 'zod';

// Maximum payload sizes to prevent DoS
const MAX_SLUG_LENGTH = 200;
const MAX_EMAIL_LENGTH = 255;
const MAX_CONTACT_ID_LENGTH = 50;
const MAX_STRING_LENGTH = 1000;
const MAX_PAYLOAD_PROPERTIES = 50;
const MAX_PAYLOAD_SIZE_BYTES = 10000; // 10KB

// Contact identifier schema
export const contactIdentifierSchema = z.object({
  email: z.string().email().max(MAX_EMAIL_LENGTH).optional(),
  contactId: z.string().max(MAX_CONTACT_ID_LENGTH).optional(),
}).refine(
  (data) => data.email || data.contactId,
  {
    message: 'At least one of email or contactId must be provided',
  }
);

// Event-specific payload schemas
const moduleEventPayloadSchema = z.object({
  module_slug: z.string().min(1).max(MAX_SLUG_LENGTH),
  pathway_slug: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
  course_slug: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
  content_type: z.string().max(MAX_STRING_LENGTH).optional(),
  slug: z.string().max(MAX_SLUG_LENGTH).optional(),
  ts: z.string().datetime().optional(),
}).passthrough(); // Allow additional properties

const enrollmentEventPayloadSchema = z.object({
  pathway_slug: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
  course_slug: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
  enrollment_source: z.string().max(MAX_STRING_LENGTH).optional(),
  ts: z.string().datetime().optional(),
}).passthrough();

const pageViewEventPayloadSchema = z.object({
  content_type: z.string().min(1).max(MAX_STRING_LENGTH),
  slug: z.string().min(1).max(MAX_SLUG_LENGTH),
  pathway_slug: z.string().max(MAX_SLUG_LENGTH).optional(),
  course_slug: z.string().max(MAX_SLUG_LENGTH).optional(),
  ts: z.string().datetime().optional(),
}).passthrough();

// Main track event schema
export const trackEventSchema = z.object({
  eventName: z.enum([
    'learning_module_started',
    'learning_module_completed',
    'learning_pathway_enrolled',
    'learning_course_enrolled',
    'learning_course_completed',
    'learning_pathway_completed',
    'learning_page_viewed',
  ]),
  contactIdentifier: contactIdentifierSchema.optional(),
  payload: z.record(z.any()).optional(),
  enrollment_source: z.string().max(MAX_STRING_LENGTH).optional(),
  pathway_slug: z.string().max(MAX_SLUG_LENGTH).optional(),
  course_slug: z.string().max(MAX_SLUG_LENGTH).optional(),
}).refine(
  (data) => {
    // Event-specific validation
    if (data.eventName === 'learning_module_started' || data.eventName === 'learning_module_completed') {
      const moduleSlug = data.payload?.module_slug || data.pathway_slug || data.course_slug;
      if (!moduleSlug) {
        return false;
      }
    }
    if (data.eventName === 'learning_pathway_enrolled') {
      if (!data.pathway_slug && !data.payload?.pathway_slug) {
        return false;
      }
    }
    if (data.eventName === 'learning_course_enrolled') {
      if (!data.course_slug && !data.payload?.course_slug) {
        return false;
      }
    }
    if (data.eventName === 'learning_course_completed') {
      if (!data.course_slug && !data.payload?.course_slug) {
        return false;
      }
    }
    if (data.eventName === 'learning_pathway_completed') {
      if (!data.pathway_slug && !data.payload?.pathway_slug) {
        return false;
      }
    }
    if (data.eventName === 'learning_page_viewed') {
      const hasContentType = data.payload?.content_type;
      const hasSlug = data.payload?.slug;
      if (!hasContentType || !hasSlug) {
        return false;
      }
    }
    return true;
  },
  {
    message: 'Event payload missing required fields for this event type',
  }
);

// Query parameter schemas for GET endpoints
export const progressReadQuerySchema = z.object({
  email: z.string().email().max(MAX_EMAIL_LENGTH).optional(),
  contactId: z.string().max(MAX_CONTACT_ID_LENGTH).optional(),
});

export const progressAggregateQuerySchema = z.object({
  email: z.string().email().max(MAX_EMAIL_LENGTH).optional(),
  contactId: z.string().max(MAX_CONTACT_ID_LENGTH).optional(),
  type: z.enum(['pathway', 'course']),
  slug: z.string().min(1).max(MAX_SLUG_LENGTH),
});

export const enrollmentsListQuerySchema = z.object({
  email: z.string().email().max(MAX_EMAIL_LENGTH).optional(),
  contactId: z.string().max(MAX_CONTACT_ID_LENGTH).optional(),
}).refine(
  (data) => data.email || data.contactId,
  {
    message: 'Either email or contactId is required',
  }
);

// Quiz grading schema
export const quizGradeSchema = z.object({
  module_slug: z.string().min(1).max(MAX_SLUG_LENGTH),
  answers: z.array(
    z.object({
      id: z.string().min(1).max(MAX_STRING_LENGTH),
      value: z.any(),
    })
  ).max(100), // Reasonable limit on quiz answers
});

// Progress state structure schemas (for internal validation)
export const moduleProgressStateSchema = z.object({
  started: z.boolean().optional(),
  started_at: z.string().datetime().optional(),
  completed: z.boolean().optional(),
  completed_at: z.string().datetime().optional(),
});

export const courseProgressStateSchema = z.object({
  enrolled: z.boolean().optional(),
  enrolled_at: z.string().datetime().optional(),
  enrollment_source: z.string().max(MAX_STRING_LENGTH).optional(),
  modules: z.record(moduleProgressStateSchema).optional(),
});

export const pathwayProgressStateSchema = z.object({
  enrolled: z.boolean().optional(),
  enrolled_at: z.string().datetime().optional(),
  enrollment_source: z.string().max(MAX_STRING_LENGTH).optional(),
  modules: z.record(moduleProgressStateSchema).optional(),
});

/**
 * Validation helper that returns descriptive error messages
 */
export function validatePayload<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): { success: true; data: T } | { success: false; error: string; details: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const details = result.error.errors.map((err) => {
    const path = err.path.join('.');
    return `${path || 'root'}: ${err.message}`;
  });

  return {
    success: false,
    error: `Invalid ${context}`,
    details,
  };
}

/**
 * Check payload size to prevent oversized requests
 */
export function checkPayloadSize(payload: string, maxBytes: number = MAX_PAYLOAD_SIZE_BYTES): boolean {
  const sizeBytes = new TextEncoder().encode(payload).length;
  return sizeBytes <= maxBytes;
}

/**
 * Validation error codes for structured logging
 */
export enum ValidationErrorCode {
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  INVALID_JSON = 'INVALID_JSON',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE = 'INVALID_FIELD_TYPE',
  INVALID_FIELD_VALUE = 'INVALID_FIELD_VALUE',
  INVALID_EVENT_TYPE = 'INVALID_EVENT_TYPE',
  INVALID_EVENT_DATA = 'INVALID_EVENT_DATA', // Issue #221: For completion validation failures
}

/**
 * Structured validation error for logging and metrics
 */
export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  details?: string[];
  context?: Record<string, any>;
}

/**
 * Create a structured validation error
 */
export function createValidationError(
  code: ValidationErrorCode,
  message: string,
  details?: string[],
  context?: Record<string, any>
): ValidationError {
  return {
    code,
    message,
    details,
    context,
  };
}
