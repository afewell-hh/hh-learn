/**
 * Protected API Endpoints for External SSO + Progress Store (Issue #304)
 *
 * Implements DynamoDB-backed API endpoints for enrollments, progress, and badges.
 * All endpoints (except /api/health) require authentication via hhl_access_token cookie.
 *
 * Endpoints:
 * - GET /api/enrollments - List user's enrollments
 * - POST /api/enrollments - Create new enrollment
 * - DELETE /api/enrollments/:courseSlug - Remove enrollment
 * - GET /api/progress/:courseSlug - Get progress for specific course
 * - POST /api/progress - Update module progress
 * - GET /api/badges - List user's badges
 * - GET /api/health - Health check (no auth required)
 *
 * @see docs/implementation-plan-issue-304.md
 * @see tests/api/enrollments.spec.ts
 * @see tests/api/progress.spec.ts
 * @see tests/api/badges.spec.ts
 * @see tests/api/health.spec.ts
 */

import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import jwt from 'jsonwebtoken';
import {
  enrollmentCreateSchema,
  courseSlugParamSchema,
  progressUpdateSchema,
  validatePayload,
  checkPayloadSize,
  ValidationErrorCode,
  createValidationError,
} from '../../shared/validation.js';

// Environment variables
const COGNITO_REGION = process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-west-2';
const COGNITO_ISSUER = process.env.COGNITO_ISSUER!;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

// DynamoDB table names
const DYNAMODB_USERS_TABLE = process.env.DYNAMODB_USERS_TABLE!;
const DYNAMODB_ENROLLMENTS_TABLE = process.env.DYNAMODB_ENROLLMENTS_TABLE!;
const DYNAMODB_PROGRESS_TABLE = process.env.DYNAMODB_PROGRESS_TABLE!;
const DYNAMODB_BADGES_TABLE = process.env.DYNAMODB_BADGES_TABLE!;

// DynamoDB client
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: COGNITO_REGION }));

// API version
const API_VERSION = '1.0.0';

// =============================================================================
// CORS and Response Helpers
// =============================================================================

const ALLOWED_ORIGINS = [
  'https://hedgehog.cloud',
  'https://www.hedgehog.cloud',
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return 'https://hedgehog.cloud';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return 'https://hedgehog.cloud';
}

function ok(body: unknown, origin?: string, statusCode: number = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getAllowedOrigin(origin),
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(body),
  };
}

function bad(code: number, msg: string, origin?: string, details?: any): APIGatewayProxyResultV2 {
  return {
    statusCode: code,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getAllowedOrigin(origin),
      'Access-Control-Allow-Credentials': 'true',
      ...(code === 401 && { 'WWW-Authenticate': 'Bearer realm="Hedgehog Learn"' }),
    },
    body: JSON.stringify(details ? { error: msg, details } : { error: msg }),
  };
}

function noContent(origin?: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(origin),
      'Access-Control-Allow-Credentials': 'true',
    },
    body: '',
  };
}

// =============================================================================
// JWT Verification and User Extraction
// =============================================================================

/**
 * JWKS cache (Lambda global scope for reuse across warm invocations)
 */
interface JWK {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

interface JWKS {
  keys: JWK[];
}

let jwksCache: JWKS | null = null;
let jwksCacheExpiry = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

async function fetchJWKS(): Promise<JWKS> {
  const now = Date.now();

  if (jwksCache && now < jwksCacheExpiry) {
    return jwksCache;
  }

  const jwksUrl = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }

  jwksCache = await response.json();
  jwksCacheExpiry = now + JWKS_CACHE_TTL;

  return jwksCache!;
}

function jwkToPem(jwk: JWK): string {
  const modulus = Buffer.from(jwk.n, 'base64url');
  const exponent = Buffer.from(jwk.e, 'base64url');

  const modulusLength = modulus.length;
  const exponentLength = exponent.length;

  const derPrefix = Buffer.from([
    0x30, 0x82,
    ((modulusLength + exponentLength + 32) >> 8) & 0xff,
    (modulusLength + exponentLength + 32) & 0xff,
    0x30, 0x0d,
    0x06, 0x09,
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
    0x03, 0x82,
    ((modulusLength + exponentLength + 9) >> 8) & 0xff,
    (modulusLength + exponentLength + 9) & 0xff,
    0x00,
    0x30, 0x82,
    ((modulusLength + exponentLength + 4) >> 8) & 0xff,
    (modulusLength + exponentLength + 4) & 0xff,
    0x02, 0x82,
    (modulusLength >> 8) & 0xff,
    modulusLength & 0xff,
  ]);

  const exponentPrefix = Buffer.from([0x02, exponentLength]);

  const der = Buffer.concat([derPrefix, modulus, exponentPrefix, exponent]);
  const pem = `-----BEGIN PUBLIC KEY-----\n${der.toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----\n`;

  return pem;
}

