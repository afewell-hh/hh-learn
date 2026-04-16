/**
 * Sensitive-handling tests for GET /shadow/module/progress answer-review.
 * Issue #451, Phase 5A. Spec §2.4, §7.6. Test plan §2.5.
 *
 * Non-negotiables this file enforces:
 *   - Correct answers are NEVER serialized in the response.
 *   - learner_identity is NEVER serialized in the response.
 *   - Schema drift degrades gracefully (deleted questions → schema_drift: true).
 *   - Lab attestation attempts never carry answer_review.
 *   - Ownership scoping: Query always uses PK=USER#<cookieUserId>.
 */

import { handleShadowModuleProgress } from '../../src/api/lambda/shadow-module-progress';

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
// QueryCommand acts as a constructor (the handler uses `new QueryCommand(...)`),
// and the captured `input` is later inspected in the ownership-scoping assertion.
const queryCommandInputs: any[] = [];
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: (...args: any[]) => mockDynamoSend(...args),
    }),
  },
  GetCommand: jest.fn().mockImplementation((input: any) => ({ input, _tag: 'GetCommand' })),
  QueryCommand: jest.fn().mockImplementation((input: any) => {
    queryCommandInputs.push(input);
    return { input, _tag: 'QueryCommand' };
  }),
}));

import { getHubSpotClient } from '../../src/shared/hubspot';
import { verifyCookieAuth } from '../../src/api/lambda/cognito-auth';

const mockGetHubSpotClient = getHubSpotClient as jest.MockedFunction<typeof getHubSpotClient>;
const mockVerifyCookieAuth = verifyCookieAuth as jest.MockedFunction<typeof verifyCookieAuth>;

const AUTH_RESULT = { userId: 'caller-user-id', email: 'caller@example.com', decoded: {} as any };
const OTHER_USER_ID = 'other-user-id';

const MODULE_SLUG = 'fabric-operations-welcome';
const REQUIRED_QUIZ = { task_slug: 'quiz-1', task_type: 'quiz', required: true };
const REQUIRED_LAB = { task_slug: 'lab-main', task_type: 'lab_attestation', required: true };

const CURRENT_SCHEMA = {
  quiz_id: 'welcome-quiz',
  passing_score: 75,
  questions: [
    { id: 'q1', question: 'Which command lists fabric switches?', correct_answer: 'kubectl get switch' },
    { id: 'q2', question: 'What is the fabric controller?', correct_answer: 'agent' },
  ],
};

// The known-correct-answer strings that MUST NEVER appear in serialized responses.
const KNOWN_CORRECT_ANSWERS = ['kubectl get switch', 'agent'];

function moduleRow(slug: string, completionTasks: any[], quizSchema?: any) {
  return {
    path: slug,
    name: slug,
    values: {
      hs_name: slug,
      completion_tasks_json: JSON.stringify(completionTasks),
      ...(quizSchema ? { quiz_schema_json: JSON.stringify(quizSchema) } : {}),
    },
  };
}

function hubspotWithModules(rows: any[]) {
  return {
    cms: { hubdb: { rowsApi: { getTableRows: jest.fn().mockResolvedValue({ results: rows }) } } },
  };
}

function makeEvent(qs: any = { module_slug: MODULE_SLUG }) {
  return { headers: { origin: 'https://hedgehog.cloud' }, cookies: [], queryStringParameters: qs };
}

beforeEach(() => {
  jest.clearAllMocks();
  queryCommandInputs.length = 0;
  process.env.APP_STAGE = 'shadow';
  process.env.TASK_RECORDS_TABLE = 'task-records';
  process.env.TASK_ATTEMPTS_TABLE = 'task-attempts';
  process.env.ENTITY_COMPLETIONS_TABLE = 'entity-completions';
  process.env.CERTIFICATES_TABLE = 'certificates';
  process.env.HUBDB_MODULES_TABLE_ID = 'modules-table';
  mockVerifyCookieAuth.mockResolvedValue(AUTH_RESULT);
});

