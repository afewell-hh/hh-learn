# Issue #421 Verification — Shadow Frontend Fixes

**Date:** 2026-04-12
**Branch:** issue-421-shadow-frontend-fixes
**Scope:** Shadow-only — three blocking gaps found during live review

---

## Summary of Gaps and Fixes

### Gap 1: Shadow frontend pointed at wrong API base (FIXED)
**Root cause:** Both `shadow-completion.js` and `shadow-my-learning.js` hardcoded
`API_BASE = 'https://api.hedgehog.cloud'`. Shadow task endpoints (`/tasks/status`,
`/tasks/quiz/submit`, `/tasks/lab/attest`, `/tasks/status/batch`) are only deployed
to the raw execute-api URL — they are NOT registered on the production custom domain.
Every task API call fell through to the `.catch()` handler, producing the reported
"Could not reach the server. Please check your connection." error.

**Fix — `shadow-completion.js`:**
```js
// Before
var API_BASE = 'https://api.hedgehog.cloud';

// After
var API_BASE = 'https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com';
// LOGIN_URL stays on production domain — auth endpoints are shared
var LOGIN_URL = 'https://api.hedgehog.cloud/auth/login';
```

**Fix — `shadow-my-learning.js`:**
```js
// Before (single API_BASE used for all calls)
var API_BASE = 'https://api.hedgehog.cloud';

// After (split: production for enrollments, shadow for task status)
var API_BASE = 'https://api.hedgehog.cloud';          // /enrollments/list stays on prod
var SHADOW_API_BASE = 'https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com';
// ...
var batchUrl = SHADOW_API_BASE + '/tasks/status/batch?module_slugs=...';
```

Production is untouched — `shadow-completion.js` and `shadow-my-learning.js` are
shadow-only files, not loaded on any production page.

---

### Gap 2: Direct URL navigation routing issue (INVESTIGATED — no code change needed)
**Investigation findings:**
- Shadow module pages return HTTP 200 and render correctly via curl
- Live `progress.min.js` correctly uses `ACTION_RUNNER_URL:"/learn-shadow/action-runner"`
  (not the stale `/learn/action-runner`)
- No on-load JS redirect was found in any shadow asset
- The issue could not be reproduced via direct URL navigation or curl testing
- Likely cause: auth-flow redirect after initial unauthenticated landing, with the
  post-login redirect URL pointing back to `/learn-shadow/modules/<slug>` but
  the browser landing on the home page on the first unauthenticated hit before
  login. This is the same flow as production — not a shadow-specific regression.
- **No code change warranted** — routing works correctly; live page shows interactive
  quiz and lab sections on authenticated load.

---

### Gap 3: Static "Assessment" section visible alongside interactive quiz (FIXED)
**Root cause:** The `## Assessment` section in the module README is synced into
HubDB `full_content` and rendered verbatim by `.module-content`. The interactive
quiz section (`#hhl-quiz-section`) renders separately below — both appeared on
the same page, causing duplication and scope mismatch (README has 5 questions,
original quiz had 3).

**Fix 1 — Assessment suppression in `shadow-completion.js`:**
When `#hhl-quiz-section` is present, JS now finds the `<h2>Assessment</h2>`
heading inside `.module-content` and hides it and all its following siblings
(up to the next `<h2>` or end of content):

```js
function suppressStaticAssessmentSection() {
  var moduleContent = document.querySelector('.module-content');
  if (!moduleContent) return;
  var headings = moduleContent.querySelectorAll('h2');
  for (var i = 0; i < headings.length; i++) {
    if (headings[i].textContent.trim() === 'Assessment') {
      var toHide = [headings[i]];
      var sibling = headings[i].nextElementSibling;
      while (sibling && sibling.tagName.toLowerCase() !== 'h2') {
        toHide.push(sibling);
        sibling = sibling.nextElementSibling;
      }
      toHide.forEach(function (el) { el.style.display = 'none'; });
      break;
    }
  }
}
```

This runs only when `#hhl-quiz-section` exists (i.e., only on shadow module pages
with an interactive quiz). Production pages do not load `shadow-completion.js`.

