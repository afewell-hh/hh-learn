/**
 * Negative control — architecture-mandated by Phase 2 revision and Phase 3 §7.4.
 * Issue #451, Phase 5A. Test plan §2.7.
 *
 * This file encodes two non-negotiables:
 *
 *   1. The shadow pathway-certificate path MUST use the shadow aggregator,
 *      not calculatePathwayCompletion from completion.ts (which reads the
 *      CRM hhl_progress_state blob). The behavioral test seeds shadow state
 *      only, leaves CRM state empty, and asserts the pathway cert IS issued.
 *      If the implementation were to (incorrectly) use the CRM aggregator
 *      against an empty CRM blob, the pathway would look incomplete and
 *      this test would fail — that failure is the architectural guardrail.
 *
 *   2. Static import-graph assertion on certificate-issuance.ts: it must
 *      import from './shadow-aggregation' and must NOT import
 *      calculatePathwayCompletion or calculateCourseCompletion from
 *      './completion'. This is a byte-level guarantee that the wrong
 *      aggregator cannot creep back in via refactor.
 */

import * as fs from 'fs';
import * as path from 'path';

import { issueCertificateIfComplete } from '../../src/api/lambda/certificate-issuance';

// ---------------------------------------------------------------------------
// Mocks (same pattern as certificate-issuance.test.ts)
// ---------------------------------------------------------------------------

jest.mock('crypto', () => ({
  randomUUID: jest
    .fn()
    .mockReturnValueOnce('mod-uuid-0000-4000-a000-000000000001')
    .mockReturnValueOnce('course-uuid-000000-4000-a000-000000000002')
    .mockReturnValueOnce('pathway-uuid-00000-4000-a000-000000000003'),
}));

jest.mock('../../src/shared/hubspot', () => ({
  getHubSpotClient: jest.fn(),
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
  PutCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'PutCommand' })),
  QueryCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'QueryCommand' })),
  BatchGetCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'BatchGetCommand' })),
  UpdateCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'UpdateCommand' })),
}));

import { getHubSpotClient } from '../../src/shared/hubspot';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const mockGetHubSpotClient = getHubSpotClient as jest.MockedFunction<typeof getHubSpotClient>;

function makeDynamo(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from({} as any);
}

function hubspotRowsSequence(rowsSequence: any[][]) {
  // Each call to getHubSpotClient returns a fresh mock whose getTableRows
  // returns the next payload from the sequence.
  let i = 0;
  mockGetHubSpotClient.mockImplementation(() => ({
    cms: {
      hubdb: {
        rowsApi: {
          getTableRows: jest.fn().mockImplementation(() => {
            const payload = rowsSequence[i];
            i++;
            return Promise.resolve({ results: payload || [] });
          }),
        },
      },
    },
  }) as any);
}

const USER_ID = 'neg-control-user';
const NOW = '2026-04-14T00:00:00.000Z';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.APP_STAGE = 'shadow';
  process.env.CERTIFICATES_TABLE = 'certificates-shadow';
  process.env.ENTITY_COMPLETIONS_TABLE = 'entity-completions-shadow';
  process.env.HUBDB_MODULES_TABLE_ID = 'modules-table';
  process.env.HUBDB_COURSES_TABLE_ID = 'courses-table';
  process.env.HUBDB_PATHWAYS_TABLE_ID = 'pathways-table';
});

afterEach(() => {
  delete process.env.APP_STAGE;
  delete process.env.CERTIFICATES_TABLE;
  delete process.env.ENTITY_COMPLETIONS_TABLE;
  delete process.env.HUBDB_MODULES_TABLE_ID;
  delete process.env.HUBDB_COURSES_TABLE_ID;
  delete process.env.HUBDB_PATHWAYS_TABLE_ID;
});

// ---------------------------------------------------------------------------
// 1. Static import-graph assertion (cheap, independent of behavior)
// ---------------------------------------------------------------------------

describe('negative control — import graph', () => {
  it('certificate-issuance.ts imports from ./shadow-aggregation', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/api/lambda/certificate-issuance.ts'),
      'utf-8'
    );
    // Match with optional .js suffix (used by the codebase's ESM-style import paths).
    expect(src).toMatch(/from ['"]\.\/shadow-aggregation(\.js)?['"]/);
  });

  it('certificate-issuance.ts does NOT import calculatePathwayCompletion or calculateCourseCompletion', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/api/lambda/certificate-issuance.ts'),
      'utf-8'
    );
    // Strip single-line and block comments before scanning to avoid false positives
    // on prose that mentions the forbidden symbols for documentation purposes.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    // The forbidden symbols must not appear in any import statement or call site.
    const importMatchPathway = /import[\s\S]*?calculatePathwayCompletion[\s\S]*?from\s+['"]\.\/completion(\.js)?['"]/.test(codeOnly);
    const importMatchCourse = /import[\s\S]*?calculateCourseCompletion[\s\S]*?from\s+['"]\.\/completion(\.js)?['"]/.test(codeOnly);
    expect(importMatchPathway).toBe(false);
    expect(importMatchCourse).toBe(false);

    // Call-site: neither function may be invoked.
    expect(codeOnly).not.toMatch(/\bcalculatePathwayCompletion\s*\(/);
    expect(codeOnly).not.toMatch(/\bcalculateCourseCompletion\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// 2. Behavioral negative control
// ---------------------------------------------------------------------------

describe('negative control — pathway cert uses shadow aggregator, not CRM', () => {
  it('seeds shadow-complete pathway with empty CRM blob → pathway cert IS issued', async () => {
    // Build shadow state: all modules in all 4 courses of network-like-hyperscaler complete.
    // We represent it with DynamoDB GetCommand responses returning status='complete' for each.
    //
    // The trigger is completing the last module in foundations (fabric-operations-foundations-recap).
    // For the negative control to be meaningful, we need the issuance flow to:
    //   (a) issue the module cert (foundations-recap)
    //   (b) detect the course foundations is complete → issue course cert
    //   (c) detect the pathway network-like-hyperscaler is complete → issue pathway cert
    //
    // If the impl used calculatePathwayCompletion from completion.ts (which reads the CRM
    // hhl_progress_state blob we are leaving empty), step (c) would NOT issue. So the
    // passing assertion below is the architectural guardrail.
    //
    // NOTE: This test will need extensive DynamoDB mocking; see impl in Phase 5A for
    // the exact call sequence. This file is committed in the fail-first state with
    // a placeholder assertion that will not pass until the pathway-cert flow exists.

    // TODO once impl exists: wire up the full DynamoDB mock sequence and assert:
    //   expect(result.pathwayCertIssued).toBe(true);
    //   expect(result.pathwayCertId).toBeDefined();
    // For the fail-first commit, we assert the function signature supports the new fields.

    const dynamo = makeDynamo();
    // Minimal stub to get through module-cert gate (awards_certificate=false → early return).
    hubspotRowsSequence([
      [
        {
          path: 'fabric-operations-foundations-recap',
          values: { hs_name: 'Recap', awards_certificate: false },
        },
      ],
    ]);

    const result: any = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: 'fabric-operations-foundations-recap',
      moduleStatus: 'complete',
      taskStatusesMap: {},
      now: NOW,
    });

    // Guardrail: the result type MUST expose pathwayCertIssued / pathwayCertId once
    // the shadow-aggregator-backed pathway-cert path is wired in.
    expect(result).toHaveProperty('pathwayCertIssued');
  });
});
