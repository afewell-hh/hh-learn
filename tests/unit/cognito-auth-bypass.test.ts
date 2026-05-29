/**
 * Unit tests for the P0 dual-guard hardening of Cognito test bypass paths.
 *
 * Issue: #461 — bypass logic must require BOTH
 *   - APP_STAGE === 'shadow'
 *   - ENABLE_TEST_BYPASS === 'true'
 *
 * Covers the two entry points in src/api/lambda/cognito-auth.ts:
 *   1. handleCallback() — mock auth code (MOCK_*) → mock cookies
 *   2. verifyCookieAuth() — sentinel access token (shadow_e2e_test_token)
 *
 * Required cases (from issue body):
 *   - callback bypass accepted on shadow + enabled
 *   - callback bypass rejected on production + enabled
 *   - cookie bypass accepted on shadow + enabled
 *   - cookie bypass rejected on production + enabled
 *   - cookie bypass rejected when bypass disabled (even on shadow)
 */

// IMPORTANT: cognito-auth.ts reads several env vars at module load and throws
// if JWT_SECRET is unset. These assignments must execute before the SUT is
// imported. With ts-jest + tsconfig module=CommonJS, top-level statements
// run in source order, so setting env here works.
process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
process.env.COGNITO_DOMAIN = 'test.example.com';
process.env.COGNITO_CLIENT_ID = 'test-client-id';
process.env.COGNITO_REDIRECT_URI = 'https://api.test.example.com/auth/callback';
process.env.COGNITO_ISSUER = 'https://cognito-idp.us-west-2.amazonaws.com/test-pool';
process.env.COGNITO_USER_POOL_ID = 'us-west-2_testpool';
process.env.DYNAMODB_USERS_TABLE = 'test-users-table';
process.env.SITE_BASE_URL = 'https://test.example.com';

import jwt from 'jsonwebtoken';
import {
  handleCallback,
  verifyCookieAuth,
  isTestBypassEnabled,
} from '../../src/api/lambda/cognito-auth';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const STATE_SECRET = 'test-jwt-secret-for-unit-tests';

function signState(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      redirect_url: '/learn',
      code_verifier: 'test-code-verifier-abcdefghij',
      nonce: 'test-nonce',
      timestamp: Date.now(),
      ...overrides,
    },
    STATE_SECRET,
    { expiresIn: '10m' }
  );
}

function cookieEvent(token: string) {
  return { headers: { cookie: `hhl_access_token=${token}` } };
}

// Snapshot only the env vars the helper reads so each test starts clean.
let originalAppStage: string | undefined;
let originalEnableBypass: string | undefined;

beforeEach(() => {
  originalAppStage = process.env.APP_STAGE;
  originalEnableBypass = process.env.ENABLE_TEST_BYPASS;
});

afterEach(() => {
  if (originalAppStage === undefined) delete process.env.APP_STAGE;
  else process.env.APP_STAGE = originalAppStage;
  if (originalEnableBypass === undefined) delete process.env.ENABLE_TEST_BYPASS;
  else process.env.ENABLE_TEST_BYPASS = originalEnableBypass;
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// isTestBypassEnabled() — direct truth-table
// ---------------------------------------------------------------------------

describe('isTestBypassEnabled() — dual-guard predicate', () => {
  it('returns true only when APP_STAGE=shadow AND ENABLE_TEST_BYPASS=true', () => {
    process.env.APP_STAGE = 'shadow';
    process.env.ENABLE_TEST_BYPASS = 'true';
    expect(isTestBypassEnabled()).toBe(true);
  });

  it('returns false when APP_STAGE is production even if bypass enabled', () => {
    process.env.APP_STAGE = 'production';
    process.env.ENABLE_TEST_BYPASS = 'true';
    expect(isTestBypassEnabled()).toBe(false);
  });

  it('returns false when APP_STAGE is unset even if bypass enabled', () => {
    delete process.env.APP_STAGE;
    process.env.ENABLE_TEST_BYPASS = 'true';
    expect(isTestBypassEnabled()).toBe(false);
  });

  it('returns false when bypass disabled even on shadow', () => {
    process.env.APP_STAGE = 'shadow';
    process.env.ENABLE_TEST_BYPASS = 'false';
    expect(isTestBypassEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleCallback — MOCK_ code bypass
// ---------------------------------------------------------------------------

describe('handleCallback() — MOCK_ code bypass', () => {
  it('accepts MOCK_ code when APP_STAGE=shadow and ENABLE_TEST_BYPASS=true', async () => {
    process.env.APP_STAGE = 'shadow';
    process.env.ENABLE_TEST_BYPASS = 'true';

    const state = signState();
    const res: any = await handleCallback({
      queryStringParameters: { code: 'MOCK_unit_test', state },
      headers: {},
    });

    expect(res.statusCode).toBe(302);
    const cookies: string[] = res.cookies || [];
    expect(
      cookies.some((c) => c.includes('hhl_access_token=mock_access_token_for_testing'))
    ).toBe(true);
  });

  it('rejects MOCK_ code in production even when ENABLE_TEST_BYPASS=true', async () => {
    process.env.APP_STAGE = 'production';
    process.env.ENABLE_TEST_BYPASS = 'true';

    // Stub fetch so the non-bypass token-exchange path fails deterministically
    // instead of hitting the network. We assert behavior, not reachability.
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('blocked in unit test'));

    const state = signState();
    const res: any = await handleCallback({
      queryStringParameters: { code: 'MOCK_unit_test', state },
      headers: {},
    });

    // The bypass must NOT have set the mock cookies.
    const cookies: string[] = res.cookies || [];
    expect(cookies.some((c) => c.includes('mock_access_token_for_testing'))).toBe(false);
    // Code path fell through to normal exchange and errored out → 500
    expect(res.statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// verifyCookieAuth — sentinel token bypass
// ---------------------------------------------------------------------------

describe('verifyCookieAuth() — sentinel token bypass', () => {
  it('accepts shadow_e2e_test_token when APP_STAGE=shadow and ENABLE_TEST_BYPASS=true', async () => {
    process.env.APP_STAGE = 'shadow';
    process.env.ENABLE_TEST_BYPASS = 'true';

    const result = await verifyCookieAuth(cookieEvent('shadow_e2e_test_token'));

    expect(result.userId).toBe('shadow-e2e-test-user');
    expect(result.email).toBe('shadow-e2e@test.internal');
    expect(result.decoded).toMatchObject({
      sub: 'shadow-e2e-test-user',
      token_use: 'access',
    });
  });

  it('rejects sentinel token in production even when ENABLE_TEST_BYPASS=true', async () => {
    process.env.APP_STAGE = 'production';
    process.env.ENABLE_TEST_BYPASS = 'true';

    // Defense-in-depth: stub fetch so JWKS resolution can't accidentally
    // succeed in some unrelated way. (The sentinel is not a valid JWT so
    // jwt.decode returns null and verifyJWT throws before fetch is called.)
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('JWKS blocked in unit test'));

    await expect(
      verifyCookieAuth(cookieEvent('shadow_e2e_test_token'))
    ).rejects.toThrow();
  });

  it('rejects sentinel token when ENABLE_TEST_BYPASS=false, even on shadow', async () => {
    process.env.APP_STAGE = 'shadow';
    process.env.ENABLE_TEST_BYPASS = 'false';

    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('JWKS blocked in unit test'));

    await expect(
      verifyCookieAuth(cookieEvent('shadow_e2e_test_token'))
    ).rejects.toThrow();
  });
});