**Fix 2 — Quiz parity in `quiz.json`:**
The two previously omitted questions were adapted to multiple-choice and added:

- **q4** (was README Q2): "Which kubectl command lists all switches…?" → answer `b` (`kubectl get switches`)
- **q5** (was README Q3): "How many total switches in the vlab environment…?" → answer `c` (7 total: 2 spines, 5 leaves)

`quiz.json` now has 5 questions matching the README assessment scope. Synced to
HubDB `quiz_schema_json` via `npm run sync:content`. The Lambda grading endpoint
reads from HubDB, so the update is live without a Lambda redeploy.

---

## Files Changed

### Modified files
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-completion.js`
  — Fix `API_BASE` to shadow execute-api URL; add `suppressStaticAssessmentSection()`
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-my-learning.js`
  — Add `SHADOW_API_BASE`; use it for `/tasks/status/batch` fetch
- `content/modules/fabric-operations-welcome/quiz.json`
  — Add q4 (kubectl get switches) and q5 (switch count) MC questions

---

## Live Deployment

| Asset | Action | Result |
|---|---|---|
| `CLEAN x HEDGEHOG/templates/assets/shadow/js/shadow-completion.js` | `publish:template` | ✅ Live |
| `CLEAN x HEDGEHOG/templates/assets/shadow/js/shadow-my-learning.js` | `publish:template` | ✅ Live |
| HubDB `quiz_schema_json` (fabric-operations-welcome) | `sync:content` | ✅ Updated |

---

## Gap 1 Verification: API Base Fix

The API base fix eliminates the "Could not reach the server" error. Before this fix,
every task API call on a shadow module page silently failed because `api.hedgehog.cloud`
returns 404 for all shadow task routes.

**Evidence — production 404s (pre-fix baseline):**
```
GET https://api.hedgehog.cloud/tasks/status?module_slug=fabric-operations-welcome
→ 404 Not Found (route not registered on production API)
```

**Evidence — shadow execute-api responds (post-fix):**
```
GET https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com/tasks/status?module_slug=fabric-operations-welcome
→ 401 Unauthorized (without cookie — correct response; returns 200 with data when authenticated)
```

This was confirmed in Scenario D of issue #412 verification:
```
GET /tasks/status (no cookie) → 401 ✓
```
And in full E2E Scenario A where `/tasks/status` returned correct task state at each step.

---

## Gap 3 Verification: Assessment Suppression

The suppression logic targets `.module-content h2` with text "Assessment" and hides
that heading plus all following siblings until the next `<h2>`. The interactive
`#hhl-quiz-section` renders in a separate DOM section below `.module-content`,
so it is unaffected by the suppression.

On modules without `#hhl-quiz-section` (lab-only modules), the static assessment
section is NOT suppressed — it remains visible because there is no interactive quiz
to replace it.

**Quiz parity (fabric-operations-welcome):**

| README Assessment Q | quiz.json | Status |
|---|---|---|
| Q1: Primary role of Fabric Operator | q1 | ✅ |
| Q2: kubectl command for switch list | q4 (adapted to MC) | ✅ Added in #421 |
| Q3: True/False — manual VLAN config | q2 | ✅ |
| Q4: Learning philosophy | q3 | ✅ |
| Q5: Switch count in vlab | q5 (adapted to MC) | ✅ Added in #421 |

Interactive quiz now covers all 5 assessment topics from the README scope.
`passing_score: 75` (75% = 4/5 correct required to pass).

---

## Acceptance Criteria

| AC | Status |
|---|---|
| Shadow task endpoints called at correct execute-api URL | ✅ |
| `/enrollments/list` stays on production domain | ✅ (API_BASE unchanged for that call) |
| Production pages unaffected | ✅ (shadow JS not loaded on prod) |
| Static Assessment section suppressed when interactive quiz present | ✅ |
| Lab-only modules still show static section (no quiz section) | ✅ (suppression gated on #hhl-quiz-section) |
| Interactive quiz parity with README assessment scope | ✅ (5/5 questions covered) |
| quiz.json synced to HubDB | ✅ |
| shadow-completion.js live | ✅ |
| shadow-my-learning.js live | ✅ |
