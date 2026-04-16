/**
 * GET /shadow/pathway/status (handler-visible path: /pathway/status)
 *
 * Shadow-only read endpoint: returns pathway-level progress with per-course
 * rollup using shadow aggregation semantics. Consumed by the shadow pathway
 * detail page and by My Learning for pathway cards.
 *
 * Shadow guard: 403 when APP_STAGE is neither 'shadow' nor 'production'.
 * Auth: httpOnly cookie (hhl_access_token) verified against Cognito JWKS.
 * Read-only: no DynamoDB writes.
 *
 * @see Issue #451 (Phase 5A), Spec #449 §2.2, Test plan #450 §2.3.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { verifyCookieAuth } from './cognito-auth.js';
import { computeShadowPathwayStatus } from './shadow-aggregation.js';

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

export async function handleShadowPathwayStatus(event: any) {
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

  const pathway_slug = (event.queryStringParameters?.pathway_slug || '').trim();
  if (!pathway_slug) {
    return jsonResp(400, { error: 'pathway_slug query parameter is required' }, origin);
  }

  if (!process.env.ENTITY_COMPLETIONS_TABLE) {
    return jsonResp(500, { error: 'Server configuration error' }, origin);
  }

  try {
    const result = await computeShadowPathwayStatus({
      dynamo: getDynamo(),
      userId,
      pathwaySlug: pathway_slug,
    });
    if (!result) {
      return jsonResp(400, { error: 'pathway not found' }, origin);
    }
    return jsonResp(200, result, origin);
  } catch (err: any) {
    if (err?.message === 'Server configuration error') {
      return jsonResp(500, { error: 'Server configuration error' }, origin);
    }
    console.error('[ShadowPathwayStatus] error:', err?.message || err);
    return jsonResp(500, { error: 'Failed to read pathway status' }, origin);
  }
}
