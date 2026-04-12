# Issue #410 Verification — Shadow Module Page Quiz + Lab UX

**Date:** 2026-04-12
**Branch:** issue-410-shadow-module-completion-ui
**Scope:** Shadow-only — no production template changes

---

## Files Changed

### New files
- `clean-x-hedgehog-templates/learn-shadow/module-page.html` — shadow module page template with quiz + lab attestation UX
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-completion.js` — completion framework JS (quiz submit, lab attest, state restore)

### Modified files
- `.gitignore` — scoped `module-page.html` ignore rule to `/module-page.html` (root-only) so shadow template can be tracked

### Unchanged (verified)
- `clean-x-hedgehog-templates/learn/module-page.html` — production template **not modified** (`git diff` shows empty)

---

## Shadow UX Behavior

### Quiz Section (`fabric-operations-welcome`, `fabric-operations-diagnosis-lab`, etc.)
- Rendered server-side by HubL from `quiz_schema_json` + `completion_tasks_json`
- HubL loops over `quiz_schema.questions`, outputs stems and options only
- `correct_answer` field is **never written to the HTML** (server-side field, not included in rendered output)
- Shows below module content when module has both a `quiz` task in `completion_tasks_json` AND a non-empty `quiz_schema_json`
- `Submit Quiz` button calls `POST /tasks/quiz/submit` with `credentials: 'include'`
- Pass result: shows "Quiz Passed ✓ — Score: X%" badge; quiz form hidden
- Fail result: shows "Score: X% (Attempt N) — Need 75% to pass." with "Retake Quiz" button; retake resets all radio inputs

### Lab Attestation Section (`fabric-operations-vpc-provisioning`, most modules)
- Shown when module has a `lab_attestation` task in `completion_tasks_json`
- "Mark Lab Complete" button calls `POST /tasks/lab/attest` with `credentials: 'include'`
- Success: button replaced with "Lab Completed ✓" indicator

### Module Complete Banner
- Appears at top of page when `module_complete: true` from any endpoint, or `module_status: "complete"` from GET /tasks/status
- Text: "Module Complete ✓ — All tasks finished."

### Modules with no tasks (`foundations-recap`, `troubleshooting-framework`, vAIDC modules)
- `foundations-recap`: has `knowledge_check` task type (not `quiz`), no `quiz_schema_json` → no quiz UI, no lab attestation UI → legacy "Mark complete" button remains
- `troubleshooting-framework`: empty `completion_tasks_json` → no task UI rendered
- All modules with neither a `quiz` nor `lab_attestation` task type: no task sections rendered, legacy progress buttons preserved

### No quiz for lab-only modules (`vpc-provisioning`, etc.)
- `quiz_schema_json` is null in HubDB → `has_quiz_task` may be true but HubL `if` guard on `quiz_schema_json` prevents rendering → no quiz section

---

## State Restoration

On `DOMContentLoaded`, `shadow-completion.js` calls:
```
GET https://api.hedgehog.cloud/tasks/status?module_slug=<slug>
  credentials: 'include'
```

Response handling:
| `module_status` | Action |
|---|---|
| `complete` | All task UIs set to "done" state; module-complete banner shown |
| `in_progress`, task `quiz-1` `passed` | Quiz form hidden; "Quiz Passed ✓" badge shown with score |
| `in_progress`, task `quiz-1` `failed` | Quiz form visible; score + attempts shown; retake button shown |
| `in_progress`, task `lab-main` `attested` | Lab button hidden; "Lab Completed ✓" shown |
| `not_started` or fetch error | Initial state maintained (quiz form + lab button visible) |
| 401 | Page load proceeds in initial state (unauthenticated user) |

The state is persisted in DynamoDB (`entity-completions-shadow` table) and read back on each page load. Passing the quiz or attesting the lab persists the result before the state is reflected in the UI.

---

## Security: Correct Answer Protection

`quiz_schema_json` in HubDB contains `correct_answer` fields (server-side grading data).
The shadow template uses HubL `|fromjson` to parse the schema and loops over `quiz_schema.questions`, outputting ONLY `question.id`, `question.stem`, and `option.id` / `option.text`. The `correct_answer` field is **never accessed or output** in the template. Grading happens entirely on the server via `POST /tasks/quiz/submit`.

---

## Shadow-Only Routing Verification

All internal links in the shadow template use `/learn-shadow/*`:
- Breadcrumb: `href="/learn-shadow"`
- Prev/next navigation: `href="/learn-shadow/modules/{{ slug }}"`
- Prerequisites: `href="/learn-shadow/{{ slug }}"`
- Module list view cards: `href="/learn-shadow/modules/{{ slug }}"`

No `/learn/` links in the shadow template (consistent with d35da66 base + no regressions).

---

## Error Handling

| Condition | Behavior |
|---|---|
| 401 from any API call | "Please sign in..." banner with login link |
| 5xx from any API call | "Something went wrong..." message in feedback area |
| Network error | "Could not reach the server..." message in feedback area |
| Page load 401 (unauthenticated) | Silent; initial state preserved (don't block page) |

---

## Legacy Button Handling

When `#hhl-quiz-section` or `#hhl-lab-section` is present (i.e., module has task-based completion):
- `#hhl-mark-complete` button is hidden by `shadow-completion.js`
- `#hhl-mark-started` button is hidden by `shadow-completion.js`

When no task sections are present (modules without quiz/lab tasks): legacy buttons remain visible.

---

## Live Testing Protocol

To verify in shadow environment (`/learn-shadow/modules/fabric-operations-welcome`):

1. **Fresh session (unauthenticated)**: Load page → quiz renders, lab button visible, no module-complete banner
2. **Submit incomplete quiz**: Click "Submit Quiz" without answering all questions → "Please answer all questions" warning
3. **Submit wrong answers**: Submit all wrong → score < 75%, fail badge + "Retake Quiz" button
4. **Retake + correct answers**: Click Retake → form resets → submit correct answers → "Quiz Passed ✓" badge shown
5. **Mark Lab Complete**: Click button → "Lab Completed ✓" shown → module-complete banner appears
6. **Reload page**: Page loads → GET /tasks/status returns `module_status: complete` → both task UIs in done state, module-complete banner

To verify lab-only module (`/learn-shadow/modules/fabric-operations-vpc-provisioning`):
- No quiz section
- "Mark Lab Complete" button present

To verify no-task module (`/learn-shadow/modules/fabric-operations-foundations-recap`):
- No quiz section
- No lab section
- Legacy "Mark complete" button visible

---

## Build Check

```
$ npm run build
(clean exit — no TypeScript compilation of template files; build verifies lambda/sync only)
```

Template changes are HTML/HubL (no build step). JS file is plain ES5-compatible JavaScript (no transpilation required).

---

## API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /tasks/status?module_slug=<slug>` | Page load state restoration |
| `POST /tasks/quiz/submit` | Quiz answer submission |
| `POST /tasks/lab/attest` | Lab completion attestation |

All deployed to shadow stage (lambda URL: `https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com`).
All calls use `credentials: 'include'` for httpOnly cookie auth.
