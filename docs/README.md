---
title: Hedgehog Learn Documentation Index
owner: hh-learn project lead
status: living
last-reviewed: 2025-10-19
last-updated: 2025-10-19
---

# Documentation Index

> Hedgehog Learn keeps day-to-day status in GitHub. Use this index to discover durable reference material and the canonical planning sources.

## Planning Sources of Truth
- **GitHub Project (Hedgehog Learn):** Repo → *Projects* tab → *Hedgehog Learn* board (Kanban + Iterations views).
- **Active Epics:** [#15 – Epic: v0.4 Structured Media](https://github.com/afewell-hh/hh-learn/issues/15), [#18 – Epic: v0.5 Analytics, A11y, Perf](https://github.com/afewell-hh/hh-learn/issues/18), _Learn MVP Launch Readiness_ (new epic to be created).
- **Open Milestones:** `Learn MVP Launch Readiness` (target 2025-12-12), `v0.1 – Authoring & Dynamic Pages` (#1), `v0.2 – Structured Media` (#2), `v0.3 – Quizzes & Progress` (#3), `v0.4 – Pathways & Labs` (#4), `v0.5 – Analytics, A11y, Perf` (#5), `v0.4 – Structured Media (backlog experiments)` (#8).
- **Iteration Plans:** [`iterations/2025-10-20-plan.md`](iterations/2025-10-20-plan.md) captures the four-iteration recovery schedule derived from the 2025-10-18 gap analysis.
- **Outstanding Work:** [Issue #60](https://github.com/afewell-hh/hh-learn/issues/60) still requires manual verification; follow `docs/issue-60-verification-guide.md` before declaring the migration complete.

## Living Documents

This folder only contains long-lived references that should stay accurate as the product evolves. Anything tied to a single sprint or a historical decision belongs in GitHub issues, discussions, or pull requests instead.

### Content Authoring
- [`content-standard.md`](content-standard.md) – **normative standard** for module content (required reading for all authors).
- [`contributor-guide.md`](contributor-guide.md) – **step-by-step workflow** for authoring and publishing modules (start here if you're new).
- [`course-authoring.md`](course-authoring.md) – comprehensive reference for modules, courses, and pathways.
- Templates: [`templates/module-README-template.md`](templates/module-README-template.md), [`templates/module-meta-template.json`](templates/module-meta-template.json)

### Platform & Operations
- [`architecture.md`](architecture.md) – current system boundaries and planned evolution.
- [`content-sync.md`](content-sync.md) – operational runbook for HubSpot content syncing and related maintenance. See § Pathways Mapping for pathway sync details.
- [`theme-development.md`](theme-development.md) – how we extend the Clean.Pro theme safely.
- [`project-management.md`](project-management.md) – GitHub Projects best practices, labels, cadence, and automation.
- [`roadmap.md`](roadmap.md) – phase-based milestones and acceptance criteria.
- [`learn-launch-runbook.md`](learn-launch-runbook.md) – current MVP go-live checklist with evidence links (last verified 2025-10-17).
- [`issue-285-landing-pages-plan.md`](issue-285-landing-pages-plan.md) – comprehensive implementation plan for `/learn` landing and `/learn/get-started` pages (created 2025-11-05).

### Verification & Access Tokens
- **[`hubspot-project-apps-agent-guide.md`](hubspot-project-apps-agent-guide.md)** – **AI agent training guide** for HubSpot Project Apps (2025.2). *Authentication sections are historical; check the status doc below first.*
- [`authentication-status.md`](authentication-status.md) – Source of truth for the current authentication stance (public pages remain anonymous; SSO pending).
- [`auth-and-progress.md`](auth-and-progress.md) – Historical overview of authenticated beacons, CRM persistence, and feature flags.
- [`issue-60-verification-guide.md`](issue-60-verification-guide.md) – step-by-step instructions to complete the Projects Access Token migration.
- [`phase2-authenticated-beacons.md`](phase2-authenticated-beacons.md) – membership and event-definition prerequisites for Phase 2.
- [`phase2-contact-properties.md`](phase2-contact-properties.md) – schema reference for progress properties stored on contacts.
- [`project-app-oauth-integration.md`](project-app-oauth-integration.md) – comparison of auth models and why the project access token is required.

When adding a new document, update this index and include an “owner” in the front matter or intro so we know who keeps it fresh.

## Archive
- Historical planning snapshots live in `docs/archive/`. See [`archive/2025-10/README.md`](archive/2025-10/README.md) for the Issue #187 clean-up moves and October 2025 checklist index.
