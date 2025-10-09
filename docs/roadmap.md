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

## v0.2 – Learning Pathways (High Priority)
Outcomes
- Define and ship “Pathways” to group modules into guided sequences
- Render pathway list/detail pages and per-pathway progress summary
- Support ordering, prerequisites, and basic completion logic

Acceptance Criteria
- Pathway HubDB schema + sync support (relationships and ordering)
- Pathway list and detail pages render with associated modules
- Per-learner progress summary placeholder (UI only) on pathway pages

## v0.3 – Auth & Progress (Login + CRM) (Next Priority)
Outcomes
- Enable learner login (HubSpot membership or OAuth via app project)
- Track module/pathway progress to CRM (custom objects or events)
- Basic learner dashboard (what’s started, in-progress, completed)

Acceptance Criteria
- Authenticated session on module/pathway pages
- Progress events stored in CRM (contact or custom object)
- Minimal dashboard showing learner progress

## v0.4 – Structured Media (Video & Assets)
Outcomes
- Support `media` (video/image) in front matter → HubDB JSON → rendered block
- Author snippets for YouTube, Vimeo, HubSpot-hosted video

Acceptance Criteria
- Media JSON synced and rendered on detail pages
- Backwards compatible with inline Markdown embeds

## v0.5 – Quizzes (Schema + Grading)
Outcomes
- Define quiz schema and storage in HubDB
- Client UI for quizzes on module pages
- Lambda `/quiz/grade` computes score

Acceptance Criteria
- One module with a working quiz and score displayed to learner

## v0.6 – Analytics, Accessibility, Performance
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
