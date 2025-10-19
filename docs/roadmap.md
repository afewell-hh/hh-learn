---
title: HHL Roadmap
owner: hh-learn project lead
status: living
last-reviewed: 2025-10-19
---

# Hedgehog Learn – Roadmap

This is the long-term plan at a glance. Each phase maps to a Milestone and one or more Epics (Issues) on the GitHub Project.

> Source of truth: Use the *Hedgehog Learn* GitHub Project board for day-to-day status. Milestone numbers referenced below correspond to the open milestones in GitHub (`#1`, `#2`, `#3`, `#4`, `#5`, `#8`). Epics are tracked as labelled issues (`epic`).

### Current Signals (2025-10-19)
- **Learn MVP Launch Readiness (Milestone new):** Tracks the four-iteration recovery plan derived from the 2025-10-18 gap analysis. P0 issues will seed enrollment, progress fidelity, course navigation, and catalog filters.
- **v0.1 – Authoring & Dynamic Pages (Milestone #1):** Build work merged; Issue [#60](https://github.com/afewell-hh/hh-learn/issues/60) still requires manual verification before closing.
- **v0.4 Structured Media Backlog (Milestone #8) & v0.5 Analytics/A11y/Perf (Milestone #5):** Continue to act as long-term epics but are paused until MVP blockers are cleared.
- **Epics:** [#15](https://github.com/afewell-hh/hh-learn/issues/15) (structured media) and [#18](https://github.com/afewell-hh/hh-learn/issues/18) (analytics/a11y/perf) remain open; add the new Learn MVP epic once tickets are created.

## v0.1 – Stabilize Authoring & Dynamic Pages
> Status (2025-10-17): Build work merged; Issue #60 verification pending. Do not close the milestone until the manual checks in `docs/issue-60-verification-guide.md` succeed.

Outcomes
- Single `/learn` page using `module-page.html` for list + detail
- Authoring guide live and enforced by CI
- Labels and Project automations in place

Acceptance Criteria
- At least 3 modules published via sync
- Prev/next navigation on detail pages
- CI green on front-matter validation

## v0.2 – Structured Media
Outcomes
- Support `media` blocks (video, imagery) in front matter → HubDB JSON → rendered components.
- Provide reusable author snippets for YouTube, Vimeo, and HubSpot-hosted video assets.
- Ensure templates gracefully handle missing or legacy inline embeds.

Acceptance Criteria
- Media JSON synced and rendered on module detail pages.
- Backwards compatible rendering for existing Markdown embeds.
- Linting/validation catches unsupported media configurations.

## v0.3 – Quizzes & Progress
Outcomes
- Enable authenticated learners via HubSpot CMS Membership with progress stored in HubSpot CRM (contact properties backend).
- Harden `/events/track` + `/progress/read` endpoints using the Projects Access Token (Issue #60) so authenticated beacons persist reliably.
- Deliver quiz authoring schema, rendering, and Lambda grading pipeline.

Acceptance Criteria
- Authenticated session confirmed on module/pathway pages with CRM-backed progress responses.
- Manual verification for Issue #60 completed and artifacts posted.
- At least one module ships with a working quiz and score surfaced to the learner UI.

## v0.4 – Pathways & Labs
Outcomes
- Define and ship “Pathways” experiences (list/detail, per-pathway progress summaries).
- Expand HubDB schemas to cover labs / hands-on experiences tied to pathways.
- Support ordering, prerequisites, and completion logic across modules and labs.

Acceptance Criteria
- Pathway and lab HubDB schemas synced (relationships + ordering) with authoring tooling.
- Pathway list and detail pages render associated modules/labs with progress context.
- Per-learner progress summary placeholder (UI only) on pathway and lab detail pages.

## v0.5 – Analytics, Accessibility, Performance
Outcomes
- Behavioral events wired into HubSpot analytics/CRM for completed/started modules and pathway enrolment.
- Accessibility sweep across templates (headings, contrast, focus, keyboard order).
- Performance improvements: lazy-load media, optimize code blocks, tighten bundle size.

Acceptance Criteria
- Analytics dashboards confirm event ingestion matches beacons.
- Accessibility checks pass on key pages; remediations documented.
- Core Web Vitals meet internal targets on `/learn` and module detail pages.

## Learn MVP Launch Readiness (2025-10 → 2025-12)
Outcomes
- Reintroduce explicit enrollment, course-aware navigation, and CRM-backed progress indicators so learners can intentionally start and complete structured journeys.
- Restore catalog filters and add guardrails for HubDB relationships to prevent silent data corruption.
- Redesign the progress data model to support pathway → course → module hierarchies and emit behavioral analytics for future reporting.

Acceptance Criteria
- Enrollment CTA flow deployed for pathways and courses with Lambda persistence and My Learning dashboard visibility.
- Pathway and course pages render accurate started/completed counts sourced from CRM progress state.
- Catalog filters enabled in production with automated tests and accessibility checks.
- HubDB sync validation blocks orphaned references; Lambda enforces progress schema validation.
- Hierarchical progress store migrated and verified in staging; behavioral events wired with dashboards and alarms.

## Governance
- Track phases as Milestones: `Learn MVP Launch Readiness`, `v0.1 Authoring & Dynamic Pages`, `v0.2 Structured Media`, `v0.3 Quizzes & Progress`, `v0.4 Pathways & Labs`, `v0.5 Analytics/A11y/Perf`.
- Each phase has Epics (Issues) with acceptance criteria; work is split into smaller Issues linked to the Milestone and Project.
- Update this roadmap when scope changes. Keep dates in GitHub Milestones; keep outcomes here.

## v0.6 – AI Maintenance Pipeline (GitOps)
Outcomes
- Repository‑dispatch/schedule triggers create validation tasks when product releases publish
- Modules mapped to products via `.hhl-products.yml`
- On success, PR bumps `validated_on` (and `version` if applicable)

Acceptance Criteria
- [ ] Release event opens Issues for all mapped modules
- [ ] Green path opens automatic PR updating metadata

## v0.7 – Scenario Framework & Validation Harness
Outcomes
- Opinionated scenario/step/validation schema in front matter
- Prototype harness executes `commands` and evaluates `validate` checks in ephemeral env
- Failure reports annotate exact steps with logs

Acceptance Criteria
- [ ] One module validated end‑to‑end via harness in CI (kind or minikube)
- [ ] Failure raises detailed Issue with artifacts
