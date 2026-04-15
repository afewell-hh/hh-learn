/**
 * Unit tests for POST /tasks/quiz/submit
 *
 * Tests cover:
 *   - gradeQuiz(): all-correct (pass), all-wrong (fail), partial score
 *   - computeModuleStatus(): not_started, in_progress, complete
 *   - handleQuizSubmit(): shadow guard (403), auth failure (401),
 *     validation failure (400), missing quiz schema (400)
 *
 * Fixtures derived from content/modules/fabric-operations-welcome/quiz.json
 * and content/modules/fabric-operations-diagnosis-lab/quiz.json.
 */

import { gradeQuiz, computeModuleStatus, handleQuizSubmit, QuizSchema, CompletionTask } from '../../src/api/lambda/tasks-quiz-submit';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../src/shared/hubspot', () => ({
  getHubSpotClient: jest.fn(),
}));

jest.mock('../../src/api/lambda/cognito-auth', () => ({
  verifyCookieAuth: jest.fn(),
}));

// Mock DynamoDB client — prevent real AWS calls in unit tests
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue({ Attributes: { attempt_count: 1 }, Items: [] }),
    }),
  },
  PutCommand: jest.fn().mockImplementation((input) => ({ input })),
  UpdateCommand: jest.fn().mockImplementation((input) => ({ input })),
  QueryCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

import { getHubSpotClient } from '../../src/shared/hubspot';
import { verifyCookieAuth } from '../../src/api/lambda/cognito-auth';

const mockGetHubSpotClient = getHubSpotClient as jest.MockedFunction<typeof getHubSpotClient>;
const mockVerifyCookieAuth = verifyCookieAuth as jest.MockedFunction<typeof verifyCookieAuth>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Mirrors content/modules/fabric-operations-welcome/quiz.json (3 questions, passing_score=75)
const WELCOME_QUIZ: QuizSchema = {
  quiz_id: 'quiz-1',
  passing_score: 75,
  questions: [
    { id: 'q1', correct_answer: 'b', points: 1 },
    { id: 'q2', correct_answer: 'b', points: 1 },
    { id: 'q3', correct_answer: 'b', points: 1 },
  ],
};

// Mirrors content/modules/fabric-operations-diagnosis-lab/quiz.json (4 questions, passing_score=75)
const DIAGNOSIS_QUIZ: QuizSchema = {
  quiz_id: 'quiz-1',
  passing_score: 75,
  questions: [
    { id: 'q1', correct_answer: 'b', points: 1 },
    { id: 'q2', correct_answer: 'b', points: 1 },
    { id: 'q3', correct_answer: 'c', points: 1 },
    { id: 'q4', correct_answer: 'b', points: 1 },
  ],
};

// Typical completion tasks for a module with quiz + lab
const QUIZ_AND_LAB_TASKS: CompletionTask[] = [
  { task_slug: 'quiz-1', task_type: 'quiz', graded: true, required: true },
  { task_slug: 'lab-main', task_type: 'lab_attestation', graded: false, required: true },
];

// ---------------------------------------------------------------------------
// gradeQuiz — pure function tests
// ---------------------------------------------------------------------------

