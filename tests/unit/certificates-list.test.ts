/**
 * Unit tests for GET /shadow/certificates list endpoint (Issue #429)
 *
 * Tests cover:
 *   - 403 when APP_STAGE !== 'shadow'
 *   - 401 when auth cookie is missing / invalid
 *   - 200 with empty array when no certs exist for user
 *   - 200 with sorted certificates list (most recent first)
 *   - 500 when DynamoDB query fails
 *   - entityTitle fallback to entitySlug when absent from DynamoDB item
 */

import { handleCertificatesList } from '../../src/api/lambda/certificates-list';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
  QueryCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'QueryCommand' })),
}));

import { verifyCookieAuth } from '../../src/api/lambda/cognito-auth';

const mockVerifyCookieAuth = verifyCookieAuth as jest.MockedFunction<typeof verifyCookieAuth>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CERTS_TABLE = 'hedgehog-learn-certificates-shadow';
const USER_ID = 'test-user-sub-abc';
const NOW = '2026-04-15T00:00:00.000Z';
const OLDER = '2026-03-01T00:00:00.000Z';
const MODULE_CERT_ID = 'a1a1a1a1-0000-4000-a000-000000000001';
const COURSE_CERT_ID = 'b2b2b2b2-0000-4000-a000-000000000002';

const baseEvent = {
  headers: { origin: 'https://hedgehog.cloud' },
  requestContext: { http: { method: 'GET' } },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleCertificatesList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CERTIFICATES_TABLE = CERTS_TABLE;
    process.env.APP_STAGE = 'shadow';
  });

  afterEach(() => {
    delete process.env.CERTIFICATES_TABLE;
    delete process.env.APP_STAGE;
  });

  it('returns 403 when APP_STAGE !== shadow', async () => {
    process.env.APP_STAGE = 'dev';
    const result = await handleCertificatesList(baseEvent);
    expect(result.statusCode).toBe(403);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('Not available');
  });

  it('returns 403 when APP_STAGE is undefined', async () => {
    delete process.env.APP_STAGE;
    const result = await handleCertificatesList(baseEvent);
    expect(result.statusCode).toBe(403);
  });

  it('returns 401 when verifyCookieAuth throws', async () => {
    mockVerifyCookieAuth.mockRejectedValueOnce(new Error('Missing cookie'));
    const result = await handleCertificatesList(baseEvent);
    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 200 with empty array when no certificates exist', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@example.com',
      decoded: {},
    });
    mockDynamoSend.mockResolvedValueOnce({ Items: [] });

    const result = await handleCertificatesList(baseEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.certificates).toEqual([]);
  });

  it('returns 200 with certificates sorted by issuedAt descending (most recent first)', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@example.com',
      decoded: {},
    });

    // DynamoDB returns items in arbitrary order; we verify the sort
    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          certId: MODULE_CERT_ID,
          entityType: 'module',
          entitySlug: 'fabric-operations-welcome',
          entityTitle: 'Fabric Operations Welcome',
          issuedAt: OLDER,
        },
        {
          certId: COURSE_CERT_ID,
          entityType: 'course',
          entitySlug: 'network-like-hyperscaler-foundations',
          entityTitle: 'Network Like Hyperscaler Foundations',
          issuedAt: NOW,
        },
      ],
    });

    const result = await handleCertificatesList(baseEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.certificates).toHaveLength(2);
    // Most recent first
    expect(body.certificates[0].certId).toBe(COURSE_CERT_ID);
    expect(body.certificates[0].issuedAt).toBe(NOW);
    expect(body.certificates[1].certId).toBe(MODULE_CERT_ID);
    expect(body.certificates[1].issuedAt).toBe(OLDER);
  });

  it('returns entityTitle from stored value', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@example.com',
      decoded: {},
    });
    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          certId: MODULE_CERT_ID,
          entityType: 'module',
          entitySlug: 'some-module',
          entityTitle: 'Some Module Title',
          issuedAt: NOW,
        },
      ],
    });

    const result = await handleCertificatesList(baseEvent);
    const body = JSON.parse(result.body);
    expect(body.certificates[0].entityTitle).toBe('Some Module Title');
  });

  it('falls back to entitySlug when entityTitle is absent from DynamoDB item', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@example.com',
      decoded: {},
    });
    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          certId: MODULE_CERT_ID,
          entityType: 'module',
          entitySlug: 'fabric-operations-welcome',
          // entityTitle is absent
          issuedAt: NOW,
        },
      ],
    });

    const result = await handleCertificatesList(baseEvent);
    const body = JSON.parse(result.body);
    expect(body.certificates[0].entityTitle).toBe('fabric-operations-welcome');
  });

  it('does not include PII (learnerId, evidenceSummary) in response', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@example.com',
      decoded: {},
    });
    mockDynamoSend.mockResolvedValueOnce({
      Items: [
        {
          certId: MODULE_CERT_ID,
          entityType: 'module',
          entitySlug: 'some-module',
          entityTitle: 'Some Module',
          issuedAt: NOW,
          learnerId: USER_ID,            // PII — must NOT appear
          evidenceSummary: { x: 'y' },  // internal — must NOT appear
        },
      ],
    });

    const result = await handleCertificatesList(baseEvent);
    const body = JSON.parse(result.body);
    expect(body.certificates[0].learnerId).toBeUndefined();
    expect(body.certificates[0].evidenceSummary).toBeUndefined();
  });

  it('returns 500 when CERTIFICATES_TABLE is not set', async () => {
    delete process.env.CERTIFICATES_TABLE;
    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@example.com',
      decoded: {},
    });
    const result = await handleCertificatesList(baseEvent);
    expect(result.statusCode).toBe(500);
  });

  it('returns 500 when DynamoDB query throws', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@example.com',
      decoded: {},
    });
    mockDynamoSend.mockRejectedValueOnce(new Error('DynamoDB unavailable'));

    const result = await handleCertificatesList(baseEvent);
    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('Failed to retrieve');
  });

  it('queries using PK = USER#<userId> and begins_with CERT#', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@example.com',
      decoded: {},
    });
    mockDynamoSend.mockResolvedValueOnce({ Items: [] });

    await handleCertificatesList(baseEvent);

    expect(mockDynamoSend).toHaveBeenCalledTimes(1);
    const callArg = mockDynamoSend.mock.calls[0][0];
    expect(callArg.input.TableName).toBe(CERTS_TABLE);
    expect(callArg.input.KeyConditionExpression).toContain('begins_with');
    expect(callArg.input.ExpressionAttributeValues[':pk']).toBe(`USER#${USER_ID}`);
    expect(callArg.input.ExpressionAttributeValues[':skPrefix']).toBe('CERT#');
  });

  it('sets Access-Control-Allow-Credentials header', async () => {
    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: USER_ID,
      email: 'test@example.com',
      decoded: {},
    });
    mockDynamoSend.mockResolvedValueOnce({ Items: [] });

    const result = await handleCertificatesList(baseEvent);
    expect(result.headers['Access-Control-Allow-Credentials']).toBe('true');
  });
});
