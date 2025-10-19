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
