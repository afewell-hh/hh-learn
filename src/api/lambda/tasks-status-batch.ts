/**
 * GET /tasks/status/batch?module_slugs=slug1,slug2,...
 *
 * Shadow-only batch read: returns task completion states for multiple modules
 * in a single request. Used by the shadow My Learning page (#411).
 *
 * Query param: module_slugs — comma-separated list (max 25 slugs)
 * Response: { statuses: { [moduleSlug]: { module_status, tasks } } }
 *
 * Shadow guard: 403 if APP_STAGE !== 'shadow'.
 * Auth: httpOnly cookie (hhl_access_token) verified against Cognito JWKS.
 * Read-only: no DynamoDB writes in this handler.
 *
 * Uses DynamoDB BatchGetItem to retrieve all module completion records for the
 * user in a single round-trip. Slugs with no DynamoDB record are returned with
 * module_status: 'not_started' and an empty tasks map.
 *
 * @see Issue #411
 * @see GET /tasks/status (#409) — single-module version
 * @see infrastructure/dynamodb/entity-completions-shadow-table.json
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { verifyCookieAuth } from './cognito-auth.js';
import { buildResponseFromRecord } from './tasks-status.js';
import type { TaskStatusResponse } from './tasks-status.js';

// ---------------------------------------------------------------------------
// DynamoDB client (lazy init)
// ---------------------------------------------------------------------------

let _dynamoClient: DynamoDBDocumentClient | undefined;
function getDynamo(): DynamoDBDocumentClient {
  if (!_dynamoClient) {
    const region =
      process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-west-2';
    _dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  return _dynamoClient;
}

// ---------------------------------------------------------------------------
// CORS helpers
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'https://hedgehog.cloud',
  'https://www.hedgehog.cloud',
];
const HUBSPOT_CDN_PATTERN =
  /^https:\/\/.*\.hubspotusercontent(?:-na1|00|20|30|40)\.net$/;

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return 'https://hedgehog.cloud';
  if (ALLOWED_ORIGINS.includes(origin) || HUBSPOT_CDN_PATTERN.test(origin)) {
    return origin;
  }
  return 'https://hedgehog.cloud';
}

function jsonResp(
  status: number,
  body: unknown,
  origin?: string
): { statusCode: number; headers: Record<string, string>; body: string } {
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

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

export type TaskStatusBatchResponse = {
  statuses: Record<string, TaskStatusResponse>;
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleTasksStatusBatch(event: any) {
  const origin = event.headers?.origin || event.headers?.Origin;

  // --- Shadow guard ---
  if (process.env.APP_STAGE !== 'shadow') {
    return jsonResp(403, { error: 'Not available in this environment' }, origin);
  }

  // --- Auth ---
  let userId: string;
  try {
    const auth = await verifyCookieAuth(event);
    userId = auth.userId;
  } catch {
    return jsonResp(401, { error: 'Unauthorized' }, origin);
  }

  // --- Validate query parameter ---
  const rawSlugs = (event.queryStringParameters?.module_slugs || '').trim();
  if (!rawSlugs) {
    return jsonResp(400, { error: 'module_slugs query parameter is required' }, origin);
  }

  const moduleSlugs = rawSlugs
    .split(',')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);

  if (moduleSlugs.length === 0) {
    return jsonResp(400, { error: 'module_slugs must contain at least one slug' }, origin);
  }
  if (moduleSlugs.length > 25) {
    return jsonResp(400, { error: 'module_slugs may contain at most 25 slugs' }, origin);
  }

  const ENTITY_COMPLETIONS_TABLE = process.env.ENTITY_COMPLETIONS_TABLE!;

  // --- BatchGetItem ---
  try {
    const keys = moduleSlugs.map((slug: string) => ({
      PK: `USER#${userId}`,
      SK: `COMPLETION#MODULE#${slug}`,
    }));

    const result = await getDynamo().send(
      new BatchGetCommand({
        RequestItems: {
          [ENTITY_COMPLETIONS_TABLE]: { Keys: keys },
        },
      })
    );

    // Build a lookup map from SK → record
    const records: Record<string, any> = {};
    const fetched = (result.Responses?.[ENTITY_COMPLETIONS_TABLE]) || [];
    for (const item of fetched) {
      // SK format: COMPLETION#MODULE#<slug>
      const sk: string = item.SK || '';
      const slug = sk.replace('COMPLETION#MODULE#', '');
      if (slug) records[slug] = item;
    }

    // Build response map: present slugs from DynamoDB + not_started for missing
    const statuses: Record<string, TaskStatusResponse> = {};
    for (const slug of moduleSlugs) {
      if (records[slug]) {
        statuses[slug] = buildResponseFromRecord(slug, records[slug]);
      } else {
        statuses[slug] = {
          module_slug: slug,
          module_status: 'not_started',
          tasks: {},
        };
      }
    }

    const response: TaskStatusBatchResponse = { statuses };
    return jsonResp(200, response, origin);
  } catch (err: any) {
    console.error('[TasksStatusBatch] DynamoDB BatchGetItem failed:', err?.message || err);
    return jsonResp(500, { error: 'Failed to read task statuses' }, origin);
  }
}
