/**
 * Unit tests for shadow certificate issuance and verification (Issue #427, #429)
 *
 * Tests cover:
 *   - Module cert generated when all tasks pass (moduleStatus === 'complete')
 *   - Module cert NOT generated when only some tasks pass (moduleStatus !== 'complete')
 *   - awards_certificate gate: cert skipped when flag is false/0 in HubDB
 *   - entityTitle stored in DynamoDB at issuance
 *   - Course cert generated when all modules in a course complete
 *   - Course cert skipped when course awards_certificate=false
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
// HubSpot mock helpers
//
// issueCertificateIfComplete calls getHubSpotClient TWICE:
//   1st call: in the awards_certificate gate (modules table lookup)
//   2nd call: in checkAndIssueCourseCompletion (courses table lookup)
//
// Each HubSpot client object returned has its own getTableRows mock.
// ---------------------------------------------------------------------------

function makeHubSpotClientMock(rows: any[]) {
  return {
    cms: {
      hubdb: {
        rowsApi: {
          getTableRows: jest.fn().mockResolvedValueOnce({ results: rows }),
        },
      },
    },
  };
}

/**
 * Set up both the module-gate HubDB mock and the course-check HubDB mock.
 * Call this before any test that reaches a 'complete' moduleStatus.
 */
function setupHubSpotMocks(modulesRows: any[], coursesRows: any[]) {
  mockGetHubSpotClient
    .mockReturnValueOnce(makeHubSpotClientMock(modulesRows) as any)
    .mockReturnValueOnce(makeHubSpotClientMock(coursesRows) as any);
}

// Standard module row that passes the awards_certificate gate
const AWARDS_CERT_MODULE_ROW = {
  path: MODULE_SLUG,
  values: {
    hs_name: 'Fabric Operations Welcome',
    awards_certificate: true,
    completion_tasks_json: JSON.stringify([
      { task_slug: 'quiz-1', task_type: 'quiz', required: true },
      { task_slug: 'lab-main', task_type: 'lab_attestation', required: true },
    ]),
  },
};

// ---------------------------------------------------------------------------
// issueCertificateIfComplete
// ---------------------------------------------------------------------------