async function verifyJWT(token: string): Promise<any> {
  const decodedHeader = jwt.decode(token, { complete: true });

  if (!decodedHeader || typeof decodedHeader === 'string') {
    throw new Error('Invalid token format');
  }

  const kid = decodedHeader.header.kid;
  if (!kid) {
    throw new Error('Token missing kid in header');
  }

  const jwks = await fetchJWKS();
  const jwk = jwks.keys.find(key => key.kid === kid);

  if (!jwk) {
    throw new Error(`No matching JWK found for kid: ${kid}`);
  }

  const pem = jwkToPem(jwk);

  const decoded = jwt.verify(token, pem, {
    algorithms: ['RS256'],
    issuer: COGNITO_ISSUER,
  }) as any;

  // Validate token_use is 'access'
  if (decoded.token_use !== 'access') {
    throw new Error(`Invalid token_use: expected access, got ${decoded.token_use}`);
  }

  // Validate client_id
  if (decoded.client_id !== COGNITO_CLIENT_ID) {
    throw new Error(`Invalid client_id: expected ${COGNITO_CLIENT_ID}, got ${decoded.client_id}`);
  }

  return decoded;
}

/**
 * Extract and verify userId from hhl_access_token cookie
 * Returns userId (Cognito sub) or null if authentication fails
 */
async function extractUserIdFromCookie(event: any): Promise<string | null> {
  try {
    const cookies = event.headers?.cookie || event.headers?.Cookie || '';
    const accessTokenMatch = cookies.match(/hhl_access_token=([^;]+)/);

    if (!accessTokenMatch) {
      return null;
    }

    const accessToken = accessTokenMatch[1];
    const decoded = await verifyJWT(accessToken);

    const userId = decoded.sub || decoded.username;
    if (!userId) {
      return null;
    }

    return userId;
  } catch (err: any) {
    console.error('[Auth] JWT verification failed:', err.message);
    return null;
  }
}

// =============================================================================
// Enrollment Endpoints
// =============================================================================

/**
 * GET /api/enrollments
 * List user's enrollments
 */
export async function listEnrollments(event: any): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;

  try {
    // Authenticate user
    const userId = await extractUserIdFromCookie(event);
    if (!userId) {
      return bad(401, 'Unauthorized: Missing or invalid access token', origin);
    }

    // Query enrollments from DynamoDB
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: DYNAMODB_ENROLLMENTS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
        },
      })
    );

    const enrollments = (result.Items || []).map(item => ({
      courseSlug: item.courseSlug,
      pathwaySlug: item.pathwaySlug,
      enrolledAt: item.enrolledAt,
      enrollmentSource: item.enrollmentSource,
      status: item.status || 'active',
      completedAt: item.completedAt,
    }));

    return ok({ enrollments }, origin);
  } catch (err: any) {
    console.error('[listEnrollments] Error:', err);
    return bad(500, 'Internal server error', origin);
  }
}

/**
 * POST /api/enrollments
 * Create new enrollment
 */
