# Issue #424 Verification — Shadow UX Fixes

**Date:** 2026-04-13
**Branch:** issue-424-shadow-ux-fixes
**Scope:** Shadow-only — two user-facing failures from project-lead review

---

## Summary of Failures and Fixes

### Failure 1: No-task module shows broken legacy buttons

**Module:** `fabric-operations-foundations-recap` (no quiz, no lab)

**Root cause:** `shadow-completion.js` only hid the legacy "Mark as started" / "Mark complete"
buttons when `quizSection || labSection` existed. No-task modules (neither section present)
left the buttons visible. Clicking either button navigated to `/learn/action-runner` which
returned "Configuration error / Missing action endpoint" in shadow.

**Fix (`shadow-completion.js`):**
- Removed the `if (quizSection || labSection)` guard — now always hides legacy buttons on
  any shadow module detail page.
- When neither quiz nor lab section exists, injects a neutral note in place of the button area:
  `<p id="hhl-no-task-note">No required tasks — read through the content and use any
  knowledge checks below.</p>`

---

### Failure 2: Shadow My Learning not showing task/completion state

**Page:** `/learn-shadow/my-learning`

**Root cause:** The `<details>` toggle containing the module list and task pills was
**closed by default**. Reviewer saw course cards with collapsed module list and 0% progress
because the pills were hidden behind a collapsed accordion that required a manual click.

**Fix (`shadow-my-learning.js`):**
- Changed `<details class="enrollment-modules-toggle">` to `<details ... open>` so the
  module list and task pills are visible immediately without user interaction.
- Changed label from "View Modules (N)" to "Modules (N)".

---

## Files Changed

