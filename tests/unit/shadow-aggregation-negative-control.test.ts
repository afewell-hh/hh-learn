/**
 * Negative control — architecture-mandated by Phase 2 revision and Phase 3 §7.4.
 * Issue #451, Phase 5A. Test plan §2.7.
 *
 * Encodes two non-negotiables:
 *
 *   1. BEHAVIORAL — The shadow pathway-certificate path must use the shadow
 *      aggregator (reads entity-completions-shadow DynamoDB), not
 *      calculatePathwayCompletion from completion.ts (reads the CRM
 *      hhl_progress_state blob). Proof pattern:
 *        - Seed DynamoDB with every module in every course of the
 *          network-like-hyperscaler pathway marked status='complete'.
 *        - Leave CRM state empty (shadow write path doesn't even read it;
 *          the test explicitly never mocks any CRM fetch).
 *        - Run issueCertificateIfComplete with moduleStatus='complete' on
 *          the last module.
 *        - Assert pathwayCertIssued === true AND pathwayCertId is populated.
 *        - If a future refactor swapped in calculatePathwayCompletion
 *          against the CRM blob, the CRM would report incomplete (empty
 *          blob) and the cert would not issue; this test would fail.
 *
 *   2. STATIC — certificate-issuance.ts imports from ./shadow-aggregation
 *      and does NOT import or call calculatePathwayCompletion or
 *      calculateCourseCompletion from ./completion. Byte-level guarantee
 *      against import-graph regression.
 */

import * as fs from 'fs';
import * as path from 'path';