describe('issueCertificateIfComplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CERTIFICATES_TABLE = CERTS_TABLE;
    process.env.ENTITY_COMPLETIONS_TABLE = ENTITY_COMPLETIONS_TABLE;
    process.env.HUBDB_COURSES_TABLE_ID = 'test-courses-table';
    process.env.HUBDB_MODULES_TABLE_ID = 'test-modules-table';
  });

  afterEach(() => {
    delete process.env.CERTIFICATES_TABLE;
    delete process.env.ENTITY_COMPLETIONS_TABLE;
    delete process.env.HUBDB_COURSES_TABLE_ID;
    delete process.env.HUBDB_MODULES_TABLE_ID;
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

    // DynamoDB calls:
    // 1. GetCommand (cert existence check) → no item
    // 2. PutCommand (write new cert) → success
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })  // cert existence check
      .mockResolvedValueOnce({});                   // PutCommand succeeds

    // HubDB: modules (gate: awards_certificate=true) + courses (no course matches)
    setupHubSpotMocks([AWARDS_CERT_MODULE_ROW], []);

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

    // HubDB: modules (gate pass) + courses (no matching course)
    setupHubSpotMocks([AWARDS_CERT_MODULE_ROW], []);

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
    // 1. GetCommand: module cert existence check → no item
    // 2. PutCommand: write module cert → success
    // 3. GetCommand: entity-completion for 'module-a' → complete
    // 4. GetCommand: entity-completion for MODULE_SLUG → complete
    // 5. GetCommand: course cert existence check → no item
    // 6. PutCommand: write course cert → success
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })                           // (1)
      .mockResolvedValueOnce({})                                            // (2)
      .mockResolvedValueOnce({ Item: { status: 'complete' } })             // (3)
      .mockResolvedValueOnce({ Item: { status: 'complete' } })             // (4)
      .mockResolvedValueOnce({ Item: undefined })                           // (5)
      .mockResolvedValueOnce({});                                           // (6)

    // HubDB: modules (gate pass) + courses (one course, awards_certificate=true)
    setupHubSpotMocks(
      [AWARDS_CERT_MODULE_ROW],
      [
        {
          path: 'network-like-hyperscaler-foundations',
          values: {
            hs_name: 'NLH Foundations',
            awards_certificate: true,
            module_slugs_json: JSON.stringify(['module-a', MODULE_SLUG]),
          },
        },
      ]
    );

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
      .mockResolvedValueOnce({ Item: undefined })                           // module cert check
      .mockResolvedValueOnce({})                                            // module PutCommand
      .mockResolvedValueOnce({ Item: { status: 'in_progress' } });        // module-a → not complete

    // HubDB: modules (gate pass) + courses (one course, awards_certificate=true)
    setupHubSpotMocks(
      [AWARDS_CERT_MODULE_ROW],
      [
        {
          path: 'network-like-hyperscaler-foundations',
          values: {
            hs_name: 'NLH Foundations',
            awards_certificate: true,
            module_slugs_json: JSON.stringify(['module-a', MODULE_SLUG]),
          },
        },
      ]
    );

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

  // -------------------------------------------------------------------------
  // awards_certificate gate tests (Issue #429)
  // -------------------------------------------------------------------------

  it('skips module cert when awards_certificate=false on module row', async () => {
    const dynamo = makeDynamo();

    // Only one getHubSpotClient call: modules gate (returns false → early return)
    mockGetHubSpotClient.mockReturnValueOnce(
      makeHubSpotClientMock([
        {
          path: MODULE_SLUG,
          values: { hs_name: 'Some Module', awards_certificate: false },
        },
      ]) as any
    );

    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: MODULE_SLUG,
      moduleStatus: 'complete',
      taskStatusesMap: { 'quiz-1': 'passed', 'lab-main': 'attested' },
      now: NOW,
    });

    expect(result.moduleCertIssued).toBe(false);
    expect(result.moduleCertId).toBeUndefined();
    expect(result.courseCertIssued).toBe(false);
    // DynamoDB should NOT have been called (gate rejects before any DB write)
    expect(mockDynamoSend).not.toHaveBeenCalled();
  });

  it('skips module cert when awards_certificate=0 (HubDB integer falsy) on module row', async () => {
    const dynamo = makeDynamo();

    mockGetHubSpotClient.mockReturnValueOnce(
      makeHubSpotClientMock([
        {
          path: MODULE_SLUG,
          values: { hs_name: 'Some Module', awards_certificate: 0 },
        },
      ]) as any
    );

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

  it('issues module cert when awards_certificate=1 (HubDB integer truthy)', async () => {
    const dynamo = makeDynamo();

    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })  // cert existence check
      .mockResolvedValueOnce({});                   // PutCommand succeeds

    setupHubSpotMocks(
      [{ path: MODULE_SLUG, values: { hs_name: 'Module A', awards_certificate: 1 } }],
      []
    );

    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: MODULE_SLUG,
      moduleStatus: 'complete',
      taskStatusesMap: { 'quiz-1': 'passed' },
      now: NOW,
    });

    expect(result.moduleCertIssued).toBe(true);
  });

  it('skips module cert when module row is not found in HubDB', async () => {
    const dynamo = makeDynamo();

    // Only one getHubSpotClient call: modules gate returns empty results
    mockGetHubSpotClient.mockReturnValueOnce(
      makeHubSpotClientMock([]) as any
    );

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

  it('skips module cert when HUBDB_MODULES_TABLE_ID is not set', async () => {
    delete process.env.HUBDB_MODULES_TABLE_ID;
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

  it('skips course cert when course row has awards_certificate=false', async () => {
    const dynamo = makeDynamo();

    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })  // module cert check
      .mockResolvedValueOnce({});                   // module cert PutCommand

    // modules: gate passes; courses: one course with awards_certificate=false
    setupHubSpotMocks(
      [AWARDS_CERT_MODULE_ROW],
      [
        {
          path: 'network-like-hyperscaler-foundations',
          values: {
            hs_name: 'NLH Foundations',
            awards_certificate: false,
            module_slugs_json: JSON.stringify([MODULE_SLUG]),
          },
        },
      ]
    );

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

  it('stores entityTitle in the cert record written to DynamoDB', async () => {
    const dynamo = makeDynamo();

    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })  // cert existence check
      .mockResolvedValueOnce({});                   // PutCommand

    setupHubSpotMocks(
      [{ path: MODULE_SLUG, values: { hs_name: 'Expected Title', awards_certificate: true } }],
      []
    );

    await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: MODULE_SLUG,
      moduleStatus: 'complete',
      taskStatusesMap: { 'quiz-1': 'passed' },
      now: NOW,
    });

    // Find the PutCommand call and verify entityTitle was stored
    const putCall = mockDynamoSend.mock.calls.find(
      (call: any[]) => call[0]?._tag === 'PutCommand'
    );
    expect(putCall).toBeDefined();
    expect(putCall![0].input.Item.entityTitle).toBe('Expected Title');
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
          entityTitle: 'Fabric Operations Welcome',
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
    expect(body.entityTitle).toBe('Fabric Operations Welcome');
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
          entityTitle: 'NLH Foundations',
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
