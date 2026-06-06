/**
 * Unit tests for GET /shadow/pathway/status handler (handler-visible path /pathway/status).
 * Issue #451, Phase 5A. Spec §2.2, §1.4. Test plan §2.3.
 */

import { handleShadowPathwayStatus } from '../../src/api/lambda/shadow-pathway-status';

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
const ENTITY_COMPLETIONS_TABLE = 'hedgehog-learn-entity-completions-shadow';
const CERTS_TABLE = 'hedgehog-learn-certificates-shadow';
const PATHWAY_SLUG = 'network-like-hyperscaler';

function modulesRow(slug: string) {
  return {
    path: slug,
    name: slug,
    values: { hs_name: slug, completion_tasks_json: JSON.stringify([REQUIRED_QUIZ]) },
  };
}

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

// All modules across all 4 courses of network-like-hyperscaler pathway
const ALL_MODULE_SLUGS = [
  'fabric-operations-welcome',
  'fabric-operations-how-it-works',
  'fabric-operations-mastering-interfaces',
  'fabric-operations-foundations-recap',
  // Provisioning, observability, troubleshooting modules inferred from content/courses
];

function makeEvent(qs: any = { pathway_slug: PATHWAY_SLUG }) {
  return { headers: { origin: 'https://hedgehog.cloud' }, cookies: [], queryStringParameters: qs };
}

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

describe('handleShadowPathwayStatus — error paths', () => {
  it('403 when APP_STAGE is not shadow/production', async () => {
    process.env.APP_STAGE = 'dev';
    const result = await handleShadowPathwayStatus(makeEvent());
    expect(result.statusCode).toBe(403);
  });

  it('401 on auth failure', async () => {
    mockVerifyCookieAuth.mockRejectedValue(new Error('bad'));
    const result = await handleShadowPathwayStatus(makeEvent());
    expect(result.statusCode).toBe(401);
  });

  it('400 when pathway_slug missing', async () => {
    const result = await handleShadowPathwayStatus(makeEvent({}));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('pathway_slug query parameter is required');
  });

  it('400 when pathway_slug is unknown', async () => {
    const result = await handleShadowPathwayStatus(makeEvent({ pathway_slug: 'nonexistent' }));
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe('pathway not found');
  });
});

describe('handleShadowPathwayStatus — success paths', () => {
  it('empty state: all courses not_started', async () => {
    // HubSpot modules call may be invoked multiple times; use mockReturnValue
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules([]) as any);
    // DynamoDB returns empty for BatchGet (entity-completions); single call returns empty cert table
    mockDynamoSend.mockResolvedValue({ Responses: { [ENTITY_COMPLETIONS_TABLE]: [], [CERTS_TABLE]: [] } });

    const result = await handleShadowPathwayStatus(makeEvent());
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.pathway_slug).toBe(PATHWAY_SLUG);
    expect(body.pathway_status).toBe('not_started');
    expect(body.courses_total).toBe(4);
    expect(body.courses_completed).toBe(0);
    expect(body.courses).toHaveLength(4);
  });

  it('per-course entries do NOT include modules[] (bounded payload)', async () => {
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules([]) as any);
    mockDynamoSend.mockResolvedValue({ Responses: { [ENTITY_COMPLETIONS_TABLE]: [], [CERTS_TABLE]: [] } });

    const result = await handleShadowPathwayStatus(makeEvent());
    const body = JSON.parse(result.body);
    for (const c of body.courses) {
      expect(c.modules).toBeUndefined();
    }
  });

  it('contract shape: required top-level keys present', async () => {
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules([]) as any);
    mockDynamoSend.mockResolvedValue({ Responses: { [ENTITY_COMPLETIONS_TABLE]: [], [CERTS_TABLE]: [] } });

    const result = await handleShadowPathwayStatus(makeEvent());
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty('pathway_slug');
    expect(body).toHaveProperty('pathway_title');
    expect(body).toHaveProperty('pathway_status');
    expect(body).toHaveProperty('courses_completed');
    expect(body).toHaveProperty('courses_total');
    expect(body).toHaveProperty('courses');
    expect(body).toHaveProperty('pathway_cert_id');
    expect(['not_started', 'in_progress', 'complete']).toContain(body.pathway_status);
  });
});
