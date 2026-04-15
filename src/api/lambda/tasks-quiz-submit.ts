/**
 * POST /tasks/quiz/submit
 *
 * Shadow-only endpoint: grades a learner's quiz submission, records the attempt
 * and task record in DynamoDB, and recomputes module-level EntityCompletion.
 *
 * Shadow guard: returns 403 when APP_STAGE !== 'shadow'.
 * Auth: httpOnly cookie (hhl_access_token) verified against Cognito JWKS.
 * Correct answers are read server-side only and never returned to the caller.
 * All DynamoDB writes complete before the response is returned (write-before-respond).
 *
 * @see Issue #407
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

const submitSchema = z.object({
  module_slug: z.string().min(1).max(200),
  quiz_ref: z.string().min(1).max(100),
  answers: z
    .array(
      z.object({
        id: z.string().min(1).max(50),
        value: z.string().min(0).max(500),
      })
    )
    .min(1)
    .max(100),
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
// Quiz grading (pure — exported for unit tests)
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  id: string;
  correct_answer: string;
  points?: number;
}

export interface QuizSchema {
  quiz_id: string;
  passing_score?: number;
  questions: QuizQuestion[];
}

export interface GradeResult {
  score: number;
  pass: boolean;
}

/**
 * Grade a quiz submission against its schema.
 * Correct answers are compared server-side only; they must not appear in the response.
 */
export function gradeQuiz(
  schema: QuizSchema,
  answers: Array<{ id: string; value: string }>
): GradeResult {
  const answerMap = new Map(answers.map((a) => [a.id, a.value]));

  let totalPoints = 0;
  let earnedPoints = 0;

  for (const question of schema.questions) {
    const pts = question.points ?? 1;
    totalPoints += pts;
    const submitted = answerMap.get(question.id);
    if (submitted !== undefined && submitted === question.correct_answer) {
      earnedPoints += pts;
    }
  }

  const score =
    totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passingScore = schema.passing_score ?? 75;

  return { score, pass: score >= passingScore };
}

// ---------------------------------------------------------------------------
// Module completion computation (pure — exported for unit tests)
// ---------------------------------------------------------------------------

export interface CompletionTask {
  task_slug: string;
  task_type: 'quiz' | 'lab_attestation' | 'knowledge_check';
  graded: boolean;
  required: boolean;
}

export type ModuleStatus = 'not_started' | 'in_progress' | 'complete';

/**
 * Compute module-level completion status from task records.
 * Only required tasks gate completion.
 * - quiz: must be 'passed'
 * - lab_attestation: must be 'attested'
 * - knowledge_check: not required by default; does not block completion
 */
