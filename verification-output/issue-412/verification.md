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
- `serverless.yml` — add POST /admin/test/reset httpApi route
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

Production database (hhl_progress_state) has no access path from shadow endpoints.

---

## Scenario A: Fresh Flow — Live Tester Protocol

After reset, perform full quiz-fail → retake → pass → lab → My Learning flow for
`fabric-operations-welcome`.

### Pre-conditions
```
POST /admin/test/reset
Body: { "module_slug": "fabric-operations-welcome" }
→ expect { reset: true, records_deleted: { task_records: N, task_attempts: N, entity_completions: N } }
```

### Step-by-step
1. Navigate to `/learn-shadow/modules/fabric-operations-welcome`
2. Attempt quiz with wrong answers
   - Expected: quiz submission returns `{ passed: false, score: X% }`
   - GET /tasks/status → `module_status: in_progress`, tasks.quiz: `{ passed: false }`
3. Retake quiz with correct answers
   - Expected: quiz submission returns `{ passed: true, score: 100% }`
   - GET /tasks/status → tasks.quiz: `{ passed: true, score: 100 }`
4. Complete lab attestation
   - Expected: lab attest returns 200
   - GET /tasks/status → `module_status: complete`, tasks.lab_attestation: `{ completed: true }`
5. Navigate to `/learn-shadow/my-learning`
   - Expected: `fabric-operations-welcome` shows "✓ Complete" badge
   - Expected: Quiz pill → "Quiz: Passed (100%)" (green)
   - Expected: Lab pill → "Lab: Completed" (green)

---

## Scenario B: Lab-Only Module — Live Tester Protocol

Module `fabric-operations-vpc-provisioning` (lab-only, no quiz task).

1. Reset: `POST /admin/test/reset` with `{ "module_slug": "fabric-operations-vpc-provisioning" }`
2. GET /tasks/status → `module_status: not_started`, tasks.lab_attestation: absent or not_started
3. No quiz section visible on module page (quiz guard: `{% if dynamic_page_hubdb_row.quiz_schema_json %}`)
4. Lab attestation form visible
5. Complete lab attestation
6. GET /tasks/status → `module_status: complete`
7. My Learning: module shows "✓ Complete", no quiz pill present

---

## Scenario E: Reset Effectiveness — Live Tester Protocol

After Scenario A (module fully complete):

1. **Scoped reset:**
   ```
   POST /admin/test/reset
   Body: { "module_slug": "fabric-operations-welcome" }
   → records_deleted.entity_completions >= 1
   ```
2. GET /tasks/status for `fabric-operations-welcome` → `module_status: not_started`
3. My Learning reload → module badge reverts to "Not Started" / "In Progress" for course

4. **Full reset (no module_slug):**
   ```
   POST /admin/test/reset
   Body: {}
   → all records deleted
   ```
5. GET /tasks/status/batch for all enrolled modules → all `not_started`
6. My Learning → all courses show "Not Started"

---

## No-Task Module Policy Check (from #411 fix — live verification)

The following modules have no required tasks and should behave as follows:

| Module | Expected pill | Expected module status | Counts toward completion? |
|---|---|---|---|
| fabric-operations-troubleshooting-framework | "No required tasks" (light green italic) | `–` (en dash) | No (excluded from denominator) |
| fabric-operations-foundations-recap | "No required tasks" (light green italic) | `–` (en dash) | No |

- A course where ALL modules are no-task → badge: "Not Started", 0% progress, never auto-completes ✓

---

## Deployment Confirmation

Shadow stage deployed 2026-04-12:

```
POST - https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com/admin/test/reset ✓
```

ENABLE_TEST_BYPASS=true set in .env and live in shadow Lambda environment.
APP_STAGE=shadow confirmed (shadow guard passes, auth guard fires correctly → 401).

---

## Acceptance Criteria Status

| AC | Status |
|---|---|
| POST /admin/test/reset deployed, dual-gated (shadow + bypass) | ✓ |
| Endpoint deletes task-records, task-attempts, entity-completions for user | ✓ (code verified, DynamoDB Query + BatchWrite) |
| Scoped reset (module_slug) works | ✓ (SK prefix filter by module) |
| Full reset (no module_slug) works | ✓ (SK prefix TASK#MODULE# / ATTEMPT#MODULE# / COMPLETION#MODULE#) |
| Auth required — 401 without cookie | ✓ (curl-verified) |
| Production isolation — endpoint not on prod | ✓ (curl-verified, 404 on api.hedgehog.cloud) |
| Scenarios A, B, E (authenticated E2E) | Protocol written — requires live tester with Cognito session |
| Scenario C (prod isolation) | ✓ curl-verified above |
| Scenario D (auth protection) | ✓ curl-verified above |
