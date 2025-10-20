import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import { getHubSpotClient } from '../../shared/hubspot.js';
import type { TrackEventInput, QuizGradeInput, QuizGradeResult } from '../../shared/types.js';
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
  type ValidationError,
} from '../../shared/validation.js';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://hedgehog.cloud',
  'https://www.hedgehog.cloud',
];

// Check if origin matches HubSpot CDN patterns
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;

  // Check exact matches
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Check HubSpot CDN patterns
  const hubspotPatterns = [
    /^https:\/\/.*\.hubspotusercontent-na1\.net$/,
    /^https:\/\/.*\.hubspotusercontent00\.net$/,
    /^https:\/\/.*\.hubspotusercontent20\.net$/,
    /^https:\/\/.*\.hubspotusercontent30\.net$/,
    /^https:\/\/.*\.hubspotusercontent40\.net$/,
  ];

  return hubspotPatterns.some(pattern => pattern.test(origin));
}

const ok = (body: unknown = {}, origin?: string) => ({
  statusCode: 200,
  body: JSON.stringify(body),
  headers: {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : 'https://hedgehog.cloud',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  },
});

const bad = (code: number, msg: string, origin?: string, details?: any) => ({
  statusCode: code,
  body: JSON.stringify(details ? { error: msg, details } : { error: msg }),
  headers: {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : 'https://hedgehog.cloud',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  },
});

/**
 * Log validation failure with structured data for monitoring
 */
function logValidationFailure(validationError: ValidationError, endpoint: string, rawPayload?: string): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'warn',
    event: 'validation_failure',
    endpoint,
    error_code: validationError.code,
    error_message: validationError.message,
    details: validationError.details,
    context: validationError.context,
    payload_preview: rawPayload ? rawPayload.substring(0, 200) : undefined,
  };

  console.warn('[VALIDATION_FAILURE]', JSON.stringify(logEntry));
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const origin = event.headers?.origin || event.headers?.Origin;
    const path = (event.rawPath || '').toLowerCase();

    // Handle OPTIONS preflight
    if (event.requestContext.http.method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : 'https://hedgehog.cloud',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      };
    }

    if (path.endsWith('/progress/read') && event.requestContext.http.method === 'GET') return await readProgress(event, origin);
    if (path.endsWith('/progress/aggregate') && event.requestContext.http.method === 'GET') return await getAggregatedProgress(event, origin);
    if (path.endsWith('/enrollments/list') && event.requestContext.http.method === 'GET') return await listEnrollments(event, origin);
    if (event.requestContext.http.method !== 'POST') return bad(405, 'POST only', origin);
  if (path.endsWith('/events/track')) return await track(event.body || '', origin);
    if (path.endsWith('/quiz/grade')) return await grade(event.body || '', origin);

    return bad(404, 'Not found', origin);
  } catch (err: any) {
    console.error('Handler error', err);
    return bad(500, 'Internal error', event.headers?.origin || event.headers?.Origin);
  }
};