export function computeModuleStatus(
  completionTasks: CompletionTask[],
  taskRecords: Record<string, string | undefined>
): ModuleStatus {
  const requiredTasks = completionTasks.filter((t) => t.required);

  if (requiredTasks.length === 0) {
    return Object.keys(taskRecords).length > 0 ? 'complete' : 'not_started';
  }

  let allSatisfied = true;
  let anyAttempted = false;

  for (const task of requiredTasks) {
    const status = taskRecords[task.task_slug];

    if (!status) {
      allSatisfied = false;
      continue;
    }

    anyAttempted = true;

    if (task.task_type === 'quiz' && status !== 'passed') {
      allSatisfied = false;
    } else if (task.task_type === 'lab_attestation' && status !== 'attested') {
      allSatisfied = false;
    }
    // knowledge_check: filtered out (required=false), so never reaches here
  }

  if (!anyAttempted) return 'not_started';
  if (allSatisfied) return 'complete';
  return 'in_progress';
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleQuizSubmit(event: any) {
  const origin = event.headers?.origin || event.headers?.Origin;

  // --- Shadow guard (must be first after route dispatch) ---
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

  const parsed = submitSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonResp(
      400,
      { error: 'Invalid request', details: parsed.error.flatten() },
      origin
    );
  }

  const { module_slug, quiz_ref, answers } = parsed.data;

  // --- Fetch quiz schema and completion tasks from HubDB ---
  let quizSchema: QuizSchema;
  let completionTasks: CompletionTask[] = [];

  try {
    const hubspot = getHubSpotClient();
    const tableId = process.env.HUBDB_MODULES_TABLE_ID;
    if (!tableId) {
      console.error('[QuizSubmit] HUBDB_MODULES_TABLE_ID not set');
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

    if (!moduleRow || !moduleRow.values?.quiz_schema_json) {
      return jsonResp(400, { error: 'no quiz schema for module' }, origin);
    }

    quizSchema = JSON.parse(moduleRow.values.quiz_schema_json);

    if (quizSchema.quiz_id !== quiz_ref) {
      return jsonResp(400, { error: 'quiz_ref not found' }, origin);
    }

    if (moduleRow.values.completion_tasks_json) {
      try {
        completionTasks = JSON.parse(moduleRow.values.completion_tasks_json);
      } catch {
        completionTasks = [];
      }
    }
  } catch (err: any) {
    // Re-throw nothing — any error from the try above is a 500
    console.error('[QuizSubmit] HubDB fetch error:', err?.message || err);
    return jsonResp(500, { error: 'Failed to fetch quiz schema' }, origin);
  }

  // --- Grade (correct answers stay server-side) ---
  const { score, pass } = gradeQuiz(quizSchema, answers);
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
          SK: `ATTEMPT#MODULE#${module_slug}#${quiz_ref}#${now}`,
          task_type: 'quiz',
          answers, // submitted answers (NOT correct answers)
          score,
          pass,
          attempted_at: now,
          learner_identity: { userId, email: userEmail },
        },
      })
    );

    // Step 2a: Upsert TaskRecord (status, attempt_count)
    const taskRecordResult = await dynamo.send(
      new UpdateCommand({
        TableName: TASK_RECORDS_TABLE,
        Key: {
          PK: `USER#${userId}`,
          SK: `TASK#MODULE#${module_slug}#${quiz_ref}`,
        },
        UpdateExpression:
          'SET task_type = :task_type, graded = :graded, #status = :status, ' +
          'last_attempt_at = :now, updated_at = :now ' +
          'ADD attempt_count :one',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':task_type': 'quiz',
          ':graded': true,
          ':status': pass ? 'passed' : 'failed',
          ':now': now,
          ':one': 1,
        },
        ReturnValues: 'UPDATED_NEW',
      })
    );

    const attemptCount = Number(taskRecordResult.Attributes?.attempt_count ?? 1);

    // Step 2b: Conditionally update best_score (only if new score is higher)
    try {
      await dynamo.send(
        new UpdateCommand({
          TableName: TASK_RECORDS_TABLE,
          Key: {
            PK: `USER#${userId}`,
            SK: `TASK#MODULE#${module_slug}#${quiz_ref}`,
          },
          UpdateExpression: 'SET best_score = :score',
          ConditionExpression:
            'attribute_not_exists(best_score) OR best_score < :score',
          ExpressionAttributeValues: { ':score': score },
        })
      );
    } catch (err: any) {
      if (err.name !== 'ConditionalCheckFailedException') throw err;
      // Existing best_score >= new score — no update needed
    }

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

    // Build slug→status map (for computeModuleStatus) and full detail map (for storage)
    const taskRecordStatuses: Record<string, string | undefined> = {};
    const taskStatusesMap: Record<string, { status: string; score?: number; attempts?: number }> = {};

    for (const item of taskRecordsResult.Items || []) {
      const skParts = (item.SK as string).split('#');
      const taskSlug = skParts[skParts.length - 1];
      taskRecordStatuses[taskSlug] = item.status;
      taskStatusesMap[taskSlug] = {
        status: item.status,
        ...(item.best_score !== undefined && { score: Number(item.best_score) }),
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
      score,
      pass,
      attempts: attemptCount,
      module_complete: moduleStatus === 'complete',
    };

    if (certResult.moduleCertId) {
      responseBody.cert_id = certResult.moduleCertId;
    }

    return jsonResp(200, responseBody, origin);
  } catch (err: any) {
    console.error('[QuizSubmit] DynamoDB write failed:', err?.message || err);
    return jsonResp(500, { error: 'Failed to persist attempt' }, origin);
  }
}
