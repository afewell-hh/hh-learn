# Issue #427 — Shadow Certificate Issuance and Verification

Shadow phase 6 of Epic #397. Adds certificate generation on top of the task recording infrastructure.

---

## DynamoDB Schema

### `hedgehog-learn-certificates-shadow`

| Field | Type | Description |
|-------|------|-------------|
| `PK` | String | `USER#<cognitoSub>` — partition key |
| `SK` | String | `CERT#<entityType>#<entitySlug>` — sort key |
| `certId` | String (UUID v4) | Globally unique certificate identifier; GSI partition key |
| `learnerId` | String | Cognito sub of the learner |
| `entityType` | String | `"module"` or `"course"` |
| `entitySlug` | String | Slug of the module or course |
| `issuedAt` | String | ISO 8601 timestamp |
| `evidenceSummary` | Map | `{ <taskSlug>: <status> }` snapshot at issuance time |

**GSI**: `certId-index` — PK: `certId` (HASH), projection: ALL  
Used by the public verification endpoint to look up certs without knowing the learner's sub.

**Condition**: `IsShadowStage` — only provisioned in the shadow stage.

---

## API Endpoints

### GET /shadow/certificate/:certId (public — no auth required)

Looks up a certificate by `certId` via the GSI. Returns only non-PII fields.

**Request**:
```
GET https://api.hedgehog.cloud/shadow/shadow/certificate/a1b2c3d4-1234-4abc-8def-000000000001
```

**200 Response**:
```json
{
  "certId": "a1b2c3d4-1234-4abc-8def-000000000001",
  "entityType": "module",
  "entitySlug": "fabric-operations-welcome",
  "issuedAt": "2026-04-14T12:34:56.789Z"
}
```

**Error responses**:
- `403` — `APP_STAGE !== 'shadow'`
- `400` — missing or non-UUID certId
- `404` — certId not found
- `500` — DynamoDB error

---

### POST /tasks/quiz/submit (augmented — now returns cert_id)

When submission causes module completion, the response includes `cert_id`:

```json
{
  "score": 100,
  "pass": true,
  "attempts": 1,
  "module_complete": true,
  "cert_id": "a1b2c3d4-1234-4abc-8def-000000000001"
}
```

`cert_id` is absent when `module_complete: false`.

---

### POST /tasks/lab/attest (augmented — now returns cert_id)

Same cert_id augmentation:

```json
{
  "attested": true,
  "task_slug": "lab-main",
  "module_complete": true,
  "cert_id": "a1b2c3d4-1234-4abc-8def-000000000001"
}
```

---

### GET /tasks/status?module_slug=... (augmented — now returns cert_id)

When `module_status === "complete"` and a certificate exists:

```json
{
  "module_slug": "fabric-operations-welcome",
  "module_status": "complete",
  "tasks": { ... },
  "cert_id": "a1b2c3d4-1234-4abc-8def-000000000001"
}
```

---

## Certificate Issuance Logic

### Module-level (in `certificate-issuance.ts`)

1. Called by `tasks-quiz-submit.ts` and `tasks-lab-attest.ts` after every entity-completion write.
2. If `moduleStatus !== 'complete'`, returns immediately (no-op).
3. Checks `GET certificates-shadow` for `PK=USER#<sub>, SK=CERT#module#<slug>`.
4. If not found: calls `PutItem` with `ConditionExpression: attribute_not_exists(PK) AND attribute_not_exists(SK)` (race guard).
5. Returns `{ moduleCertIssued, moduleCertId }`.

### Course-level (in `certificate-issuance.ts`)

6. Fetches HubDB `courses` table rows via `HUBDB_COURSES_TABLE_ID`.
7. Finds courses whose `module_slugs_json` contains the just-completed module.
8. For each such course, does a `GetItem` on `entity-completions-shadow` for every module in the course.
9. If all modules have `status: 'complete'`, issues a course certificate (idempotent PutItem).

### Idempotency

Both module and course certificate issuance use `GetItem` before `PutItem`. If the item already exists, the existing `certId` is returned without writing. A `ConditionalCheckFailedException` on `PutItem` (concurrent race) fetches the winning record's `certId`.

---

## How to Test Manually

### Prerequisites

- Shadow stack deployed (`APP_STAGE=shadow`)
- Learner authenticated (Cognito httpOnly cookie set)
- Module with `completion_tasks_json` in HubDB

### Step 1: Complete all tasks for a module