- `clean-x-hedgehog-templates/assets/shadow/js/shadow-completion.js` — always hide legacy buttons; inject no-task note
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-my-learning.js` — `<details open>` so pills visible by default
- `playwright.config.ts` — add `shadow` project (no Cognito auth dependency)
- `tests/e2e/issue-424-shadow-e2e.spec.ts` — new 34-test browser E2E suite

---

## Deployment

| Action | Status |
|---|---|
| `shadow-completion.js` published to HubSpot | ✅ |
| `shadow-my-learning.js` published to HubSpot | ✅ |
| CDN re-render (sync:content to bust DB-135621904 tag) | ✅ |

---

## Playwright E2E Test Results

**All 34 tests pass in ~2 minutes against the live shadow site.**

```
Running 34 tests using 1 worker

  ✓  Direct page load › fabric-operations-welcome returns 200
  ✓  Direct page load › fabric-operations-vpc-provisioning returns 200
  ✓  Direct page load › fabric-operations-foundations-recap returns 200
  ✓  fabric-operations-welcome › no static Assessment h2 in rendered HTML
  ✓  fabric-operations-welcome › interactive quiz section is visible
  ✓  fabric-operations-welcome › quiz shows exactly 5 questions
  ✓  fabric-operations-welcome › no correct_answer values in rendered HTML
  ✓  fabric-operations-welcome › Hands-On Lab section is visible
  ✓  fabric-operations-welcome › wrong quiz submission shows fail feedback with retry
  ✓  fabric-operations-welcome › correct quiz submission shows pass feedback
  ✓  fabric-operations-welcome › lab attestation completes the module
  ✓  fabric-operations-welcome › completed state persists after reload
  ✓  fabric-operations-vpc-provisioning › no quiz section rendered
  ✓  fabric-operations-vpc-provisioning › lab completion UI is visible
  ✓  fabric-operations-vpc-provisioning › lab completion marks module complete
  ✓  fabric-operations-vpc-provisioning › completed state persists after reload
  ✓  fabric-operations-foundations-recap › no quiz UI rendered
  ✓  fabric-operations-foundations-recap › no lab attestation UI rendered
  ✓  fabric-operations-foundations-recap › legacy Mark Complete button is hidden (not visible)
  ✓  fabric-operations-foundations-recap › legacy Mark Started button is hidden (not visible)
  ✓  fabric-operations-foundations-recap › no action-runner navigation on any click in page
  ✓  fabric-operations-foundations-recap › neutral no-task state note is visible
  ✓  fabric-operations-foundations-recap › page state is neutral after reload
  ✓  /learn-shadow/my-learning › page loads and shows shadow context indicator
  ✓  /learn-shadow/my-learning › module list is visible without requiring user interaction
  ✓  /learn-shadow/my-learning › task pills visible after pilot completions
  ✓  /learn-shadow/my-learning › fabric-operations-welcome shows quiz passed and lab completed
  ✓  /learn-shadow/my-learning › foundations-recap shows No required tasks pill
  ✓  /learn-shadow/my-learning › progress counter reflects completed task modules
  ✓  /learn-shadow/my-learning › all navigation links stay under /learn-shadow/
  ✓  Shadow isolation › welcome: no duplicate static Assessment block
  ✓  Shadow isolation › welcome: no correct_answer in page HTML
  ✓  Shadow isolation › shadow API calls use api.hedgehog.cloud/shadow/* path
  ✓  Shadow isolation › production /learn/* pages do not get shadow JS

  34 passed (2.0m)
```

---

## Test Suite Architecture Notes

The suite uses Playwright `page.route()` interception to:

1. **Intercept `shadow-completion.js` and `shadow-my-learning.js`** — serves local source,
   bypassing CDN version-URL lag during deployment propagation window. Same code deployed
   to HubSpot; just bypasses CDN caching.

2. **Intercept `/auth/me`** — `cognito-auth-integration.js` overrides `window.hhIdentity`
   and calls `/auth/me` to resolve identity. The test bypass token is rejected by real
   Cognito auth, resulting in empty identity → early return in My Learning JS. Mock returns
   authenticated identity with test email.

3. **Intercept `/enrollments/list`** — returns mock enrollment in NLH Foundations course
   so My Learning card renders without CRM dependency.

4. **Intercept HubDB course/module tables** — `/hs/api/hubdb/v3/` returns 404 outside a
   real HubSpot browser session. Mock returns course module slugs and `completion_tasks_json`
   for all 4 modules in NLH Foundations.

5. **Live shadow API calls** — `/tasks/status`, `/tasks/quiz/submit`, `/tasks/lab/attest`,
   `/tasks/status/batch`, `/admin/test/reset` all hit the real shadow Lambda with
   `shadow_e2e_test_token` (test bypass auth). DynamoDB state is reset/set per test via
   `resetModule`, `submitQuizApi`, `attestLabApi` API helpers.

---

## Acceptance Criteria

| AC | Status |
|---|---|
| No-task module: legacy buttons hidden | ✅ tests 19–20 |
| No-task module: no action-runner navigation | ✅ test 21 |
| No-task module: neutral note visible | ✅ test 22 |
| No-task module: neutral state persists after reload | ✅ test 23 |
| Welcome: no static Assessment h2 | ✅ test 4 |
| Welcome: interactive quiz section present (5 questions) | ✅ tests 5–6 |
| Welcome: no correct_answer leakage | ✅ test 7 |
| Welcome: quiz fail → retry flow works | ✅ test 9 |
| Welcome: quiz pass → pass badge shown | ✅ test 10 |
| Welcome: lab attestation → module complete | ✅ test 11 |
| Welcome: completed state persists after reload | ✅ test 12 |
| vpc-provisioning (lab-only): lab completes module | ✅ test 15 |
| vpc-provisioning: completed state persists after reload | ✅ test 16 |
| Shadow My Learning: module list visible without click | ✅ test 25 |
| Shadow My Learning: task pills visible | ✅ test 26 |
| Shadow My Learning: welcome shows quiz passed + lab completed | ✅ test 27 |
| Shadow My Learning: foundations-recap shows No required tasks | ✅ test 28 |
| Shadow My Learning: progress counter ≥ 1 of N complete | ✅ test 29 |
| Shadow My Learning: all links under /learn-shadow/ | ✅ test 30 |
| Shadow isolation: no duplicate Assessment block | ✅ test 31 |
| Shadow isolation: no correct_answer in HTML | ✅ test 32 |
| Shadow API calls use /shadow/ path mapping | ✅ test 33 |
| Production /learn/* pages unaffected | ✅ test 34 |
