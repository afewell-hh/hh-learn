/**
 * Unit tests for POST /tasks/lab/attest
 *
 * Tests cover:
 *   - shadow guard (403)
 *   - auth failure (401)
 *   - request validation (400)
 *   - task not found for module (400)
 *   - task is not lab_attestation type (400)
 *   - successful attestation path (200)
 *   - DynamoDB write failure (500)
 *   - re-attestation is idempotent (200)
 *   - module_complete reflects computed status
 */

import { handleLabAttest } from '../../src/api/lambda/tasks-lab-attest';

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

// Default DynamoDB mock: writes succeed, query returns empty items
const mockDynamoSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: (...args: any[]) => mockDynamoSend(...args),
    }),
  },
  PutCommand: jest.fn().mockImplementation((input: any) => ({ input })),
  UpdateCommand: jest.fn().mockImplementation((input: any) => ({ input })),
  QueryCommand: jest.fn().mockImplementation((input: any) => ({ input })),
}));

// Mock computeModuleStatus from tasks-quiz-submit to isolate attest handler
jest.mock('../../src/api/lambda/tasks-quiz-submit', () => ({
  computeModuleStatus: jest.fn().mockReturnValue('in_progress'),
  CompletionTask: undefined, // type-only, no runtime value needed
}));

import { getHubSpotClient } from '../../src/shared/hubspot';
import { verifyCookieAuth } from '../../src/api/lambda/cognito-auth';
import { computeModuleStatus } from '../../src/api/lambda/tasks-quiz-submit';

const mockGetHubSpotClient = getHubSpotClient as jest.MockedFunction<typeof getHubSpotClient>;
const mockVerifyCookieAuth = verifyCookieAuth as jest.MockedFunction<typeof verifyCookieAuth>;
const mockComputeModuleStatus = computeModuleStatus as jest.MockedFunction<typeof computeModuleStatus>;

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

function makeHubSpotMock(completionTasksJson: string | null = JSON.stringify(WELCOME_COMPLETION_TASKS)) {
  return {
    cms: {
      hubdb: {
        rowsApi: {
          getTableRows: jest.fn().mockResolvedValueOnce({
            results: [
              {
                path: 'fabric-operations-welcome',
                values: {
                  completion_tasks_json: completionTasksJson,
                },
              },
            ],
          }),
        },
      },
    },
  };
}

function makeSuccessfulDynamoMock() {
  mockDynamoSend.mockImplementation((cmd: any) => {
    // QueryCommand returns task records for EntityCompletion recompute
    if (cmd.input && cmd.input.KeyConditionExpression) {
      return Promise.resolve({
        Items: [
          {
            SK: 'TASK#MODULE#fabric-operations-welcome#lab-main',
            status: 'attested',
            attempt_count: 1,
          },
        ],
      });
    }
    // PutCommand and UpdateCommand return empty
    return Promise.resolve({});
  });
}

const AUTH_RESULT = { userId: 'test-user-id', email: 'test@example.com', decoded: {} };

const BASE_EVENT = {
  headers: { 'content-type': 'application/json' },
  cookies: [],
  body: JSON.stringify({
    module_slug: 'fabric-operations-welcome',
    task_slug: 'lab-main',
  }),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  process.env.APP_STAGE = 'shadow';
  process.env.HUBDB_MODULES_TABLE_ID = 'test-table-id';
  process.env.TASK_RECORDS_TABLE = 'test-task-records';
  process.env.TASK_ATTEMPTS_TABLE = 'test-task-attempts';
  process.env.ENTITY_COMPLETIONS_TABLE = 'test-entity-completions';
  mockComputeModuleStatus.mockReturnValue('in_progress');
});

afterEach(() => {
  delete process.env.APP_STAGE;
});

describe('handleLabAttest — shadow guard', () => {
  it('returns 403 when APP_STAGE is dev', async () => {
    process.env.APP_STAGE = 'dev';
    const result = await handleLabAttest(BASE_EVENT);
    expect(result.statusCode).toBe(403);
  });

  it('returns 403 when APP_STAGE is prod', async () => {
    process.env.APP_STAGE = 'prod';
    const result = await handleLabAttest(BASE_EVENT);
    expect(result.statusCode).toBe(403);
  });

  it('returns 403 when APP_STAGE is undefined', async () => {
    delete process.env.APP_STAGE;
    const result = await handleLabAttest(BASE_EVENT);
    expect(result.statusCode).toBe(403);
  });
});

