/**
 * Unit tests for shadow certificate issuance and verification (Issue #427)
 *
 * Tests cover:
 *   - Module cert generated when all tasks pass (moduleStatus === 'complete')
 *   - Module cert NOT generated when only some tasks pass (moduleStatus !== 'complete')
 *   - Course cert generated when all modules in a course complete
 *   - Idempotent: re-completion returns existing certId without writing a new cert
 *   - Public verification endpoint returns correct payload
 *   - 404 on unknown certId
 *   - 403 when APP_STAGE !== 'shadow'
 *   - 400 on invalid certId format
 */

import { issueCertificateIfComplete } from '../../src/api/lambda/certificate-issuance';
import { handleCertificateVerify } from '../../src/api/lambda/certificate-verify';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('00000000-0000-4000-a000-000000000001'),
}));

jest.mock('../../src/shared/hubspot', () => ({
  getHubSpotClient: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

// Mutable mock so individual tests can override send behavior
const mockDynamoSend = jest.fn();
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: (...args: any[]) => mockDynamoSend(...args),
    }),
  },
  GetCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'GetCommand' })),
  PutCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'PutCommand' })),
  QueryCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'QueryCommand' })),
  UpdateCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'UpdateCommand' })),
}));

import { getHubSpotClient } from '../../src/shared/hubspot';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const mockGetHubSpotClient = getHubSpotClient as jest.MockedFunction<typeof getHubSpotClient>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDynamo(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from({} as any);
}

const NOW = '2026-04-14T00:00:00.000Z';
const USER_ID = 'test-user-sub-123';
const MODULE_SLUG = 'fabric-operations-welcome';
const CERTS_TABLE = 'hedgehog-learn-certificates-shadow';
const ENTITY_COMPLETIONS_TABLE = 'hedgehog-learn-entity-completions-shadow';

// ---------------------------------------------------------------------------
// issueCertificateIfComplete
// ---------------------------------------------------------------------------