async function listEnrollments(event: any, origin?: string) {
  const enableCrmProgress = process.env.ENABLE_CRM_PROGRESS === 'true';
  if (!enableCrmProgress) return bad(401, 'CRM progress not enabled', origin);

  try {
    const hubspot = getHubSpotClient();
    const qs = event.queryStringParameters || {};

    // Validate query parameters
    const validation = validatePayload(enrollmentsListQuerySchema, qs, 'query parameters');
    if (!validation.success) {
      const error = createValidationError(
        ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
        validation.error,
        validation.details
      );
      logValidationFailure(error, '/enrollments/list');
      return bad(400, error.message, origin, { code: error.code, details: error.details });
    }

    let contactId = validation.data.contactId;
    const email = validation.data.email;

    if (!contactId && email) {
      const search = await (hubspot as any).crm.contacts.searchApi.doSearch({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        properties: ['hhl_progress_state'],
        limit: 1,
      });
      if (!search.results || search.results.length === 0) return bad(404, 'Contact not found', origin);
      contactId = search.results[0].id;
    }

    const contact = await hubspot.crm.contacts.basicApi.getById(contactId!, ['hhl_progress_state']);
    let state: any = {};
    try { state = contact.properties.hhl_progress_state ? JSON.parse(contact.properties.hhl_progress_state) : {}; } catch (e) { state = {}; }

    // Extract enrollments from progress state
    const enrollments: any = {
      pathways: [],
      courses: []
    };

    // Parse pathways
    for (const [slug, data] of Object.entries(state)) {
      if (slug === 'courses') continue; // Skip the courses object key
      const pathwayData = data as any;
      if (pathwayData.enrolled) {
        enrollments.pathways.push({
          slug,
          enrolled_at: pathwayData.enrolled_at || null,
          enrollment_source: pathwayData.enrollment_source || null
        });
      }

      // Also extract courses within hierarchical pathways
      if (pathwayData.courses) {
        for (const [courseSlug, courseData] of Object.entries(pathwayData.courses)) {
          const course = courseData as any;
          if (course.enrolled) {
            enrollments.courses.push({
              slug: courseSlug,
              pathway_slug: slug, // Track which pathway this course belongs to
              enrolled_at: course.enrolled_at || null,
              enrollment_source: course.enrollment_source || null
            });
          }
        }
      }
    }

    // Parse standalone courses
    if (state.courses) {
      for (const [slug, data] of Object.entries(state.courses)) {
        const courseData = data as any;
        if (courseData.enrolled) {
          enrollments.courses.push({
            slug,
            pathway_slug: null, // Standalone course
            enrolled_at: courseData.enrolled_at || null,
            enrollment_source: courseData.enrollment_source || null
          });
        }
      }
    }

    return ok({
      mode: 'authenticated',
      enrollments
    }, origin);
  } catch (e: any) {
    console.error('listEnrollments error', e?.message || e);
    return bad(500, 'Unable to fetch enrollments', origin);
  }
}

async function getAggregatedProgress(event: any, origin?: string) {
  const enableCrmProgress = process.env.ENABLE_CRM_PROGRESS === 'true';
  if (!enableCrmProgress) return ok({ mode: 'anonymous' }, origin);

  try {
    const hubspot = getHubSpotClient();
    const qs = event.queryStringParameters || {};

    // Validate query parameters
    const validation = validatePayload(progressAggregateQuerySchema, qs, 'query parameters');
    if (!validation.success) {
      const error = createValidationError(
        ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
        validation.error,
        validation.details
      );
      logValidationFailure(error, '/progress/aggregate');
      return bad(400, error.message, origin, { code: error.code, details: error.details });
    }

    let contactId = validation.data.contactId;
    const email = validation.data.email;
    const contentType = validation.data.type;
    const slug = validation.data.slug;

    if (!contactId && !email) return ok({ mode: 'anonymous' }, origin);

    // Look up contact if needed
    if (!contactId && email) {
      const search = await (hubspot as any).crm.contacts.searchApi.doSearch({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        properties: ['hhl_progress_state'],
        limit: 1,
      });
      if (!search.results || search.results.length === 0) return ok({ mode: 'anonymous' }, origin);
      contactId = search.results[0].id;
    }

    // Get progress state from contact
    const contact = await hubspot.crm.contacts.basicApi.getById(contactId!, ['hhl_progress_state']);
    let state: any = {};
    try {
      state = contact.properties.hhl_progress_state ? JSON.parse(contact.properties.hhl_progress_state) : {};
    } catch (e) {
      state = {};
    }

    // Calculate aggregated progress based on content type
    let started = 0;
    let completed = 0;
    let enrolled = false;
    let enrolled_at = null;

    if (contentType === 'pathway') {
      // Aggregate progress across the pathway
      const pathwayData = state[slug];
      if (pathwayData) {
        enrolled = pathwayData.enrolled || false;
        enrolled_at = pathwayData.enrolled_at || null;

        if (pathwayData.courses) {
          // Hierarchical model: count courses
          const courses = pathwayData.courses || {};
          for (const courseSlug in courses) {
            const courseData = courses[courseSlug];
            if (courseData.started) started++;
            if (courseData.completed) completed++;
          }
        } else if (pathwayData.modules) {
          // Flat model (legacy): count modules
          const modules = pathwayData.modules || {};
          for (const moduleSlug in modules) {
            const moduleData = modules[moduleSlug];
            if (moduleData.started) started++;
            if (moduleData.completed) completed++;
          }
        }
      }
    } else if (contentType === 'course') {
      // Aggregate modules across the course
      // First check standalone courses
      let courseData = state.courses?.[slug];

      // If not found in standalone courses, search within pathways
      if (!courseData) {
        for (const [pathwaySlug, pathwayData] of Object.entries(state)) {
          if (pathwaySlug === 'courses') continue; // Skip the standalone courses object
          const pathway = pathwayData as any;
          if (pathway.courses && pathway.courses[slug]) {
            courseData = pathway.courses[slug];
            break; // Found the course within a pathway
          }
        }
      }

      if (courseData) {
        enrolled = courseData.enrolled || false;
        enrolled_at = courseData.enrolled_at || null;
        const modules = courseData.modules || {};
        for (const moduleSlug in modules) {
          const moduleData = modules[moduleSlug];
          if (moduleData.started) started++;
          if (moduleData.completed) completed++;
        }
      }
    }

    return ok({
      mode: 'authenticated',
      started,
      completed,
      enrolled,
      enrolled_at,
    }, origin);
  } catch (e: any) {
    console.error('getAggregatedProgress error', e?.message || e);
    return ok({ mode: 'fallback', error: 'Unable to fetch progress' }, origin);
  }
}

