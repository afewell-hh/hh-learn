"use strict";
/**
 * Validation schemas for progress tracking payloads
 *
 * This module defines comprehensive JSON schemas using Zod to validate
 * incoming progress tracking requests, ensuring data integrity and providing
 * helpful error messages when validation fails.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationErrorCode = exports.pathwayProgressStateSchema = exports.courseProgressStateSchema = exports.moduleProgressStateSchema = exports.quizGradeSchema = exports.enrollmentsListQuerySchema = exports.progressAggregateQuerySchema = exports.progressReadQuerySchema = exports.trackEventSchema = exports.contactIdentifierSchema = void 0;
exports.validatePayload = validatePayload;
exports.checkPayloadSize = checkPayloadSize;
exports.createValidationError = createValidationError;
const zod_1 = require("zod");
// Maximum payload sizes to prevent DoS
const MAX_SLUG_LENGTH = 200;
const MAX_EMAIL_LENGTH = 255;
const MAX_CONTACT_ID_LENGTH = 50;
const MAX_STRING_LENGTH = 1000;
const MAX_PAYLOAD_PROPERTIES = 50;
const MAX_PAYLOAD_SIZE_BYTES = 10000; // 10KB
// Contact identifier schema
exports.contactIdentifierSchema = zod_1.z.object({
    email: zod_1.z.string().email().max(MAX_EMAIL_LENGTH).optional(),
    contactId: zod_1.z.string().max(MAX_CONTACT_ID_LENGTH).optional(),
}).refine((data) => data.email || data.contactId, {
    message: 'At least one of email or contactId must be provided',
});
// Event-specific payload schemas
const moduleEventPayloadSchema = zod_1.z.object({
    module_slug: zod_1.z.string().min(1).max(MAX_SLUG_LENGTH),
    pathway_slug: zod_1.z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
    course_slug: zod_1.z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
    content_type: zod_1.z.string().max(MAX_STRING_LENGTH).optional(),
    slug: zod_1.z.string().max(MAX_SLUG_LENGTH).optional(),
    ts: zod_1.z.string().datetime().optional(),
}).passthrough(); // Allow additional properties
const enrollmentEventPayloadSchema = zod_1.z.object({
    pathway_slug: zod_1.z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
    course_slug: zod_1.z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
    enrollment_source: zod_1.z.string().max(MAX_STRING_LENGTH).optional(),
    ts: zod_1.z.string().datetime().optional(),
}).passthrough();
const pageViewEventPayloadSchema = zod_1.z.object({
    content_type: zod_1.z.string().min(1).max(MAX_STRING_LENGTH),
    slug: zod_1.z.string().min(1).max(MAX_SLUG_LENGTH),
    pathway_slug: zod_1.z.string().max(MAX_SLUG_LENGTH).optional(),
    course_slug: zod_1.z.string().max(MAX_SLUG_LENGTH).optional(),
    ts: zod_1.z.string().datetime().optional(),
}).passthrough();
// Main track event schema
exports.trackEventSchema = zod_1.z.object({
    eventName: zod_1.z.enum([
        'learning_module_started',
        'learning_module_completed',
        'learning_pathway_enrolled',
        'learning_course_enrolled',
        'learning_course_completed',
        'learning_pathway_completed',
        'learning_page_viewed',
    ]),
    contactIdentifier: exports.contactIdentifierSchema.optional(),
    payload: zod_1.z.record(zod_1.z.any()).optional(),
    enrollment_source: zod_1.z.string().max(MAX_STRING_LENGTH).optional(),
    pathway_slug: zod_1.z.string().max(MAX_SLUG_LENGTH).optional(),
    course_slug: zod_1.z.string().max(MAX_SLUG_LENGTH).optional(),
}).refine((data) => {
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
}, {
    message: 'Event payload missing required fields for this event type',
});
// Query parameter schemas for GET endpoints
exports.progressReadQuerySchema = zod_1.z.object({
    email: zod_1.z.string().email().max(MAX_EMAIL_LENGTH).optional(),
    contactId: zod_1.z.string().max(MAX_CONTACT_ID_LENGTH).optional(),
});
exports.progressAggregateQuerySchema = zod_1.z.object({
    email: zod_1.z.string().email().max(MAX_EMAIL_LENGTH).optional(),
    contactId: zod_1.z.string().max(MAX_CONTACT_ID_LENGTH).optional(),
    type: zod_1.z.enum(['pathway', 'course']),
    slug: zod_1.z.string().min(1).max(MAX_SLUG_LENGTH),
});
exports.enrollmentsListQuerySchema = zod_1.z.object({
    email: zod_1.z.string().email().max(MAX_EMAIL_LENGTH).optional(),
    contactId: zod_1.z.string().max(MAX_CONTACT_ID_LENGTH).optional(),
}).refine((data) => data.email || data.contactId, {
    message: 'Either email or contactId is required',
});
// Quiz grading schema
exports.quizGradeSchema = zod_1.z.object({
    module_slug: zod_1.z.string().min(1).max(MAX_SLUG_LENGTH),
    answers: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().min(1).max(MAX_STRING_LENGTH),
        value: zod_1.z.any(),
    })).max(100), // Reasonable limit on quiz answers
});
// Progress state structure schemas (for internal validation)
exports.moduleProgressStateSchema = zod_1.z.object({
    started: zod_1.z.boolean().optional(),
    started_at: zod_1.z.string().datetime().optional(),
    completed: zod_1.z.boolean().optional(),
    completed_at: zod_1.z.string().datetime().optional(),
});
exports.courseProgressStateSchema = zod_1.z.object({
    enrolled: zod_1.z.boolean().optional(),
    enrolled_at: zod_1.z.string().datetime().optional(),
    enrollment_source: zod_1.z.string().max(MAX_STRING_LENGTH).optional(),
    modules: zod_1.z.record(exports.moduleProgressStateSchema).optional(),
});
exports.pathwayProgressStateSchema = zod_1.z.object({
    enrolled: zod_1.z.boolean().optional(),
    enrolled_at: zod_1.z.string().datetime().optional(),
    enrollment_source: zod_1.z.string().max(MAX_STRING_LENGTH).optional(),
    modules: zod_1.z.record(exports.moduleProgressStateSchema).optional(),
});
/**
 * Validation helper that returns descriptive error messages
 */
