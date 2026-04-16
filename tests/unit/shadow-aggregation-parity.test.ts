/**
 * Parity regression — architecture-mandated by Phase 2 and Phase 3 §7.3.
 * Issue #451, Phase 5A. Test plan §2.8.
 *
 * Exercises the BACKEND RESPONSE SHAPE as consumed by the dashboard and
 * course-detail surfaces — not helper internals.
 *
 * The My Learning dashboard is specified to fetch GET /shadow/pathway/status
 * for each enrolled pathway and render the per-course rollups.
 * The course detail page is specified to fetch GET /shadow/course/status
 * for the visible course.
 * Against the same DynamoDB state, both surfaces must agree on
 *   - modules_completed
 *   - modules_total
 *   - course_status
 * for the same course.
 *
 * This test simulates a dashboard fetch-and-render pipeline:
 *   1. Seed a shared DynamoDB state for one learner (half of foundations
 *      complete, other pathway courses untouched).
 *   2. Invoke handleShadowPathwayStatus to produce the JSON payload the
 *      dashboard would consume; parse its response body.
 *   3. Invoke handleShadowCourseStatus for the same course; parse its body.
 *   4. Locate the matching per-course entry in the pathway response.
 *   5. Assert that the three fields match exactly.
 *
 * If the dashboard's rollup ever drifts from the course-detail surface,
 * this test fails — at the wire-contract level, not the helper-call level.
 */

import { handleShadowCourseStatus } from '../../src/api/lambda/shadow-course-status';
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

const AUTH_RESULT = { userId: 'parity-user', email: 'parity@example.com', decoded: {} as any };
const COURSE_SLUG = 'network-like-hyperscaler-foundations';
const PATHWAY_SLUG = 'network-like-hyperscaler';

const ENTITY_COMPLETIONS_TABLE = 'entity-completions-shadow';
const CERTS_TABLE = 'certificates-shadow';

const ALL_MODULES = [
  // foundations (2 complete, 2 not-started per shared state)
  'fabric-operations-welcome',
  'fabric-operations-how-it-works',
  'fabric-operations-mastering-interfaces',
  'fabric-operations-foundations-recap',
  // provisioning
  'fabric-operations-vpc-provisioning',
  'fabric-operations-vpc-attachments',
  'fabric-operations-connectivity-validation',
  'fabric-operations-decommission-cleanup',
  // observability
  'fabric-operations-telemetry-overview',
  'fabric-operations-dashboard-interpretation',
  'fabric-operations-events-status',
  'fabric-operations-pre-support-diagnostics',
  // troubleshooting
  'fabric-operations-troubleshooting-framework',
  'fabric-operations-diagnosis-lab',
  'fabric-operations-rollback-recovery',
  'fabric-operations-post-incident-review',
];

// Shared state: exactly two foundations modules complete; no other shadow state.
const COMPLETED_SKS = new Set([
  'COMPLETION#MODULE#fabric-operations-welcome',
  'COMPLETION#MODULE#fabric-operations-how-it-works',
]);

function buildHubspotMock() {
  const modulesRows = ALL_MODULES.map((slug) => ({
    path: slug,
    name: slug,
    values: {
      hs_name: slug,
      completion_tasks_json: JSON.stringify([
        { task_slug: 'quiz-1', task_type: 'quiz', required: true },
      ]),
    },
  }));
  return {
    cms: {
      hubdb: {
        rowsApi: {
          getTableRows: jest.fn().mockResolvedValue({ results: modulesRows }),
        },
      },
    },
  } as any;
}

function buildDynamoImpl() {
  return (cmd: any) => {
    const tag = cmd?._tag;
    const input = cmd?.input;
    if (tag === 'BatchGetCommand') {
      const req = input.RequestItems || {};
      const resp: any = { Responses: {} };
      for (const [table, spec] of Object.entries(req)) {
        const keys = (spec as any).Keys as Array<{ PK: string; SK: string }>;
        if (table === ENTITY_COMPLETIONS_TABLE) {
          resp.Responses[table] = keys
            .filter((k) => COMPLETED_SKS.has(k.SK))
            .map((k) => ({ PK: k.PK, SK: k.SK, status: 'complete', task_statuses: {} }));
        } else if (table === CERTS_TABLE) {
          // No certs yet
          resp.Responses[table] = [];
        } else {
          resp.Responses[table] = [];
        }
      }
      return Promise.resolve(resp);
    }
    return Promise.resolve({});
  };
}

function makeEvent(qs: Record<string, string>) {
  return { headers: { origin: 'https://hedgehog.cloud' }, cookies: [], queryStringParameters: qs };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.APP_STAGE = 'shadow';
  process.env.ENTITY_COMPLETIONS_TABLE = ENTITY_COMPLETIONS_TABLE;
  process.env.CERTIFICATES_TABLE = CERTS_TABLE;
  process.env.HUBDB_MODULES_TABLE_ID = 'modules-table';
  mockVerifyCookieAuth.mockResolvedValue(AUTH_RESULT);
  mockGetHubSpotClient.mockImplementation(() => buildHubspotMock());
  mockDynamoSend.mockImplementation(buildDynamoImpl());
});

