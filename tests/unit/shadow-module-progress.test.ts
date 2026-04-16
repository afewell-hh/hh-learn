/**
 * Unit tests for GET /shadow/module/progress handler (handler-visible path /module/progress).
 * Issue #451, Phase 5A. Spec §2.3, §1.4. Test plan §2.4.
 *
 * Sensitive-handling tests (answer review) are in shadow-module-progress.answer-review.test.ts
 * to keep safety assertions findable and not diluted.
 */

import { handleShadowModuleProgress } from '../../src/api/lambda/shadow-module-progress';

jest.mock('../../src/shared/hubspot', () => ({
  getHubSpotClient: jest.fn(),
}));
jest.mock('../../src/api/lambda/cognito-auth', () => ({
  verifyCookieAuth: jest.fn(),
}));
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

const mockDynamoSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: (...args: any[]) => mockDynamoSend(...args),
    }),
  },
  GetCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'GetCommand' })),
  QueryCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'QueryCommand' })),
}));

import { getHubSpotClient } from '../../src/shared/hubspot';
import { verifyCookieAuth } from '../../src/api/lambda/cognito-auth';

const mockGetHubSpotClient = getHubSpotClient as jest.MockedFunction<typeof getHubSpotClient>;
const mockVerifyCookieAuth = verifyCookieAuth as jest.MockedFunction<typeof verifyCookieAuth>;

const AUTH_RESULT = { userId: 'test-user-id', email: 'test@example.com', decoded: {} as any };

const MODULE_SLUG = 'fabric-operations-welcome';
const TASK_RECORDS_TABLE = 'hedgehog-learn-task-records-shadow';
const TASK_ATTEMPTS_TABLE = 'hedgehog-learn-task-attempts-shadow';
const ENTITY_COMPLETIONS_TABLE = 'hedgehog-learn-entity-completions-shadow';
const CERTS_TABLE = 'hedgehog-learn-certificates-shadow';

const REQUIRED_QUIZ = { task_slug: 'quiz-1', task_type: 'quiz', required: true };
const REQUIRED_LAB = { task_slug: 'lab-main', task_type: 'lab_attestation', required: true };

function moduleRow(slug: string, completionTasks: any[], quizSchema?: any) {
  return {
    path: slug,
    name: slug,
    values: {
      hs_name: slug,
      completion_tasks_json: JSON.stringify(completionTasks),
      ...(quizSchema ? { quiz_schema_json: JSON.stringify(quizSchema) } : {}),
    },
  };
}

function hubspotWithModules(rows: any[]) {
  return {
    cms: {
      hubdb: {
        rowsApi: { getTableRows: jest.fn().mockResolvedValue({ results: rows }) },
      },
    },
  };
}

function makeEvent(qs: any = { module_slug: MODULE_SLUG }) {
  return { headers: { origin: 'https://hedgehog.cloud' }, cookies: [], queryStringParameters: qs };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.APP_STAGE = 'shadow';
  process.env.TASK_RECORDS_TABLE = TASK_RECORDS_TABLE;
  process.env.TASK_ATTEMPTS_TABLE = TASK_ATTEMPTS_TABLE;
  process.env.ENTITY_COMPLETIONS_TABLE = ENTITY_COMPLETIONS_TABLE;
  process.env.CERTIFICATES_TABLE = CERTS_TABLE;
  process.env.HUBDB_MODULES_TABLE_ID = 'test-modules-table';
  mockVerifyCookieAuth.mockResolvedValue(AUTH_RESULT);
});

afterEach(() => {
  delete process.env.APP_STAGE;
  delete process.env.TASK_RECORDS_TABLE;
  delete process.env.TASK_ATTEMPTS_TABLE;
  delete process.env.ENTITY_COMPLETIONS_TABLE;
  delete process.env.CERTIFICATES_TABLE;
  delete process.env.HUBDB_MODULES_TABLE_ID;
});