afterEach(() => {
  delete process.env.APP_STAGE;
  delete process.env.TASK_RECORDS_TABLE;
  delete process.env.TASK_ATTEMPTS_TABLE;
  delete process.env.ENTITY_COMPLETIONS_TABLE;
  delete process.env.CERTIFICATES_TABLE;
  delete process.env.HUBDB_MODULES_TABLE_ID;
});

describe('answer-review — schema resolution', () => {
  it('full schema: correct answer submitted → is_correct=true', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [REQUIRED_QUIZ], CURRENT_SCHEMA)]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({
        Items: [
          {
            SK: `ATTEMPT#MODULE#${MODULE_SLUG}#quiz-1#2026-04-12T00:00:00.000Z`,
            task_type: 'quiz',
            attempted_at: '2026-04-12T00:00:00.000Z',
            score: 100,
            pass: true,
            answers: [
              { id: 'q1', value: 'kubectl get switch' },
              { id: 'q2', value: 'agent' },
            ],
            learner_identity: { userId: AUTH_RESULT.userId, email: AUTH_RESULT.email },
          },
        ],
      })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handleShadowModuleProgress(makeEvent());
    const body = JSON.parse(result.body);
    expect(body.attempts[0].answer_review).toHaveLength(2);
    expect(body.attempts[0].answer_review[0].is_correct).toBe(true);
    expect(body.attempts[0].answer_review[0].schema_drift).toBe(false);
    expect(body.attempts[0].answer_review[0].question_text).toBe('Which command lists fabric switches?');
  });

  it('incorrect answer → is_correct=false', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [REQUIRED_QUIZ], CURRENT_SCHEMA)]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({
        Items: [
          {
            SK: `ATTEMPT#MODULE#${MODULE_SLUG}#quiz-1#2026-04-12T00:00:00.000Z`,
            task_type: 'quiz',
            attempted_at: '2026-04-12T00:00:00.000Z',
            score: 0,
            pass: false,
            answers: [{ id: 'q1', value: 'kubectl get pods' }],
            learner_identity: { userId: AUTH_RESULT.userId, email: AUTH_RESULT.email },
          },
        ],
      })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handleShadowModuleProgress(makeEvent());
    const body = JSON.parse(result.body);
    expect(body.attempts[0].answer_review[0].is_correct).toBe(false);
    expect(body.attempts[0].answer_review[0].submitted_answer_text).toBe('kubectl get pods');
  });

  it('schema drift: deleted question → is_correct=null, question_text=null, schema_drift=true', async () => {
    const DRIFTED_SCHEMA = {
      quiz_id: 'welcome-quiz',
      passing_score: 75,
      questions: [{ id: 'q1', question: 'Which command lists fabric switches?', correct_answer: 'kubectl get switch' }],
      // q2 removed
    };
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [REQUIRED_QUIZ], DRIFTED_SCHEMA)]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({
        Items: [
          {
            SK: `ATTEMPT#MODULE#${MODULE_SLUG}#quiz-1#2026-04-12T00:00:00.000Z`,
            task_type: 'quiz',
            attempted_at: '2026-04-12T00:00:00.000Z',
            score: 50,
            pass: false,
            answers: [
              { id: 'q1', value: 'kubectl get switch' },
              { id: 'q2', value: 'old-answer' }, // question q2 no longer exists
            ],
            learner_identity: { userId: AUTH_RESULT.userId, email: AUTH_RESULT.email },
          },
        ],
      })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handleShadowModuleProgress(makeEvent());
    const body = JSON.parse(result.body);
    const review = body.attempts[0].answer_review;
    const drifted = review.find((r: any) => r.question_id === 'q2');
    expect(drifted).toBeDefined();
    expect(drifted.is_correct).toBeNull();
    expect(drifted.question_text).toBeNull();
    expect(drifted.schema_drift).toBe(true);
    expect(drifted.submitted_answer_text).toBe('old-answer');

    const resolved = review.find((r: any) => r.question_id === 'q1');
    expect(resolved.schema_drift).toBe(false);
    expect(resolved.is_correct).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NEVER-LEAK assertions (architectural safety contract)
