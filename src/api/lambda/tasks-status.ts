/**
 * GET /tasks/status?module_slug=<slug>
 *
 * Shadow-only read endpoint: returns the learner's current task completion state
 * for a module. Used by the module page and My Learning page to restore UI state
 * across page loads.
 *
 * Shadow guard: returns 403 when APP_STAGE !== 'shadow'.
 * Auth: httpOnly cookie (hhl_access_token) verified against Cognito JWKS.
 * Read-only: no DynamoDB writes in this handler.
 *
 * Primary read path: EntityCompletion record from entity-completions-shadow.
 * Fallback path (module never attempted): fetch completion_tasks_json from HubDB
 * and return a synthetic "not_started" response for all declared tasks.
 *
 * @see Issue #409
 * @see infrastructure/dynamodb/entity-completions-shadow-table.json
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getHubSpotClient } from '../../shared/hubspot.js';
import { verifyCookieAuth } from './cognito-auth.js';

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
// Response types (exported for unit tests)
// ---------------------------------------------------------------------------

export type TaskStatusEntry = {
  status: 'not_started' | 'in_progress' | 'passed' | 'failed' | 'attested';
  score?: number;
  attempts?: number;
};

export type TaskStatusResponse = {
  module_slug: string;
  module_status: 'not_started' | 'in_progress' | 'complete';
  tasks: Record<string, TaskStatusEntry>;
};

/**
 * Build the "not started" fallback response from declared completion tasks.
 * Every declared task gets status=not_started with no score or attempts.
 */
export function buildNotStartedResponse(
  module_slug: string,
  completionTasks: Array<{ task_slug: string }>
): TaskStatusResponse {
  const tasks: Record<string, TaskStatusEntry> = {};
  for (const task of completionTasks) {
    tasks[task.task_slug] = { status: 'not_started' };
  }
  return {
    module_slug,
    module_status: 'not_started',
    tasks,
  };
}

/**
 * Map EntityCompletion DynamoDB record to the TaskStatusResponse shape.
 * task_statuses is a map written by the write endpoints (#407, #408).
 */
export function buildResponseFromRecord(
  module_slug: string,
  record: {
    status?: string;
    task_statuses?: Record<string, { status: string; score?: number; attempts?: number }>;
  }
): TaskStatusResponse {
  const moduleStatus = (record.status || 'not_started') as TaskStatusResponse['module_status'];
  const tasks: Record<string, TaskStatusEntry> = {};

  for (const [slug, entry] of Object.entries(record.task_statuses || {})) {
    const taskEntry: TaskStatusEntry = {
      status: (entry.status || 'not_started') as TaskStatusEntry['status'],
    };
    if (entry.score !== undefined) taskEntry.score = Number(entry.score);
    if (entry.attempts !== undefined) taskEntry.attempts = Number(entry.attempts);
    tasks[slug] = taskEntry;
  }

  return { module_slug, module_status: moduleStatus, tasks };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleTasksStatus(event: any) {
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
  const module_slug = (event.queryStringParameters?.module_slug || '').trim();
  if (!module_slug) {
    return jsonResp(400, { error: 'module_slug query parameter is required' }, origin);
  }

  const ENTITY_COMPLETIONS_TABLE = process.env.ENTITY_COMPLETIONS_TABLE!;

  // --- Primary read: EntityCompletion record ---
  try {
    const result = await getDynamo().send(
      new GetCommand({
        TableName: ENTITY_COMPLETIONS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `COMPLETION#MODULE#${module_slug}`,
        },
      })
    );

    if (result.Item) {
      const response = buildResponseFromRecord(module_slug, result.Item);
      return jsonResp(200, response, origin);
    }
  } catch (err: any) {
    console.error('[TasksStatus] DynamoDB GetItem failed:', err?.message || err);
    return jsonResp(500, { error: 'Failed to read task status' }, origin);
  }

  // --- Fallback: module never attempted — build not_started shape from HubDB ---
  try {
    const hubspot = getHubSpotClient();
    const tableId = process.env.HUBDB_MODULES_TABLE_ID;
    if (!tableId) {
      console.error('[TasksStatus] HUBDB_MODULES_TABLE_ID not set');
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

    if (!moduleRow) {
      return jsonResp(404, { error: 'module not found' }, origin);
    }

    let completionTasks: Array<{ task_slug: string }> = [];
    if (moduleRow.values?.completion_tasks_json) {
      try {
        completionTasks = JSON.parse(moduleRow.values.completion_tasks_json);
      } catch {
        completionTasks = [];
      }
    }

    const response = buildNotStartedResponse(module_slug, completionTasks);
    return jsonResp(200, response, origin);
  } catch (err: any) {
    console.error('[TasksStatus] HubDB fallback error:', err?.message || err);
    return jsonResp(500, { error: 'Failed to read task configuration' }, origin);
  }
}