async function readProgress(event: any, origin?: string) {
  const enableCrmProgress = process.env.ENABLE_CRM_PROGRESS === 'true';
  if (!enableCrmProgress) return ok({ mode: 'anonymous' }, origin);

  try {
    const hubspot = getHubSpotClient();
    const qs = event.queryStringParameters || {};

    // Validate query parameters (note: both email and contactId are optional for readProgress)
    const validation = validatePayload(progressReadQuerySchema, qs, 'query parameters');
    if (!validation.success) {
      const error = createValidationError(
        ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
        validation.error,
        validation.details
      );
      logValidationFailure(error, '/progress/read');
      return bad(400, error.message, origin, { code: error.code, details: error.details });
    }

    let contactId = validation.data.contactId;
    const email = validation.data.email;

    if (!contactId && !email) return ok({ mode: 'anonymous' }, origin);

    if (!contactId && email) {
      const search = await (hubspot as any).crm.contacts.searchApi.doSearch({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        properties: ['hhl_progress_state', 'hhl_progress_updated_at', 'hhl_progress_summary'],
        limit: 1,
      });
      if (!search.results || search.results.length === 0) return ok({ mode: 'anonymous' }, origin);
      contactId = search.results[0].id;
    }

    const contact = await hubspot.crm.contacts.basicApi.getById(contactId!, [
      'hhl_progress_state',
      'hhl_progress_updated_at',
      'hhl_progress_summary',
      'hhl_last_viewed_type',
      'hhl_last_viewed_slug',
      'hhl_last_viewed_at',
    ]);
    let state: any = {};
    try { state = contact.properties.hhl_progress_state ? JSON.parse(contact.properties.hhl_progress_state) : {}; } catch (e) { state = {}; }

    return ok({
      mode: 'authenticated',
      progress: state,
      updated_at: contact.properties.hhl_progress_updated_at || null,
      summary: contact.properties.hhl_progress_summary || null,
      last_viewed: {
        type: contact.properties.hhl_last_viewed_type || null,
        slug: contact.properties.hhl_last_viewed_slug || null,
        at: contact.properties.hhl_last_viewed_at || null,
      },
    }, origin);
  } catch (e: any) {
    console.error('readProgress error', e?.message || e);
    return ok({ mode: 'fallback', error: 'Unable to read progress' }, origin);
  }
}

