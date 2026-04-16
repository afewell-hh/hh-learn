/**
 * Unit tests for the shadow aggregation helper (Issue #451, Phase 5A).
 *
 * Targets src/api/lambda/shadow-aggregation.ts:
 *   - classifyModule (pure)
 *   - computeShadowCourseStatus
 *   - computeShadowPathwayStatus
 *
 * The helper operates natively on shadow DynamoDB records and encodes the
 * task-bearing-denominator policy per Phase 3 spec §2, §3.4 and Phase 4 plan §2.1.
 * It MUST NOT reuse calculateCourseCompletion/calculatePathwayCompletion from
 * completion.ts — that file is a CRM-progress aggregator with a different
 * input shape and different denominator policy.
 */

import {
  classifyModule,
  computeShadowCourseStatus,
  computeShadowPathwayStatus,
} from '../../src/api/lambda/shadow-aggregation';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
  QueryCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'QueryCommand' })),
}));

import { getHubSpotClient } from '../../src/shared/hubspot';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const mockGetHubSpotClient = getHubSpotClient as jest.MockedFunction<typeof getHubSpotClient>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'test-user-sub-123';
const COURSE_SLUG = 'network-like-hyperscaler-foundations';
const PATHWAY_SLUG = 'network-like-hyperscaler';

const ENTITY_COMPLETIONS_TABLE = 'hedgehog-learn-entity-completions-shadow';
const CERTS_TABLE = 'hedgehog-learn-certificates-shadow';

function makeDynamo(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from({} as any);
}

// A HubSpot client mock that returns a given modules-table payload
function hubspotWithModules(modulesRows: any[]) {
  return {
    cms: {
      hubdb: {
        rowsApi: {
          getTableRows: jest.fn().mockResolvedValue({ results: modulesRows }),
        },
      },
    },
  };
}

const REQUIRED_QUIZ = { task_slug: 'quiz-1', task_type: 'quiz', required: true };
const REQUIRED_LAB = { task_slug: 'lab-main', task_type: 'lab_attestation', required: true };
const KNOWLEDGE_CHECK = { task_slug: 'kc-1', task_type: 'knowledge_check', required: false };
const OPT_OUT_QUIZ = { task_slug: 'quiz-optional', task_type: 'quiz', required: false };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ENTITY_COMPLETIONS_TABLE = ENTITY_COMPLETIONS_TABLE;
  process.env.CERTIFICATES_TABLE = CERTS_TABLE;
  process.env.HUBDB_MODULES_TABLE_ID = 'test-modules-table';
  process.env.HUBDB_COURSES_TABLE_ID = 'test-courses-table';
  process.env.HUBDB_PATHWAYS_TABLE_ID = 'test-pathways-table';
});

afterEach(() => {
  delete process.env.ENTITY_COMPLETIONS_TABLE;
  delete process.env.CERTIFICATES_TABLE;
  delete process.env.HUBDB_MODULES_TABLE_ID;
  delete process.env.HUBDB_COURSES_TABLE_ID;
  delete process.env.HUBDB_PATHWAYS_TABLE_ID;
});

// ---------------------------------------------------------------------------
// classifyModule — pure function (Phase 4 §2.1.1–2.1.8)
// ---------------------------------------------------------------------------

describe('classifyModule', () => {
  it('returns no_tasks / has_required_tasks=false when completionTasks is empty', () => {
    const result = classifyModule(undefined, []);
    expect(result.module_status).toBe('no_tasks');
    expect(result.has_required_tasks).toBe(false);
  });

  it('returns no_tasks when only knowledge_check tasks are declared', () => {
    const result = classifyModule(undefined, [KNOWLEDGE_CHECK]);
    expect(result.module_status).toBe('no_tasks');
    expect(result.has_required_tasks).toBe(false);
  });

  it('returns no_tasks when only required:false quiz is declared', () => {
    const result = classifyModule(undefined, [OPT_OUT_QUIZ]);
    expect(result.module_status).toBe('no_tasks');
    expect(result.has_required_tasks).toBe(false);
  });

  it('returns not_started when module has required task but no record', () => {
    const result = classifyModule(undefined, [REQUIRED_QUIZ]);
    expect(result.module_status).toBe('not_started');
    expect(result.has_required_tasks).toBe(true);
  });

  it('returns in_progress when record status is in_progress', () => {
    const result = classifyModule({ status: 'in_progress' }, [REQUIRED_QUIZ]);
    expect(result.module_status).toBe('in_progress');
    expect(result.has_required_tasks).toBe(true);
  });

  it('returns complete when record status is complete', () => {
    const result = classifyModule({ status: 'complete' }, [REQUIRED_QUIZ, REQUIRED_LAB]);
    expect(result.module_status).toBe('complete');
    expect(result.has_required_tasks).toBe(true);
  });

  it('treats mixed quiz+knowledge_check as task-bearing (quiz is required)', () => {
    const result = classifyModule({ status: 'complete' }, [REQUIRED_QUIZ, KNOWLEDGE_CHECK]);
    expect(result.has_required_tasks).toBe(true);
    expect(result.module_status).toBe('complete');
  });

  it('safely defaults unknown record status to not_started', () => {
    const result = classifyModule({ status: 'weird' as any }, [REQUIRED_QUIZ]);
    expect(result.module_status).toBe('not_started');
  });
});

