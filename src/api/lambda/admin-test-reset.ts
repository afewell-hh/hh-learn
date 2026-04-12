/**
 * POST /admin/test/reset
 *
 * Shadow-only test utility: deletes all shadow DynamoDB records for the
 * authenticated user (optionally scoped to a single module_slug).
 *
 * Dual guard:
 *   1. APP_STAGE must be 'shadow'
 *   2. ENABLE_TEST_BYPASS must be 'true'
 *
 * Body (JSON, all optional):
 *   { module_slug?: string }
 *
 * Response:
 *   { reset: true, module_slug: string|null, records_deleted: {
 *       task_records: number, task_attempts: number, entity_completions: number
 *   }}
 *
 * Auth: httpOnly cookie (hhl_access_token) verified against Cognito JWKS.
 *
 * DynamoDB operations:
 *   - task-records-shadow     SK prefix: TASK#MODULE#<slug># (or all TASK# items)
 *   - task-attempts-shadow    SK prefix: ATTEMPT#MODULE#<slug># (or all ATTEMPT# items)
 *   - entity-completions-shadow SK: COMPLETION#MODULE#<slug> (or all COMPLETION# items)
 *
 * @see Issue #412
 * @see infrastructure/dynamodb/task-records-shadow-table.json
 * @see infrastructure/dynamodb/task-attempts-shadow-table.json
 * @see infrastructure/dynamodb/entity-completions-shadow-table.json
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { verifyCookieAuth } from './cognito-auth.js';

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
// DynamoDB helpers
// ---------------------------------------------------------------------------

/**
 * Query all items for a user in a table where SK begins with the given prefix.
 * Returns array of { PK, SK } delete keys.
 */
async function queryDeleteKeys(
  tableName: string,
  userId: string,
  skPrefix: string
): Promise<Array<{ PK: string; SK: string }>> {
  const keys: Array<{ PK: string; SK: string }> = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await getDynamo().send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': skPrefix,
        },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey: lastKey,
      })
    );

    for (const item of result.Items || []) {
      keys.push({ PK: item.PK, SK: item.SK });
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return keys;
}

/**
 * Batch-delete items. DynamoDB BatchWriteItem supports up to 25 requests per call.
 */
async function batchDelete(
  tableName: string,
  keys: Array<{ PK: string; SK: string }>
): Promise<number> {
  if (keys.length === 0) return 0;

  let deleted = 0;
  const BATCH_SIZE = 25;

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const chunk = keys.slice(i, i + BATCH_SIZE);
    await getDynamo().send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((k) => ({
            DeleteRequest: { Key: { PK: k.PK, SK: k.SK } },
          })),
        },
      })
    );
    deleted += chunk.length;
  }

  return deleted;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleAdminTestReset(event: any) {
  const origin = event.headers?.origin || event.headers?.Origin;

  // --- Dual guard ---
  if (process.env.APP_STAGE !== 'shadow') {
    return jsonResp(403, { error: 'Not available in this environment' }, origin);
  }
  if (process.env.ENABLE_TEST_BYPASS !== 'true') {
    return jsonResp(403, { error: 'Test bypass not enabled' }, origin);
  }

  // --- Auth ---
  let userId: string;
  try {
    const auth = await verifyCookieAuth(event);
    userId = auth.userId;
  } catch {
    return jsonResp(401, { error: 'Unauthorized' }, origin);
  }

  // --- Parse optional body ---
  let moduleSlug: string | null = null;
  try {
    if (event.body) {
      const parsed = JSON.parse(event.body);
      if (parsed.module_slug && typeof parsed.module_slug === 'string') {
        moduleSlug = parsed.module_slug.trim() || null;
      }
    }
  } catch {
    return jsonResp(400, { error: 'Invalid JSON body' }, origin);
  }

  const TASK_RECORDS_TABLE = process.env.TASK_RECORDS_TABLE!;
  const TASK_ATTEMPTS_TABLE = process.env.TASK_ATTEMPTS_TABLE!;
  const ENTITY_COMPLETIONS_TABLE = process.env.ENTITY_COMPLETIONS_TABLE!;

  // --- Build SK prefixes ---
  // With module_slug: scope to that module only
  // Without: delete everything for this user across all modules
  const taskRecordsPrefix = moduleSlug
    ? `TASK#MODULE#${moduleSlug}#`
    : 'TASK#MODULE#';
  const taskAttemptsPrefix = moduleSlug
    ? `ATTEMPT#MODULE#${moduleSlug}#`
    : 'ATTEMPT#MODULE#';
  const completionsPrefix = moduleSlug
    ? `COMPLETION#MODULE#${moduleSlug}`
    : 'COMPLETION#MODULE#';

  try {
    // Query delete keys for all three tables
    const [taskRecordKeys, taskAttemptKeys, completionKeys] = await Promise.all([
      queryDeleteKeys(TASK_RECORDS_TABLE, userId, taskRecordsPrefix),
      queryDeleteKeys(TASK_ATTEMPTS_TABLE, userId, taskAttemptsPrefix),
      queryDeleteKeys(ENTITY_COMPLETIONS_TABLE, userId, completionsPrefix),
    ]);

    // Execute deletes
    const [taskRecordsDeleted, taskAttemptsDeleted, entityCompletionsDeleted] =
      await Promise.all([
        batchDelete(TASK_RECORDS_TABLE, taskRecordKeys),
        batchDelete(TASK_ATTEMPTS_TABLE, taskAttemptKeys),
        batchDelete(ENTITY_COMPLETIONS_TABLE, completionKeys),
      ]);

    return jsonResp(
      200,
      {
        reset: true,
        module_slug: moduleSlug,
        records_deleted: {
          task_records: taskRecordsDeleted,
          task_attempts: taskAttemptsDeleted,
          entity_completions: entityCompletionsDeleted,
        },
      },
      origin
    );
  } catch (err: any) {
    console.error('[AdminTestReset] DynamoDB operation failed:', err?.message || err);
    return jsonResp(500, { error: 'Reset failed' }, origin);
  }
}
