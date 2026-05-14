---
title: GitHub Projects – Best Practices
owner: hh-learn project lead
status: living
last-reviewed: 2025-10-19
---

# GitHub Projects – Best Practices

This is the canonical guide for planning and tracking Hedgehog Learn (HHL) using GitHub Projects (new), Issues, and PR workflows. Keep this document updated as our process evolves.

## Goals
- Single source of truth for scope, status, and ownership.
- Predictable flow from idea → delivery with lightweight automation.
- Require docs and authoring updates as part of “done”.

## Project Structure
- **Single HHL Project** at the org or repo level with these views:
  - Board (kanban, default)
  - Roadmap (group by Milestone)
  - Content Ops (filter: `type:content`)
  - Engineering (filter: `type:feature, type:bug, type:chore`)

### Board Columns
- Backlog → Ready → In Progress → In Review → Blocked → Done

### Project Fields
- `Priority`: P0, P1, P2, P3
- `Type`: feature, bug, docs, content, chore
- `Area`: cms-template, hubdb-sync, lambda, analytics, docs, content
- `Iteration`: 2-week cadence (e.g., 2025-10-06 → 2025-10-17)

AI/GitOps validation:
- `Release`: free-text field (e.g., product@1.6.2) optionally added to Issues created by the release trigger workflow.

### Labels (Issues/PRs)
- `type/*` (feature|bug|docs|content|chore)
- `area/*` (cms-template|hubdb-sync|lambda|analytics|docs|content)
- `priority/*` (P0|P1|P2|P3)
- `blocked` (when applicable)

> Tip: Create matching labels in the repo settings so automation rules remain simple.

## Issue Hygiene
- Use provided templates (feature, bug, docs, content module).
- One clear outcome per issue. Use checklists for sub-tasks.
- Add `Priority`, `Type`, `Area`, `Iteration`, and `Milestone`.
- Link related issues (e.g., content issue links to template changes).

## PR Hygiene
- Link the PR to the Issue(s) and the Project.
- Small, scoped PRs; include screenshots for UI changes.
- Ensure required checklist is complete (docs & authoring updates).

## Automation Rules (Projects)
- When Issue is added to project and `Priority` set, move to **Backlog**.
- When Issue is assigned and work begins (or PR opens), move to **In Progress**.
- When PR is set to `Ready for Review`, move to **In Review**.
- When PR closes with linked Issue, move Issue to **Done**.
- Auto-archive Done items after 14 days.

### Setup (once)
To enable the automation workflow in `.github/workflows/project-automation.yml`, set repository variables in GitHub → Settings → Variables → Repository variables:
- `PROJECT_OWNER` – your org or user login (e.g., `hedgehog-cloud`).
- `PROJECT_NUMBER` – the Project (new) number (visible in the Project URL).
- `PROJECT_STATUS_FIELD` – name of your single-select field for status (default `Status`).

The workflow will:
- Add new Issues/PRs to the configured Project.
- Set the Status field based on events (Issue opened/assigned/closed, PR opened/ready for review/closed).
- Release trigger workflow (`.github/workflows/release-trigger.yml`) opens Maintenance Validation issues for mapped modules when a product release occurs. Use `repository_dispatch` with type `product_release` and payload `{ "product": "hedgehog-platform", "version": "1.6.2", "channel": "stable" }`.

Note: Ensure your Project contains a single-select field named `Status` with options: Backlog, Ready, In Progress, In Review, Blocked, Done.

## Milestones & Roadmap
- Milestones mirror “release trains” or learning drops (e.g., `Learn v0.2 – Video & Quizzes`).
- Every issue in a milestone has a clear acceptance criterion.

## Definitions of Ready/Done

### Definition of Ready
- Clear problem statement with acceptance criteria
- `Type`, `Area`, and `Priority` labels set
- Dependencies identified and linked
- Assigned to appropriate iteration/milestone

### Definition of Done (MANDATORY)
**All issues MUST follow this process. No exceptions.**

1. **Implementation**
   - Code complete with passing unit tests
   - Lint and build errors resolved
   - Templates validated (for CMS changes)

2. **Pull Request (REQUIRED)**
   - PR created from feature branch
   - PR linked to issue(s) via "Closes #XXX" or "Fixes #XXX"
   - PR title follows conventional commit format
   - PR description includes summary and testing notes
   - Screenshots attached for UI changes

3. **CI Validation (REQUIRED)**
   - All CI checks passing:
     - Lint (`npm run lint`)
     - Build (`npm run build`)
     - Unit tests (`npm test`)
     - E2E tests (where applicable)
     - Template validation (for CMS changes)
   - No merge until all checks green