// ---------------------------------------------------------------------------
// computeShadowCourseStatus (Phase 4 §2.1.9–2.1.17)
// ---------------------------------------------------------------------------

describe('computeShadowCourseStatus', () => {
  function modulesRowFor(slug: string, completionTasks: any[], title?: string) {
    return {
      path: slug,
      name: title ?? slug,
      values: {
        hs_name: title ?? slug,
        completion_tasks_json: JSON.stringify(completionTasks),
      },
    };
  }

  function setupHubSpotForCourse(rows: any[]) {
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules(rows) as any);
  }

  it('returns not_started with zero counts when no DynamoDB records exist', async () => {
    setupHubSpotForCourse([
      modulesRowFor('fabric-operations-welcome', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-how-it-works', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-mastering-interfaces', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-foundations-recap', [REQUIRED_QUIZ]),
    ]);
    mockDynamoSend.mockResolvedValueOnce({ Responses: { [ENTITY_COMPLETIONS_TABLE]: [] } });

    const result = await computeShadowCourseStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      courseSlug: COURSE_SLUG,
    });

    expect(result).not.toBeNull();
    expect(result!.course_status).toBe('not_started');
    expect(result!.modules_completed).toBe(0);
    expect(result!.modules_total).toBe(4);
    expect(result!.modules).toHaveLength(4);
  });

  it('returns in_progress with partial completion', async () => {
    setupHubSpotForCourse([
      modulesRowFor('fabric-operations-welcome', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-how-it-works', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-mastering-interfaces', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-foundations-recap', [REQUIRED_QUIZ]),
    ]);
    mockDynamoSend.mockResolvedValueOnce({
      Responses: {
        [ENTITY_COMPLETIONS_TABLE]: [
          { PK: `USER#${USER_ID}`, SK: 'COMPLETION#MODULE#fabric-operations-welcome', status: 'complete', task_statuses: {} },
          { PK: `USER#${USER_ID}`, SK: 'COMPLETION#MODULE#fabric-operations-how-it-works', status: 'in_progress', task_statuses: {} },
        ],
      },
    });
    // No cert lookup
    mockDynamoSend.mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await computeShadowCourseStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      courseSlug: COURSE_SLUG,
    });

    expect(result!.course_status).toBe('in_progress');
    expect(result!.modules_completed).toBe(1);
    expect(result!.modules_total).toBe(4);
  });

  it('returns complete when all task-bearing modules are complete', async () => {
    setupHubSpotForCourse([
      modulesRowFor('fabric-operations-welcome', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-how-it-works', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-mastering-interfaces', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-foundations-recap', [REQUIRED_QUIZ]),
    ]);
    const completeRecords = [
      'fabric-operations-welcome',
      'fabric-operations-how-it-works',
      'fabric-operations-mastering-interfaces',
      'fabric-operations-foundations-recap',
    ].map((s) => ({
      PK: `USER#${USER_ID}`,
      SK: `COMPLETION#MODULE#${s}`,
      status: 'complete',
      task_statuses: {},
    }));
    mockDynamoSend
      .mockResolvedValueOnce({ Responses: { [ENTITY_COMPLETIONS_TABLE]: completeRecords } })
      .mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await computeShadowCourseStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      courseSlug: COURSE_SLUG,
    });

    expect(result!.course_status).toBe('complete');
    expect(result!.modules_completed).toBe(4);
    expect(result!.modules_total).toBe(4);
  });

  it('excludes no-task module from denominator while still returning it in modules[]', async () => {
    setupHubSpotForCourse([
      modulesRowFor('fabric-operations-welcome', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-how-it-works', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-mastering-interfaces', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-foundations-recap', []), // no tasks
    ]);
    mockDynamoSend
      .mockResolvedValueOnce({
        Responses: {
          [ENTITY_COMPLETIONS_TABLE]: [
            { PK: `USER#${USER_ID}`, SK: 'COMPLETION#MODULE#fabric-operations-welcome', status: 'complete', task_statuses: {} },
            { PK: `USER#${USER_ID}`, SK: 'COMPLETION#MODULE#fabric-operations-how-it-works', status: 'complete', task_statuses: {} },
            { PK: `USER#${USER_ID}`, SK: 'COMPLETION#MODULE#fabric-operations-mastering-interfaces', status: 'complete', task_statuses: {} },
          ],
        },
      })
      .mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await computeShadowCourseStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      courseSlug: COURSE_SLUG,
    });

    expect(result!.modules_total).toBe(3);
    expect(result!.modules_completed).toBe(3);
    expect(result!.course_status).toBe('complete');
    expect(result!.modules).toHaveLength(4);
    const recap = result!.modules.find((m) => m.module_slug === 'fabric-operations-foundations-recap')!;
    expect(recap.module_status).toBe('no_tasks');
    expect(recap.has_required_tasks).toBe(false);
  });

  it('populates course_cert_id when cert exists', async () => {
    setupHubSpotForCourse([
      modulesRowFor('fabric-operations-welcome', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-how-it-works', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-mastering-interfaces', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-foundations-recap', [REQUIRED_QUIZ]),
    ]);
    const completeRecords = [
      'fabric-operations-welcome',
      'fabric-operations-how-it-works',
      'fabric-operations-mastering-interfaces',
      'fabric-operations-foundations-recap',
    ].map((s) => ({
      PK: `USER#${USER_ID}`,
      SK: `COMPLETION#MODULE#${s}`,
      status: 'complete',
      task_statuses: {},
    }));
    mockDynamoSend
      .mockResolvedValueOnce({ Responses: { [ENTITY_COMPLETIONS_TABLE]: completeRecords } })
      .mockResolvedValueOnce({
        Responses: {
          [CERTS_TABLE]: [
            { PK: `USER#${USER_ID}`, SK: `CERT#course#${COURSE_SLUG}`, certId: 'abc-course-cert' },
          ],
        },
      });

    const result = await computeShadowCourseStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      courseSlug: COURSE_SLUG,
    });

    expect(result!.course_cert_id).toBe('abc-course-cert');
  });

  it('returns null when course slug is not in metadata cache', async () => {
    const result = await computeShadowCourseStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      courseSlug: 'nonexistent-course',
    });
    expect(result).toBeNull();
  });

  it('preserves module ordering from course metadata', async () => {
    setupHubSpotForCourse([
      modulesRowFor('fabric-operations-welcome', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-how-it-works', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-mastering-interfaces', [REQUIRED_QUIZ]),
      modulesRowFor('fabric-operations-foundations-recap', [REQUIRED_QUIZ]),
    ]);
    // Return DynamoDB records in reversed order — aggregator must still return metadata order
    mockDynamoSend
      .mockResolvedValueOnce({
        Responses: {
          [ENTITY_COMPLETIONS_TABLE]: [
            { PK: `USER#${USER_ID}`, SK: 'COMPLETION#MODULE#fabric-operations-foundations-recap', status: 'complete', task_statuses: {} },
            { PK: `USER#${USER_ID}`, SK: 'COMPLETION#MODULE#fabric-operations-welcome', status: 'complete', task_statuses: {} },
          ],
        },
      })
      .mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await computeShadowCourseStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      courseSlug: COURSE_SLUG,
    });

    expect(result!.modules.map((m) => m.module_slug)).toEqual([
      'fabric-operations-welcome',
      'fabric-operations-how-it-works',
      'fabric-operations-mastering-interfaces',
      'fabric-operations-foundations-recap',
    ]);
  });
});

