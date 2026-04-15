/**
 * POST /tasks/lab/attest
 *
 * Shadow-only endpoint: records a learner's explicit attestation that they completed
 * a hands-on lab. The platform does not verify the lab environment — the learner's
 * identity and deliberate click is the attestation.
 *
 * Shadow guard: returns 403 when APP_STAGE !== 'shadow'.
 * Auth: httpOnly cookie (hhl_access_token) verified against Cognito JWKS.
 * Validation: confirms task_slug is a declared lab_attestation task for the module
 *   (reads completion_tasks_json from HubDB).
 * Idempotent: re-attesting the same task is accepted and refreshes last_attempt_at.
 * All DynamoDB writes complete before the response is returned (write-before-respond).
 *
 * @see Issue #408
 * @see infrastructure/dynamodb/task-records-shadow-table.json
 * @see infrastructure/dynamodb/task-attempts-shadow-table.json
 * @see infrastructure/dynamodb/entity-completions-shadow-table.json
 */

import { z } from 'zod';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { getHubSpotClient } from '../../shared/hubspot.js';
import { verifyCookieAuth } from './cognito-auth.js';
import { computeModuleStatus, type CompletionTask } from './tasks-quiz-submit.js';
import { issueCertificateIfComplete } from './certificate-issuance.js';

// ---------------------------------------------------------------------------
// DynamoDB client (lazy init for testability)
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
// Request schema
// ---------------------------------------------------------------------------

const attestSchema = z.object({
  module_slug: z.string().min(1).max(200),
  task_slug: z.string().min(1).max(100),
});

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
// Handler
// ---------------------------------------------------------------------------

