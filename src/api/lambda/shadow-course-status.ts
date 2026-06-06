/**
 * GET /shadow/course/status (handler-visible path: /course/status)
 *
 * Shadow-only read endpoint: returns course-level progress with per-module
 * breakdown using shadow aggregation semantics. Consumed by the shadow
 * course detail page and by My Learning for course cards.
 *
 * Shadow guard: 403 when APP_STAGE is neither 'shadow' nor 'production'.
 * Auth: httpOnly cookie (hhl_access_token) verified against Cognito JWKS.
 * Read-only: no DynamoDB writes.
 *
 * @see Issue #451 (Phase 5A), Spec #449 §2.1, Test plan #450 §2.2.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { verifyCookieAuth } from './cognito-auth.js';
import { computeShadowCourseStatus } from './shadow-aggregation.js';

let _dynamoClient: DynamoDBDocumentClient | undefined;
function getDynamo(): DynamoDBDocumentClient {
  if (!_dynamoClient) {
    const region = process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-west-2';
    _dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  return _dynamoClient;
}

const ALLOWED_ORIGINS = ['https://hedgehog.cloud', 'https://www.hedgehog.cloud'];
const HUBSPOT_CDN_PATTERN = /^https:\/\/.*\.hubspotusercontent(?:-na1|00|20|30|40)\.net$/;

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return 'https://hedgehog.cloud';
  if (ALLOWED_ORIGINS.includes(origin) || HUBSPOT_CDN_PATTERN.test(origin)) return origin;
  return 'https://hedgehog.cloud';
}

function jsonResp(status: number, body: unknown, origin?: string) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getAllowedOrigin(origin),
      'Access-Control-Allow-Credentials': 'true',
    },
    body: JSON.stringify(body),
  };
}

export async function handleShadowCourseStatus(event: any) {
  const origin = event.headers?.origin || event.headers?.Origin;

  const stage = process.env.APP_STAGE;
  if (stage !== 'shadow' && stage !== 'production') {
    return jsonResp(403, { error: 'Not available in this environment' }, origin);
  }

  let userId: string;
  try {
    const auth = await verifyCookieAuth(event);
    userId = auth.userId;
  } catch {
    return jsonResp(401, { error: 'Unauthorized' }, origin);
  }

  const course_slug = (event.queryStringParameters?.course_slug || '').trim();
  if (!course_slug) {
    return jsonResp(400, { error: 'course_slug query parameter is required' }, origin);
  }

  if (!process.env.ENTITY_COMPLETIONS_TABLE) {
    return jsonResp(500, { error: 'Server configuration error' }, origin);
  }

  try {
    const result = await computeShadowCourseStatus({
      dynamo: getDynamo(),
      userId,
      courseSlug: course_slug,
    });
    if (!result) {
      return jsonResp(400, { error: 'course not found' }, origin);
    }
    return jsonResp(200, result, origin);
  } catch (err: any) {
    if (err?.message === 'Server configuration error') {
      return jsonResp(500, { error: 'Server configuration error' }, origin);
    }
    console.error('[ShadowCourseStatus] error:', err?.message || err);
    return jsonResp(500, { error: 'Failed to read course status' }, origin);
  }
}