async function track(raw: string, origin?: string) {
  // Check payload size first
  if (!checkPayloadSize(raw)) {
    const error = createValidationError(
      ValidationErrorCode.PAYLOAD_TOO_LARGE,
      'Request payload exceeds maximum size of 10KB',
      undefined,
      { payload_size: new TextEncoder().encode(raw).length }
    );
    logValidationFailure(error, '/events/track', raw);
    return bad(400, error.message, origin, { code: error.code });
  }

  // Parse JSON
  let parsedBody: any;
  try {
    parsedBody = JSON.parse(raw || '{}');
  } catch (e) {
    const error = createValidationError(
      ValidationErrorCode.INVALID_JSON,
      'Request body is not valid JSON',
      [(e as Error).message]
    );
    logValidationFailure(error, '/events/track', raw);
    return bad(400, error.message, origin, { code: error.code, details: error.details });
  }

  // Validate against schema
  const validation = validatePayload(trackEventSchema, parsedBody, 'track event payload');
  if (!validation.success) {
    const error = createValidationError(
      ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
      validation.error,
      validation.details,
      { event_name: parsedBody.eventName }
    );
    logValidationFailure(error, '/events/track', raw);
    return bad(400, error.message, origin, { code: error.code, details: error.details });
  }

  const input = validation.data as TrackEventInput;

  // Check if CRM persistence is enabled
  const enableCrmProgress = process.env.ENABLE_CRM_PROGRESS === 'true';
  const progressBackend = process.env.PROGRESS_BACKEND || 'properties';

  if (!enableCrmProgress) {
    // Anonymous mode - just log
    console.log('Track event (anonymous)', input.eventName, input.payload);
    return ok({ status: 'logged', mode: 'anonymous' }, origin);
  }

  // CRM persistence enabled - require contact identifier
  if (!input.contactIdentifier?.email && !input.contactIdentifier?.contactId) {
    console.log('Track event (no identity)', input.eventName);
    return ok({ status: 'logged', mode: 'anonymous' }, origin);
  }

  try {
    const hubspot = getHubSpotClient();

    // Route to appropriate backend
    if (progressBackend === 'properties') {
      // Contact Properties backend (MVP default)
      await persistViaContactProperties(hubspot, input);
      console.log('Track event (persisted via properties)', input.eventName, input.contactIdentifier);
      return ok({ status: 'persisted', mode: 'authenticated', backend: 'properties' }, origin);
    } else if (progressBackend === 'events') {
      // Custom Behavioral Events backend (future enhancement)
      await persistViaBehavioralEvents(hubspot, input);
      console.log('Track event (persisted via events)', input.eventName, input.contactIdentifier);
      return ok({ status: 'persisted', mode: 'authenticated', backend: 'events' }, origin);
    } else {
      console.error('Invalid PROGRESS_BACKEND:', progressBackend);
      return ok({ status: 'logged', mode: 'fallback', error: 'Invalid backend configuration' }, origin);
    }
  } catch (err: any) {
    console.error('Failed to persist event to CRM:', err.message || err);
    // Return success even if CRM persistence fails - don't break user experience
    return ok({ status: 'logged', mode: 'fallback', error: err.message }, origin);
  }
}

/**
 * Update course-level started/completed flags based on module progress
 */
function updateCourseAggregates(course: any) {
  const modules = Object.values(course.modules || {}) as any[];
  if (modules.length === 0) return;

  // Started: any module started
  const anyStarted = modules.some((m) => m.started);
  if (anyStarted && !course.started) {
    course.started = true;
    const startedModules = modules.filter((m) => m.started_at).map((m) => m.started_at!);
    course.started_at = startedModules.sort()[0]; // Earliest started_at
  }

  // NOTE: Course completion is intentionally NOT calculated here.
  // The course.modules object only contains modules the learner has interacted with,
  // not the full module list from the course definition. Computing completion would
  // require loading course metadata to know the total module count.
  // Completion tracking will be implemented in a follow-up issue.
}