// ---------------------------------------------------------------------------

describe('answer-review — never-leak assertions', () => {
  function runAndGetBody() {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [REQUIRED_QUIZ], CURRENT_SCHEMA)]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({
        Items: [
          {
            SK: `ATTEMPT#MODULE#${MODULE_SLUG}#quiz-1#2026-04-12T00:00:00.000Z`,
            task_type: 'quiz',
            attempted_at: '2026-04-12T00:00:00.000Z',
            score: 50,
            pass: false,
            answers: [{ id: 'q1', value: 'kubectl get pods' }], // wrong answer — correct stays in schema
            learner_identity: { userId: AUTH_RESULT.userId, email: AUTH_RESULT.email, extraPii: 'sensitive-bit' },
          },
        ],
      })
      .mockResolvedValueOnce({ Item: undefined });
    return handleShadowModuleProgress(makeEvent()).then((r: any) => r.body as string);
  }

  it('correct-answer text NEVER appears in serialized response (string search)', async () => {
    const body = await runAndGetBody();
    for (const correct of KNOWN_CORRECT_ANSWERS) {
      expect(body).not.toContain(correct);
    }
  });

  it('the key "correct_answer" NEVER appears in serialized response', async () => {
    const body = await runAndGetBody();
    expect(body).not.toMatch(/"correct_answer"/);
  });

  it('the key "learner_identity" NEVER appears in serialized response', async () => {
    const body = await runAndGetBody();
    expect(body).not.toMatch(/"learner_identity"/);
  });

  it('extraPii value from learner_identity NEVER appears in serialized response', async () => {
    const body = await runAndGetBody();
    expect(body).not.toContain('sensitive-bit');
  });

  it('lab attestation attempts carry NO answer_review key', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [REQUIRED_LAB])]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({
        Items: [
          {
            SK: `ATTEMPT#MODULE#${MODULE_SLUG}#lab-main#2026-04-12T00:00:00.000Z`,
            task_type: 'lab_attestation',
            attempted_at: '2026-04-12T00:00:00.000Z',
            attested_at: '2026-04-12T00:00:00.000Z',
            learner_identity: { userId: AUTH_RESULT.userId, email: AUTH_RESULT.email },
          },
        ],
      })
      .mockResolvedValueOnce({ Item: undefined });

    const result = await handleShadowModuleProgress(makeEvent());
    const body = JSON.parse(result.body);
    expect(body.attempts[0].outcome).toBe('attested');
    expect(body.attempts[0].answer_review).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Ownership scoping (no cross-learner leak)
// ---------------------------------------------------------------------------

describe('answer-review — ownership scoping', () => {
  it('Query uses PK=USER#<cookieUserId>; no query-param override is possible', async () => {
    mockGetHubSpotClient.mockReturnValue(
      hubspotWithModules([moduleRow(MODULE_SLUG, [REQUIRED_QUIZ], CURRENT_SCHEMA)]) as any
    );
    mockDynamoSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Items: [] })
      .mockResolvedValueOnce({ Item: undefined });

    // Attempt a forgery-style query param (userId/learner_id) — it must be ignored.
    await handleShadowModuleProgress(
      makeEvent({ module_slug: MODULE_SLUG, user_id: OTHER_USER_ID, learner_id: OTHER_USER_ID })
    );

    // Every QueryCommand must have its PK bound to the caller's userId
    expect(queryCommandInputs.length).toBeGreaterThan(0);
    for (const input of queryCommandInputs) {
      const pk = input.ExpressionAttributeValues?.[':pk'];
      expect(pk).toBe(`USER#${AUTH_RESULT.userId}`);
      expect(pk).not.toBe(`USER#${OTHER_USER_ID}`);
    }
  });
});