4. **Code Review (REQUIRED)**
   - At least one approval from project owner or area expert
   - All review comments addressed
   - Auto code review (`@codex review`) completed

5. **Verification Evidence (REQUIRED)**
   - Artifacts stored in `verification-output/issue-XXX/`
   - Must include:
     - Implementation summary
     - Test results or manual test script
     - Deployment/publish logs (where applicable)
     - Screenshots or curl output demonstrating functionality
   - Evidence linked in PR and issue closing comment

6. **Documentation**
   - `docs/course-authoring.md` updated (if content authoring affected)
   - `docs/auth-and-progress.md` updated (if auth/progress affected)
   - API documentation updated (if Lambda endpoints changed)
   - This file updated (if process changed)

7. **Deployment**
   - Templates published via `publish-template` script (for CMS)
   - Lambda deployed via `serverless deploy` (for backend)
   - HubDB synced if schema changed
   - Deployment verified in production

8. **Issue Closure**
   - All acceptance criteria checked off
   - Closing comment includes:
     - Link to merged PR
     - Summary of changes
     - Link to verification artifacts
     - Deployment status
   - Issue status moved to Done in GitHub Project

### Enforcement
**Issues closed without following this process MUST be reopened.**
Per Issue #217, work done without PRs must be retroactively documented
and reviewed before being considered complete.

## Cadence
- Weekly triage/grooming: review Backlog → Ready; rebalance priorities.
- Iteration planning: assign issues to the next 2-week Iteration.
- Retro: capture process improvements and update this doc.

## Documentation Requirements
- For any change impacting authors or content structure: update `docs/course-authoring.md` and link the commit in the PR.
- For any process/tooling change: update this file and `docs/content-sync.md` if relevant.
- For template/UI refactors that do not change authoring behavior (e.g., swapping inline nav for shared macro in `catalog.html`), note the change here to satisfy the docs gate.

## Publish Flow (v3)

- Validate → Draft → Publish is the required order for Design Manager assets.
- Use the “published” validator by default so HubL dependencies (macros, CSS/JS) resolve against live assets.
- Commands (examples):
  - Validate only: `npm run validate:template -- --path "CLEAN x HEDGEHOG/templates/learn/catalog.html" --local "clean-x-hedgehog-templates/learn/catalog.html" --env published`
  - Publish template: `npm run publish:template -- --path "CLEAN x HEDGEHOG/templates/learn/courses-page.html" --local "clean-x-hedgehog-templates/learn/courses-page.html" --validate-env published`
  - Publish constants: `npm run publish:constants`

Notes
- Validator warnings: we proceed when results contain only `DEPRECATED_HUBL_PROPERTY` warnings and fail-fast otherwise.
- Always prefer absolute macro imports (e.g., `/CLEAN x HEDGEHOG/templates/learn/macros/left-nav.html`).

### Template Publishing Utility (HubSpot CMS)
- When updating templates or CSS/JS in `clean-x-hedgehog-templates/**`, publish the asset to the PUBLISHED environment using the utility added in this iteration.
- Usage:
  - Publish a template (register page):
    - `npm run publish:template -- --path "CLEAN x HEDGEHOG/templates/learn/register.html" --local "clean-x-hedgehog-templates/learn/register.html"`
  - Publish CSS:
    - `npm run publish:template -- --path "CLEAN x HEDGEHOG/templates/assets/css/registration.css" --local "clean-x-hedgehog-templates/assets/css/registration.css"`
- This mirrors clicking “Publish” in the Design Manager UI and ensures VCS is the source of truth. See `scripts/hubspot/publish-template.ts` for details.

CI gates:
- Front matter validation runs on PRs touching content or sync code.
- Docs gate requires a docs update when content-affecting changes occur (override via `[skip-docs-check]` in the PR title/body or `docs-exempt` label when justified).

## Proposals & Discovery
- Use GitHub Discussions or a `feature` issue labeled `proposal`.
- Attach spikes/POCs as draft PRs linked to the proposal issue.

## Incident Handling
- For production-impacting issues, use the bug template with `priority/P0` and `blocked` as needed. Add a brief postmortem comment once resolved.

## Release Notes

### 2026-05-14: Phase 5B Deterministic Suite Stabilization + Pathway Badge Marker Disambiguation (Issue #465 / PR #466)

