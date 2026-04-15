# Issue #407 Verification — POST /tasks/quiz/submit

**Date:** 2026-04-12
**Branch:** issue-407-quiz-submit
**Stage deployed:** shadow
**Endpoint:** POST https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com/tasks/quiz/submit

---

## Endpoint Contract

### Request
```json
{
  "module_slug": "fabric-operations-welcome",
  "quiz_ref": "quiz-1",
  "answers": [
    {"id": "q1", "value": "b"},
    {"id": "q2", "value": "b"},
    {"id": "q3", "value": "b"}
  ]
}
```

### Response (200 OK)
```json
{
  "score": 100,
  "pass": true,
  "attempts": 1,
  "module_complete": false
}
```
(`module_complete: false` because `lab-main` lab_attestation task not yet attested)

### Error responses
| Condition | Code | Body |
|---|---|---|
| APP_STAGE !== shadow | 403 | `{"error":"Not available in this environment"}` |
| No valid Cognito cookie | 401 | `{"error":"Unauthorized"}` |
| Missing/invalid body | 400 | `{"error":"Invalid request", "details":{...}}` |
| No quiz schema for module | 400 | `{"error":"no quiz schema for module"}` |
| quiz_ref mismatch | 400 | `{"error":"quiz_ref not found"}` |
| DynamoDB write failure | 500 | `{"error":"Failed to persist attempt"}` |

---

## Auth Approach

Cookie-based Cognito auth via `hhl_access_token` httpOnly cookie.
Pattern: read cookie from `event.cookies` or `event.headers?.cookie`, verify with Cognito JWKS (`verifyJWT` with `tokenUse: 'access'`, `clientId` check), extract `userId = decoded.sub`.

New shared export: `verifyCookieAuth(event)` in `cognito-auth.ts` — used by this and future shadow endpoints (#408, #409).

---

## Shadow Guard

`process.env.APP_STAGE !== 'shadow'` returns 403 immediately — first check after route dispatch. Lambda env var `APP_STAGE: shadow` confirmed in previous #405 verification.

---

## Grading Logic

1. Fetch all HubDB module rows; find row by `path === module_slug`
2. Parse `quiz_schema_json` column → QuizSchema
3. For each question: compare submitted `answers[].value` to `question.correct_answer`
4. `score = round((earned_points / total_points) * 100)`
5. `pass = score >= quiz.passing_score` (default 75)
6. Correct answers never appear in response

---

## Persistence (write-before-respond)

All three DynamoDB writes complete before response is returned. Any write failure returns 500.

1. **TaskAttempt** (PutItem, append-only): `ATTEMPT#MODULE#<slug>#<quiz_ref>#<isoTimestamp>`
2. **TaskRecord** (UpdateItem + conditional best_score update):
   - `TASK#MODULE#<slug>#<quiz_ref>` — status=passed/failed, attempt_count incremented via ADD
   - best_score updated conditionally: `attribute_not_exists(best_score) OR best_score < :score`
3. **EntityCompletion** (UpdateItem):
   - Reads all TaskRecords for user+module to recompute status
   - `computeModuleStatus()`: complete if ALL required tasks satisfied; in_progress if any attempted; not_started otherwise

---

## Live Verification

Unauthenticated request → 401 (shadow guard passes, auth check activates):

```
curl -X POST https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com/tasks/quiz/submit \
  -H "Content-Type: application/json" \
  -d '{"module_slug":"fabric-operations-welcome","quiz_ref":"quiz-1","answers":[{"id":"q1","value":"b"}]}'

HTTP 401: {"error":"Unauthorized"}
```

Full authenticated test requires a live `hhl_access_token` cookie from a Cognito session.
See Issue #407 for curl command with real token.

---

## Unit Tests

```
Tests: 24 passed, 24 total
```

Coverage:
- `gradeQuiz`: all-correct (100/pass), all-wrong (0/fail), partial score (67/fail), threshold boundary (75/pass), unanswered questions, default passing_score
- `computeModuleStatus`: not_started, in_progress (quiz passed, lab missing), complete, quiz-failed state, no-required-tasks edge cases
- `handleQuizSubmit`: shadow guard (403), auth failure (401), invalid body (400), missing quiz schema (400), quiz_ref mismatch (400), correct_answer not in response

---

## Files Changed

- `src/api/lambda/tasks-quiz-submit.ts` — new handler (shadow guard, cookie auth, Zod validation, HubDB fetch, gradeQuiz, 3x DynamoDB writes)
- `src/api/lambda/cognito-auth.ts` — export `verifyCookieAuth` + `getCookieValue`
- `src/api/lambda/index.ts` — import + route `POST /tasks/quiz/submit`
- `serverless.yml` — add `HUBDB_MODULES_TABLE_ID` env var + `POST /tasks/quiz/submit` httpApi event
- `tests/unit/tasks-quiz-submit.test.ts` — 24 Jest unit tests
- `jest.config.js` — Jest configuration (ts-jest, moduleNameMapper for .js imports)
- `tsconfig.test.json` — test-only tsconfig with jest types
- `tsconfig.json` — exclude `tests/unit/**` from app build
- `package.json` — add `test:unit` script + jest/ts-jest/@types/jest devDependencies

---

## No Production Impact

- Route is new (`/tasks/quiz/submit`) — does not overlap with existing endpoints
- Shadow guard prevents execution outside shadow stage
- Existing `/quiz/grade` stub left untouched per spec
- `HUBDB_MODULES_TABLE_ID` env var added to all stages (reads the shared HubDB modules table, no side effects)
