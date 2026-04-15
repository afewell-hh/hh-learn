# Issue #412 Verification — QA: Test Reset Endpoint + Shadow E2E

**Date:** 2026-04-12
**Branch:** issue-412-shadow-e2e-qa
**Scope:** Shadow-only — POST /admin/test/reset + full E2E QA matrix

---

## Files Changed

### New files
- `src/api/lambda/admin-test-reset.ts` — POST /admin/test/reset Lambda handler

### Modified files
- `src/api/lambda/index.ts` — import + route for handleAdminTestReset
- `src/api/lambda/cognito-auth.ts` — verifyCookieAuth test bypass for shadow E2E
- `serverless.yml` — add httpApi route, add BatchGetItem + BatchWriteItem IAM permissions
- `.env` — add ENABLE_TEST_BYPASS=true

---

## POST /admin/test/reset

| Property | Value |
|---|---|
| Route | `POST /admin/test/reset` |
| Guard 1 | 403 if APP_STAGE !== 'shadow' |
| Guard 2 | 403 if ENABLE_TEST_BYPASS !== 'true' |
| Auth | Cognito httpOnly cookie |
| Body | `{ module_slug?: string }` (optional scope) |
| Tables cleared | task-records-shadow, task-attempts-shadow, entity-completions-shadow |
| Response | `{ reset: true, module_slug, records_deleted: { task_records, task_attempts, entity_completions } }` |

### UnprocessedItems handling
`batchDelete()` checks `UnprocessedItems` after every `BatchWriteItem` call and retries with
exponential backoff (base 50ms, doubles per retry, max 5 retries). Items are only counted
toward `records_deleted` once confirmed processed by DynamoDB. If unprocessed items remain
after MAX_RETRIES, the function throws and the handler returns 500.

---

## Test Bypass Note

`verifyCookieAuth()` accepts the sentinel token `shadow_e2e_test_token` when
`ENABLE_TEST_BYPASS=true` (shadow stage only). This allows automated curl E2E tests to
exercise real DynamoDB operations without requiring a live Cognito browser session. The
bypass is identical in scope to the existing `MOCK_` code bypass in `/auth/callback` — both
gated by the same shadow-only env flag. Production has `ENABLE_TEST_BYPASS=false` (default).

---

## IAM Fix

`dynamodb:BatchGetItem` and `dynamodb:BatchWriteItem` were missing from the shadow table IAM
policy. `GET /tasks/status/batch` uses `BatchGetItem`; `POST /admin/test/reset` uses
`BatchWriteItem`. Both failed with AccessDeniedException when records existed. Added to the
IAM statement in `serverless.yml` and redeployed.

---

## Scenario D: Auth Protection (curl — verified 2026-04-12)

All shadow endpoints return 401 when called without a Cognito session cookie.

| Check | Expected | Actual |
|---|---|---|
| POST /admin/test/reset (no cookie) | 401 | 401 ✓ |
| GET /tasks/status (no cookie) | 401 | 401 ✓ |
| GET /tasks/status/batch (no cookie) | 401 | 401 ✓ |
| POST /tasks/quiz/submit (no cookie) | 401 | 401 ✓ |
| POST /tasks/lab/attest (no cookie) | 401 | 401 ✓ |

---

## Scenario C: Production Isolation (curl — verified 2026-04-12)

Shadow completion framework routes are NOT deployed to production (api.hedgehog.cloud).

| Endpoint | Prod response | Expected |
|---|---|---|
| POST /admin/test/reset | 404 Not Found ✓ | Route not registered |
| GET /tasks/status/batch | 404 Not Found ✓ | Route not registered |
| GET /tasks/status | 404 Not Found ✓ | Route not registered |
| POST /tasks/quiz/submit | 404 Not Found ✓ | Route not registered |

---

## Scenario A: Quiz fail → retake → pass → lab → My Learning (executed 2026-04-12)

Module: `fabric-operations-welcome` (quiz-1 + lab-main tasks)