/**
 * Update pathway-level started/completed flags based on course/module progress
 */
function updatePathwayAggregates(pathway: any) {
  if (pathway.courses) {
    // Hierarchical model: aggregate from courses
    const courses = Object.values(pathway.courses || {}) as any[];
    if (courses.length === 0) return;

    // Started: any course started
    const anyStarted = courses.some((c) => c.started);
    if (anyStarted && !pathway.started) {
      pathway.started = true;
      const startedCourses = courses.filter((c) => c.started_at).map((c) => c.started_at!);
      pathway.started_at = startedCourses.sort()[0]; // Earliest started_at
    }

    // NOTE: Pathway completion is intentionally NOT calculated here.
    // The pathway.courses object only contains courses the learner has interacted with,
    // not the full course list from the pathway definition. Computing completion would
    // require loading pathway metadata to know the total course count.
    // Completion tracking will be implemented in a follow-up issue.
  } else if (pathway.modules) {
    // Flat model: aggregate from modules (backward compatibility)
    const modules = Object.values(pathway.modules || {}) as any[];
    if (modules.length === 0) return;

    // Started: any module started
    const anyStarted = modules.some((m) => m.started);
    if (anyStarted && !pathway.started) {
      pathway.started = true;
      const startedModules = modules.filter((m) => m.started_at).map((m) => m.started_at!);
      pathway.started_at = startedModules.sort()[0]; // Earliest started_at
    }

    // NOTE: Flat model pathway completion is intentionally NOT calculated here for the same
    // reason as hierarchical: pathway.modules may only contain modules the learner has
    // interacted with, not the full module list from the pathway definition.
    // Completion tracking will be implemented in a follow-up issue.
  }
}

/**
 * Persist progress via Contact Properties (MVP default)
 * Uses hhl_progress_state property to store JSON progress data
 */
