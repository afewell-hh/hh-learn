# Issue #424 Verification — Shadow UX Fixes

**Date:** 2026-04-13
**Branch:** issue-424-shadow-ux-fixes
**Scope:** Shadow-only — two user-facing failures from project-lead review

---

## Summary of Fixes

### Fix 1: No-task module shows broken legacy buttons

**Module:** `fabric-operations-foundations-recap` (no quiz, no lab)

**Root cause:** `shadow-completion.js` only hid the legacy "Mark as started" / "Mark complete"
buttons when `quizSection || labSection` existed. No-task modules left buttons visible.
Clicking either navigated to `/learn/action-runner` → "Configuration error / Missing action
endpoint" in shadow.

**Fix (`shadow-completion.js`):**
- Removed the `if (quizSection || labSection)` guard — always hides legacy buttons on any
  shadow module detail page.
- When neither quiz nor lab section exists, injects a neutral note in `.module-progress-cta`:
  `<p id="hhl-no-task-note">No required tasks — read through the content and use any
  knowledge checks below.</p>`

### Fix 2: Shadow My Learning not showing task/completion state

**Page:** `/learn-shadow/my-learning`

**Root cause:** The `<details>` toggle containing the module list and task pills was closed
by default. Reviewer saw course cards with collapsed module list and 0% progress because
pills were hidden behind a collapsed accordion requiring a manual click.

**Fix (`shadow-my-learning.js`):**
- Changed `<details class="enrollment-modules-toggle">` to `<details ... open>` so the
  module list and task pills are visible immediately without user interaction.
- Changed label from "View Modules (N)" to "Modules (N)".

---

## Files Changed

| File | Change |
|---|---|
| `clean-x-hedgehog-templates/assets/shadow/js/shadow-completion.js` | Always hide legacy buttons; inject no-task note |
| `clean-x-hedgehog-templates/assets/shadow/js/shadow-my-learning.js` | `<details open>` so pills visible by default |
| `clean-x-hedgehog-templates/learn-shadow/module-page.html` | Added redeploy comment to bust template CDN cache |
| `playwright.config.ts` | Replaced `shadow` project with `shadow-deterministic` + `shadow-live` |
| `tests/e2e/shadow-deterministic.spec.ts` | Layer 1: 34-test deterministic frontend regression suite |
| `tests/e2e/shadow-live.spec.ts` | Layer 2: 17-test live acceptance suite with CDN verification + screenshots |

---

## Deployment

| Action | Status |
|---|---|
| `shadow-completion.js` published to HubSpot Design Manager (`templates/assets/shadow/js/`) | ✅ |
| `shadow-my-learning.js` published to HubSpot Design Manager | ✅ |
| `module-page.html` re-published (forced template re-render for CDN URL propagation) | ✅ |
| CDN re-render — all shadow module pages now reference new JS URL (`1776046773191`) | ✅ |
| `sync:content` run to publish HubDB module table | ✅ |

**CDN verification:**
- Old `shadow-completion.js` CDN URL: `...1776034785801/template_shadow-completion.min.js` (pre-fix)
- New `shadow-completion.js` CDN URL: `...1776046773191/template_shadow-completion.min.js` (with fix)
- All three shadow module pages now reference the new URL (verified 2026-04-13T05:20 UTC)

---

## Two-Layer Test Strategy

### Layer 1 — Deterministic Frontend Regression (`shadow-deterministic`)

**Purpose:** Verify that `shadow-completion.js` and `shadow-my-learning.js` render the
correct UI for all three shadow module types against known API state. Eliminates CDN
propagation delay as a variable by intercepting JS with byte-identical local source.

**Allowed mocks (each documented in file header):**
1. `shadow-completion.js` + `shadow-my-learning.js` JS interception — CDN lag bypass;
   served from `fs.readFileSync` of committed repo source (byte-identical to deployed file).
2. `/auth/me` — `cognitoMe()` uses `verifyJWT()` with Cognito JWKS; test bypass token
   not accepted. Permanently unavoidable without Lambda routing change.
3. `/enrollments/list` — test user not enrolled in CRM.
4. HubDB tables `135381433` + `135621904` — return 404 outside a HubSpot portal session.

**Results: 34/34 passed (~2.0 min)**