describe('issueCertificateIfComplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CERTIFICATES_TABLE = CERTS_TABLE;
    process.env.ENTITY_COMPLETIONS_TABLE = ENTITY_COMPLETIONS_TABLE;
    process.env.HUBDB_COURSES_TABLE_ID = 'test-courses-table';
  });

  afterEach(() => {
    delete process.env.CERTIFICATES_TABLE;
    delete process.env.ENTITY_COMPLETIONS_TABLE;
    delete process.env.HUBDB_COURSES_TABLE_ID;
  });

  it('returns no-op when moduleStatus is not complete', async () => {
    const dynamo = makeDynamo();
    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: MODULE_SLUG,
      moduleStatus: 'in_progress',
      taskStatusesMap: { 'quiz-1': 'passed' },
      now: NOW,
    });

    expect(result.moduleCertIssued).toBe(false);
    expect(result.moduleCertId).toBeUndefined();
    expect(result.courseCertIssued).toBe(false);
    expect(mockDynamoSend).not.toHaveBeenCalled();
  });

  it('issues module cert when moduleStatus is complete (no existing cert)', async () => {
    const dynamo = makeDynamo();

    // Sequence of DynamoDB calls:
    // 1. GetCommand (cert existence check) → no item
    // 2. PutCommand (write new cert) → success
    // 3. GetCommand (entity-completion for module in course check — course lookup goes via HubDB)
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })  // cert existence check
      .mockResolvedValueOnce({});                   // PutCommand succeeds

    // HubDB courses: no course contains this module
    mockGetHubSpotClient.mockReturnValueOnce({
      cms: {
        hubdb: {
          rowsApi: {
            getTableRows: jest.fn().mockResolvedValueOnce({ results: [] }),
          },
        },
      },
    } as any);

    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: MODULE_SLUG,
      moduleStatus: 'complete',
      taskStatusesMap: { 'quiz-1': 'passed', 'lab-main': 'attested' },
      now: NOW,
    });

    expect(result.moduleCertIssued).toBe(true);
    expect(result.moduleCertId).toBe('00000000-0000-4000-a000-000000000001');
    expect(result.courseCertIssued).toBe(false);
  });

  it('does NOT issue module cert when only some tasks pass (not_complete status)', async () => {
    const dynamo = makeDynamo();

    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: MODULE_SLUG,
      moduleStatus: 'not_started',
      taskStatusesMap: {},
      now: NOW,
    });

    expect(result.moduleCertIssued).toBe(false);
    expect(mockDynamoSend).not.toHaveBeenCalled();
  });

  it('is idempotent: returns existing certId without writing when cert already exists', async () => {
    const dynamo = makeDynamo();
    const existingCertId = 'aaaaaaaa-0000-4000-a000-000000000099';

    // GetCommand returns an existing cert
    mockDynamoSend
      .mockResolvedValueOnce({ Item: { certId: existingCertId } });  // cert exists

    // HubDB courses: none match
    mockGetHubSpotClient.mockReturnValueOnce({
      cms: {
        hubdb: {
          rowsApi: {
            getTableRows: jest.fn().mockResolvedValueOnce({ results: [] }),
          },
        },
      },
    } as any);

    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: MODULE_SLUG,
      moduleStatus: 'complete',
      taskStatusesMap: { 'quiz-1': 'passed', 'lab-main': 'attested' },
      now: NOW,
    });

    expect(result.moduleCertIssued).toBe(false);   // not newly issued
    expect(result.moduleCertId).toBe(existingCertId);
    // PutCommand should NOT have been called
    const putCalls = mockDynamoSend.mock.calls.filter(
      (call) => call[0]?._tag === 'PutCommand'
    );
    expect(putCalls.length).toBe(0);
  });

  it('issues course cert when all modules in course are complete', async () => {
    const dynamo = makeDynamo();

    // randomUUID will be called twice: once for module cert, once for course cert
    const { randomUUID } = require('crypto');
    (randomUUID as jest.Mock)
      .mockReturnValueOnce('mod-cert-uuid-0000-4000-a000-000000000002')
      .mockReturnValueOnce('course-cert-uuid-0004000-a000-000000000003');

    // DynamoDB call sequence:
    // 1. GetCommand: module cert existence check → no item (not yet issued)
    // 2. PutCommand: write module cert → success
    // 3. GetCommand: entity-completion for 'module-a' → complete
    // 4. GetCommand: entity-completion for 'module-b' (= MODULE_SLUG, just completed) → complete
    // 5. GetCommand: course cert existence check → no item
    // 6. PutCommand: write course cert → success
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })                           // (1) module cert check
      .mockResolvedValueOnce({})                                            // (2) module PutCommand
      .mockResolvedValueOnce({ Item: { status: 'complete' } })             // (3) module-a entity check
      .mockResolvedValueOnce({ Item: { status: 'complete' } })             // (4) MODULE_SLUG entity check
      .mockResolvedValueOnce({ Item: undefined })                           // (5) course cert check
      .mockResolvedValueOnce({});                                           // (6) course PutCommand

    // HubDB returns one course containing MODULE_SLUG and 'module-a'
    mockGetHubSpotClient.mockReturnValueOnce({
      cms: {
        hubdb: {
          rowsApi: {
            getTableRows: jest.fn().mockResolvedValueOnce({
              results: [
                {
                  path: 'network-like-hyperscaler-foundations',
                  values: {
                    module_slugs_json: JSON.stringify(['module-a', MODULE_SLUG]),
                  },
                },
              ],
            }),
          },
        },
      },
    } as any);

    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: MODULE_SLUG,
      moduleStatus: 'complete',
      taskStatusesMap: { 'quiz-1': 'passed', 'lab-main': 'attested' },
      now: NOW,
    });

    expect(result.moduleCertIssued).toBe(true);
    expect(result.courseCertIssued).toBe(true);
    expect(result.courseCertId).toBeDefined();
  });

  it('does NOT issue course cert when some modules in course are not complete', async () => {
    const dynamo = makeDynamo();

    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })                           // module cert check → not exists
      .mockResolvedValueOnce({})                                            // module PutCommand
      .mockResolvedValueOnce({ Item: { status: 'in_progress' } })         // module-a entity check → not complete
      // course loop short-circuits after first non-complete module

    // HubDB returns one course containing MODULE_SLUG and 'module-a'
    mockGetHubSpotClient.mockReturnValueOnce({
      cms: {
        hubdb: {
          rowsApi: {
            getTableRows: jest.fn().mockResolvedValueOnce({
              results: [
                {
                  path: 'network-like-hyperscaler-foundations',
                  values: {
                    module_slugs_json: JSON.stringify(['module-a', MODULE_SLUG]),
                  },
                },
              ],
            }),
          },
        },
      },
    } as any);

    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: MODULE_SLUG,
      moduleStatus: 'complete',
      taskStatusesMap: { 'quiz-1': 'passed', 'lab-main': 'attested' },
      now: NOW,
    });

    expect(result.moduleCertIssued).toBe(true);
    expect(result.courseCertIssued).toBe(false);
  });

  it('returns no-op when CERTIFICATES_TABLE env is not set', async () => {
    delete process.env.CERTIFICATES_TABLE;
    const dynamo = makeDynamo();

    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: MODULE_SLUG,
      moduleStatus: 'complete',
      taskStatusesMap: { 'quiz-1': 'passed' },
      now: NOW,
    });

    expect(result.moduleCertIssued).toBe(false);
    expect(mockDynamoSend).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleCertificateVerify — GET /shadow/certificate/:certId