export async function createEnrollment(event: any): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;

  try {
    // Authenticate user
    const userId = await extractUserIdFromCookie(event);
    if (!userId) {
      return bad(401, 'Unauthorized: Missing or invalid access token', origin);
    }

    // Parse and validate request body
    const raw = event.body || '{}';

    if (!checkPayloadSize(raw)) {
      return bad(400, 'Request payload exceeds maximum size of 10KB', origin, {
        code: ValidationErrorCode.PAYLOAD_TOO_LARGE,
      });
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(raw);
    } catch (e) {
      return bad(400, 'Request body is not valid JSON', origin, {
        code: ValidationErrorCode.INVALID_JSON,
      });
    }

    const validation = validatePayload(enrollmentCreateSchema, parsedBody, 'enrollment data');
    if (!validation.success) {
      return bad(400, validation.error, origin, {
        code: ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
        details: validation.details,
      });
    }

    const { courseSlug, pathwaySlug, enrollmentSource } = validation.data;

    // Check if enrollment already exists
    const existing = await dynamoClient.send(
      new GetCommand({
        TableName: DYNAMODB_ENROLLMENTS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `ENROLLMENT#${courseSlug}`,
        },
      })
    );

    if (existing.Item) {
      return bad(409, 'Already enrolled in this course', origin, {
        code: 'ALREADY_ENROLLED',
      });
    }

    // Create enrollment
    const now = new Date().toISOString();
    const enrollment = {
      PK: `USER#${userId}`,
      SK: `ENROLLMENT#${courseSlug}`,
      GSI1PK: `COURSE#${courseSlug}`,
      GSI1SK: `USER#${userId}`,
      userId,
      courseSlug,
      pathwaySlug,
      enrolledAt: now,
      enrollmentSource,
      status: 'active',
    };

    await dynamoClient.send(
      new PutCommand({
        TableName: DYNAMODB_ENROLLMENTS_TABLE,
        Item: enrollment,
      })
    );

    console.log('[createEnrollment] Created enrollment:', userId, courseSlug);

    return ok(
      {
        enrollment: {
          courseSlug,
          pathwaySlug,
          enrolledAt: now,
          enrollmentSource,
          status: 'active',
        },
      },
      origin,
      201
    );
  } catch (err: any) {
    console.error('[createEnrollment] Error:', err);
    return bad(500, 'Internal server error', origin);
  }
}

/**
 * DELETE /api/enrollments/:courseSlug
 * Remove enrollment
 */
export async function deleteEnrollment(event: any): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;

  try {
    // Authenticate user
    const userId = await extractUserIdFromCookie(event);
    if (!userId) {
      return bad(401, 'Unauthorized: Missing or invalid access token', origin);
    }

    // Extract and validate courseSlug from path
    const courseSlug = event.pathParameters?.courseSlug;
    if (!courseSlug) {
      return bad(400, 'Missing courseSlug path parameter', origin);
    }

    const validation = validatePayload(courseSlugParamSchema, { courseSlug }, 'courseSlug parameter');
    if (!validation.success) {
      return bad(400, validation.error, origin, {
        code: ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
        details: validation.details,
      });
    }

    // Check if enrollment exists
    const existing = await dynamoClient.send(
      new GetCommand({
        TableName: DYNAMODB_ENROLLMENTS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `ENROLLMENT#${courseSlug}`,
        },
      })
    );

    if (!existing.Item) {
      return bad(404, 'Enrollment not found', origin);
    }

    // Delete enrollment
    await dynamoClient.send(
      new DeleteCommand({
        TableName: DYNAMODB_ENROLLMENTS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `ENROLLMENT#${courseSlug}`,
        },
      })
    );

    console.log('[deleteEnrollment] Deleted enrollment:', userId, courseSlug);

    return noContent(origin);
  } catch (err: any) {
    console.error('[deleteEnrollment] Error:', err);
    return bad(500, 'Internal server error', origin);
  }
}

// =============================================================================
// Progress Endpoints
// =============================================================================

/**
 * GET /api/progress/:courseSlug
 * Get progress for specific course
 */
export async function getCourseProgress(event: any): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;

  try {
    // Authenticate user
    const userId = await extractUserIdFromCookie(event);
    if (!userId) {
      return bad(401, 'Unauthorized: Missing or invalid access token', origin);
    }

    // Extract and validate courseSlug from path
    const courseSlug = event.pathParameters?.courseSlug;
    if (!courseSlug) {
      return bad(400, 'Missing courseSlug path parameter', origin);
    }

    const validation = validatePayload(courseSlugParamSchema, { courseSlug }, 'courseSlug parameter');
    if (!validation.success) {
      return bad(400, validation.error, origin, {
        code: ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
        details: validation.details,
      });
    }

    // Query progress from DynamoDB
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: DYNAMODB_PROGRESS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}#COURSE#${courseSlug}`,
        },
      })
    );

    // Transform DynamoDB items into modules object
    const modules: Record<string, any> = {};

    for (const item of result.Items || []) {
      const moduleId = item.moduleId;
      modules[moduleId] = {
        started: item.started || false,
        startedAt: item.startedAt,
        completed: item.completed || false,
        completedAt: item.completedAt,
      };
    }

    return ok({ courseSlug, modules }, origin);
  } catch (err: any) {
    console.error('[getCourseProgress] Error:', err);
    return bad(500, 'Internal server error', origin);
  }
}