### A0 — Scoped reset (clean slate)
```json
POST /admin/test/reset  {"module_slug":"fabric-operations-welcome"}
→ { "reset": true, "module_slug": "fabric-operations-welcome",
    "records_deleted": { "task_records": 0, "task_attempts": 0, "entity_completions": 0 } }
```

### A1 — Status after reset
```json
GET /tasks/status?module_slug=fabric-operations-welcome
→ { "module_slug": "fabric-operations-welcome", "module_status": "not_started",
    "tasks": { "quiz-1": {"status": "not_started"}, "lab-main": {"status": "not_started"} } }
```
✓ Clean state confirmed

### A2 — Submit quiz FAIL (all wrong answers: q1=a, q2=a, q3=a)
```json
POST /tasks/quiz/submit  {"module_slug":"fabric-operations-welcome","quiz_ref":"quiz-1",
  "answers":[{"id":"q1","value":"a"},{"id":"q2","value":"a"},{"id":"q3","value":"a"}]}
→ { "score": 0, "pass": false, "attempts": 1, "module_complete": false }
```
✓ Quiz graded as failed (score 0%)

### A3 — Status after failed quiz
```json
GET /tasks/status?module_slug=fabric-operations-welcome
→ { "module_slug": "fabric-operations-welcome", "module_status": "in_progress",
    "tasks": { "quiz-1": {"status": "failed", "score": 0, "attempts": 1} } }
```
✓ module_status in_progress; quiz-1 failed with attempts=1

### A4 — Retake quiz PASS (all correct: q1=b, q2=b, q3=b)
```json
POST /tasks/quiz/submit  {"module_slug":"fabric-operations-welcome","quiz_ref":"quiz-1",
  "answers":[{"id":"q1","value":"b"},{"id":"q2","value":"b"},{"id":"q3","value":"b"}]}
→ { "score": 100, "pass": true, "attempts": 2, "module_complete": false }
```
✓ Quiz passed (score 100%, attempt 2); module not yet complete (lab pending)

### A5 — Status after passing quiz
```json
GET /tasks/status?module_slug=fabric-operations-welcome
→ { "module_slug": "fabric-operations-welcome", "module_status": "in_progress",
    "tasks": { "quiz-1": {"status": "passed", "score": 100, "attempts": 2} } }
```
✓ module_status still in_progress; quiz-1 passed; lab-main absent (not yet attested)

### A6 — Lab attestation
```json
POST /tasks/lab/attest  {"module_slug":"fabric-operations-welcome","task_slug":"lab-main"}
→ { "attested": true, "task_slug": "lab-main", "module_complete": true }
```
✓ Lab attested; module_complete = true

### A7 — Status after lab attestation
```json
GET /tasks/status?module_slug=fabric-operations-welcome
→ { "module_slug": "fabric-operations-welcome", "module_status": "complete",
    "tasks": {
      "quiz-1": {"status": "passed", "attempts": 2},
      "lab-main": {"status": "attested", "attempts": 1}
    } }
```
✓ module_status = complete; quiz-1 passed (2 attempts); lab-main attested

**Scenario A: PASS** — quiz fail → retake → pass → lab → complete confirmed end-to-end.

---

## Scenario B: Lab-only module (executed 2026-04-12)

Module: `fabric-operations-vpc-provisioning` (lab-main only, no quiz task)

### B0 — Reset
```json
POST /admin/test/reset  {"module_slug":"fabric-operations-vpc-provisioning"}
→ { "reset": true, "records_deleted": { "task_records": 0, "task_attempts": 0, "entity_completions": 0 } }
```

### B1 — Status after reset
```json
GET /tasks/status?module_slug=fabric-operations-vpc-provisioning
→ { "module_slug": "fabric-operations-vpc-provisioning", "module_status": "not_started",
    "tasks": { "lab-main": {"status": "not_started"} } }
```
✓ Only lab-main task present (no quiz task); not_started

