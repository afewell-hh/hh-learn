/**
 * Parity regression — architecture-mandated by Phase 2 and Phase 3 §7.3.
 * Issue #451, Phase 5A. Test plan §2.8.
 *
 * Given a shared DynamoDB state fixture, the counts returned by
 * /shadow/course/status MUST match the counts returned by
 * /shadow/pathway/status for the same course. This is the explicit
 * regression guard against dashboard/detail-page drift.
 */

import { computeShadowCourseStatus, computeShadowPathwayStatus } from '../../src/api/lambda/shadow-aggregation';

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
  BatchGetCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'BatchGetCommand' })),
  GetCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'GetCommand' })),
}));

import { getHubSpotClient } from '../../src/shared/hubspot';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const mockGetHubSpotClient = getHubSpotClient as jest.MockedFunction<typeof getHubSpotClient>;

const USER_ID = 'parity-user';
const COURSE_SLUG = 'network-like-hyperscaler-foundations';
const PATHWAY_SLUG = 'network-like-hyperscaler';

const REQUIRED_QUIZ = { task_slug: 'quiz-1', task_type: 'quiz', required: true };

function moduleRow(slug: string, completionTasks: any[]) {
  return {
    path: slug,
    name: slug,
    values: {
      hs_name: slug,
      completion_tasks_json: JSON.stringify(completionTasks),
    },
  };
}

function hubspotWithModules(rows: any[]) {
  return {
    cms: {
      hubdb: {
        rowsApi: { getTableRows: jest.fn().mockResolvedValue({ results: rows }) },
      },
    },
  };
}

function makeDynamo(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from({} as any);
}

const ENTITY_COMPLETIONS_TABLE = 'hedgehog-learn-entity-completions-shadow';
const CERTS_TABLE = 'hedgehog-learn-certificates-shadow';

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ENTITY_COMPLETIONS_TABLE = ENTITY_COMPLETIONS_TABLE;
  process.env.CERTIFICATES_TABLE = CERTS_TABLE;
  process.env.HUBDB_MODULES_TABLE_ID = 'modules-table';
});

afterEach(() => {
  delete process.env.ENTITY_COMPLETIONS_TABLE;
  delete process.env.CERTIFICATES_TABLE;
  delete process.env.HUBDB_MODULES_TABLE_ID;
});

// Shared state fixture: 2 of 4 foundations modules complete.
const FOUNDATIONS_MODULES = [
  'fabric-operations-welcome',
  'fabric-operations-how-it-works',
  'fabric-operations-mastering-interfaces',
  'fabric-operations-foundations-recap',
];

function seedSharedState() {
  const moduleRows = FOUNDATIONS_MODULES.map((s) => moduleRow(s, [REQUIRED_QUIZ]));
  // HubSpot called once by course-status; potentially again by pathway-status
  mockGetHubSpotClient.mockReturnValue(hubspotWithModules(moduleRows) as any);
  // 2 of 4 complete
  const completedRecords = [
    {
      PK: `USER#${USER_ID}`,
      SK: 'COMPLETION#MODULE#fabric-operations-welcome',
      status: 'complete',
      task_statuses: {},
    },
    {
      PK: `USER#${USER_ID}`,
      SK: 'COMPLETION#MODULE#fabric-operations-how-it-works',
      status: 'complete',
      task_statuses: {},
    },
  ];
  // For course-status path: one BatchGet for completions + one BatchGet for certs
  // For pathway-status path: one or more BatchGets covering all courses' modules
  mockDynamoSend.mockImplementation((cmd: any) => {
    if (cmd._tag === 'BatchGetCommand') {
      const req = cmd.input.RequestItems;
      if (req[ENTITY_COMPLETIONS_TABLE]) {
        // Return the subset that matches requested keys
        const keys = req[ENTITY_COMPLETIONS_TABLE].Keys as any[];
        const matched = completedRecords.filter((r) =>
          keys.some((k) => k.PK === r.PK && k.SK === r.SK)
        );
        return Promise.resolve({ Responses: { [ENTITY_COMPLETIONS_TABLE]: matched } });
      }
      if (req[CERTS_TABLE]) {
        return Promise.resolve({ Responses: { [CERTS_TABLE]: [] } });
      }
    }
    return Promise.resolve({});
  });
}

describe('parity regression — course-status and pathway-status agree', () => {
  it('foundations course counts match between /shadow/course/status and the foundations entry in /shadow/pathway/status', async () => {
    seedSharedState();
    const courseResult = await computeShadowCourseStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      courseSlug: COURSE_SLUG,
    });

    // Reset + reseed for the pathway call (different mock call budget)
    jest.clearAllMocks();
    seedSharedState();

    const pathwayResult = await computeShadowPathwayStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      pathwaySlug: PATHWAY_SLUG,
    });

    expect(courseResult).not.toBeNull();
    expect(pathwayResult).not.toBeNull();

    const foundationsEntry = pathwayResult!.courses.find((c) => c.course_slug === COURSE_SLUG);
    expect(foundationsEntry).toBeDefined();

    expect(foundationsEntry!.modules_completed).toBe(courseResult!.modules_completed);
    expect(foundationsEntry!.modules_total).toBe(courseResult!.modules_total);
    expect(foundationsEntry!.course_status).toBe(courseResult!.course_status);
  });
});
