/**
 * Unit tests for GET /tasks/status
 *
 * Tests cover:
 *   - shadow guard (403)
 *   - auth failure (401)
 *   - missing module_slug query param (400)
 *   - primary read path: EntityCompletion record found → mapped response (200)
 *   - fallback path: no record → HubDB not_started shape (200)
 *   - fallback path: module not found in HubDB (404)
 *   - DynamoDB failure (500)
 *   - HubDB fallback failure (500)
 *   - buildNotStartedResponse pure function
 *   - buildResponseFromRecord pure function
 */

import {
  handleTasksStatus,
  buildNotStartedResponse,
  buildResponseFromRecord,
} from '../../src/api/lambda/tasks-status';

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
  GetCommand: jest.fn().mockImplementation((input: any) => ({ input })),
}));

import { getHubSpotClient } from '../../src/shared/hubspot';
import { verifyCookieAuth } from '../../src/api/lambda/cognito-auth';

const mockGetHubSpotClient = getHubSpotClient as jest.MockedFunction<typeof getHubSpotClient>;
const mockVerifyCookieAuth = verifyCookieAuth as jest.MockedFunction<typeof verifyCookieAuth>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WELCOME_COMPLETION_TASKS = [
  {
    task_slug: 'quiz-1',
    task_type: 'quiz',
    graded: true,
    required: true,
    label: 'Module Assessment',
  },
  {
    task_slug: 'lab-main',
    task_type: 'lab_attestation',
    graded: false,
    required: true,
    label: 'Hands-On Lab',
  },
];

function makeHubSpotMock(
  completionTasksJson: string | null = JSON.stringify(WELCOME_COMPLETION_TASKS),
  moduleSlug = 'fabric-operations-welcome'
) {
  return {
    cms: {
      hubdb: {
        rowsApi: {
          getTableRows: jest.fn().mockResolvedValueOnce({
            results: completionTasksJson !== undefined
              ? [
                  {
                    path: moduleSlug,
                    values: { completion_tasks_json: completionTasksJson },
                  },
                ]
              : [],
          }),
        },
      },
    },
  };
}

const AUTH_RESULT = { userId: 'test-user-id', email: 'test@example.com', decoded: {} };

const BASE_EVENT = {
  headers: {},
  cookies: [],
  queryStringParameters: { module_slug: 'fabric-operations-welcome' },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  process.env.APP_STAGE = 'shadow';
  process.env.HUBDB_MODULES_TABLE_ID = 'test-table-id';
  process.env.ENTITY_COMPLETIONS_TABLE = 'test-entity-completions';
});

afterEach(() => {
  delete process.env.APP_STAGE;
});

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('buildNotStartedResponse', () => {
  it('returns not_started for all declared tasks', () => {
    const result = buildNotStartedResponse('test-module', WELCOME_COMPLETION_TASKS);
    expect(result.module_slug).toBe('test-module');
    expect(result.module_status).toBe('not_started');
    expect(result.tasks['quiz-1'].status).toBe('not_started');
    expect(result.tasks['lab-main'].status).toBe('not_started');
  });

  it('returns empty tasks map for module with no declared tasks', () => {
    const result = buildNotStartedResponse('empty-module', []);
    expect(result.module_status).toBe('not_started');
    expect(Object.keys(result.tasks)).toHaveLength(0);
  });

  it('does not include score or attempts in not_started entries', () => {
    const result = buildNotStartedResponse('test-module', WELCOME_COMPLETION_TASKS);
    expect(result.tasks['quiz-1'].score).toBeUndefined();
    expect(result.tasks['quiz-1'].attempts).toBeUndefined();
  });
});

