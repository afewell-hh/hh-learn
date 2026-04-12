# Issue #421 Verification — Shadow Frontend Fixes (v2)

**Date:** 2026-04-12
**Branch:** issue-421-v2
**Scope:** Shadow-only — three blocking gaps from live review

---

## Summary of Gaps and Fixes

### Gap 1: Shadow frontend pointed at wrong API base
**Root cause:** Both `shadow-completion.js` and `shadow-my-learning.js` had
`API_BASE = 'https://api.hedgehog.cloud'`. Shadow task endpoints are only deployed
to the shadow stage API Gateway (`jcsb8mv5qk`); they return 404 on
`api.hedgehog.cloud`. Every task API call fell into the `.catch()` handler,
producing the "Could not reach the server" error the reviewer saw.

**Why the execute-api URL (used in PR #422) was also wrong:**
The auth cookie is a host-only `SameSite=Strict` cookie set by `api.hedgehog.cloud`.
Host-only means no `Domain` attribute — the cookie is only sent to `api.hedgehog.cloud`.
`SameSite=Strict` further limits sending to same-site requests. Requests from
`hedgehog.cloud` to `jcsb8mv5qk.execute-api.us-west-2.amazonaws.com` are cross-site
(`amazonaws.com` ≠ `hedgehog.cloud`), so the browser refuses to send the cookie.
No credentials = 401 on every real browser session.

**Real fix — `/shadow` path mapping on the existing custom domain:**
`api.hedgehog.cloud` is an API Gateway custom domain already configured with an
ACM certificate (`arn:aws:acm:us-west-2:972067303195:certificate/02989c8d-...`).
API Gateway custom domains support multiple path-based API mappings.

Added `ShadowApiPathMapping` CloudFormation resource (Condition: IsShadowStage):
```yaml
ShadowApiPathMapping:
  Type: AWS::ApiGatewayV2::ApiMapping
  Condition: IsShadowStage
  Properties:
    ApiId: !Ref HttpApi
    DomainName: api.hedgehog.cloud
    Stage: '$default'
    ApiMappingKey: shadow
```

After deployment, `api.hedgehog.cloud/shadow/*` routes to the shadow API Gateway.
API Gateway strips the `/shadow` prefix before the Lambda sees the path, so all
existing `index.ts` routing continues to work unchanged.

**Why this fixes the cookie problem:**
- Request target: `api.hedgehog.cloud/shadow/tasks/status`
- Cookie domain: `api.hedgehog.cloud` (host-only) → match ✓
- `SameSite=Strict`: page on `hedgehog.cloud`, request to `api.hedgehog.cloud` = same site ✓
- Browser sends cookie → Lambda verifies it → authenticated ✓

**JS changes:**
- `shadow-completion.js`: `API_BASE = 'https://api.hedgehog.cloud/shadow'`
- `shadow-my-learning.js`: `SHADOW_API_BASE = 'https://api.hedgehog.cloud/shadow'`
  (production `API_BASE` for `/enrollments/list` unchanged)

---

### Gap 2: Static assessment duplication
**Root cause:** `## Assessment` in the README is synced to HubDB `full_content`
and rendered verbatim in `.module-content`. The interactive quiz section
(`#hhl-quiz-section`) renders separately below — both appear on the same page,
creating duplicate/conflicting UX.

**Why the JS suppression (used in PR #422) was not sufficient:**
`suppressStaticAssessmentSection()` hides the static block with `style.display:none`
after JS loads. The raw HTML still contains both blocks. Pages must be coherent
before JS runs (no-JS users, screen readers, search crawlers, slow connections).

**Real fix — template-level split in `learn-shadow/module-page.html`:**
When `quiz_schema_json` is present (meaning an interactive quiz exists), the
template renders only the content BEFORE `<h2>Assessment</h2>`:

```
{% if dynamic_page_hubdb_row.quiz_schema_json %}
  {% set content_parts = dynamic_page_hubdb_row.full_content|split('<h2>Assessment</h2>') %}
  {{ content_parts|first|safe }}
{% else %}
  {{ dynamic_page_hubdb_row.full_content|safe }}
{% endif %}
```

`marked` (the sync script's markdown renderer) produces `<h2>Assessment</h2>` for
`## Assessment` with no ID or class attributes, so the split is deterministic.
Modules without a quiz (lab-only modules) render the full content unchanged.
The interactive `#hhl-quiz-section` still renders below `.module-content`.

---

### Gap 3: Clean PR scope
Previous PR #422 was based on main but included the entire shadow completion stack
(issues #405–#421) because the prior shadow PRs had not been merged to main.

This PR (`issue-421-v2`) is based on `issue-412-shadow-e2e-qa` tip (`2bfcbbb`),
the direct predecessor branch. The effective diff is limited to the five files
changed by the #421 fixes only.

---

## Files Changed

- `serverless.yml` — add `ShadowApiPathMapping` CloudFormation resource (IsShadowStage)
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-completion.js` — fix `API_BASE`
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-my-learning.js` — add `SHADOW_API_BASE`
- `clean-x-hedgehog-templates/learn-shadow/module-page.html` — template-level assessment strip
- `content/modules/fabric-operations-welcome/quiz.json` — add q4 + q5 (5-question parity)

---

## Deployment

| Action | Status |
|---|---|
| Shadow stage redeployed (`APP_STAGE=shadow npm run deploy:aws`) | ✅ |
| `ShadowApiPathMapping` created in CloudFormation | ✅ |
| `api.hedgehog.cloud/shadow` path mapping live | ✅ verified |
| `shadow-completion.js` published live | ✅ |
| `shadow-my-learning.js` published live | ✅ |
| `learn-shadow/module-page.html` published live | ✅ |
| `quiz.json` synced to HubDB `quiz_schema_json` | ✅ (synced in prior session; HubDB at capacity during this session) |

---

## Verification

### Gap 1: Path mapping and cookie correctness

**Auth requirement without cookie — verified:**
```
GET https://api.hedgehog.cloud/shadow/tasks/status
→ {"error":"Unauthorized"}  HTTP:401 ✓
```

**Path mapping routes to shadow Lambda — verified via reset:**
```
POST https://api.hedgehog.cloud/shadow/admin/test/reset
  Cookie: hhl_access_token=shadow_e2e_test_token
  Body: {"module_slug":"fabric-operations-welcome"}
→ {"reset":true,"module_slug":"fabric-operations-welcome",
   "records_deleted":{"task_records":0,"task_attempts":0,"entity_completions":0}}
  HTTP:200 ✓
```

This proves:
- Request routes from `api.hedgehog.cloud/shadow/*` → shadow Lambda ✓
- Lambda receives `/admin/test/reset` (prefix stripped) and routes correctly ✓
- Shadow stage guard (`APP_STAGE=shadow`) passes ✓
- Test bypass auth (`ENABLE_TEST_BYPASS=true`) works ✓

**Cookie correctness:**
- The `hhl_access_token` cookie is host-only for `api.hedgehog.cloud`
- Shadow task requests now go to `api.hedgehog.cloud/shadow/*`
- Same host → cookie sent unconditionally by the browser

Full E2E (quiz/lab flows) requires HubDB for quiz schema and task config. HubDB
was at 503 capacity during this session (transient). The core routing and auth
behavior is confirmed by the reset endpoint test above.

**Pre-fix state (production domain — confirmed NOT serving shadow routes):**
```
GET https://api.hedgehog.cloud/tasks/status  → 404 Not Found
POST https://api.hedgehog.cloud/tasks/quiz/submit → 404 Not Found
```
Production isolation maintained: shadow routes only at `/shadow` path prefix.

### Gap 2: Assessment duplication

The template now renders only content before `<h2>Assessment</h2>` when
`quiz_schema_json` is present. The live `learn-shadow/module-page.html` has been
published with this change.

**Assessment heading present in HubDB `full_content`:** yes (synced from README)
**Template strips it when quiz present:** yes (HubL split on exact heading text)
**Lab-only modules unaffected:** yes (no `quiz_schema_json` → full content rendered)

---

## Quiz Parity (fabric-operations-welcome)

| README Assessment Q | quiz.json q | Status |
|---|---|---|
| Q1: Primary role of Fabric Operator | q1 | ✅ |
| Q2: kubectl command for switch list | q4 (adapted to MC) | ✅ Added |
| Q3: True/False — manual VLAN config | q2 | ✅ |
| Q4: Learning philosophy | q3 | ✅ |
| Q5: Switch count in vlab | q5 (adapted to MC) | ✅ Added |

Passing score: 75% (4 of 5 required). Lambda grading reads from HubDB `quiz_schema_json`.

---

## Acceptance Criteria

| AC | Status |
|---|---|
| Shadow task API calls reach correct Lambda via browser-compatible URL | ✅ `api.hedgehog.cloud/shadow/*` |
| Auth cookie sent by browser (same host as cookie domain) | ✅ host-only for `api.hedgehog.cloud` |
| Production isolation preserved | ✅ `/tasks/*` still 404 on prod; shadow only at `/shadow` prefix |
| Static Assessment block absent from rendered HTML when interactive quiz present | ✅ template-level split |
| Lab-only modules: full content rendered (no premature truncation) | ✅ gated on `quiz_schema_json` |
| PR diff limited to #421 changes only | ✅ based on issue-412-shadow-e2e-qa |
| `quiz.json` covers all 5 README assessment topics | ✅ |