async function persistViaContactProperties(hubspot: any, input: TrackEventInput) {
  // Find contact by email or ID
  let contactId: string;

  if (input.contactIdentifier?.contactId) {
    contactId = input.contactIdentifier.contactId;
  } else if (input.contactIdentifier?.email) {
    // Look up contact by email
    const searchResponse = await hubspot.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: input.contactIdentifier.email,
        }],
      }],
      properties: ['hhl_progress_state'],
      limit: 1,
    });

    if (!searchResponse.results || searchResponse.results.length === 0) {
      throw new Error(`Contact not found for email: ${input.contactIdentifier.email}`);
    }

    contactId = searchResponse.results[0].id;
  } else {
    throw new Error('No contact identifier provided');
  }

  // Read current progress state
  const contact = await hubspot.crm.contacts.basicApi.getById(contactId, ['hhl_progress_state']);
  let progressState: any = {};

  try {
    if (contact.properties.hhl_progress_state) {
      progressState = JSON.parse(contact.properties.hhl_progress_state);
    }
  } catch (err) {
    console.warn('Failed to parse existing progress state, starting fresh:', err);
    progressState = {};
  }

  // Extract pathway, course, and module info from payload or top-level fields
  const pathwaySlug = input.pathway_slug || (input.payload?.pathway_slug as string) || null;
  const courseSlug = input.course_slug || (input.payload?.course_slug as string) || null;
  const moduleSlug = (input.payload?.module_slug as string) || null;
  const enrollmentSource = input.enrollment_source || (input.payload?.enrollment_source as string) || null;

  // Update progress based on event type
  const timestamp = new Date().toISOString();
  const dateOnly = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format for HubSpot date property

  if (input.eventName === 'learning_pathway_enrolled' && pathwaySlug) {
    // Initialize pathway if needed
    if (!progressState[pathwaySlug]) {
      progressState[pathwaySlug] = { modules: {} };
    }
    progressState[pathwaySlug].enrolled = true;
    progressState[pathwaySlug].enrolled_at = timestamp;
    if (enrollmentSource) {
      progressState[pathwaySlug].enrollment_source = enrollmentSource;
    }
  } else if (input.eventName === 'learning_course_enrolled' && courseSlug) {
    // Determine if this is a standalone course or course within a pathway
    if (pathwaySlug) {
      // Course within pathway (hierarchical model)
      if (!progressState[pathwaySlug]) {
        progressState[pathwaySlug] = { courses: {} };
      }
      if (!progressState[pathwaySlug].courses) {
        progressState[pathwaySlug].courses = {};
      }
      if (!progressState[pathwaySlug].courses[courseSlug]) {
        progressState[pathwaySlug].courses[courseSlug] = { modules: {} };
      }
      progressState[pathwaySlug].courses[courseSlug].enrolled = true;
      progressState[pathwaySlug].courses[courseSlug].enrolled_at = timestamp;
      if (enrollmentSource) {
        progressState[pathwaySlug].courses[courseSlug].enrollment_source = enrollmentSource;
      }

      // Ensure parent pathway is also marked as enrolled when first course is enrolled
      if (!progressState[pathwaySlug].enrolled) {
        progressState[pathwaySlug].enrolled = true;
        progressState[pathwaySlug].enrolled_at = timestamp;
        if (enrollmentSource) {
          progressState[pathwaySlug].enrollment_source = enrollmentSource;
        }
      }
    } else {
      // Standalone course
      if (!progressState.courses) {
        progressState.courses = {};
      }
      if (!progressState.courses[courseSlug]) {
        progressState.courses[courseSlug] = { modules: {} };
      }
      progressState.courses[courseSlug].enrolled = true;
      progressState.courses[courseSlug].enrolled_at = timestamp;
      if (enrollmentSource) {
        progressState.courses[courseSlug].enrollment_source = enrollmentSource;
      }
    }
  } else if (moduleSlug && (pathwaySlug || courseSlug)) {
    // Module progress: support both hierarchical (pathway → course → module) and flat models

    if (pathwaySlug && courseSlug) {
      // Hierarchical model: pathway → course → module
      if (!progressState[pathwaySlug]) {
        progressState[pathwaySlug] = { courses: {} };
      }
      if (!progressState[pathwaySlug].courses) {
        progressState[pathwaySlug].courses = {};
      }
      if (!progressState[pathwaySlug].courses[courseSlug]) {
        progressState[pathwaySlug].courses[courseSlug] = { modules: {} };
      }
      if (!progressState[pathwaySlug].courses[courseSlug].modules[moduleSlug]) {
        progressState[pathwaySlug].courses[courseSlug].modules[moduleSlug] = {};
      }

      // Auto-enroll course if not already enrolled (backward compatibility)
      // Existing clients only send module events without explicit course enrollment
      if (!progressState[pathwaySlug].courses[courseSlug].enrolled) {
        progressState[pathwaySlug].courses[courseSlug].enrolled = true;
        progressState[pathwaySlug].courses[courseSlug].enrolled_at = timestamp;
        progressState[pathwaySlug].courses[courseSlug].enrollment_source = 'module_event';
      }

      // Auto-enroll pathway if not already enrolled
      if (!progressState[pathwaySlug].enrolled) {
        progressState[pathwaySlug].enrolled = true;
        progressState[pathwaySlug].enrolled_at = timestamp;
        progressState[pathwaySlug].enrollment_source = 'module_event';
      }

      if (input.eventName === 'learning_module_started') {
        progressState[pathwaySlug].courses[courseSlug].modules[moduleSlug].started = true;
        progressState[pathwaySlug].courses[courseSlug].modules[moduleSlug].started_at = timestamp;
      } else if (input.eventName === 'learning_module_completed') {
        progressState[pathwaySlug].courses[courseSlug].modules[moduleSlug].completed = true;
        progressState[pathwaySlug].courses[courseSlug].modules[moduleSlug].completed_at = timestamp;
      }

      // Update course aggregates
      updateCourseAggregates(progressState[pathwaySlug].courses[courseSlug]);

      // Update pathway aggregates
      updatePathwayAggregates(progressState[pathwaySlug]);
    } else if (pathwaySlug && !courseSlug) {
      // Flat model (legacy): pathway → module (backward compatibility)
      if (!progressState[pathwaySlug]) {
        progressState[pathwaySlug] = { modules: {} };
      }
      if (!progressState[pathwaySlug].modules) {
        progressState[pathwaySlug].modules = {};
      }
      if (!progressState[pathwaySlug].modules[moduleSlug]) {
        progressState[pathwaySlug].modules[moduleSlug] = {};
      }

      // Auto-enroll pathway if not already enrolled (backward compatibility)
      if (!progressState[pathwaySlug].enrolled) {
        progressState[pathwaySlug].enrolled = true;
        progressState[pathwaySlug].enrolled_at = timestamp;
        progressState[pathwaySlug].enrollment_source = 'module_event';
      }

      if (input.eventName === 'learning_module_started') {
        progressState[pathwaySlug].modules[moduleSlug].started = true;
        progressState[pathwaySlug].modules[moduleSlug].started_at = timestamp;
      } else if (input.eventName === 'learning_module_completed') {
        progressState[pathwaySlug].modules[moduleSlug].completed = true;
        progressState[pathwaySlug].modules[moduleSlug].completed_at = timestamp;
      }

      // Update pathway aggregates (flat model)
      updatePathwayAggregates(progressState[pathwaySlug]);
    } else if (courseSlug && !pathwaySlug) {
      // Standalone course → module
      if (!progressState.courses) {
        progressState.courses = {};
      }
      if (!progressState.courses[courseSlug]) {
        progressState.courses[courseSlug] = { modules: {} };
      }
      if (!progressState.courses[courseSlug].modules[moduleSlug]) {
        progressState.courses[courseSlug].modules[moduleSlug] = {};
      }

      // Auto-enroll course if not already enrolled (backward compatibility)
      if (!progressState.courses[courseSlug].enrolled) {
        progressState.courses[courseSlug].enrolled = true;
        progressState.courses[courseSlug].enrolled_at = timestamp;
        progressState.courses[courseSlug].enrollment_source = 'module_event';
      }

      if (input.eventName === 'learning_module_started') {
        progressState.courses[courseSlug].modules[moduleSlug].started = true;
        progressState.courses[courseSlug].modules[moduleSlug].started_at = timestamp;
      } else if (input.eventName === 'learning_module_completed') {
        progressState.courses[courseSlug].modules[moduleSlug].completed = true;
        progressState.courses[courseSlug].modules[moduleSlug].completed_at = timestamp;
      }

      // Update course aggregates
      updateCourseAggregates(progressState.courses[courseSlug]);
    }
  }

  // Base properties to update
  const props: Record<string, any> = {
    hhl_progress_state: JSON.stringify(progressState),
    hhl_progress_updated_at: dateOnly, // Date-only format (YYYY-MM-DD) for HubSpot date property
    hhl_progress_summary: generateProgressSummary(progressState),
  };

  // Handle page view → last viewed properties
  if (input.eventName === 'learning_page_viewed') {
    const contentType = (input.payload?.content_type as string) || '';
    const slug = (input.payload?.slug as string) || '';
    if (contentType && slug) {
      props.hhl_last_viewed_type = contentType;
      props.hhl_last_viewed_slug = slug;
      // For datetime property we write ISO timestamp; HubSpot will coerce if configured as datetime
      props.hhl_last_viewed_at = timestamp;
    }
  }

  // Update contact properties
  await hubspot.crm.contacts.basicApi.update(contactId, { properties: props });
}