### B2 — Lab attestation
```json
POST /tasks/lab/attest  {"module_slug":"fabric-operations-vpc-provisioning","task_slug":"lab-main"}
→ { "attested": true, "task_slug": "lab-main", "module_complete": true }
```
✓ Lab attested; module_complete = true (no quiz needed)

### B3 — Status after attestation
```json
GET /tasks/status?module_slug=fabric-operations-vpc-provisioning
→ { "module_slug": "fabric-operations-vpc-provisioning", "module_status": "complete",
    "tasks": { "lab-main": {"status": "attested", "attempts": 1} } }
```
✓ module_status = complete with lab-only path (no quiz tasks in response)

**Scenario B: PASS** — lab-only module completes correctly without quiz path.

---

## Scenario E: Reset effectiveness (executed 2026-04-12)

Starting state: fabric-operations-welcome = complete, fabric-operations-vpc-provisioning = complete

### E1 — Scoped reset (welcome only)
```json
POST /admin/test/reset  {"module_slug":"fabric-operations-welcome"}
→ { "reset": true, "module_slug": "fabric-operations-welcome",
    "records_deleted": { "task_records": 2, "task_attempts": 3, "entity_completions": 1 } }
```
✓ 2 task records (quiz-1 + lab-main), 3 attempts (quiz fail + quiz pass + lab), 1 completion deleted

### E2 — Welcome status after scoped reset
```json
GET /tasks/status?module_slug=fabric-operations-welcome
→ { "module_slug": "fabric-operations-welcome", "module_status": "not_started",
    "tasks": { "quiz-1": {"status": "not_started"}, "lab-main": {"status": "not_started"} } }
```
✓ Reverted to not_started

### E3 — vpc-provisioning status after scoped reset (should be unaffected)
```json
GET /tasks/status?module_slug=fabric-operations-vpc-provisioning
→ { "module_slug": "fabric-operations-vpc-provisioning", "module_status": "complete",
    "tasks": { "lab-main": {"status": "attested", "attempts": 1} } }
```
✓ Still complete — scoped reset did not touch other modules

### E4 — Full reset (no module_slug)
```json
POST /admin/test/reset  {}
→ { "reset": true, "module_slug": null,
    "records_deleted": { "task_records": 1, "task_attempts": 1, "entity_completions": 1 } }
```
✓ Deleted remaining vpc-provisioning records (1 task, 1 attempt, 1 completion)

### E5 — Batch status after full reset
```json
GET /tasks/status/batch?module_slugs=fabric-operations-welcome,fabric-operations-vpc-provisioning
→ { "statuses": {
      "fabric-operations-welcome": { "module_slug": "fabric-operations-welcome",
        "module_status": "not_started", "tasks": {} },
      "fabric-operations-vpc-provisioning": { "module_slug": "fabric-operations-vpc-provisioning",
        "module_status": "not_started", "tasks": {} }
    } }
```
✓ Both modules not_started; batch endpoint functional

**Scenario E: PASS** — scoped reset isolates correctly; full reset clears all.

---

## Acceptance Criteria Status

| AC | Status |
|---|---|
| POST /admin/test/reset deployed, dual-gated (shadow + bypass) | ✓ |
| UnprocessedItems retry with bounded backoff | ✓ (max 5 retries, exponential 50ms–800ms) |
| Scoped reset (module_slug) isolates to one module | ✓ E3: vpc-provisioning unaffected |
| Full reset (no module_slug) clears all user records | ✓ E4+E5 confirmed |
| Auth required — 401 without cookie | ✓ Scenario D |
| Production isolation — endpoint not on prod | ✓ Scenario C |
| Scenario A: quiz fail → retake → pass → lab → complete | ✓ Executed + passing |
| Scenario B: lab-only module completes without quiz | ✓ Executed + passing |
| Scenario E: scoped + full reset effectiveness | ✓ Executed + passing |
| GET /tasks/status/batch functional with real data | ✓ E5 confirmed |