describe('handleLabAttest — authentication', () => {
  it('returns 401 when no valid cookie is present', async () => {
    mockVerifyCookieAuth.mockRejectedValueOnce(new Error('Missing hhl_access_token cookie'));
    const result = await handleLabAttest(BASE_EVENT);
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error).toBe('Unauthorized');
  });

  it('returns 401 when token is expired', async () => {
    mockVerifyCookieAuth.mockRejectedValueOnce(new Error('Token expired'));
    const result = await handleLabAttest(BASE_EVENT);
    expect(result.statusCode).toBe(401);
  });
});

describe('handleLabAttest — request validation', () => {
  it('returns 400 when module_slug is missing', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    const result = await handleLabAttest({
      ...BASE_EVENT,
      body: JSON.stringify({ task_slug: 'lab-main' }),
    });
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when task_slug is missing', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    const result = await handleLabAttest({
      ...BASE_EVENT,
      body: JSON.stringify({ module_slug: 'fabric-operations-welcome' }),
    });
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    const result = await handleLabAttest({ ...BASE_EVENT, body: 'not-json' });
    expect(result.statusCode).toBe(400);
  });
});

describe('handleLabAttest — task validation', () => {
  it('returns 400 when task_slug is not declared for the module', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);

    const result = await handleLabAttest({
      ...BASE_EVENT,
      body: JSON.stringify({
        module_slug: 'fabric-operations-welcome',
        task_slug: 'nonexistent-task',
      }),
    });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('task not found for module');
  });

  it('returns 400 when task exists but is not lab_attestation type', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    // Override: task_slug=quiz-1 is a quiz type, not lab_attestation
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);

    const result = await handleLabAttest({
      ...BASE_EVENT,
      body: JSON.stringify({
        module_slug: 'fabric-operations-welcome',
        task_slug: 'quiz-1', // quiz type — should be rejected
      }),
    });

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('task is not a lab_attestation type');
  });

  it('returns 400 when module has no completion_tasks_json', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock(null) as any);

    const result = await handleLabAttest(BASE_EVENT);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('task not found for module');
  });

  it('returns 400 when module row is not found in HubDB', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockGetHubSpotClient.mockReturnValueOnce({
      cms: { hubdb: { rowsApi: { getTableRows: jest.fn().mockResolvedValueOnce({ results: [] }) } } },
    } as any);

    const result = await handleLabAttest(BASE_EVENT);
    expect(result.statusCode).toBe(400);
  });
});

describe('handleLabAttest — successful attestation', () => {
  it('returns 200 with attested=true and task_slug for valid attestation', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);
    makeSuccessfulDynamoMock();

    const result = await handleLabAttest(BASE_EVENT);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.attested).toBe(true);
    expect(body.task_slug).toBe('lab-main');
    expect(typeof body.module_complete).toBe('boolean');
  });

  it('module_complete=true when computeModuleStatus returns complete', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);
    makeSuccessfulDynamoMock();
    mockComputeModuleStatus.mockReturnValueOnce('complete');

    const result = await handleLabAttest(BASE_EVENT);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.module_complete).toBe(true);
  });

  it('module_complete=false when quiz not yet passed (in_progress)', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);
    makeSuccessfulDynamoMock();
    mockComputeModuleStatus.mockReturnValueOnce('in_progress');

    const result = await handleLabAttest(BASE_EVENT);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.module_complete).toBe(false);
  });

  it('re-attestation is idempotent — returns 200 again', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);
    makeSuccessfulDynamoMock();

    // Re-attest: should still succeed
    const result = await handleLabAttest(BASE_EVENT);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.attested).toBe(true);
  });

  it('response echoes the task_slug from the request', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);
    makeSuccessfulDynamoMock();

    const result = await handleLabAttest(BASE_EVENT);
    const body = JSON.parse(result.body);
    expect(body.task_slug).toBe('lab-main');
  });
});

describe('handleLabAttest — DynamoDB write failure', () => {
  it('returns 500 when TaskAttempt PutItem fails', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);
    mockDynamoSend.mockRejectedValueOnce(new Error('DynamoDB connection refused'));

    const result = await handleLabAttest(BASE_EVENT);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Failed to persist attestation');
  });

  it('returns 500 when TaskRecord UpdateItem fails', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce(AUTH_RESULT as any);
    mockGetHubSpotClient.mockReturnValueOnce(makeHubSpotMock() as any);
    // First call (PutCommand) succeeds, second (UpdateCommand for TaskRecord) fails
    mockDynamoSend
      .mockResolvedValueOnce({}) // TaskAttempt PutItem OK
      .mockRejectedValueOnce(new Error('Write throughput exceeded'));

    const result = await handleLabAttest(BASE_EVENT);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe('Failed to persist attestation');
  });
});