/**
 * Persist progress via Custom Behavioral Events (future enhancement)
 * Requires Custom Behavioral Events in HubSpot license
 */
async function persistViaBehavioralEvents(hubspot: any, input: TrackEventInput) {
  const eventData: any = {
    eventName: input.eventName,
    occurredAt: new Date(), // Use Date object, not ISO string
    properties: {
      ...(input.payload || {}),
    },
  };

  // Identify contact by email or contactId
  if (input.contactIdentifier?.email) {
    eventData.email = input.contactIdentifier.email;
  } else if (input.contactIdentifier?.contactId) {
    eventData.objectId = input.contactIdentifier.contactId;
  }

  // Send event to HubSpot (v11 client)
  await hubspot.events.send.behavioralEventsTrackingApi.send(eventData as any);
}

/**
 * Generate a human-readable summary of progress state
 */
function generateProgressSummary(progressState: any): string {
  const keys = Object.keys(progressState);
  if (keys.length === 0) return 'No progress yet';

  const summaries: string[] = [];

  for (const key of keys) {
    if (key === 'courses') {
      // Standalone courses
      const courses = progressState.courses || {};
      for (const courseSlug in courses) {
        const courseData = courses[courseSlug];
        const modules = Object.keys(courseData.modules || {});
        const completed = modules.filter((m) => courseData.modules[m].completed).length;
        const total = modules.length;

        if (total > 0) {
          summaries.push(`${courseSlug}: ${completed}/${total} modules`);
        }
      }
    } else {
      // Pathway
      const pathwayData = progressState[key];

      if (pathwayData.courses) {
        // Hierarchical model: count courses
        const courses = Object.keys(pathwayData.courses || {});
        const completedCourses = courses.filter((c) => pathwayData.courses[c].completed).length;
        const total = courses.length;

        if (total > 0) {
          summaries.push(`${key}: ${completedCourses}/${total} courses`);
        }
      } else if (pathwayData.modules) {
        // Flat model: count modules (backward compatibility)
        const modules = Object.keys(pathwayData.modules || {});
        const completed = modules.filter((m) => pathwayData.modules[m].completed).length;
        const total = modules.length;

        if (total > 0) {
          summaries.push(`${key}: ${completed}/${total} modules`);
        }
      }
    }
  }

  return summaries.join('; ') || 'In progress';
}

