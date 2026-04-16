/**
 * GET /shadow/module/progress (handler-visible path: /module/progress)
 *
 * Shadow-only read endpoint: returns the learner-record view for a module —
 * overall module status, per-task state with best_score/attempt_count, and
 * attempt history with per-quiz-attempt answer review.
 *
 * Shadow guard: 403 when APP_STAGE is neither 'shadow' nor 'production'.
 * Auth: httpOnly cookie (hhl_access_token) verified against Cognito JWKS.
 *
 * Sensitive-handling rules (spec §2.4):
 *   - Correct answers are NEVER serialized.
 *   - learner_identity snapshots from attempt records are NEVER serialized.
 *   - Schema drift (deleted question ids) → {is_correct:null, question_text:null, schema_drift:true}.
 *   - Lab attestation attempts carry no answer_review.
 *   - Ownership-scoped: Query PK is always USER#<cookieUserId>; query-param
 *     overrides are ignored.
 *
 * @see Issue #451 (Phase 5A), Spec #449 §2.3, §2.4, Test plan #450 §2.4, §2.5.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

import { getHubSpotClient } from '../../shared/hubspot.js';
import { verifyCookieAuth } from './cognito-auth.js';
import {
  classifyModule,
  type CompletionTaskDeclaration,
} from './shadow-aggregation.js';
import {
  getCourseMetadata,
  getPathwayMetadata,
  listAllCourseSlugs,
  listAllPathwaySlugs,
  loadMetadataCache,
} from './completion.js';

// Ensure metadata is loaded for breadcrumb resolution.
loadMetadataCache();

// ---------------------------------------------------------------------------
// Lazy DynamoDB client
// ---------------------------------------------------------------------------

let _dynamoClient: DynamoDBDocumentClient | undefined;
function getDynamo(): DynamoDBDocumentClient {
  if (!_dynamoClient) {
    const region = process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-west-2';
    _dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  }
  return _dynamoClient;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Breadcrumb resolution — uses the metadata cache from completion.ts
// (titles are available via the additive title field on CourseMetadata /
// PathwayMetadata, loaded during loadMetadataCache).
// ---------------------------------------------------------------------------

function resolveBreadcrumbs(moduleSlug: string): {
  parent_course_slug: string | null;
  parent_course_title: string | null;
  parent_pathway_slug: string | null;
  parent_pathway_title: string | null;
} {
  let parent_course_slug: string | null = null;
  let parent_course_title: string | null = null;
  for (const cs of listAllCourseSlugs()) {
    const cm = getCourseMetadata(cs);
    if (cm && cm.modules.includes(moduleSlug)) {
      parent_course_slug = cs;
      parent_course_title = cm.title ?? cs;
      break;
    }
  }

  let parent_pathway_slug: string | null = null;
  let parent_pathway_title: string | null = null;
  if (parent_course_slug) {
    for (const ps of listAllPathwaySlugs()) {
      const pm = getPathwayMetadata(ps);
      if (pm && pm.courses.includes(parent_course_slug)) {
        parent_pathway_slug = ps;
        parent_pathway_title = pm.title ?? ps;
        break;
      }
    }
  }

  return {
    parent_course_slug,
    parent_course_title,
    parent_pathway_slug,
    parent_pathway_title,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuizQuestion {
  id: string;
  question?: string;
  text?: string;
  label?: string;
  correct_answer?: string;
  answer_options?: Array<{ id: string; text?: string; label?: string }>;
}

interface QuizSchema {
  quiz_id?: string;
  passing_score?: number;
  questions: QuizQuestion[];
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleShadowModuleProgress(event: any) {
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

  const module_slug = (event.queryStringParameters?.module_slug || '').trim();
  if (!module_slug) {
    return jsonResp(400, { error: 'module_slug query parameter is required' }, origin);
  }

  // include_attempts (default true)
  const includeAttemptsRaw = event.queryStringParameters?.include_attempts;
  const include_attempts = includeAttemptsRaw !== 'false';

  // attempts_limit (default 20, 1..50)
  let attempts_limit = 20;
  if (event.queryStringParameters?.attempts_limit !== undefined) {
    const parsed = Number(event.queryStringParameters.attempts_limit);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 50) {
      return jsonResp(400, { error: 'attempts_limit must be between 1 and 50' }, origin);
    }
    attempts_limit = parsed;
  }

  const TASK_RECORDS_TABLE = process.env.TASK_RECORDS_TABLE;
  const TASK_ATTEMPTS_TABLE = process.env.TASK_ATTEMPTS_TABLE;
  const ENTITY_COMPLETIONS_TABLE = process.env.ENTITY_COMPLETIONS_TABLE;
  const CERTS_TABLE = process.env.CERTIFICATES_TABLE;
  const MODULES_TABLE_ID = process.env.HUBDB_MODULES_TABLE_ID;
  if (!TASK_RECORDS_TABLE || !TASK_ATTEMPTS_TABLE || !ENTITY_COMPLETIONS_TABLE || !MODULES_TABLE_ID) {
    return jsonResp(500, { error: 'Server configuration error' }, origin);
  }

  const dynamo = getDynamo();

  // --- Step 1: load HubDB module row (for completion tasks + quiz schema + title) ---
  let completionTasks: CompletionTaskDeclaration[] = [];
  let quizSchema: QuizSchema | null = null;
  let moduleTitle = module_slug;
  try {
    const hubspot = getHubSpotClient();
    const rowsResponse = await (hubspot as any).cms.hubdb.rowsApi.getTableRows(
      MODULES_TABLE_ID,
      undefined,
      undefined,
      undefined
    );
    const rows: any[] = rowsResponse?.results || [];
    const moduleRow = rows.find(
      (r: any) => (r.path || '').toLowerCase() === module_slug.toLowerCase()
    );
    if (!moduleRow) {
      return jsonResp(400, { error: 'module not found' }, origin);
    }
    moduleTitle = (moduleRow.name || moduleRow.values?.hs_name || moduleRow.values?.name || module_slug) as string;
    if (moduleRow.values?.completion_tasks_json) {
      try {
        const parsed = JSON.parse(moduleRow.values.completion_tasks_json);
        if (Array.isArray(parsed)) completionTasks = parsed;
      } catch {
        /* ignore */
      }
    }
    if (moduleRow.values?.quiz_schema_json) {
      try {
        quizSchema = JSON.parse(moduleRow.values.quiz_schema_json);
      } catch {
        quizSchema = null;
      }
    }
  } catch (err: any) {
    console.error('[ShadowModuleProgress] HubDB fetch error:', err?.message || err);
    return jsonResp(500, { error: 'Failed to read module configuration' }, origin);
  }

  // --- Step 2: entity-completion record (overall module_status) ---
  let moduleRecord: { status?: string; task_statuses?: Record<string, any> } | undefined;
  try {
    const res = await dynamo.send(
      new GetCommand({
        TableName: ENTITY_COMPLETIONS_TABLE,
        Key: { PK: `USER#${userId}`, SK: `COMPLETION#MODULE#${module_slug}` },
      })
    );
    if (res.Item) moduleRecord = res.Item as any;
  } catch (err: any) {
    console.error('[ShadowModuleProgress] entity-completion read failed:', err?.message || err);
    return jsonResp(500, { error: 'Failed to read module progress' }, origin);
  }

  const { module_status, has_required_tasks } = classifyModule(moduleRecord, completionTasks);

  // --- Step 3: task-records for this module (per-task best_score/attempts) ---
  interface TaskRecordEntry {
    task_slug: string;
    task_type?: string;
    status?: string;
    best_score?: number;
    attempt_count?: number;
    last_attempt_at?: string;
  }
  const taskRecordsMap = new Map<string, TaskRecordEntry>();
  try {
    const res = await dynamo.send(
      new QueryCommand({
        TableName: TASK_RECORDS_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':skPrefix': `TASK#MODULE#${module_slug}#`,
        },
      })
    );
    for (const item of res.Items || []) {
      const sk = (item.SK as string) || '';
      const parts = sk.split('#');
      const taskSlug = parts[parts.length - 1];
      if (!taskSlug) continue;
      taskRecordsMap.set(taskSlug, {
        task_slug: taskSlug,
        task_type: item.task_type as string | undefined,
        status: item.status as string | undefined,
        best_score: item.best_score !== undefined ? Number(item.best_score) : undefined,
        attempt_count: item.attempt_count !== undefined ? Number(item.attempt_count) : undefined,
        last_attempt_at: item.last_attempt_at as string | undefined,
      });
    }
  } catch (err: any) {
    console.error('[ShadowModuleProgress] task-records query failed:', err?.message || err);
    return jsonResp(500, { error: 'Failed to read task records' }, origin);
  }

  // Build tasks[] array in declaration order. Knowledge-checks with records are included; others may have no record.
  const tasks = completionTasks.map((decl) => {
    const record = taskRecordsMap.get(decl.task_slug);
    const entry: any = {
      task_slug: decl.task_slug,
      task_type: decl.task_type,
      task_title: (decl as any).label || (decl as any).task_title || decl.task_slug,
      required: decl.required !== false,
      status: record?.status ?? 'not_started',
    };
    if (record?.best_score !== undefined) entry.best_score = record.best_score;
    if (record?.attempt_count !== undefined) entry.attempt_count = record.attempt_count;
    if (record?.last_attempt_at) entry.last_attempt_at = record.last_attempt_at;
    if (decl.task_type === 'quiz' && quizSchema?.passing_score !== undefined) {
      entry.passing_score = quizSchema.passing_score;
    }
    return entry;
  });

  // --- Step 4: attempts[] (optional) ---
  let attempts: any[] | undefined;
  if (include_attempts) {
    try {
      const res = await dynamo.send(
        new QueryCommand({
          TableName: TASK_ATTEMPTS_TABLE,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':skPrefix': `ATTEMPT#MODULE#${module_slug}#`,
          },
          ScanIndexForward: false,
          Limit: attempts_limit,
        })
      );
      attempts = (res.Items || []).map((item: any) => buildAttemptEntry(item, quizSchema));
    } catch (err: any) {
      console.error('[ShadowModuleProgress] task-attempts query failed:', err?.message || err);
      return jsonResp(500, { error: 'Failed to read attempt history' }, origin);
    }
  }

  // --- Step 5: module_cert_id (best-effort) ---
  let module_cert_id: string | null = null;
  if (CERTS_TABLE) {
    try {
      const res = await dynamo.send(
        new GetCommand({
          TableName: CERTS_TABLE,
          Key: { PK: `USER#${userId}`, SK: `CERT#module#${module_slug}` },
          ProjectionExpression: 'certId',
        })
      );
      if (res.Item?.certId) module_cert_id = res.Item.certId as string;
    } catch (err: any) {
      console.warn('[ShadowModuleProgress] cert lookup failed:', err?.message || err);
    }
  }

  const breadcrumbs = resolveBreadcrumbs(module_slug);

  const responseBody: any = {
    module_slug,
    module_title: moduleTitle,
    module_status,
    has_required_tasks,
    tasks,
    module_cert_id,
    breadcrumbs,
  };
  if (include_attempts) responseBody.attempts = attempts;

  return jsonResp(200, responseBody, origin);
}

