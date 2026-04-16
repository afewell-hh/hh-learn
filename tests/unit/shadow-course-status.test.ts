/**
 * Unit tests for GET /shadow/course/status handler (handler-visible path /course/status).
 * Issue #451, Phase 5A. Spec §2.1, §1.4. Test plan §2.2.
 */

import { handleShadowCourseStatus } from '../../src/api/lambda/shadow-course-status';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
  BatchGetCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'BatchGetCommand' })),
  GetCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'GetCommand' })),
}));

import { getHubSpotClient } from '../../src/shared/hubspot';
import { verifyCookieAuth } from '../../src/api/lambda/cognito-auth';

const mockGetHubSpotClient = getHubSpotClient as jest.MockedFunction<typeof getHubSpotClient>;
const mockVerifyCookieAuth = verifyCookieAuth as jest.MockedFunction<typeof verifyCookieAuth>;

const AUTH_RESULT = { userId: 'test-user-id', email: 'test@example.com', decoded: {} as any };

const REQUIRED_QUIZ = { task_slug: 'quiz-1', task_type: 'quiz', required: true };

function hubspotWithModules(rows: any[]) {
  return {
    cms: {
      hubdb: {
        rowsApi: {
          getTableRows: jest.fn().mockResolvedValue({ results: rows }),
        },
      },
    },
  };
}

function modulesRow(slug: string, completionTasks: any[]) {
  return {
    path: slug,
    name: slug,
    values: {
      hs_name: slug,
      completion_tasks_json: JSON.stringify(completionTasks),
    },
  };
}

const ENTITY_COMPLETIONS_TABLE = 'hedgehog-learn-entity-completions-shadow';
const CERTS_TABLE = 'hedgehog-learn-certificates-shadow';
const COURSE_SLUG = 'network-like-hyperscaler-foundations';

const FOUR_MODULE_ROWS = [
  modulesRow('fabric-operations-welcome', [REQUIRED_QUIZ]),
  modulesRow('fabric-operations-how-it-works', [REQUIRED_QUIZ]),
  modulesRow('fabric-operations-mastering-interfaces', [REQUIRED_QUIZ]),
  modulesRow('fabric-operations-foundations-recap', [REQUIRED_QUIZ]),
];

beforeEach(() => {
  jest.clearAllMocks();
  process.env.APP_STAGE = 'shadow';
  process.env.ENTITY_COMPLETIONS_TABLE = ENTITY_COMPLETIONS_TABLE;
  process.env.CERTIFICATES_TABLE = CERTS_TABLE;
  process.env.HUBDB_MODULES_TABLE_ID = 'test-modules-table';
  mockVerifyCookieAuth.mockResolvedValue(AUTH_RESULT);
});

afterEach(() => {
  delete process.env.APP_STAGE;
  delete process.env.ENTITY_COMPLETIONS_TABLE;
  delete process.env.CERTIFICATES_TABLE;
  delete process.env.HUBDB_MODULES_TABLE_ID;
});

function makeEvent(qs: Record<string, string> | null = { course_slug: COURSE_SLUG }, origin = 'https://hedgehog.cloud') {
  return {
    headers: { origin },
    cookies: [],
    queryStringParameters: qs,
  };
}

// ---------------------------------------------------------------------------
// Error paths (success/empty/partial/unauthorized/error state coverage)
// ---------------------------------------------------------------------------

describe('handleShadowCourseStatus — error paths', () => {
  it('returns 403 when APP_STAGE is not shadow or production', async () => {
    process.env.APP_STAGE = 'dev';
    const result = await handleShadowCourseStatus(makeEvent());
    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).error).toBe('Not available in this environment');
  });

  it('returns 401 when cookie auth fails', async () => {
    mockVerifyCookieAuth.mockRejectedValue(new Error('no cookie'));
    const result = await handleShadowCourseStatus(makeEvent());
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error).toBe('Unauthorized');
  });

  it('returns 400 when course_slug query param is missing', async () => {
    const result = await handleShadowCourseStatus(makeEvent({}));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('course_slug query parameter is required');
  });

  it('returns 400 when course_slug is not found in metadata cache', async () => {
    const result = await handleShadowCourseStatus(makeEvent({ course_slug: 'nonexistent-course' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('course not found');
  });

  it('returns 500 when DynamoDB BatchGet throws', async () => {
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules(FOUR_MODULE_ROWS) as any);
    mockDynamoSend.mockRejectedValueOnce(new Error('dynamo down'));

    const result = await handleShadowCourseStatus(makeEvent());
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Failed to read course status');
  });

  it('returns 500 when required env var is missing', async () => {
    delete process.env.ENTITY_COMPLETIONS_TABLE;
    const result = await handleShadowCourseStatus(makeEvent());
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Server configuration error');
  });
});

// ---------------------------------------------------------------------------
// Success paths
// ---------------------------------------------------------------------------