function validatePayload(schema, data, context) {
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
function checkPayloadSize(payload, maxBytes = MAX_PAYLOAD_SIZE_BYTES) {
    const sizeBytes = new TextEncoder().encode(payload).length;
    return sizeBytes <= maxBytes;
}
/**
 * Validation error codes for structured logging
 */
var ValidationErrorCode;
(function (ValidationErrorCode) {
    ValidationErrorCode["PAYLOAD_TOO_LARGE"] = "PAYLOAD_TOO_LARGE";
    ValidationErrorCode["INVALID_JSON"] = "INVALID_JSON";
    ValidationErrorCode["SCHEMA_VALIDATION_FAILED"] = "SCHEMA_VALIDATION_FAILED";
    ValidationErrorCode["MISSING_REQUIRED_FIELD"] = "MISSING_REQUIRED_FIELD";
    ValidationErrorCode["INVALID_FIELD_TYPE"] = "INVALID_FIELD_TYPE";
    ValidationErrorCode["INVALID_FIELD_VALUE"] = "INVALID_FIELD_VALUE";
    ValidationErrorCode["INVALID_EVENT_TYPE"] = "INVALID_EVENT_TYPE";
    ValidationErrorCode["INVALID_EVENT_DATA"] = "INVALID_EVENT_DATA";
})(ValidationErrorCode || (exports.ValidationErrorCode = ValidationErrorCode = {}));
/**
 * Create a structured validation error
 */
function createValidationError(code, message, details, context) {
    return {
        code,
        message,
        details,
        context,
    };
}
