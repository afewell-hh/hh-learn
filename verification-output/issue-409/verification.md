# Issue #409 Verification — GET /tasks/status

**Date:** 2026-04-12
**Branch:** issue-409-tasks-status
**Stage deployed:** shadow
**Endpoint:** GET https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com/tasks/status

---

## Endpoint Contract

### Request
```
GET /tasks/status?module_slug=<slug>
Cookie: hhl_access_token=<cognito-access-token>
```

### Response (200 OK — primary path, record exists)
```json
{
  "module_slug": "fabric-operations-welcome",
  "module_status": "in_progress",
  "tasks": {
    "quiz-1": { "status": "failed", "score": 50, "attempts": 1 },
    "lab-main": { "status": "attested", "attempts": 1 }
  }
}
```

### Response (200 OK — fallback path, module never attempted)
```json
{
  "module_slug": "fabric-operations-welcome",
  "module_status": "not_started",
  "tasks": {
    "quiz-1": { "status": "not_started" },
    "lab-main": { "status": "not_started" }
  }
}
```

### Error responses
| Condition | Code | Body |
|---|---|---|
| APP_STAGE !== shadow | 403 | `{"error":"Not available in this environment"}` |
| No valid Cognito cookie | 401 | `{"error":"Unauthorized"}` |
| Missing/empty module_slug | 400 | `{"error":"module_slug query parameter is required"}` |
| Module not found in HubDB (fallback) | 404 | `{"error":"module not found"}` |
| DynamoDB failure | 500 | `{"error":"Failed to read task status"}` |
| HubDB fallback failure | 500 | `{"error":"Failed to read task configuration"}` |

---

## Read Logic

### Primary path
1. Auth: verify `hhl_access_token` cookie via Cognito JWKS → extract `userId`
2. GetItem from `entity-completions-shadow` table: `PK=USER#<userId>`, `SK=COMPLETION#MODULE#<slug>`
3. If record found: map `status` + `task_statuses` → return 200

### Fallback path (no EntityCompletion record)
1. Fetch HubDB modules table rows
2. Find row where `path === module_slug` (case-insensitive)
3. If not found → 404
4. Parse `completion_tasks_json` column
5. Build not_started shape: all declared tasks get `status: "not_started"`, no score/attempts
6. Return 200

---

## Auth Approach

Reuses `verifyCookieAuth(event)` exported from `cognito-auth.ts` (introduced in #407). Reads `hhl_access_token` httpOnly cookie, verifies against Cognito JWKS, extracts `userId = decoded.sub`.

---

## Live Verification

Unauthenticated request → 401 (shadow guard passes, auth activates):
```
curl "https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com/tasks/status?module_slug=fabric-operations-welcome"

HTTP 401: {"error":"Unauthorized"}
```

Full authenticated test requires a live `hhl_access_token` cookie from a Cognito session.

---

## Unit Tests

```
Tests: 67 passed, 67 total (24 from #407 + 19 from #408 + 24 from #409)
Test Suites: 3 passed, 3 total
```

#409 test coverage:
- `buildNotStartedResponse`: all tasks not_started, empty module, no score/attempts in output
- `buildResponseFromRecord`: maps module_status + task entries, defaults missing status, omits undefined fields
- Shadow guard: APP_STAGE=dev, prod, undefined → all 403
- Auth: missing cookie, expired token → 401
- Request validation: missing module_slug, empty string, null queryStringParameters → 400
- Primary path: record found → 200 with mapped statuses + scores; module_status=complete; HubDB not called
- Fallback path: no record → 200 not_started shape; module not in HubDB → 404; no completion_tasks_json → empty tasks
- Error paths: DynamoDB failure → 500; HubDB failure → 500; missing HUBDB_MODULES_TABLE_ID → 500

---

## Files Changed

- `src/api/lambda/tasks-status.ts` — new handler
- `src/api/lambda/index.ts` — import + route `GET /tasks/status`
- `serverless.yml` — add `GET /tasks/status` httpApi event
- `tests/unit/tasks-status.test.ts` — 24 Jest unit tests

---

## No Production Impact

- Read-only endpoint; no DynamoDB writes
- Shadow guard enforced as first check
- New route only; does not overlap existing endpoints
