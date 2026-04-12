# Issue #408 Verification — POST /tasks/lab/attest

**Date:** 2026-04-12
**Branch:** issue-408-lab-attest
**Stage deployed:** shadow
**Endpoint:** POST https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com/tasks/lab/attest

---

## Endpoint Contract

### Request
```json
{
  "module_slug": "fabric-operations-welcome",
  "task_slug": "lab-main"
}
```

### Response (200 OK)
```json
{
  "attested": true,
  "task_slug": "lab-main",
  "module_complete": false
}
```
(`module_complete: false` because quiz task not yet passed; becomes `true` once `quiz-1` is also passed)

### Error responses
| Condition | Code | Body |
|---|---|---|
| APP_STAGE !== shadow | 403 | `{"error":"Not available in this environment"}` |
| No valid Cognito cookie | 401 | `{"error":"Unauthorized"}` |
| Missing/invalid body | 400 | `{"error":"Invalid request", "details":{...}}` |
| task_slug not declared for module | 400 | `{"error":"task not found for module"}` |
| task is not lab_attestation type | 400 | `{"error":"task is not a lab_attestation type"}` |
| DynamoDB write failure | 500 | `{"error":"Failed to persist attestation"}` |

---

## Auth Approach

Reuses `verifyCookieAuth(event)` exported from `cognito-auth.ts` in #407. Reads `hhl_access_token` httpOnly cookie, verifies against Cognito JWKS, extracts `userId = decoded.sub`.

---

## Validation Logic

1. Fetch HubDB modules table rows; find row where `path === module_slug`
2. Parse `completion_tasks_json` column
3. Find entry where `task_slug` matches request `task_slug`
4. If not found → 400 `task not found for module`
5. If found but `task_type !== 'lab_attestation'` → 400 `task is not a lab_attestation type`
6. Validation passes → proceed to persistence

---

## Persistence (write-before-respond)

All writes complete before response. Any failure returns 500.

1. **TaskAttempt** (PutItem, append-only): `ATTEMPT#MODULE#<slug>#<task_slug>#<isoTimestamp>` with `task_type=lab_attestation`, `attested_at`, `attempted_at`, `learner_identity`
2. **TaskRecord** (UpdateItem): `TASK#MODULE#<slug>#<task_slug>` — `status=attested`, `graded=false`, `ADD attempt_count :one`. Idempotent: re-attesting refreshes `last_attempt_at`, keeps `status=attested`
3. **EntityCompletion** (QueryCommand + UpdateItem): reads all TaskRecords for user+module, calls `computeModuleStatus()` (reused from `tasks-quiz-submit.ts`), upserts `COMPLETION#MODULE#<slug>`

---

## Live Verification

Unauthenticated request → 401 (shadow guard passes, auth activates):
```
curl -X POST https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com/tasks/lab/attest \
  -H "Content-Type: application/json" \
  -d '{"module_slug":"fabric-operations-welcome","task_slug":"lab-main"}'

HTTP 401: {"error":"Unauthorized"}
```

Full authenticated test requires a live `hhl_access_token` cookie from a Cognito session.

---

## Unit Tests

```
Tests: 43 passed, 43 total (24 from #407 + 19 from #408)
Test Suites: 2 passed, 2 total
```

#408 test coverage:
- Shadow guard: APP_STAGE=dev, prod, undefined → all 403
- Auth: missing cookie, expired token → 401
- Request validation: missing module_slug, missing task_slug, invalid JSON → 400
- Task validation: nonexistent task_slug → 400 `task not found`, quiz task_slug as lab attempt → 400 `not lab_attestation type`, no completion_tasks_json → 400, module not in HubDB → 400
- Successful attestation: 200 with `attested=true`, `task_slug` echoed, `module_complete` boolean
- `module_complete=true` when computeModuleStatus returns complete
- `module_complete=false` when in_progress (quiz not yet passed)
- Re-attestation idempotent → 200
- DynamoDB failures: PutItem fail → 500, UpdateItem fail → 500

---

## Files Changed

- `src/api/lambda/tasks-lab-attest.ts` — new handler
- `src/api/lambda/index.ts` — import + route `POST /tasks/lab/attest`
- `serverless.yml` — add `POST /tasks/lab/attest` httpApi event
- `tests/unit/tasks-lab-attest.test.ts` — 19 Jest unit tests

---

## No Production Impact

- New route only; does not overlap existing endpoints
- Shadow guard enforced as first check
- `computeModuleStatus` reused from `tasks-quiz-submit.ts` (no duplication)