// ---------------------------------------------------------------------------

describe('handleCertificateVerify', () => {
  const VALID_CERT_ID = 'a1b2c3d4-0000-4000-a000-000000000001';

  const baseEvent = {
    headers: { origin: 'https://hedgehog.cloud' },
    pathParameters: { certId: VALID_CERT_ID },
    rawPath: `/shadow/certificate/${VALID_CERT_ID}`,
    requestContext: { http: { method: 'GET' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CERTIFICATES_TABLE = CERTS_TABLE;
  });

  afterEach(() => {
    delete process.env.CERTIFICATES_TABLE;
  });

  it('returns 403 when APP_STAGE !== shadow', async () => {
    process.env.APP_STAGE = 'dev';
    const result = await handleCertificateVerify(baseEvent);
    expect(result.statusCode).toBe(403);
    delete process.env.APP_STAGE;
  });

  it('returns 403 when APP_STAGE is undefined', async () => {
    delete process.env.APP_STAGE;
    const result = await handleCertificateVerify(baseEvent);
    expect(result.statusCode).toBe(403);
  });

  it('returns 400 on invalid certId format (not a UUID)', async () => {
    process.env.APP_STAGE = 'shadow';
    const badEvent = {
      ...baseEvent,
      pathParameters: { certId: 'not-a-uuid' },
    };
    const result = await handleCertificateVerify(badEvent);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Invalid certId format');
    delete process.env.APP_STAGE;
  });

  it('returns 404 when certId is not found in DynamoDB', async () => {
    process.env.APP_STAGE = 'shadow';
    mockDynamoSend.mockResolvedValueOnce({ Items: [] }); // GSI query returns nothing

    const result = await handleCertificateVerify(baseEvent);
    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Certificate not found');
    delete process.env.APP_STAGE;
  });

  it('returns 200 with certificate fields (no PII) when certId is found', async () => {
    process.env.APP_STAGE = 'shadow';

    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          certId: VALID_CERT_ID,
          learnerId: USER_ID,           // PII — should NOT appear in response
          entityType: 'module',
          entitySlug: MODULE_SLUG,
          issuedAt: NOW,
          evidenceSummary: { 'quiz-1': 'passed' },  // internal — should NOT appear
        },
      ],
    });

    const result = await handleCertificateVerify(baseEvent);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.certId).toBe(VALID_CERT_ID);
    expect(body.entityType).toBe('module');
    expect(body.entitySlug).toBe(MODULE_SLUG);
    expect(body.issuedAt).toBe(NOW);

    // PII fields must NOT be in response
    expect(body.learnerId).toBeUndefined();
    expect(body.evidenceSummary).toBeUndefined();
    delete process.env.APP_STAGE;
  });

  it('returns 200 for a course certificate', async () => {
    process.env.APP_STAGE = 'shadow';
    const COURSE_CERT_ID = 'b2c3d4e5-0000-4000-a000-000000000002';
    const COURSE_SLUG = 'network-like-hyperscaler-foundations';

    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          certId: COURSE_CERT_ID,
          learnerId: USER_ID,
          entityType: 'course',
          entitySlug: COURSE_SLUG,
          issuedAt: NOW,
        },
      ],
    });

    const courseEvent = {
      ...baseEvent,
      pathParameters: { certId: COURSE_CERT_ID },
    };

    const result = await handleCertificateVerify(courseEvent);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.certId).toBe(COURSE_CERT_ID);
    expect(body.entityType).toBe('course');
    expect(body.entitySlug).toBe(COURSE_SLUG);
    expect(body.learnerId).toBeUndefined();
    delete process.env.APP_STAGE;
  });

  it('returns 500 on DynamoDB error', async () => {
    process.env.APP_STAGE = 'shadow';
    mockDynamoSend.mockRejectedValueOnce(new Error('DynamoDB unavailable'));

    const result = await handleCertificateVerify(baseEvent);
    expect(result.statusCode).toBe(500);
    delete process.env.APP_STAGE;
  });
});