describe('handleShadowModuleProgress — error paths', () => {
  it('403 when APP_STAGE is not shadow/production', async () => {
    process.env.APP_STAGE = 'dev';
    const result = await handleShadowModuleProgress(makeEvent());
    expect(result.statusCode).toBe(403);
  });

  it('401 on auth failure', async () => {
    mockVerifyCookieAuth.mockRejectedValue(new Error('nope'));
    const result = await handleShadowModuleProgress(makeEvent());
    expect(result.statusCode).toBe(401);
  });

  it('400 when module_slug missing', async () => {
    const result = await handleShadowModuleProgress(makeEvent({}));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('module_slug query parameter is required');
  });

  it('400 when module not found in HubDB', async () => {
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules([]) as any);
    const result = await handleShadowModuleProgress(makeEvent({ module_slug: 'nonexistent' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('module not found');
  });

  it('400 when attempts_limit is 0', async () => {
    const result = await handleShadowModuleProgress(makeEvent({ module_slug: MODULE_SLUG, attempts_limit: '0' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('attempts_limit must be between 1 and 50');
  });

  it('400 when attempts_limit exceeds 50', async () => {
    const result = await handleShadowModuleProgress(makeEvent({ module_slug: MODULE_SLUG, attempts_limit: '51' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('attempts_limit must be between 1 and 50');
  });
});

describe('handleShadowModuleProgress — success paths', () => {
  it('no attempts yet: tasks list with not_started, attempts[] empty', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [REQUIRED_QUIZ, REQUIRED_LAB])]) as any
    );
    // EntityCompletion get (for module_status), task-records query, task-attempts query, cert get
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })  // entity-completion: none
      .mockResolvedValueOnce({ Items: [] })         // task-records query: empty
      .mockResolvedValueOnce({ Items: [] })         // task-attempts query: empty
      .mockResolvedValueOnce({ Item: undefined });  // cert get: none

    const result = await handleShadowModuleProgress(makeEvent());
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.module_slug).toBe(MODULE_SLUG);
    expect(body.module_status).toBe('not_started');
    expect(body.has_required_tasks).toBe(true);
    expect(body.tasks).toHaveLength(2);
    expect(body.tasks[0].status).toBe('not_started');
    expect(body.attempts).toEqual([]);
    expect(body.module_cert_id).toBeNull();
  });

  it('with attempts: tasks have best_score/attempt_count, attempts[] DESC by timestamp', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [REQUIRED_QUIZ])]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({
        Item: {
          PK: `USER#${AUTH_RESULT.userId}`,
          SK: `COMPLETION#MODULE#${MODULE_SLUG}`,
          status: 'in_progress',
          task_statuses: { 'quiz-1': { status: 'failed', score: 60, attempts: 2 } },
        },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            PK: `USER#${AUTH_RESULT.userId}`,
            SK: `TASK#MODULE#${MODULE_SLUG}#quiz-1`,
            task_type: 'quiz',
            status: 'failed',
            best_score: 60,
            attempt_count: 2,
            last_attempt_at: '2026-04-12T14:22:09.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        Items: [
          {
            PK: `USER#${AUTH_RESULT.userId}`,
            SK: `ATTEMPT#MODULE#${MODULE_SLUG}#quiz-1#2026-04-12T14:22:09.000Z`,
            task_type: 'quiz',
            attempted_at: '2026-04-12T14:22:09.000Z',
            score: 60,
            pass: false,
            answers: [{ id: 'q1', value: 'a' }],
          },
          {
            PK: `USER#${AUTH_RESULT.userId}`,
            SK: `ATTEMPT#MODULE#${MODULE_SLUG}#quiz-1#2026-04-11T10:00:00.000Z`,
            task_type: 'quiz',
            attempted_at: '2026-04-11T10:00:00.000Z',
            score: 40,
            pass: false,
            answers: [{ id: 'q1', value: 'c' }],
          },
        ],
      })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handleShadowModuleProgress(makeEvent());
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.module_status).toBe('in_progress');
    expect(body.tasks[0].best_score).toBe(60);
    expect(body.tasks[0].attempt_count).toBe(2);
    expect(body.attempts).toHaveLength(2);
    // DESC by attempted_at
    expect(body.attempts[0].attempted_at).toBe('2026-04-12T14:22:09.000Z');
    expect(body.attempts[1].attempted_at).toBe('2026-04-11T10:00:00.000Z');
    expect(body.attempts[0].outcome).toBe('failed');
  });

  it('include_attempts=false omits attempts[]', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [REQUIRED_QUIZ])]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Item: undefined }); // cert

    const result = await handleShadowModuleProgress(
      makeEvent({ module_slug: MODULE_SLUG, include_attempts: 'false' })
    );
    const body = JSON.parse(result.body);
    expect(body.attempts).toBeUndefined();
  });

  it('no-required-tasks module surfaces as has_required_tasks=false', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [])]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handleShadowModuleProgress(makeEvent());
    const body = JSON.parse(result.body);
    expect(body.has_required_tasks).toBe(false);
    expect(body.module_status).toBe('no_tasks');
    expect(body.tasks).toEqual([]);
  });
});

describe('handleShadowModuleProgress — contract shape', () => {
  it('has all required top-level keys including breadcrumbs', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [REQUIRED_QUIZ])]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handleShadowModuleProgress(makeEvent());
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('module_slug');
    expect(body).toHaveProperty('module_title');
    expect(body).toHaveProperty('module_status');
    expect(body).toHaveProperty('has_required_tasks');
    expect(body).toHaveProperty('tasks');
    expect(body).toHaveProperty('module_cert_id');
    expect(body).toHaveProperty('breadcrumbs');
    expect(body.breadcrumbs).toHaveProperty('parent_course_slug');
    expect(body.breadcrumbs).toHaveProperty('parent_course_title');
    expect(body.breadcrumbs).toHaveProperty('parent_pathway_slug');
    expect(body.breadcrumbs).toHaveProperty('parent_pathway_title');
  });

  it('breadcrumbs resolve parent course and pathway for module in real content', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow('fabric-operations-welcome', [REQUIRED_QUIZ])]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handleShadowModuleProgress(makeEvent({ module_slug: 'fabric-operations-welcome' }));
    const body = JSON.parse(result.body);
    expect(body.breadcrumbs.parent_course_slug).toBe('network-like-hyperscaler-foundations');
    expect(body.breadcrumbs.parent_pathway_slug).toBe('network-like-hyperscaler');
  });

  it('breadcrumbs are null for orphan module not in any course', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow('orphan-module', [REQUIRED_QUIZ])]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handleShadowModuleProgress(makeEvent({ module_slug: 'orphan-module' }));
    const body = JSON.parse(result.body);
    expect(body.breadcrumbs.parent_course_slug).toBeNull();
    expect(body.breadcrumbs.parent_pathway_slug).toBeNull();
  });
});