// ---------------------------------------------------------------------------
// computeShadowPathwayStatus (Phase 4 §2.1.18–2.1.23)
// ---------------------------------------------------------------------------

describe('computeShadowPathwayStatus', () => {
  function setupHubSpotForPathway(moduleRows: any[]) {
    mockGetHubSpotClient.mockReturnValue(hubspotWithModules(moduleRows) as any);
  }

  // Build a module row for every module in all four real courses (required quiz each).
  const allModuleSlugs = [
    // foundations
    'fabric-operations-welcome',
    'fabric-operations-how-it-works',
    'fabric-operations-mastering-interfaces',
    'fabric-operations-foundations-recap',
    // the other three courses' modules are discovered from metadata
  ];

  function buildModulesRows(withReqQuiz: string[]): any[] {
    return withReqQuiz.map((slug) => ({
      path: slug,
      name: slug,
      values: {
        hs_name: slug,
        completion_tasks_json: JSON.stringify([REQUIRED_QUIZ]),
      },
    }));
  }

  it('returns not_started when no records exist for any course', async () => {
    // All modules task-bearing, no records
    setupHubSpotForPathway(buildModulesRows(allModuleSlugs));
    mockDynamoSend
      .mockResolvedValueOnce({ Responses: { [ENTITY_COMPLETIONS_TABLE]: [] } })
      .mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await computeShadowPathwayStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      pathwaySlug: PATHWAY_SLUG,
    });

    expect(result).not.toBeNull();
    expect(result!.pathway_status).toBe('not_started');
    expect(result!.courses_completed).toBe(0);
    expect(result!.courses_total).toBe(4); // network-like-hyperscaler has 4 courses
  });

  it('returns null when pathway slug is not in metadata cache', async () => {
    const result = await computeShadowPathwayStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      pathwaySlug: 'nonexistent-pathway',
    });
    expect(result).toBeNull();
  });

  it('per-course entries exclude modules[] key (payload bounded)', async () => {
    setupHubSpotForPathway(buildModulesRows(allModuleSlugs));
    mockDynamoSend
      .mockResolvedValueOnce({ Responses: { [ENTITY_COMPLETIONS_TABLE]: [] } })
      .mockResolvedValueOnce({ Responses: { [CERTS_TABLE]: [] } });

    const result = await computeShadowPathwayStatus({
      dynamo: makeDynamo(),
      userId: USER_ID,
      pathwaySlug: PATHWAY_SLUG,
    });

    for (const course of result!.courses) {
      expect((course as any).modules).toBeUndefined();
    }
  });
});