// ---------------------------------------------------------------------------
// Attempt entry builder (pure)
//
// Sensitive-handling rules enforced here:
//   - learner_identity, answers (raw quiz submitted pairs), correct_answer
//     are ALL excluded from the output.
//   - Quiz attempts produce answer_review[] using the CURRENT quiz schema.
//   - Lab attestations produce no answer_review.
// ---------------------------------------------------------------------------

function buildAttemptEntry(item: any, quizSchema: QuizSchema | null): any {
  const sk = (item.SK as string) || '';
  const taskType = item.task_type as string | undefined;
  let outcome: string;
  if (taskType === 'quiz') outcome = item.pass ? 'passed' : 'failed';
  else if (taskType === 'lab_attestation') outcome = 'attested';
  else outcome = 'recorded';

  // Extract task_slug from SK: ATTEMPT#MODULE#<module>#<task>#<timestamp>
  const parts = sk.split('#');
  const task_slug = parts.length >= 5 ? parts[3] : '';

  const entry: any = {
    attempt_id: sk,
    task_slug,
    task_type: taskType,
    attempted_at: item.attempted_at || item.attested_at,
    outcome,
  };

  if (taskType === 'quiz') {
    if (item.score !== undefined) entry.score = Number(item.score);
    entry.answer_review = buildAnswerReview(item.answers, quizSchema);
  }
  // Lab attestations: no answer_review by contract.

  return entry;
}