/**
 * POST /api/progress
 * Update module progress
 */
export async function updateProgress(event: any): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;

  try {
    // Authenticate user
    const userId = await extractUserIdFromCookie(event);
    if (!userId) {
      return bad(401, 'Unauthorized: Missing or invalid access token', origin);
    }

    // Parse and validate request body
    const raw = event.body || '{}';

    if (!checkPayloadSize(raw)) {
      return bad(400, 'Request payload exceeds maximum size of 10KB', origin, {
        code: ValidationErrorCode.PAYLOAD_TOO_LARGE,
      });
    }

    let parsedBody: any;
    try {
      parsedBody = JSON.parse(raw);
    } catch (e) {
      return bad(400, 'Request body is not valid JSON', origin, {
        code: ValidationErrorCode.INVALID_JSON,
      });
    }

    const validation = validatePayload(progressUpdateSchema, parsedBody, 'progress update data');
    if (!validation.success) {
      return bad(400, validation.error, origin, {
        code: ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
        details: validation.details,
      });
    }

    const { courseSlug, moduleId, eventType } = validation.data;

    // Get current progress
    const existing = await dynamoClient.send(
      new GetCommand({
        TableName: DYNAMODB_PROGRESS_TABLE,
        Key: {
          PK: `USER#${userId}#COURSE#${courseSlug}`,
          SK: `MODULE#${moduleId}`,
        },
      })
    );

    const now = new Date().toISOString();
    const currentProgress = existing.Item || {};

    // Update progress based on eventType
    const updatedProgress: any = {
      PK: `USER#${userId}#COURSE#${courseSlug}`,
      SK: `MODULE#${moduleId}`,
      userId,
      courseSlug,
      moduleId,
      started: currentProgress.started || false,
      startedAt: currentProgress.startedAt,
      completed: currentProgress.completed || false,
      completedAt: currentProgress.completedAt,
    };

    if (eventType === 'started') {
      updatedProgress.started = true;
      if (!updatedProgress.startedAt) {
        updatedProgress.startedAt = now;
      }
    } else if (eventType === 'completed') {
      updatedProgress.completed = true;
      updatedProgress.completedAt = now;
      // Ensure started is also set
      if (!updatedProgress.started) {
        updatedProgress.started = true;
        if (!updatedProgress.startedAt) {
          updatedProgress.startedAt = now;
        }
      }
    }

    // Save to DynamoDB
    await dynamoClient.send(
      new PutCommand({
        TableName: DYNAMODB_PROGRESS_TABLE,
        Item: updatedProgress,
      })
    );

    console.log('[updateProgress] Updated progress:', userId, courseSlug, moduleId, eventType);

    return ok(
      {
        success: true,
        progress: {
          moduleId,
          started: updatedProgress.started,
          startedAt: updatedProgress.startedAt,
          completed: updatedProgress.completed,
          completedAt: updatedProgress.completedAt,
        },
      },
      origin
    );
  } catch (err: any) {
    console.error('[updateProgress] Error:', err);
    return bad(500, 'Internal server error', origin);
  }
}

// =============================================================================
// Badge Endpoint
// =============================================================================

/**
 * GET /api/badges
 * List user's badges
 */
export async function listBadges(event: any): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;

  try {
    // Authenticate user
    const userId = await extractUserIdFromCookie(event);
    if (!userId) {
      return bad(401, 'Unauthorized: Missing or invalid access token', origin);
    }

    // Query badges from DynamoDB
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: DYNAMODB_BADGES_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'BADGE#',
        },
        ScanIndexForward: false, // Sort descending by SK (newest first)
      })
    );

    const badges = (result.Items || []).map(item => ({
      badgeId: item.badgeId,
      issuedAt: item.issuedAt,
      type: item.type,
      metadata: item.metadata,
    }));

    return ok({ badges }, origin);
  } catch (err: any) {
    console.error('[listBadges] Error:', err);
    return bad(500, 'Internal server error', origin);
  }
}

// =============================================================================
// Health Endpoint
// =============================================================================

/**
 * GET /api/health
 * Health check endpoint (no authentication required)
 */
export async function healthCheck(event: any): Promise<APIGatewayProxyResultV2> {
  const origin = event.headers?.origin || event.headers?.Origin;

  return ok(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    },
    origin
  );
}