export async function handleLabAttest(event: any) {
  const origin = event.headers?.origin || event.headers?.Origin;

  // --- Shadow guard (first check after route dispatch) ---
  if (process.env.APP_STAGE !== 'shadow') {
    return jsonResp(403, { error: 'Not available in this environment' }, origin);
  }

  // --- Auth: httpOnly cookie → Cognito JWKS verify ---
  let userId: string;
  let userEmail: string;
  try {
    const auth = await verifyCookieAuth(event);
    userId = auth.userId;
    userEmail = auth.email;
  } catch {
    return jsonResp(401, { error: 'Unauthorized' }, origin);
  }

  // --- Parse and validate request body ---
  let rawBody: any;
  try {
    rawBody = JSON.parse(event.body || '{}');
  } catch {
    return jsonResp(400, { error: 'Invalid JSON' }, origin);
  }

  const parsed = attestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonResp(
      400,
      { error: 'Invalid request', details: parsed.error.flatten() },
      origin
    );
  }

  const { module_slug, task_slug } = parsed.data;

  // --- Fetch completion tasks from HubDB and validate task ---
  let completionTasks: CompletionTask[] = [];

  try {
    const hubspot = getHubSpotClient();
    const tableId = process.env.HUBDB_MODULES_TABLE_ID;
    if (!tableId) {
      console.error('[LabAttest] HUBDB_MODULES_TABLE_ID not set');
      return jsonResp(500, { error: 'Server configuration error' }, origin);
    }

    const rowsResponse = await (hubspot as any).cms.hubdb.rowsApi.getTableRows(
      tableId,
      undefined,
      undefined,
      undefined
    );
    const rows: any[] = rowsResponse.results || [];
    const moduleRow = rows.find(
      (r: any) => (r.path || '').toLowerCase() === module_slug.toLowerCase()
    );

    if (!moduleRow || !moduleRow.values?.completion_tasks_json) {
      return jsonResp(400, { error: 'task not found for module' }, origin);
    }

    try {
      completionTasks = JSON.parse(moduleRow.values.completion_tasks_json);
    } catch {
      return jsonResp(400, { error: 'task not found for module' }, origin);
    }

    // Validate task_slug is declared and is lab_attestation type
    const declaredTask = completionTasks.find((t) => t.task_slug === task_slug);

    if (!declaredTask) {
      return jsonResp(400, { error: 'task not found for module' }, origin);
    }

    if (declaredTask.task_type !== 'lab_attestation') {
      return jsonResp(400, { error: 'task is not a lab_attestation type' }, origin);
    }
  } catch (err: any) {
    console.error('[LabAttest] HubDB fetch error:', err?.message || err);
    return jsonResp(500, { error: 'Failed to fetch task configuration' }, origin);
  }

  const now = new Date().toISOString();
  const dynamo = getDynamo();

  const TASK_RECORDS_TABLE = process.env.TASK_RECORDS_TABLE!;
  const TASK_ATTEMPTS_TABLE = process.env.TASK_ATTEMPTS_TABLE!;
  const ENTITY_COMPLETIONS_TABLE = process.env.ENTITY_COMPLETIONS_TABLE!;

  // --- Persistence (write-before-respond; any failure returns 500) ---
  try {
    // Step 1: Append-only TaskAttempt record
    await dynamo.send(
      new PutCommand({
        TableName: TASK_ATTEMPTS_TABLE,
        Item: {
          PK: `USER#${userId}`,
          SK: `ATTEMPT#MODULE#${module_slug}#${task_slug}#${now}`,
          task_type: 'lab_attestation',
          attested_at: now,
          attempted_at: now,
          learner_identity: { userId, email: userEmail },
        },
      })
    );

    // Step 2: Upsert TaskRecord
    // status=attested is permanent — re-attesting is idempotent, refreshes last_attempt_at
    await dynamo.send(
      new UpdateCommand({
        TableName: TASK_RECORDS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `TASK#MODULE#${module_slug}#${task_slug}`,
        },
        UpdateExpression:
          'SET task_type = :task_type, graded = :graded, #status = :status, ' +
          'last_attempt_at = :now, updated_at = :now ' +
          'ADD attempt_count :one',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':task_type': 'lab_attestation',
          ':graded': false,
          ':status': 'attested',
          ':now': now,
          ':one': 1,
        },
      })
    );

    // Step 3: Read all TaskRecords for this user+module to recompute EntityCompletion
    const taskRecordsResult = await dynamo.send(
      new QueryCommand({
        TableName: TASK_RECORDS_TABLE,
        KeyConditionExpression:
          'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':skPrefix': `TASK#MODULE#${module_slug}#`,
        },
      })
    );

    const taskRecordStatuses: Record<string, string | undefined> = {};
    const taskStatusesMap: Record<string, { status: string; attempts?: number }> = {};

    for (const item of taskRecordsResult.Items || []) {
      const skParts = (item.SK as string).split('#');
      const tSlug = skParts[skParts.length - 1];
      taskRecordStatuses[tSlug] = item.status;
      taskStatusesMap[tSlug] = {
        status: item.status,
        ...(item.attempt_count !== undefined && { attempts: Number(item.attempt_count) }),
      };
    }

    const moduleStatus = computeModuleStatus(completionTasks, taskRecordStatuses);

    // Step 4: Upsert EntityCompletion
    await dynamo.send(
      new UpdateCommand({
        TableName: ENTITY_COMPLETIONS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `COMPLETION#MODULE#${module_slug}`,
        },
        UpdateExpression:
          'SET #status = :status, task_statuses = :task_statuses, last_updated_at = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': moduleStatus,
          ':task_statuses': taskStatusesMap,
          ':now': now,
        },
      })
    );

    // Step 5: Certificate issuance (best-effort — never fails the response)
    // Build a flat slug→status map for the evidenceSummary snapshot
    const evidenceSummary: Record<string, string> = {};
    for (const [slug, detail] of Object.entries(taskStatusesMap)) {
      evidenceSummary[slug] = detail.status;
    }

    const certResult = await issueCertificateIfComplete({
      dynamo,
      userId,
      moduleSlug: module_slug,
      moduleStatus,
      taskStatusesMap: evidenceSummary,
      now,
    });

    const responseBody: Record<string, unknown> = {
      attested: true,
      task_slug,
      module_complete: moduleStatus === 'complete',
    };

    if (certResult.moduleCertId) {
      responseBody.cert_id = certResult.moduleCertId;
    }

    return jsonResp(200, responseBody, origin);
  } catch (err: any) {
    console.error('[LabAttest] DynamoDB write failed:', err?.message || err);
    return jsonResp(500, { error: 'Failed to persist attestation' }, origin);
  }
}