interface AnswerReviewEntry {
  question_id: string;
  question_text: string | null;
  submitted_answer_id: string | null;
  submitted_answer_text: string | null;
  is_correct: boolean | null;
  schema_drift: boolean;
}

function questionText(q: QuizQuestion | undefined): string | null {
  if (!q) return null;
  return q.question ?? q.text ?? q.label ?? null;
}

function optionText(q: QuizQuestion | undefined, answerId: string | undefined): string | null {
  if (!q || !answerId) return answerId ?? null;
  const opt = (q.answer_options || []).find((o) => o.id === answerId);
  return opt?.text ?? opt?.label ?? answerId;
}

function buildAnswerReview(
  submittedAnswers: Array<{ id: string; value: string }> | undefined,
  quizSchema: QuizSchema | null
): AnswerReviewEntry[] {
  const answers = Array.isArray(submittedAnswers) ? submittedAnswers : [];
  return answers.map((ans): AnswerReviewEntry => {
    const q = quizSchema?.questions.find((x) => x.id === ans.id);
    if (!q) {
      // Schema drift: question no longer exists in the current schema.
      // Preserve the learner's submitted answer identifier/value — NEVER
      // substitute the question id.
      return {
        question_id: ans.id,
        question_text: null,
        submitted_answer_id: ans.value ?? null,
        submitted_answer_text: ans.value ?? null,
        is_correct: null,
        schema_drift: true,
      };
    }
    const is_correct = q.correct_answer !== undefined
      ? ans.value === q.correct_answer
      : null;
    return {
      question_id: ans.id,
      question_text: questionText(q),
      submitted_answer_id: ans.value ?? null,
      submitted_answer_text: optionText(q, ans.value) ?? ans.value ?? null,
      is_correct,
      schema_drift: false,
    };
  });
}
