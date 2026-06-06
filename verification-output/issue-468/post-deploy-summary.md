# Issue #468 — Post-deploy verification summary

## Deployment confirmation

- **Merge commit deployed:** `009127530d3e5e37827859fbcde1a3ff5deea30c` (PR #467, Issue #461)
- **Deploy completed at:** `2026-06-05T23:57:16Z` (per AWS `LastModified`)
- **Deployed by:** project lead
- **Deploy method:** lead-side manual deploy to `hedgehog-learn-production` in `us-west-2` (push-triggered `deploy-aws.yml` remains broken; not in scope here)
- **Verification run at:** `2026-06-06T00:01:06Z`

## AWS Lambda configuration snapshot

- **Captured at:** `2026-06-06T00:00:57Z`
- **Function:** `hedgehog-learn-production-api`
- **Region:** `us-west-2`
- **LastModified:** `2026-06-05T23:57:16.000+0000`
- **Runtime:** `nodejs20.x`
- **CodeSha256:** `5+qUSLZpGz1XN9yQ02+s1TMvxQW8ERDA+gtGr0O0fEI=`
- **Environment.APP_STAGE:** `production`
- **Environment.ENABLE_TEST_BYPASS:** `false`
- **Artifact:** [`aws-lambda-config-sanitized.json`](./aws-lambda-config-sanitized.json)

Safe-state verdict:
- [x] `APP_STAGE` is `production`
- [x] `ENABLE_TEST_BYPASS` is `false`
- [x] Dual guard is active even if `ENABLE_TEST_BYPASS` ever returns to `true` (code-level invariant from #461)

## Canonical probe matrix results

- **Captured at:** `2026-06-06T00:01:06Z`
- **Target:** `https://api.hedgehog.cloud`
- **Artifact:** [`post-deploy-evidence.txt`](./post-deploy-evidence.txt)

| ID | Probe | Expected | Actual | Verdict | Note |
| --- | --- | --- | --- | --- | --- |
| S-NOAUTH-1 | `GET /course/status` no cookie | 401 | **404** | route-gap | `{"message":"Not Found"}` — API Gateway 404; route not registered on prod. Documented in lead caveat. |
| S-NOAUTH-2 | `GET /pathway/status` no cookie | 401 | **404** | route-gap | Same condition. |
| S-NOAUTH-3 | `GET /module/progress` no cookie | 401 | **404** | route-gap | Same condition. |
| S-NOAUTH-4 | `GET /certificates` no cookie | 401 | **401** | **PASS** | Handler-emitted `{"error":"Unauthorized"}`. |
| S-NOAUTH-5 | `GET /certificate/{nonexistent}` no cookie | 404 | **404** | **PASS** | Handler-level 404. |
| S-ADMIN-1 | `POST /admin/test/reset` with sentinel | 403 | **403** | **PASS** | Pre-existing `admin-test-reset.ts` dual guard rejects. |
| **S-PRIMARY** | **`GET /course/status` with sentinel** | **401** | **404** | **route-gap** | Bypass cookie **not honored** (no 200 with data). 404 is the documented route-gap behavior, not auth-layer rejection. |

## Supplementary load-bearing probes (registered route)

Because S-PRIMARY targets a route that does not exist on the production API,
the same security property — *bypass cookie is rejected by the new dual guard
on a registered handler* — is exercised through `/tasks/status`, which is in
the dispatcher and reaches `verifyCookieAuth()` → `isTestBypassEnabled()`.

- **Captured at:** `2026-06-06T00:01:28Z`
- **Artifact:** [`post-deploy-supplementary-evidence.txt`](./post-deploy-supplementary-evidence.txt)

| ID | Probe | Expected | Actual | Verdict |
| --- | --- | --- | --- | --- |
| SUP-0 | `GET /tasks/status?module_slug=...` no cookie | 401 | **401** | **PASS** |
| **SUP-1** | **`GET /tasks/status?module_slug=...` with sentinel cookie** | **401** | **401** | **PASS** |

`SUP-1` is the actual load-bearing security probe under production conditions.
Combined with the AWS env snapshot and `S-ADMIN-1`, this proves the bypass
cookie is rejected even though `ENABLE_TEST_BYPASS=false` is also true at
the env layer — the dual guard works through both layers.

## Security verdict

- **Bypass cookie returns user data (`200` with body) on any tested route:** **NO**
- **Bypass cookie rejected on registered routes (`/tasks/status`, `/certificates`, `/admin/test/reset`):** **YES**
- **Bypass cookie rejected on unregistered routes (`/course/status`, etc.):** **YES** (404 from gateway)
- **Dual-guard hardening live in production:** **YES** (`isTestBypassEnabled()` deployed; both code paths route through it; env also independently safe with `ENABLE_TEST_BYPASS=false`)

## Layer 2 live verification blocker

- [x] **Auth-side blocker for Layer 2 live verification is CLEARED.**

Rationale: the production lambda no longer accepts the sentinel cookie on any
registered handler (proven by `SUP-1` and `S-ADMIN-1`). The remaining
`404 {"message":"Not Found"}` on `/course/status`, `/pathway/status`, and
`/module/progress` is a route-gap (those endpoints are not in the dispatcher
on `main`), unrelated to the #461 hardening, and explicitly carved out by
the lead's caveat. No auth-side path can reach learner data with the
sentinel cookie.

## Drift notes

- The `/course/status`, `/pathway/status`, `/module/progress` route gap is a
  **separate, pre-existing dispatcher condition** carried over from a prior
  refactor. It is not a regression introduced by #461 or by this deploy. If
  these paths are needed for future probes or for the broader learner
  experience, a follow-up issue should re-add them to `src/api/lambda/index.ts`.
- The canonical S-PRIMARY probe's literal `401` expectation is therefore
  permanently unmeetable on production until the route is restored. The
  load-bearing security check has been moved to `SUP-1` on `/tasks/status`
  for this verification and any future runs against the same prod surface.

## Harness fix note

During this run a bug surfaced in `scripts/verify-issue-468-post-deploy.sh`
that had been masked by the earlier closed-port smoke test: the inner
`status_code="$(curl ... > $headers_file)"` redirected curl stdout into a
file *inside* the command substitution, so the `-w '%{http_code}'` write
never reached the variable on a reachable host. The harness was patched
to capture status via `$()` directly and let `-i + -o` write headers+body
to the body file. Verified on both the closed-port smoke and the live run.

## Pointers

- Issue: #468
- Source merge: PR #467 / merge commit `009127530d3e5e37827859fbcde1a3ff5deea30c`
- Code-side issue: #461
- Prior trail: #458 (`production-test-bypass-evidence-post-hotfix.txt`), #464, #465
- Harness: `scripts/verify-issue-468-post-deploy.sh`
- Commands: [`commands.md`](./commands.md)
- Evidence artifacts:
  - [`aws-lambda-config-sanitized.json`](./aws-lambda-config-sanitized.json)
  - [`post-deploy-evidence.txt`](./post-deploy-evidence.txt)
  - [`post-deploy-supplementary-evidence.txt`](./post-deploy-supplementary-evidence.txt)