describe('gradeQuiz', () => {
  describe('fabric-operations-welcome (3 questions, passing_score=75)', () => {
    it('all correct answers → score=100, pass=true', () => {
      const answers = [
        { id: 'q1', value: 'b' },
        { id: 'q2', value: 'b' },
        { id: 'q3', value: 'b' },
      ];
      const result = gradeQuiz(WELCOME_QUIZ, answers);
      expect(result.score).toBe(100);
      expect(result.pass).toBe(true);
    });

    it('all wrong answers → score=0, pass=false', () => {
      const answers = [
        { id: 'q1', value: 'a' },
        { id: 'q2', value: 'a' },
        { id: 'q3', value: 'a' },
      ];
      const result = gradeQuiz(WELCOME_QUIZ, answers);
      expect(result.score).toBe(0);
      expect(result.pass).toBe(false);
    });

    it('partial score: 2/3 correct → score=67, pass=false (below 75)', () => {
      const answers = [
        { id: 'q1', value: 'b' }, // correct
        { id: 'q2', value: 'b' }, // correct
        { id: 'q3', value: 'a' }, // wrong
      ];
      const result = gradeQuiz(WELCOME_QUIZ, answers);
      expect(result.score).toBe(67);
      expect(result.pass).toBe(false);
    });
  });

  describe('fabric-operations-diagnosis-lab (4 questions, passing_score=75)', () => {
    it('all correct (q1=b, q2=b, q3=c, q4=b) → score=100, pass=true', () => {
      const answers = [
        { id: 'q1', value: 'b' },
        { id: 'q2', value: 'b' },
        { id: 'q3', value: 'c' },
        { id: 'q4', value: 'b' },
      ];
      const result = gradeQuiz(DIAGNOSIS_QUIZ, answers);
      expect(result.score).toBe(100);
      expect(result.pass).toBe(true);
    });

    it('all wrong → score=0, pass=false', () => {
      const answers = [
        { id: 'q1', value: 'a' },
        { id: 'q2', value: 'a' },
        { id: 'q3', value: 'a' },
        { id: 'q4', value: 'a' },
      ];
      const result = gradeQuiz(DIAGNOSIS_QUIZ, answers);
      expect(result.score).toBe(0);
      expect(result.pass).toBe(false);
    });

    it('partial: 3/4 correct → score=75, pass=true (exactly at threshold)', () => {
      const answers = [
        { id: 'q1', value: 'b' }, // correct
        { id: 'q2', value: 'b' }, // correct
        { id: 'q3', value: 'c' }, // correct
        { id: 'q4', value: 'a' }, // wrong
      ];
      const result = gradeQuiz(DIAGNOSIS_QUIZ, answers);
      expect(result.score).toBe(75);
      expect(result.pass).toBe(true);
    });

    it('partial: 1/4 correct → score=25, pass=false', () => {
      const answers = [
        { id: 'q1', value: 'b' }, // correct
        { id: 'q2', value: 'a' }, // wrong
        { id: 'q3', value: 'a' }, // wrong
        { id: 'q4', value: 'a' }, // wrong
      ];
      const result = gradeQuiz(DIAGNOSIS_QUIZ, answers);
      expect(result.score).toBe(25);
      expect(result.pass).toBe(false);
    });
  });

  it('unanswered questions count as wrong', () => {
    const answers = [{ id: 'q1', value: 'b' }]; // only q1 answered
    const result = gradeQuiz(WELCOME_QUIZ, answers);
    expect(result.score).toBe(33); // 1/3 = 33.33 → rounds to 33
    expect(result.pass).toBe(false);
  });

  it('uses default passing_score of 75 when not specified', () => {
    const schema: QuizSchema = {
      quiz_id: 'quiz-test',
      questions: [
        { id: 'q1', correct_answer: 'a', points: 1 },
        { id: 'q2', correct_answer: 'a', points: 1 },
        { id: 'q3', correct_answer: 'a', points: 1 },
        { id: 'q4', correct_answer: 'a', points: 1 },
      ],
    };
    // 3/4 = 75 — should pass with default threshold
    const answers = [
      { id: 'q1', value: 'a' },
      { id: 'q2', value: 'a' },
      { id: 'q3', value: 'a' },
      { id: 'q4', value: 'b' }, // wrong
    ];
    const result = gradeQuiz(schema, answers);
    expect(result.score).toBe(75);
    expect(result.pass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeModuleStatus — pure function tests
// ---------------------------------------------------------------------------

describe('computeModuleStatus', () => {
  it('no task records → not_started', () => {
    expect(computeModuleStatus(QUIZ_AND_LAB_TASKS, {})).toBe('not_started');
  });

  it('quiz passed, lab not attested → in_progress', () => {
    expect(
      computeModuleStatus(QUIZ_AND_LAB_TASKS, { 'quiz-1': 'passed' })
    ).toBe('in_progress');
  });

  it('quiz failed, no lab → in_progress', () => {
    expect(
      computeModuleStatus(QUIZ_AND_LAB_TASKS, { 'quiz-1': 'failed' })
    ).toBe('in_progress');
  });

  it('quiz passed + lab attested → complete', () => {
    expect(
      computeModuleStatus(QUIZ_AND_LAB_TASKS, {
        'quiz-1': 'passed',
        'lab-main': 'attested',
      })
    ).toBe('complete');
  });

  it('quiz not passed + lab attested → in_progress (quiz still blocks)', () => {
    expect(
      computeModuleStatus(QUIZ_AND_LAB_TASKS, {
        'quiz-1': 'failed',
        'lab-main': 'attested',
      })
    ).toBe('in_progress');
  });

  it('no required tasks → complete when any task attempted', () => {
    const tasks: CompletionTask[] = [
      { task_slug: 'opt-check', task_type: 'knowledge_check', graded: false, required: false },
    ];
    expect(computeModuleStatus(tasks, { 'opt-check': 'completed' })).toBe('complete');
  });

  it('no required tasks, no records → not_started', () => {
    const tasks: CompletionTask[] = [
      { task_slug: 'opt-check', task_type: 'knowledge_check', graded: false, required: false },
    ];
    expect(computeModuleStatus(tasks, {})).toBe('not_started');
  });

  it('empty completionTasks list → not_started when no records', () => {
    expect(computeModuleStatus([], {})).toBe('not_started');
  });
});

// ---------------------------------------------------------------------------
// handleQuizSubmit — handler error path tests
// ---------------------------------------------------------------------------

describe('handleQuizSubmit', () => {
  const validBody = JSON.stringify({
    module_slug: 'fabric-operations-welcome',
    quiz_ref: 'quiz-1',
    answers: [
      { id: 'q1', value: 'b' },
      { id: 'q2', value: 'b' },
      { id: 'q3', value: 'b' },
    ],
  });

  const baseEvent = {
    headers: { 'content-type': 'application/json' },
    cookies: [],
    body: validBody,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset APP_STAGE
    delete process.env.APP_STAGE;
  });

  it('returns 403 when APP_STAGE !== shadow', async () => {
    process.env.APP_STAGE = 'dev';
    const result = await handleQuizSubmit(baseEvent);
    expect(result.statusCode).toBe(403);
  });

  it('returns 403 when APP_STAGE is undefined', async () => {
    delete process.env.APP_STAGE;
    const result = await handleQuizSubmit(baseEvent);
    expect(result.statusCode).toBe(403);
  });

  it('returns 401 when no valid cookie is present', async () => {
    process.env.APP_STAGE = 'shadow';
    mockVerifyCookieAuth.mockRejectedValueOnce(new Error('Missing hhl_access_token cookie'));
    const result = await handleQuizSubmit(baseEvent);
    expect(result.statusCode).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    process.env.APP_STAGE = 'shadow';
    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: 'test-user-id',
      email: 'test@example.com',
      decoded: {},
    } as any);
    const badBody = JSON.stringify({ module_slug: 'test' }); // missing quiz_ref and answers
    const result = await handleQuizSubmit({ ...baseEvent, body: badBody });
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when module has no quiz_schema_json in HubDB', async () => {
    process.env.APP_STAGE = 'shadow';
    process.env.HUBDB_MODULES_TABLE_ID = 'test-table-id';

    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: 'test-user-id',
      email: 'test@example.com',
      decoded: {},
    } as any);

    // Mock HubDB to return a module row with no quiz_schema_json
    mockGetHubSpotClient.mockReturnValueOnce({
      cms: {
        hubdb: {
          rowsApi: {
            getTableRows: jest.fn().mockResolvedValueOnce({
              results: [
                {
                  path: 'fabric-operations-welcome',
                  values: { quiz_schema_json: null, completion_tasks_json: '[]' },
                },
              ],
            }),
          },
        },
      },
    } as any);

    const result = await handleQuizSubmit(baseEvent);
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('no quiz schema for module');
  });

  it('returns 400 when quiz_ref does not match schema quiz_id', async () => {
    process.env.APP_STAGE = 'shadow';
    process.env.HUBDB_MODULES_TABLE_ID = 'test-table-id';

    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: 'test-user-id',
      email: 'test@example.com',
      decoded: {},
    } as any);

    // Schema has quiz_id "quiz-1" but request sends quiz_ref "quiz-2"
    mockGetHubSpotClient.mockReturnValueOnce({
      cms: {
        hubdb: {
          rowsApi: {
            getTableRows: jest.fn().mockResolvedValueOnce({
              results: [
                {
                  path: 'fabric-operations-welcome',
                  values: {
                    quiz_schema_json: JSON.stringify({ quiz_id: 'quiz-1', questions: [] }),
                    completion_tasks_json: '[]',
                  },
                },
              ],
            }),
          },
        },
      },
    } as any);

    const wrongRefBody = JSON.stringify({
      module_slug: 'fabric-operations-welcome',
      quiz_ref: 'quiz-2', // mismatch
      answers: [{ id: 'q1', value: 'b' }],
    });
    const result = await handleQuizSubmit({ ...baseEvent, body: wrongRefBody });
    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error).toBe('quiz_ref not found');
  });

  it('response does not include correct_answer field', async () => {
    process.env.APP_STAGE = 'shadow';
    process.env.HUBDB_MODULES_TABLE_ID = 'test-table-id';
    process.env.TASK_RECORDS_TABLE = 'test-task-records';
    process.env.TASK_ATTEMPTS_TABLE = 'test-task-attempts';
    process.env.ENTITY_COMPLETIONS_TABLE = 'test-entity-completions';

    mockVerifyCookieAuth.mockResolvedValueOnce({
      userId: 'test-user-id',
      email: 'test@example.com',
      decoded: {},
    } as any);

    mockGetHubSpotClient.mockReturnValueOnce({
      cms: {
        hubdb: {
          rowsApi: {
            getTableRows: jest.fn().mockResolvedValueOnce({
              results: [
                {
                  path: 'fabric-operations-welcome',
                  values: {
                    quiz_schema_json: JSON.stringify(WELCOME_QUIZ),
                    completion_tasks_json: JSON.stringify(QUIZ_AND_LAB_TASKS),
                  },
                },
              ],
            }),
          },
        },
      },
    } as any);

    const result = await handleQuizSubmit(baseEvent);

    // Regardless of DynamoDB mock result, response must not expose correct answers
    const responseStr = result.body;
    expect(responseStr).not.toContain('correct_answer');
    // Should not contain the actual answer values from the quiz schema
    expect(responseStr).not.toContain('"correct_answer"');
  });
});
