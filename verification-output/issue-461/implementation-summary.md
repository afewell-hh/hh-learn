# Issue #461 — Implementation Summary

**Issue:** P0 Security: harden Cognito test bypass to require shadow stage
**Branch:** `issue-461-cognito-bypass-dual-guard`
**Base:** `origin/main` @ `cc9b093`

## Problem recap
Both test-bypass entry points in `src/api/lambda/cognito-auth.ts` were gated
on `ENABLE_TEST_BYPASS` alone. A misconfigured production deployment that
leaked `ENABLE_TEST_BYPASS=true` therefore accepted:
- mock callback codes (`MOCK_*`) and issued mock cookies, and
- the fixed sentinel access token `shadow_e2e_test_token` as a valid identity.

This contradicted the local reference pattern in
`src/api/lambda/admin-test-reset.ts:200-203`, which already enforces a dual
guard (`APP_STAGE === 'shadow'` AND `ENABLE_TEST_BYPASS === 'true'`).

## Change
Introduced a single exported predicate in `cognito-auth.ts`:

```ts
export function isTestBypassEnabled(): boolean {
  return (
    process.env.APP_STAGE === 'shadow' &&
    process.env.ENABLE_TEST_BYPASS === 'true'
  );
}
```

- Evaluated **per request** — no module-level caching of the flag, so a
  misconfigured prod deployment cannot opt in via a single env var.
- Mirrors the `admin-test-reset.ts` dual guard so the project has one
  consistent invariant for "shadow test behavior".

Both bypass call sites switched to the helper:

| Site | Before | After |
| --- | --- | --- |
| Callback (mock codes) | `if (ENABLE_TEST_BYPASS && code.startsWith('MOCK_'))` | `if (isTestBypassEnabled() && code.startsWith('MOCK_'))` |
| `verifyCookieAuth` (sentinel) | `if (ENABLE_TEST_BYPASS && accessToken === 'shadow_e2e_test_token')` | `if (isTestBypassEnabled() && accessToken === 'shadow_e2e_test_token')` |

The deprecated module-scope constant `const ENABLE_TEST_BYPASS = ...` was
removed (the new helper supersedes it). Comments around both call sites and
on `verifyCookieAuth` were updated to describe the **enforced** dual guard,
not the prior intended behavior.

## Files touched
- `src/api/lambda/cognito-auth.ts` — helper added, both sites updated, comments aligned.
- `tests/unit/cognito-auth-bypass.test.ts` — new unit coverage (9 cases).

No other production source files modified. No rollout, frontend, or unrelated
auth refactors bundled in.

## Tests added (9 total)
All cases prescribed by the issue body, plus a direct truth-table on the
predicate:

**`isTestBypassEnabled()` truth table (4)**
1. true only when `APP_STAGE=shadow` and `ENABLE_TEST_BYPASS=true`
2. false when `APP_STAGE=production` even if bypass enabled
3. false when `APP_STAGE` unset even if bypass enabled
4. false when bypass disabled even on shadow

**`handleCallback()` — MOCK_ code bypass (2)**
5. accepts MOCK_ code on shadow + enabled → 302 with `mock_access_token_for_testing` cookie
6. rejects MOCK_ code in production + enabled → no mock cookie set; falls through to token-exchange path (stubbed `fetch` → 500)

**`verifyCookieAuth()` — sentinel token bypass (3)**
7. accepts `shadow_e2e_test_token` on shadow + enabled → returns the stable test identity
8. rejects sentinel token in production + enabled → throws
9. rejects sentinel token on shadow when `ENABLE_TEST_BYPASS=false` → throws

## Env caching in tests
Because the new helper reads `process.env` at call time, the test does **not**
require `jest.resetModules` / dynamic imports for the dual-guard logic itself.
The test mutates only `APP_STAGE` and `ENABLE_TEST_BYPASS` per case (snapshot
in `beforeEach`, restore in `afterEach`).

Module-load-time env vars (`JWT_SECRET`, `COGNITO_*`, `DYNAMODB_USERS_TABLE`,
`SITE_BASE_URL`) are assigned at the top of the test file **before** the SUT
is imported. With `tsconfig` `module=CommonJS`, top-level statements run in
source order so this is sufficient.

## Verification commands

```bash
# Targeted unit test
npm run test:unit -- tests/unit/cognito-auth-bypass.test.ts
#   Test Suites: 1 passed, 1 total
#   Tests:       9 passed, 9 total

# Full unit suite (1 unrelated preexisting failure in certificate-issuance)
npm run test:unit

# Lambda type-check (clean)
npx tsc -p tsconfig.lambda.json --noEmit
```

The preexisting failure in `tests/unit/certificate-issuance.test.ts`
(`handleCertificateVerify › returns 404 when certId is not found in DynamoDB`)
was confirmed on `origin/main` via `git stash`; it is out of scope for #461.

## Scope discipline
Per the lead's re-entry note:
- Did not touch rollout, frontend, or unrelated auth code.
- Did not introduce new abstractions beyond the single predicate.
- Solved with focused unit coverage; no E2E changes needed.
- No broader refactor of `cognito-auth.ts` env reads — the helper reads
  `process.env` at call time, which made the existing module-scope `import`
  side effects irrelevant to the test seam.