```
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

### Layer 2 — Live Shadow Acceptance (`shadow-live`)

**Purpose:** Verify the fix works against the real live shadow site. Module page tests
(foundations-recap, welcome, vpc-provisioning) run with **zero mocks**: real CDN JS,
real Lambda, real DynamoDB via `shadow_e2e_test_token` test bypass. Includes CDN asset
content verification (fetches live CDN URLs captured from page loads) and 6 screenshots.

**Unavoidable mocks (My Learning section only):**

| Mock | Target | Why unavoidable | What remains unproven |
|---|---|---|---|
| MOCK 1 | `/auth/me` | `cognitoMe()` uses `verifyJWT()` with Cognito JWKS; test bypass token not accepted here | Real Cognito JWT auth flow (covered by `e2e` project) |
| MOCK 2 | `/enrollments/list` | Test user not enrolled in CRM → empty response | Real CRM enrollment data shape |
| MOCK 3 | HubDB tables `135381433` + `135621904` | Returns 404 outside HubSpot portal session | Real HubDB row structure (mock verified against sync:content output) |

**Results: 17/17 passed (~1.3 min)**

```
  ✓  CDN Asset Verification › shadow-completion.js CDN copy contains hhl-no-task-note fix
  ✓  CDN Asset Verification › shadow-my-learning.js CDN copy contains details[open] fix
  ✓  foundations-recap [LIVE — zero mocks] › legacy Mark Complete button is hidden (not visible)
  ✓  foundations-recap [LIVE — zero mocks] › legacy Mark Started button is hidden (not visible)
  ✓  foundations-recap [LIVE — zero mocks] › no action-runner navigation on page load
  ✓  foundations-recap [LIVE — zero mocks] › neutral no-task note is visible — screenshot 01
  ✓  fabric-operations-welcome [LIVE — zero mocks] › interactive quiz section is visible — screenshot 02
  ✓  fabric-operations-welcome [LIVE — zero mocks] › no correct_answer leakage in page HTML
  ✓  fabric-operations-welcome [LIVE — zero mocks] › wrong quiz submission → fail feedback + retake — screenshot 03
  ✓  fabric-operations-welcome [LIVE — zero mocks] › correct quiz → pass badge; lab attest → module complete — screenshots 04 + 05
  ✓  fabric-operations-vpc-provisioning [LIVE — zero mocks] › lab attestation UI is visible
  ✓  fabric-operations-vpc-provisioning [LIVE — zero mocks] › lab attestation marks module complete
  ✓  My Learning [LIVE — 3 unavoidable mocks] › module list is visible without requiring user interaction — screenshot 06
  ✓  My Learning [LIVE — 3 unavoidable mocks] › task pills visible — real /tasks/status/batch response
  ✓  My Learning [LIVE — 3 unavoidable mocks] › welcome shows quiz passed + lab completed pills
  ✓  My Learning [LIVE — 3 unavoidable mocks] › foundations-recap shows No required tasks pill
  ✓  My Learning [LIVE — 3 unavoidable mocks] › progress counter is ≥1 after welcome completion

  17 passed (1.3m)
```

---

## Screenshots (Layer 2 — Live Shadow Site)

All 6 screenshots saved in `verification-output/issue-424/screenshots/`:

| File | What it shows |
|---|---|
| `01-foundations-recap-neutral.png` | `#hhl-no-task-note` visible, no legacy buttons |
| `02-welcome-quiz-visible.png` | Interactive quiz section rendered from live CDN JS |
| `03-welcome-quiz-fail.png` | Fail feedback + Retake Quiz button (real Lambda response) |
| `04-welcome-quiz-pass.png` | Quiz Passed badge (real Lambda grade) |
| `05-welcome-module-complete.png` | Module Complete banner after real lab attest |
| `06-my-learning-module-list.png` | Module list visible by default; task pills visible |

---

## Acceptance Criteria

| AC | Layer 1 | Layer 2 |
|---|---|---|
| No-task module: legacy buttons hidden | ✅ tests 19–20 | ✅ tests 3–4 (live CDN) |
| No-task module: no action-runner navigation | ✅ test 21 | ✅ test 5 (live) |
| No-task module: neutral note visible | ✅ test 22 | ✅ test 6 + screenshot 01 |
| No-task module: neutral state persists after reload | ✅ test 23 | — |
| Welcome: no static Assessment h2 | ✅ test 4 | — |
| Welcome: interactive quiz section present (5 questions) | ✅ tests 5–6 | ✅ test 7 + screenshot 02 |
| Welcome: no correct_answer leakage | ✅ test 7 | ✅ test 8 |
| Welcome: quiz fail → retry flow | ✅ test 9 | ✅ test 9 + screenshot 03 |
| Welcome: quiz pass → pass badge | ✅ test 10 | ✅ test 10 + screenshot 04 |
| Welcome: lab attest → module complete | ✅ test 11 | ✅ test 10 + screenshot 05 |
| Welcome: completed state persists after reload | ✅ test 12 | — |
| vpc-provisioning: lab completes module | ✅ test 15 | ✅ test 12 (live) |
| Shadow My Learning: module list visible without click | ✅ test 25 | ✅ test 13 + screenshot 06 |
| Shadow My Learning: task pills visible | ✅ test 26 | ✅ test 14 |
| Shadow My Learning: welcome shows quiz passed + lab | ✅ test 27 | ✅ test 15 |
| Shadow My Learning: foundations-recap No required tasks | ✅ test 28 | ✅ test 16 |
| Shadow My Learning: progress counter ≥ 1 of N | ✅ test 29 | ✅ test 17 |
| Shadow My Learning: all links under /learn-shadow/ | ✅ test 30 | — |
| Shadow isolation: no duplicate Assessment block | ✅ test 31 | — |
| Shadow isolation: no correct_answer in HTML | ✅ test 32 | — |
| Shadow API calls use /shadow/ path | ✅ test 33 | — |
| Production /learn/* unaffected | ✅ test 34 | — |
| CDN shadow-completion.js has hhl-no-task-note fix | — | ✅ CDN test 1 |
| CDN shadow-my-learning.js has details[open] fix | — | ✅ CDN test 2 |
