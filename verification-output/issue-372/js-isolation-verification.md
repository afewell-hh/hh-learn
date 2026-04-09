# Phase 0B Correction: Shadow JS Runtime Isolation — Issue #372

## Problem Found (PR #378 Review)

The shadow JS files cloned from production in Phase 0A still contained production paths as hardcoded fallbacks. These are not overridden by data attributes — they fire when `constants.ACTION_RUNNER_URL` is absent or falsy, or in `.catch()` error paths.

### Files Affected

| File | Issue |
|---|---|
| `assets/shadow/js/enrollment.js` | `getConstants()` default, `getActionRunnerBase()` fallback, `buildRunnerUrl()` base fallback — all `/learn/action-runner` |
| `assets/shadow/js/progress.js` | Same 3 fallback sites PLUS `.catch()` hard fallback that set `TRACK_EVENTS_ENABLED: true` and `TRACK_EVENTS_URL: 'https://api.hedgehog.cloud/events/track'` |
| `assets/shadow/js/my-learning.js` | 5 runtime link constructions: module card href, last-viewed resume href, enrollment card href, module list links, "Continue to Next Module" CTA |

---

## Changes Made

### enrollment.js — 3 sites fixed

```diff
- ACTION_RUNNER_URL: '/learn/action-runner'   // getConstants() default
+ ACTION_RUNNER_URL: '/learn-shadow/action-runner'

- return '/learn/action-runner';              // getActionRunnerBase() fallback
+ return '/learn-shadow/action-runner';

- var runner = base || '/learn/action-runner'; // buildRunnerUrl() base fallback
+ var runner = base || '/learn-shadow/action-runner';
```

### progress.js — 4 sites fixed (including critical .catch() hard fallback)

```diff
// .catch() hard fallback — was ENABLING writes on error:
- TRACK_EVENTS_ENABLED: true,
- TRACK_EVENTS_URL: 'https://api.hedgehog.cloud/events/track',
- ENABLE_CRM_PROGRESS: true,
- ACTION_RUNNER_URL: '/learn/action-runner'
// Now safe in all error paths:
+ TRACK_EVENTS_ENABLED: false,
+ TRACK_EVENTS_URL: '',
+ ENABLE_CRM_PROGRESS: false,
+ ACTION_RUNNER_URL: '/learn-shadow/action-runner'

- return '/learn/action-runner';              // getActionRunnerBase() fallback
+ return '/learn-shadow/action-runner';

- var runner = base || '/learn/action-runner'; // buildRunnerUrl() base fallback
+ var runner = base || '/learn-shadow/action-runner';
```

### my-learning.js — 5 runtime links fixed

```diff
- a.href = '/learn/' + (module.path || ...)          // module card href
+ a.href = '/learn-shadow/' + (module.path || ...)

- var href = last.type === 'course' ? ('/learn/courses/' + ...) : ('/learn/' + ...) // resume link
+ var href = last.type === 'course' ? ('/learn-shadow/courses/' + ...) : ('/learn-shadow/' + ...)

- var href = type === 'pathway' ? ('/learn/pathways/' + ...) : ('/learn/courses/' + ...) // enrollment card
+ var href = type === 'pathway' ? ('/learn-shadow/pathways/' + ...) : ('/learn-shadow/courses/' + ...)

- <a href="/learn/'+modPath+'" ...>                   // module list links
+ <a href="/learn-shadow/'+modPath+'" ...>

- <a href="/learn/'+nextPath+'" class="enrollment-cta"> // Continue CTA
+ <a href="/learn-shadow/'+nextPath+'" class="enrollment-cta">
```

---

## Write-Isolation Guarantee After Fix

Shadow enrollment/progress flows cannot reach the production write path because:

1. **`data-track-events-url` is empty** → `action-runner.js` guards against empty `trackUrl` and skips `fetch()`
2. **`data-enable-crm="false"`** → enrollment.js, progress.js, my-learning.js skip CRM calls
3. **All `ACTION_RUNNER_URL` constants and JS fallbacks** now point to `/learn-shadow/action-runner`, not `/learn/action-runner`
4. **`progress.js` `.catch()` hard fallback** — previously would have re-enabled writes if an error occurred reading constants; now sets `TRACK_EVENTS_ENABLED: false` and `TRACK_EVENTS_URL: ''` even on error
5. **The shadow action-runner template** (`learn-shadow/action-runner.html`) has `TRACK_EVENTS_URL: ''` in its constants block, so even if the shadow action-runner is reached, it cannot post events to the backend

No path through the shadow JS can construct a URL to `/learn/action-runner` at runtime.

---

## Other Shadow JS Files Checked

| File | Status |
|---|---|
| `action-runner.js` | No action-runner URL construction — it's the runner itself |
| `courses.js` | `/learn/action-runner` appears only in JSDoc comments, not runtime code |
| `pathways.js` | Same — JSDoc comments only |
| `login-helper.js` | `/learn/my-learning` appears only in a `@example` JSDoc block |
| `pageview.js` | No action-runner references |
| `auth.js`, `cognito-*.js` | Auth only — no action-runner references |

---

## Deploy Confirmation

- All 65 files uploaded to HubSpot DRAFT: ✓ (0 failures)
- `assets/shadow/js/enrollment.js` published live: ✓
- `assets/shadow/js/progress.js` published live: ✓
- `assets/shadow/js/my-learning.js` published live: ✓
- All 7 shadow CMS pages republished: ✓