import { issueCertificateIfComplete } from '../../src/api/lambda/certificate-issuance';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('crypto', () => ({
  randomUUID: jest
    .fn()
    .mockReturnValueOnce('mod-uuid-000000000-4000-a000-000000000001')
    .mockReturnValueOnce('course-uuid-00000-4000-a000-000000000002')
    .mockReturnValueOnce('pathway-uuid-0000-4000-a000-000000000003'),
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

// ---------------------------------------------------------------------------
// Fixtures: real content layout for network-like-hyperscaler pathway.
// If the content files on disk change, update these constants to match.
// ---------------------------------------------------------------------------

const PATHWAY_SLUG = 'network-like-hyperscaler';
const COURSE_SLUGS = [
  'network-like-hyperscaler-foundations',
  'network-like-hyperscaler-provisioning',
  'network-like-hyperscaler-observability',
  'network-like-hyperscaler-troubleshooting',
];

const COURSE_MODULES: Record<string, string[]> = {
  'network-like-hyperscaler-foundations': [
    'fabric-operations-welcome',
    'fabric-operations-how-it-works',
    'fabric-operations-mastering-interfaces',
    'fabric-operations-foundations-recap',
  ],
  'network-like-hyperscaler-provisioning': [
    'fabric-operations-vpc-provisioning',
    'fabric-operations-vpc-attachments',
    'fabric-operations-connectivity-validation',
    'fabric-operations-decommission-cleanup',
  ],
  'network-like-hyperscaler-observability': [
    'fabric-operations-telemetry-overview',
    'fabric-operations-dashboard-interpretation',
    'fabric-operations-events-status',
    'fabric-operations-pre-support-diagnostics',
  ],
  'network-like-hyperscaler-troubleshooting': [
    'fabric-operations-troubleshooting-framework',
    'fabric-operations-diagnosis-lab',
    'fabric-operations-rollback-recovery',
    'fabric-operations-post-incident-review',
  ],
};

const ALL_MODULES = Object.values(COURSE_MODULES).flat();
// The triggering module: the last one completed triggers the full cascade.
const TRIGGER_MODULE = 'fabric-operations-post-incident-review';
const TRIGGER_COURSE = 'network-like-hyperscaler-troubleshooting';

const USER_ID = 'neg-control-user';
const NOW = '2026-04-14T00:00:00.000Z';
const CERTS_TABLE = 'certificates-shadow';
const ENTITY_COMPLETIONS_TABLE = 'entity-completions-shadow';
const MODULES_TABLE_ID = 'hubdb-modules';
const COURSES_TABLE_ID = 'hubdb-courses';
const PATHWAYS_TABLE_ID = 'hubdb-pathways';

// ---------------------------------------------------------------------------
// HubSpot mock — table-aware dispatch by table id
// ---------------------------------------------------------------------------

function buildHubspotMock() {
  const modulesRows = ALL_MODULES.map((slug) => ({
    path: slug,
    name: slug,
    values: {
      hs_name: slug,
      awards_certificate: true,
      completion_tasks_json: JSON.stringify([
        { task_slug: 'quiz-1', task_type: 'quiz', required: true },
      ]),
    },
  }));

  const coursesRows = COURSE_SLUGS.map((slug) => ({
    path: slug,
    name: slug,
    values: {
      hs_name: slug,
      awards_certificate: true,
      module_slugs_json: JSON.stringify(COURSE_MODULES[slug]),
    },
  }));

  const pathwayRow = {
    path: PATHWAY_SLUG,
    name: 'Network Like a Hyperscaler',
    values: {
      hs_name: 'Network Like a Hyperscaler',
      awards_certificate: true,
      course_slugs_json: JSON.stringify(COURSE_SLUGS),
    },
  };

  return {
    cms: {
      hubdb: {
        rowsApi: {
          getTableRows: jest.fn().mockImplementation((tableId: string) => {
            if (tableId === MODULES_TABLE_ID) return Promise.resolve({ results: modulesRows });
            if (tableId === COURSES_TABLE_ID) return Promise.resolve({ results: coursesRows });
            if (tableId === PATHWAYS_TABLE_ID) return Promise.resolve({ results: [pathwayRow] });
            return Promise.resolve({ results: [] });
          }),
        },
      },
    },
  } as any;
}

// ---------------------------------------------------------------------------
// DynamoDB mock — command-type + input-aware dispatch
// Tracks PutCommand captures so the test can assert the pathway cert row.
// ---------------------------------------------------------------------------

interface DynamoMockState {
  existingCerts: Map<string, { certId: string }>; // SK → {certId}
  puts: any[];
}

function buildDynamoImpl(state: DynamoMockState) {
  return (cmd: any) => {
    const tag = cmd?._tag;
    const input = cmd?.input;

    if (tag === 'GetCommand') {
      const table = input.TableName;
      const sk = input.Key?.SK as string | undefined;
      if (table === CERTS_TABLE && sk) {
        const existing = state.existingCerts.get(sk);
        return Promise.resolve({ Item: existing ? { certId: existing.certId } : undefined });
      }
      if (table === ENTITY_COMPLETIONS_TABLE) {
        // Per-module GetCommand (checkAndIssueCourseCompletion path) — every module complete
        return Promise.resolve({ Item: { status: 'complete' } });
      }
      return Promise.resolve({ Item: undefined });
    }

    if (tag === 'PutCommand') {
      state.puts.push(input);
      // Simulate successful conditional put
      return Promise.resolve({});
    }

    if (tag === 'BatchGetCommand') {
      // Shadow aggregator: BatchGetCommand on entity-completions OR on certificates.
      const req = input.RequestItems || {};
      const resp: any = { Responses: {} };
      for (const [table, spec] of Object.entries(req)) {
        const keys = (spec as any).Keys as Array<{ PK: string; SK: string }>;
        if (table === ENTITY_COMPLETIONS_TABLE) {
          // All modules complete
          resp.Responses[table] = keys.map((k) => ({
            PK: k.PK,
            SK: k.SK,
            status: 'complete',
            task_statuses: {},
          }));
        } else if (table === CERTS_TABLE) {
          // Reflect any certs already in state (module/course already issued)
          resp.Responses[table] = [];
          for (const k of keys) {
            const existing = state.existingCerts.get(k.SK);
            if (existing) {
              resp.Responses[table].push({ PK: k.PK, SK: k.SK, certId: existing.certId });
            }
          }
        } else {
          resp.Responses[table] = [];
        }
      }
      return Promise.resolve(resp);
    }

    return Promise.resolve({});
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.APP_STAGE = 'shadow';
  process.env.CERTIFICATES_TABLE = CERTS_TABLE;
  process.env.ENTITY_COMPLETIONS_TABLE = ENTITY_COMPLETIONS_TABLE;
  process.env.HUBDB_MODULES_TABLE_ID = MODULES_TABLE_ID;
  process.env.HUBDB_COURSES_TABLE_ID = COURSES_TABLE_ID;
  process.env.HUBDB_PATHWAYS_TABLE_ID = PATHWAYS_TABLE_ID;
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
// 1. Static import-graph assertion
// ---------------------------------------------------------------------------

describe('negative control — import graph', () => {
  it('certificate-issuance.ts imports from ./shadow-aggregation', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/api/lambda/certificate-issuance.ts'),
      'utf-8'
    );
    expect(src).toMatch(/from ['"]\.\/shadow-aggregation(\.js)?['"]/);
  });

  it('certificate-issuance.ts does NOT import calculatePathwayCompletion or calculateCourseCompletion', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/api/lambda/certificate-issuance.ts'),
      'utf-8'
    );
    // Strip comments before scanning to avoid false positives on documentation prose.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

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
  it('shadow-complete pathway + empty CRM blob → pathway cert IS issued', async () => {
    const dynamo = makeDynamo();

    // CRM state: explicitly NOT mocked. If the code path tried to read
    // hhl_progress_state (e.g., via calculatePathwayCompletion), it would
    // either fail or return incomplete. We never provide any crm.contacts
    // fetch in the HubSpot mock — any such call would throw.

    // HubSpot: HubDB tables only.
    mockGetHubSpotClient.mockImplementation(() => buildHubspotMock());

    // DynamoDB state:
    //   - module cert (CERT#module#<trigger>)  → not yet issued (will be issued now)
    //   - course cert (CERT#course#<trigger-course>) → not yet issued (will be issued now)
    //   - pathway cert (CERT#pathway#<pathway>) → not yet issued (will be issued now)
    //   - every module in every course: entity-completion status='complete'
    const state: DynamoMockState = { existingCerts: new Map(), puts: [] };
    mockDynamoSend.mockImplementation(buildDynamoImpl(state));

    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: TRIGGER_MODULE,
      moduleStatus: 'complete',
      taskStatusesMap: { 'quiz-1': 'passed' },
      now: NOW,
    });

    // --- Primary assertions (the architectural guarantee) -----------------
    expect(result.pathwayCertIssued).toBe(true);
    expect(result.pathwayCertId).toBeDefined();
    expect(typeof result.pathwayCertId).toBe('string');
    expect((result.pathwayCertId as string).length).toBeGreaterThan(0);

    // --- Secondary assertions: a CERT#pathway#<slug> row was actually written
    const pathwayPut = state.puts.find(
      (p) => p?.Item?.SK === `CERT#pathway#${PATHWAY_SLUG}` && p?.Item?.entityType === 'pathway'
    );
    expect(pathwayPut).toBeDefined();
    expect(pathwayPut.Item.learnerId).toBe(USER_ID);
    expect(pathwayPut.Item.entitySlug).toBe(PATHWAY_SLUG);
    // entityTitle was captured from the HubDB pathway row name
    expect(pathwayPut.Item.entityTitle).toBe('Network Like a Hyperscaler');
    // evidenceSummary was snapshotted from the shadow aggregator's course rollups
    expect(pathwayPut.Item.evidenceSummary).toBeDefined();
    expect(
      pathwayPut.Item.evidenceSummary[`course_${TRIGGER_COURSE}`]
    ).toBe('complete');

    // --- Tertiary assertion: module and course certs also issued as part of cascade
    expect(result.moduleCertIssued).toBe(true);
    expect(result.courseCertIssued).toBe(true);
  });

  it('shadow-INCOMPLETE pathway (one module missing) → pathway cert NOT issued', async () => {
    // Regression guard: if shadow aggregator fails open, this test fails.
    const dynamo = makeDynamo();
    mockGetHubSpotClient.mockImplementation(() => buildHubspotMock());

    const state: DynamoMockState = { existingCerts: new Map(), puts: [] };
    // Override the BatchGet branch so that ONE module in a non-trigger course
    // is missing a complete record. Every other module is complete.
    const MISSING_MODULE = 'fabric-operations-vpc-provisioning';
    mockDynamoSend.mockImplementation((cmd: any) => {
      if (cmd?._tag === 'BatchGetCommand') {
        const req = cmd.input.RequestItems || {};
        const resp: any = { Responses: {} };
        for (const [table, spec] of Object.entries(req)) {
          const keys = (spec as any).Keys as Array<{ PK: string; SK: string }>;
          if (table === ENTITY_COMPLETIONS_TABLE) {
            resp.Responses[table] = keys
              .filter((k) => !k.SK.endsWith(`COMPLETION#MODULE#${MISSING_MODULE}`))
              .map((k) => ({ PK: k.PK, SK: k.SK, status: 'complete', task_statuses: {} }));
          } else {
            resp.Responses[table] = [];
          }
        }
        return Promise.resolve(resp);
      }
      return buildDynamoImpl(state)(cmd);
    });

    const result = await issueCertificateIfComplete({
      dynamo,
      userId: USER_ID,
      moduleSlug: TRIGGER_MODULE,
      moduleStatus: 'complete',
      taskStatusesMap: { 'quiz-1': 'passed' },
      now: NOW,
    });

    // Module and course certs may still issue for the triggering course
    // (which is fully complete). The architectural claim here is narrower:
    // the PATHWAY cert MUST NOT issue because the pathway is not fully complete.
    expect(result.pathwayCertIssued).toBe(false);
    expect(result.pathwayCertId).toBeUndefined();

    // And no CERT#pathway#<slug> PutCommand was ever made.
    const pathwayPut = state.puts.find(
      (p) => p?.Item?.SK === `CERT#pathway#${PATHWAY_SLUG}`
    );
    expect(pathwayPut).toBeUndefined();
  });
});