Stabilizes the four `production-learner-record-deterministic` failures observed during the #464 post-publish run. Three were test-side (a `MutationObserver`-vs-`DOMContentLoaded` race on the ownership marker, a 400 path that navigated to a CMS-404 slug so the renderer never ran, and a strict-mode `toBeVisible()` missing `.first()` on the answer-review fixture). The fourth was a small renderer-side DOM contract change.

DOM contract change in `production-pathway-detail.js`:
- Header pathway-level badge keeps `data-pathway-status-badge` (single occurrence, the pathway's own status).
- Per-course-row badges now emit `data-pathway-course-status-badge` (one per course row).
- Visual rendering is unchanged (same CSS classes and labels); only the data attribute differs. This matches how `production-course-detail.js` already keeps `data-course-status-badge` to a single header occurrence and removes the strict-mode collision that previously resolved the locator to 5 nodes.

The deterministic spec intercepts production JS via `interceptProductionJs`, so the suite is green against live `hedgehog.cloud` (38/38) without re-publishing the renderer. A small follow-up rollout can publish the updated `production-pathway-detail.js` to PUBLISHED if/when desired; that change has no other consumers (verified with `grep -rn 'data-pathway-status-badge\|data-pathway-course-status-badge'`).

### 2026-05-13: Phase 5B `/learn` Parity with Approved Shadow Learner-Progress Center (Issue #459 / PR #463)

Brings production `/learn` up to the approved shadow learner-progress center (#452). All client renderers now consume the bare production server-authoritative endpoints (`/pathway/status`, `/course/status`, `/module/progress`, `/certificates`) — no client-side rollup recomputation, no `/tasks/status/batch` call on dashboard load.

New / changed production surfaces:
- `/learn/my-learning` — `production-my-learning.js` rewritten to use `/enrollments/list` → per-pathway `/pathway/status` + per-standalone-course `/course/status` → `/certificates`.
- `/learn/courses/<slug>` (detail mode) — additive `#course-progress-detail-root` mount + new `production-course-detail.js`. Preserves existing JSON-LD `Course`, OG/Twitter metadata, content blocks, enrollment CTA.
- `/learn/pathways/<slug>` (detail mode) — additive `#pathway-progress-detail-root` mount + new `production-pathway-detail.js`. Preserves existing JSON-LD `ItemList`, breadcrumbs, enrollment CTA.
- `/learn/modules/<slug>` — additive `View Progress Record →` link pointing at `/learn/module-progress?module=<slug>`.
- **NEW** `/learn/module-progress?module=<slug>` — static page reading `request.query_dict.module` (mirrors the route amendment chain through #449 for the shadow analogue). Renders module title, status badge, per-task rows, attempt timeline DESC, and an expandable answer-review drawer for quiz attempts. Sensitive-handling defense in depth: never prints `correct_answer`/`learner_identity`; schema-drift fallback text; lab attestations never expose a drawer.

Production-specific deltas from the shadow source (#452):
- No `<meta name="robots" content="noindex">` anywhere under `/learn/*`.
- No `.shadow-mode-banner` DOM injected by any renderer.
- Canonical URLs use `/learn/...`; in-DOM links route through `/learn/...`; clients call the bare production endpoints (no `/shadow/` prefix).
- Detail pages get *additive* progress mounts, not the thin-shell replacement shadow uses — preserves canonical URLs, JSON-LD, OG/Twitter, breadcrumbs, archived warning, content blocks, and the enrollment CTA.

Dashboard ownership boundary:
- `/learn/my-learning` loads both `production-my-learning.js` and the legacy `my-learning.js`. The ownership contract is declared in the template via `data-enrollment-renderer="production-my-learning"` on `#hhl-auth-context`.
- `production-my-learning.js` owns `#enrolled-grid`, `#enrolled-section`, `enrolled-count`, `stat-enrolled`, the certificates surfaces, and the `#loading-state` / `#main-content-container` toggle.
- `my-learning.js` owns the Resume Panel, In Progress / Completed module sections (which keep their *module-level* semantics — those stats are intentionally not surfaced by the new renderer), and the module-level `stat-in-progress` / `stat-completed`.
- Coverage: deterministic spec `Production My Learning dashboard — single-ownership boundary` describe (6 tests).

Provisioning split (rollout vs. code):
- **In code (PR #463):** template files, renderer JS, and an entry in `scripts/hubspot/provision-pages.ts` adding `learn/module-progress` to `ALLOWED_SLUGS` and the `pageConfigs` array (`tableEnvVar: 'STATIC'`).
- **Rollout-only (separate publish step):** uploading the new templates to HubSpot and registering the new `/learn/module-progress` page on the production portal (`npm run provision:pages` or equivalent). Layer 2 live tests stay `test.describe.skip(...)` until the templates are published *and* a production-side e2e auth mechanism exists (production-side of #461).

CMS published-deps validator note (carrying lesson learned):
- The CMS dry-run validator renders templates with empty `request.query_dict` and asserts every `get_asset_url(...)` reference resolves in the *published* environment. When introducing a new static page that loads a brand-new JS asset, gate the `<script>` tag behind a `{% if request.query_dict.<param> %}` conditional so the validator's no-query-string render path does not trip on the missing asset. This is the pattern used in `learn/module-progress.html`. After rollout publishes the asset, the conditional remains as a behavioral optimization (no JS download on the no-slug branch).

Tests:
- `tests/e2e/production-learner-record-deterministic.spec.ts` (project `production-learner-record-deterministic`) — 38 tests across 5 describes, including the 6-test single-ownership boundary describe.
- `tests/e2e/production-learner-record-live.spec.ts` (project `production-learner-record-live`) — 4 describes, all skip-until-deployment.

### 2025-10-19: PR + CI Enforcement (Issue #217)
- **MANDATORY process established**: All issues now require PRs and CI validation
- Updated Definition of Done with 8-step enforcement checklist
- Added PR/CI requirements to all issue templates (feature, bug, docs)
- Created new CI workflows:
  - `validation-tests.yml` - Schema validation and orphan detection
  - `e2e-catalog.yml` - Catalog filter E2E tests
  - `e2e-course-navigation.yml` - Course-aware navigation tests
- Issues #205-214 retroactively covered by comprehensive PR (Issue #217)
- **Breaking change**: Issues closed without PR+review will be reopened

### 2025-10-16: Visible UX Priorities (P1)
- Created P1 issues to address highly visible UX regressions and polish:
  - UI: Polish Catalog page layout/typography (#173)
  - Routes: Ensure module links point to /learn/modules/<slug> (verify & close) (#174)
  - Bug: Module detail page missing dynamic content (#175)
  - Bug: Course detail page missing modules list (#176)
  - Bug: Pathway detail page missing associated course cards (#177)
- Implemented a direct fix for module link routes and published templates.

Completed
- UI: Polish Catalog page layout/typography (#173)
  - Typography: title 2.25rem/700; subtitle 1.125rem/400; card title 1.125rem/600; summary 0.95rem with 1.65 line-height.
  - Layout: grid gap 20px; card padding 20px; left nav width 260px for a wider content column.
  - Meta: toned down meta color and divider (#E5E7EB), improved CTA hover state.
- Bug: Module detail page dynamic content and routing (#175)
  - Ensured prev/next links, list cards, and head rel links route to `/learn/modules/<slug>`.
  - Verified dynamic content renders from `dynamic_page_hubdb_row.full_content`.
- Bug: Course detail page missing modules list (#176)
  - Added robust HubDB lookups with `hs_path__eq` and `path__eq` fallbacks and a defensive render path when lookups return empty.
  - Guarantees a “Course Modules” section renders with working links to `/learn/modules/<slug>`.
- Bug: Pathway detail page missing associated course cards (#177)
  - Added robust HubDB lookups and a defensive fallback to always render course cards from `course_slugs_json`.
  - Corrected modules base href in module fallback section to `/learn/modules/<slug>`.
- Live verification
  - /learn/modules bound to HubDB Modules table `135621904` (via provision:pages dry-run output).
  - Pages published: learn, modules, courses, pathways, my-learning, register.
- All PRs will auto-trigger independent code review; use `@codex review` for subsequent passes.

### 2025-10-13: CRM Persistence Enabled
- Enabled CRM progress persistence by setting `ENABLE_CRM_PROGRESS: true` in `clean-x-hedgehog-templates/config/constants.json`.
- Authenticated users (via CMS Membership) now persist learning progress to HubSpot Contact Properties (`hhl_progress_state`, `hhl_progress_summary`, `hhl_progress_updated_at`).
- Persistence backend: Contact Properties; requires identity via `contactIdentifier.email` in event payloads.
- See [Issue #59](https://github.com/afewell-hh/hh-learn/issues/59) and [PR #72](https://github.com/afewell-hh/hh-learn/pull/72) for verification artifacts and acceptance criteria.

## Ownership
- Project Lead maintains this doc and the Project automations.
- Area Owners maintain labels and acceptance criteria quality in their areas.