afterEach(() => {
  delete process.env.APP_STAGE;
  delete process.env.ENTITY_COMPLETIONS_TABLE;
  delete process.env.CERTIFICATES_TABLE;
  delete process.env.HUBDB_MODULES_TABLE_ID;
});

describe('parity regression — dashboard surface agrees with course-detail surface', () => {
  it('pathway-status rollup for foundations matches course-status response (wire-contract level)', async () => {
    // Dashboard simulation: fetch pathway-status for the enrolled pathway.
    const pathwayResp = await handleShadowPathwayStatus(makeEvent({ pathway_slug: PATHWAY_SLUG }));
    expect(pathwayResp.statusCode).toBe(200);
    const pathwayBody = JSON.parse(pathwayResp.body);

    // Course-detail simulation: fetch course-status for the visible course.
    const courseResp = await handleShadowCourseStatus(makeEvent({ course_slug: COURSE_SLUG }));
    expect(courseResp.statusCode).toBe(200);
    const courseBody = JSON.parse(courseResp.body);

    // Locate the same course in the pathway response.
    const pathwayCourseEntry = pathwayBody.courses.find(
      (c: any) => c.course_slug === COURSE_SLUG
    );
    expect(pathwayCourseEntry).toBeDefined();

    // Parity — the three fields the dashboard renders from the pathway response
    // must equal the fields the course-detail surface renders directly.
    expect(pathwayCourseEntry.modules_completed).toBe(courseBody.modules_completed);
    expect(pathwayCourseEntry.modules_total).toBe(courseBody.modules_total);
    expect(pathwayCourseEntry.course_status).toBe(courseBody.course_status);

    // And the absolute values match the seeded shared state (2 of 4 complete).
    expect(courseBody.modules_completed).toBe(2);
    expect(courseBody.modules_total).toBe(4);
    expect(courseBody.course_status).toBe('in_progress');
  });

  it('empty state: all courses parity-aligned at zero', async () => {
    // Override Dynamo to return no completions at all.
    mockDynamoSend.mockImplementation((cmd: any) => {
      if (cmd?._tag === 'BatchGetCommand') {
        const req = cmd.input.RequestItems || {};
        const resp: any = { Responses: {} };
        for (const table of Object.keys(req)) {
          resp.Responses[table] = [];
        }
        return Promise.resolve(resp);
      }
      return Promise.resolve({});
    });

    const pathwayResp = await handleShadowPathwayStatus(makeEvent({ pathway_slug: PATHWAY_SLUG }));
    const courseResp = await handleShadowCourseStatus(makeEvent({ course_slug: COURSE_SLUG }));
    const pathwayBody = JSON.parse(pathwayResp.body);
    const courseBody = JSON.parse(courseResp.body);

    const pathwayCourseEntry = pathwayBody.courses.find((c: any) => c.course_slug === COURSE_SLUG);
    expect(pathwayCourseEntry.modules_completed).toBe(courseBody.modules_completed);
    expect(pathwayCourseEntry.modules_total).toBe(courseBody.modules_total);
    expect(pathwayCourseEntry.course_status).toBe(courseBody.course_status);
    expect(pathwayCourseEntry.modules_completed).toBe(0);
    expect(pathwayCourseEntry.course_status).toBe('not_started');
  });

  it('all complete state: parity holds at full completion', async () => {
    mockDynamoSend.mockImplementation((cmd: any) => {
      if (cmd?._tag === 'BatchGetCommand') {
        const req = cmd.input.RequestItems || {};
        const resp: any = { Responses: {} };
        for (const [table, spec] of Object.entries(req)) {
          const keys = (spec as any).Keys as Array<{ PK: string; SK: string }>;
          if (table === ENTITY_COMPLETIONS_TABLE) {
            resp.Responses[table] = keys.map((k) => ({
              PK: k.PK,
              SK: k.SK,
              status: 'complete',
              task_statuses: {},
            }));
          } else {
            resp.Responses[table] = [];
          }
        }
        return Promise.resolve(resp);
      }
      return Promise.resolve({});
    });

    const pathwayResp = await handleShadowPathwayStatus(makeEvent({ pathway_slug: PATHWAY_SLUG }));
    const courseResp = await handleShadowCourseStatus(makeEvent({ course_slug: COURSE_SLUG }));
    const pathwayBody = JSON.parse(pathwayResp.body);
    const courseBody = JSON.parse(courseResp.body);

    const pathwayCourseEntry = pathwayBody.courses.find((c: any) => c.course_slug === COURSE_SLUG);
    expect(pathwayCourseEntry.modules_completed).toBe(courseBody.modules_completed);
    expect(pathwayCourseEntry.modules_total).toBe(courseBody.modules_total);
    expect(pathwayCourseEntry.course_status).toBe(courseBody.course_status);
    expect(courseBody.course_status).toBe('complete');
    expect(pathwayBody.pathway_status).toBe('complete');
  });
});