```bash
# Submit a passing quiz
curl -X POST https://api.hedgehog.cloud/shadow/tasks/quiz/submit \
  -H "Content-Type: application/json" \
  -b "hhl_access_token=<token>" \
  -d '{"module_slug":"fabric-operations-welcome","quiz_ref":"quiz-1","answers":[...]}'
# → response should include "module_complete":true and "cert_id":"<uuid>"
```

```bash
# Attest lab (if also required)
curl -X POST https://api.hedgehog.cloud/shadow/tasks/lab/attest \
  -H "Content-Type: application/json" \
  -b "hhl_access_token=<token>" \
  -d '{"module_slug":"fabric-operations-welcome","task_slug":"lab-main"}'
```

### Step 2: Verify the certificate

```bash
curl https://api.hedgehog.cloud/shadow/shadow/certificate/<uuid-from-step-1>
# → 200 { certId, entityType, entitySlug, issuedAt }
```

### Step 3: Check idempotency

Re-submit the same quiz passing again:
```bash
curl -X POST https://api.hedgehog.cloud/shadow/tasks/quiz/submit ...
# → response should include same cert_id (not a new UUID)
```

### Step 4: Check My Learning page

Visit `https://hedgehog.cloud/learn-shadow/my-learning` — completed modules should show 🎓 certificate earned badge.

### Step 5: Check DynamoDB directly

```bash
aws dynamodb get-item \
  --table-name hedgehog-learn-certificates-shadow \
  --key '{"PK":{"S":"USER#<sub>"},"SK":{"S":"CERT#module#fabric-operations-welcome"}}'
```

---

## Files Changed

| File | Change |
|------|--------|
| `infrastructure/dynamodb/certificates-shadow-table.json` | New — DynamoDB schema doc |
| `serverless.yml` | Added params, env vars, IAM policy, CloudFormation table, httpApi route |
| `src/api/lambda/certificate-issuance.ts` | New — shared cert issuance logic |
| `src/api/lambda/certificate-verify.ts` | New — GET /shadow/certificate/:certId handler |
| `src/api/lambda/tasks-quiz-submit.ts` | Import + call `issueCertificateIfComplete`, add cert_id to response |
| `src/api/lambda/tasks-lab-attest.ts` | Import + call `issueCertificateIfComplete`, add cert_id to response |
| `src/api/lambda/tasks-status.ts` | Add cert_id to response when module complete |
| `src/api/lambda/index.ts` | Import handleCertificateVerify, add route dispatch |
| `clean-x-hedgehog-templates/assets/shadow/js/shadow-my-learning.js` | Add certificate badge for completed modules/courses |
| `tests/unit/certificate-issuance.test.ts` | New — 14 unit tests covering all spec scenarios |

---

## Decisions / Deviations from Spec

1. **Certificate issuance as shared module**: Instead of duplicating logic in both `tasks-quiz-submit.ts` and `tasks-lab-attest.ts`, the issuance logic lives in `certificate-issuance.ts`. Both handlers import it. This keeps the handlers DRY.

2. **Best-effort issuance**: Certificate issuance failures are caught and logged but do not fail the task write response. The task write already succeeded; cert issuance is durable-enough via DynamoDB conditional writes. This prevents a HubDB or DynamoDB blip from blocking the learner's grade response.

3. **tasks/status cert_id augmentation**: The spec said "if the response includes cert_id" — this implied the status endpoint should return cert_id. Added a `GetItem` on the certificates table when `module_status === 'complete'`. This is a single extra DynamoDB read on the happy path only.

4. **My Learning batch endpoint**: The `tasks/status/batch` endpoint does not return cert_ids (that would require N extra DynamoDB reads). The My Learning page shows the 🎓 badge for `module_status === 'complete'` modules without a direct cert link. The course-level badge is shown when `isComplete === true`. Individual module pages (which use the single-module `/tasks/status` endpoint) get the full cert link.

5. **HUBDB_COURSES_TABLE_ID in serverless.yml**: Was already in `.env` but not wired into the Lambda environment. Added it with a safe default of `''` so it doesn't break non-shadow stages.

6. **Public endpoint path**: The spec says `GET /shadow/certificate/:certId`. In the Lambda after the `/shadow` path mapping strips the prefix, the route is `/certificate/{certId}`. The route dispatch in `index.ts` uses `path.includes('/shadow/certificate/')` to match the full path before stripping.