async function grade(raw: string, origin?: string) {
  // Check payload size
  if (!checkPayloadSize(raw)) {
    const error = createValidationError(
      ValidationErrorCode.PAYLOAD_TOO_LARGE,
      'Request payload exceeds maximum size of 10KB'
    );
    logValidationFailure(error, '/quiz/grade', raw);
    return bad(400, error.message, origin, { code: error.code });
  }

  // Parse JSON
  let parsedBody: any;
  try {
    parsedBody = JSON.parse(raw || '{}');
  } catch (e) {
    const error = createValidationError(
      ValidationErrorCode.INVALID_JSON,
      'Request body is not valid JSON',
      [(e as Error).message]
    );
    logValidationFailure(error, '/quiz/grade', raw);
    return bad(400, error.message, origin, { code: error.code, details: error.details });
  }

  // Validate against schema
  const validation = validatePayload(quizGradeSchema, parsedBody, 'quiz grade payload');
  if (!validation.success) {
    const error = createValidationError(
      ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
      validation.error,
      validation.details
    );
    logValidationFailure(error, '/quiz/grade', raw);
    return bad(400, error.message, origin, { code: error.code, details: error.details });
  }

  const input = validation.data as QuizGradeInput;

  // TODO: fetch quiz schema from HubDB (modules.quiz_schema_json) and compute score.
  // Placeholder logic:
  const result: QuizGradeResult = { score: 100, pass: true };
  console.log('Graded module', input.module_slug, '=>', result);

  // Optionally emit completion event
  return ok(result, origin);
}