describe('buildResponseFromRecord', () => {
  it('maps module status and task statuses from a DynamoDB record', () => {
    const record = {
      status: 'complete',
      task_statuses: {
        'quiz-1': { status: 'passed', score: 100, attempts: 1 },
        'lab-main': { status: 'attested', attempts: 1 },
      },
    };
    const result = buildResponseFromRecord('test-module', record);
    expect(result.module_slug).toBe('test-module');
    expect(result.module_status).toBe('complete');
    expect(result.tasks['quiz-1'].status).toBe('passed');
    expect(result.tasks['quiz-1'].score).toBe(100);
    expect(result.tasks['quiz-1'].attempts).toBe(1);
    expect(result.tasks['lab-main'].status).toBe('attested');
    expect(result.tasks['lab-main'].score).toBeUndefined();
  });

  it('defaults module_status to not_started when status is missing', () => {
    const result = buildResponseFromRecord('test-module', {});
    expect(result.module_status).toBe('not_started');
    expect(result.tasks).toEqual({});
  });

  it('omits score and attempts when not present in task entry', () => {
    const record = {
      status: 'in_progress',
      task_statuses: { 'lab-main': { status: 'attested' } },
    };
    const result = buildResponseFromRecord('test-module', record);
    expect(result.tasks['lab-main'].score).toBeUndefined();
    expect(result.tasks['lab-main'].attempts).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Handler tests — shadow guard
// ---------------------------------------------------------------------------

describe('handleTasksStatus — shadow guard', () => {
  it('returns 403 when APP_STAGE is dev', async () => {
    process.env.APP_STAGE = 'dev';
    const result = await handleTasksStatus(BASE_EVENT);
    expect(result.statusCode).toBe(403);
  });

  it('returns 403 when APP_STAGE is prod', async () => {
    process.env.APP_STAGE = 'prod';
    const result = await handleTasksStatus(BASE_EVENT);
    expect(result.statusCode).toBe(403);
  });

  it('returns 403 when APP_STAGE is undefined', async () => {
    delete process.env.APP_STAGE;
    const result = await handleTasksStatus(BASE_EVENT);
    expect(result.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Handler tests — authentication
// ---------------------------------------------------------------------------

describe('handleTasksStatus — authentication', () => {
  it('returns 401 when no valid cookie is present', async () => {
    mockVerifyCookieAuth.mockRejectedValueOnce(new Error('Missing hhl_access_token cookie'));
    const result = await handleTasksStatus(BASE_EVENT);
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error).toBe('Unauthorized');
  });

  it('returns 401 when token is expired', async () => {
    mockVerifyCookieAuth.mockRejectedValueOnce(new Error('Token expired'));
    const result = await handleTasksStatus(BASE_EVENT);
    expect(result.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Handler tests — query parameter validation
// ---------------------------------------------------------------------------

describe('handleTasksStatus — request validation', () => {
  it('returns 400 when module_slug query param is missing', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    const result = await handleTasksStatus({ ...BASE_EVENT, queryStringParameters: {} });
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/module_slug/);
  });

  it('returns 400 when module_slug is empty string', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    const result = await handleTasksStatus({
      ...BASE_EVENT,
      queryStringParameters: { module_slug: '   ' },
    });
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when queryStringParameters is null', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    const result = await handleTasksStatus({ ...BASE_EVENT, queryStringParameters: null });
    expect(result.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Handler tests — primary path (EntityCompletion found)
// ---------------------------------------------------------------------------

describe('handleTasksStatus — primary read path', () => {
  it('returns 200 with mapped record when EntityCompletion exists', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockDynamoSend.mockResolvedValueOnce({
      Item: {
        PK: 'USER#test-user-id',
        SK: 'COMPLETION#MODULE#fabric-operations-welcome',
        status: 'in_progress',
        task_statuses: {
          'quiz-1': { status: 'failed', score: 50, attempts: 1 },
          'lab-main': { status: 'attested', attempts: 1 },
        },
      },
    });

    const result = await handleTasksStatus(BASE_EVENT);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.module_slug).toBe('fabric-operations-welcome');
    expect(body.module_status).toBe('in_progress');
    expect(body.tasks['quiz-1'].status).toBe('failed');
    expect(body.tasks['quiz-1'].score).toBe(50);
    expect(body.tasks['lab-main'].status).toBe('attested');
  });

  it('returns module_status=complete when record is complete', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockDynamoSend.mockResolvedValueOnce({
      Item: {
        status: 'complete',
        task_statuses: {
          'quiz-1': { status: 'passed', score: 100, attempts: 1 },
          'lab-main': { status: 'attested', attempts: 1 },
        },
      },
    });

    const result = await handleTasksStatus(BASE_EVENT);
    const body = JSON.parse(result.body);
    expect(body.module_status).toBe('complete');
  });

  it('does not hit HubDB when EntityCompletion record is found', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockDynamoSend.mockResolvedValueOnce({
      Item: { status: 'in_progress', task_statuses: {} },
    });

    await handleTasksStatus(BASE_EVENT);
    expect(mockGetHubSpotClient).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Handler tests — fallback path (no EntityCompletion)
// ---------------------------------------------------------------------------

describe('handleTasksStatus — fallback path (not_started)', () => {
  it('returns 200 with not_started shape when no EntityCompletion exists', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockDynamoSend.mockResolvedValueOnce({ Item: undefined });
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);

    const result = await handleTasksStatus(BASE_EVENT);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.module_slug).toBe('fabric-operations-welcome');
    expect(body.module_status).toBe('not_started');
    expect(body.tasks['quiz-1'].status).toBe('not_started');
    expect(body.tasks['lab-main'].status).toBe('not_started');
  });

  it('returns 404 when module not found in HubDB on fallback', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockDynamoSend.mockResolvedValueOnce({ Item: undefined });
    mockGetHubSpotClient.mockReturnValueOnce({
      cms: {
        hubdb: {
          rowsApi: {
            getTableRows: jest.fn().mockResolvedValueOnce({ results: [] }),
          },
        },
      },
    } as any);

    const result = await handleTasksStatus(BASE_EVENT);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('module not found');
  });

  it('returns not_started tasks with no score or attempts', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockDynamoSend.mockResolvedValueOnce({ Item: undefined });
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);

    const result = await handleTasksStatus(BASE_EVENT);
    const body = JSON.parse(result.body);
    expect(body.tasks['quiz-1'].score).toBeUndefined();
    expect(body.tasks['quiz-1'].attempts).toBeUndefined();
  });

  it('returns empty tasks when module has no completion_tasks_json', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockDynamoSend.mockResolvedValueOnce({ Item: undefined });
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock(null) as any);

    const result = await handleTasksStatus(BASE_EVENT);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(Object.keys(body.tasks)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Handler tests — error paths
// ---------------------------------------------------------------------------

describe('handleTasksStatus — error paths', () => {
  it('returns 500 when DynamoDB GetItem fails', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockDynamoSend.mockRejectedValueOnce(new Error('DynamoDB connection refused'));

    const result = await handleTasksStatus(BASE_EVENT);
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Failed to read task status');
  });

  it('returns 500 when HubDB fallback call fails', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockDynamoSend.mockResolvedValueOnce({ Item: undefined });
    mockGetHubSpotClient.mockReturnValueOnce({
      cms: {
        hubdb: {
          rowsApi: {
            getTableRows: jest.fn().mockRejectedValueOnce(new Error('HubSpot API error')),
          },
        },
      },
    } as any);

    const result = await handleTasksStatus(BASE_EVENT);
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Failed to read task configuration');
  });

  it('returns 500 when HUBDB_MODULES_TABLE_ID is not set on fallback path', async () => {
    delete process.env.HUBDB_MODULES_TABLE_ID;
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockDynamoSend.mockResolvedValueOnce({ Item: undefined });

    const result = await handleTasksStatus(BASE_EVENT);
    expect(result.statusCode).toBe(500);
  });
});
