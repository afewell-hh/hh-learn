---
title: HHL Roadmap
owner: hh-learn project lead
status: living
last-reviewed: 2025-10-08
---

# Hedgehog Learn – Roadmap

This is the long-term plan at a glance. Each phase maps to a Milestone and one or more Epics (Issues) on the GitHub Project.

## v0.1 – Stabilize Authoring & Dynamic Pages
Outcomes
- Single `/learn` page using `module-page.html` for list + detail
- Authoring guide live and enforced by CI
- Labels and Project automations in place

Acceptance Criteria
- At least 3 modules published via sync
- Prev/next navigation on detail pages
- CI green on front-matter validation

## v0.2 – Structured Media (Video & Assets)
Outcomes
- Support `media` (video/image) in front matter → HubDB JSON → rendered block
- Author snippets for YouTube, Vimeo, HubSpot-hosted video

Acceptance Criteria
- Media JSON synced and rendered on detail pages
- Backwards compatible with inline Markdown embeds

## v0.3 – Quizzes & Progress Tracking
Outcomes
- Define quiz schema and storage in HubDB
- Client UI for quizzes on module pages
- Lambda `/quiz/grade` computes score; `/events/track` logs start/complete

Acceptance Criteria
- One module with a working quiz and recorded completion event
- Basic results shown to learner (score/pass)

## v0.4 – Pathways & Labs
Outcomes
- Pathways (ordered sets of modules) with list/detail pages
- Labs schema and rendering (standalone or embedded)
- Sync supports relationships and ordering

Acceptance Criteria
- One pathway with 3+ modules rendered with sequence and completion hints

## v0.5 – Analytics, Accessibility, Performance
Outcomes
- Behavioral events wired into HubSpot analytics/CRM
- Accessibility sweep on templates (headings, contrast, focus)
- Lazy-load images; code block copy UX

Acceptance Criteria
- A11y checks pass on key pages; Core Web Vitals acceptable

## Governance
- Track phases as Milestones: `v0.1 Authoring`, `v0.2 Media`, `v0.3 Quizzes`, `v0.4 Pathways`, `v0.5 A11y/Perf`.
- Each phase has Epics (Issues) with acceptance criteria; work is split into smaller Issues linked to the Milestone and Project.
- Update this roadmap when scope changes. Keep dates in GitHub Milestones; keep outcomes here.
-
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