describe('handleShadowCourseStatus — success paths', () => {
  it('happy path: returns in_progress with per-module breakdown', async () => {
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules(FOUR_MODULE_ROWS) as any);
    mockDynamoSend
      .mockResolvedValueOnce({
        Responses: {
          [ENTITY_COMPLETIONS_TABLE]: [
            { PK: `USER#${AUTH_RESULT.userId}`, SK: 'COMPLETION#MODULE#fabric-operations-welcome', status: 'complete', task_statuses: {} },
            { PK: `USER#${AUTH_RESULT.userId}`, SK: 'COMPLETION#MODULE#fabric-operations-how-it-works', status: 'in_progress', task_statuses: {} },
          ],
        },
      })
      .mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await handleShadowCourseStatus(makeEvent());
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.course_slug).toBe(COURSE_SLUG);
    expect(body.course_status).toBe('in_progress');
    expect(body.modules_completed).toBe(1);
    expect(body.modules_total).toBe(4);
    expect(body.modules).toHaveLength(4);
    expect(body.course_cert_id).toBeNull();
  });

  it('empty state: all modules not_started', async () => {
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules(FOUR_MODULE_ROWS) as any);
    mockDynamoSend
      .mockResolvedValueOnce({ Responses: { [ENTITY_COMPLETIONS_TABLE]: [] } })
      .mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await handleShadowCourseStatus(makeEvent());
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.course_status).toBe('not_started');
    expect(body.modules_completed).toBe(0);
    for (const m of body.modules) {
      expect(m.module_status).toBe('not_started');
    }
  });

  it('no-task module is present in modules[] but excluded from denominator', async () => {
    const rowsWithNoTaskRecap = [
      modulesRow('fabric-operations-welcome', [REQUIRED_QUIZ]),
      modulesRow('fabric-operations-how-it-works', [REQUIRED_QUIZ]),
      modulesRow('fabric-operations-mastering-interfaces', [REQUIRED_QUIZ]),
      modulesRow('fabric-operations-foundations-recap', []), // no tasks
    ];
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules(rowsWithNoTaskRecap) as any);
    mockDynamoSend
      .mockResolvedValueOnce({
        Responses: {
          [ENTITY_COMPLETIONS_TABLE]: [
            { PK: `USER#${AUTH_RESULT.userId}`, SK: 'COMPLETION#MODULE#fabric-operations-welcome', status: 'complete', task_statuses: {} },
            { PK: `USER#${AUTH_RESULT.userId}`, SK: 'COMPLETION#MODULE#fabric-operations-how-it-works', status: 'complete', task_statuses: {} },
            { PK: `USER#${AUTH_RESULT.userId}`, SK: 'COMPLETION#MODULE#fabric-operations-mastering-interfaces', status: 'complete', task_statuses: {} },
          ],
        },
      })
      .mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await handleShadowCourseStatus(makeEvent());
    const body = JSON.parse(result.body);
    expect(body.modules_total).toBe(3);
    expect(body.modules_completed).toBe(3);
    expect(body.course_status).toBe('complete');
    const recap = body.modules.find((m: any) => m.module_slug === 'fabric-operations-foundations-recap');
    expect(recap.module_status).toBe('no_tasks');
    expect(recap.has_required_tasks).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Contract shape
// ---------------------------------------------------------------------------

describe('handleShadowCourseStatus — contract shape', () => {
  it('response has all required top-level keys', async () => {
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules(FOUR_MODULE_ROWS) as any);
    mockDynamoSend
      .mockResolvedValueOnce({ Responses: { [ENTITY_COMPLETIONS_TABLE]: [] } })
      .mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await handleShadowCourseStatus(makeEvent());
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('course_slug');
    expect(body).toHaveProperty('course_title');
    expect(body).toHaveProperty('course_status');
    expect(body).toHaveProperty('modules_completed');
    expect(body).toHaveProperty('modules_total');
    expect(body).toHaveProperty('modules');
    expect(body).toHaveProperty('course_cert_id');
    expect(['not_started', 'in_progress', 'complete']).toContain(body.course_status);
  });

  it('every module entry has required keys and valid status enum', async () => {
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules(FOUR_MODULE_ROWS) as any);
    mockDynamoSend
      .mockResolvedValueOnce({ Responses: { [ENTITY_COMPLETIONS_TABLE]: [] } })
      .mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await handleShadowCourseStatus(makeEvent());
    const body = JSON.parse(result.body);
    for (const m of body.modules) {
      expect(m).toHaveProperty('module_slug');
      expect(m).toHaveProperty('module_title');
      expect(m).toHaveProperty('module_status');
      expect(m).toHaveProperty('has_required_tasks');
      expect(m).toHaveProperty('tasks');
      expect(['not_started', 'in_progress', 'complete', 'no_tasks']).toContain(m.module_status);
    }
  });
});
