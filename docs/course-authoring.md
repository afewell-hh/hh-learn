---
title: Course Authoring Guide
owner: hh-learn content lead
status: living
last-reviewed: 2025-10-08
---

# Hedgehog Learn – Course Authoring Guide

This is the single source of truth for creating and publishing learning modules. It includes a quickstart for SMEs, detailed front matter specs, lab/scenario patterns, media guidance, validation tips, and publishing steps.

Note: Any feature impacting authors (fields, media, quizzes, workflow) must update this guide as part of the PR checklist.

## Who This Is For
- Subject-matter experts (SMEs) contributing new modules
- Editors and reviewers validating and publishing content

## 10‑Minute Quickstart (SME)
- Create a new folder: `content/modules/<module-slug>/`
- Copy the template: `docs/templates/module-README-template.md` → `content/modules/<slug>/README.md`
- Fill in the front matter and sections, especially:
  - `title`, `slug`, `difficulty`, `estimated_minutes`, `description`, `tags`
  - Add one realistic scenario with step `commands` and `validate` checks
- Preview locally (optional): ensure Markdown renders cleanly; code blocks include language hints
- Open a PR with the new folder; request review
- After merge, run sync (or let CI do it) to publish to HubDB

## Prerequisites
- Node 18+ (Node 22 LTS recommended)
- `npm install`
- Access to a HubSpot private app token (see `.env.example`); for local sync only

## Repository Layout
```
content/
  modules/
    <module-slug>/
      README.md     # REQUIRED: markdown content with front matter
      meta.json     # OPTIONAL: structured metadata (objectives, prereqs)
docs/templates/
  module-README-template.md
  module-meta-template.json
```

## Front Matter – Required Fields
- `title` (string): Module display title
- `slug` (string): URL slug (lowercase, hyphen-separated); should match folder name
- `difficulty` (enum): `beginner` | `intermediate` | `advanced`
- `estimated_minutes` (number): Time to complete
- `tags` (array of strings): Topical tags used for filters/badges
- `description` (string): 120–160 chars for list card and meta description

Recommended fields
- `version` (string): Product version aligned with content
- `validated_on` (YYYY-MM-DD): Last validation date
- `pathway_slug`, `pathway_name` (strings): If part of a pathway
- `order` (integer): Sorting weight in the list page

Agent‑ready fields (see ai-content-maintenance.md)
- `products[]`: Product mapping (name, repo, min_version)
- `scenarios[]`: Scenario blocks with stable IDs and executable steps
- `ai_hints`: Environment hints and constraints for automation

Full example: see `docs/templates/module-README-template.md`.

## Writing Guidelines
- Lab‑first: center content on realistic, “day‑in‑the‑life” scenarios
- Be concrete: each step includes shell commands and a validation check
- Explanations: keep conceptual text near steps but separate from the executable blocks
- Structure: use meaningful H2/H3 headings; the template styles them for readability
- Code blocks: always set a language (e.g., `bash`, `yaml`, `json`)
- Links: prefer official docs and canonical references

## Media (Video & Images)
- Images: standard Markdown `![alt](path)`; keep alt text meaningful
- Video (today): embed via HTML `<iframe>` (YouTube/Vimeo) or `<video>` with HubSpot-hosted files
- Video (soon): we will support a structured `media` field rendered by the template; until then, embedding is fine

## Validation & Troubleshooting
- Local sanity: skim your README, ensure commands are accurate and fenced; run commands where feasible
- WAF/size pitfalls when syncing:
  - Avoid raw `Host:` header examples; prefer `curl --resolve` form
  - Prefer `curl` to `wget` in examples
  - Keep single modules under ~10–12 KB of rendered HTML where possible
  - See `docs/content-sync.md` troubleshooting

## Sync to HubDB (Publish)
- Local publish:
  - `cp .env.example .env` and add `HUBSPOT_PRIVATE_APP_TOKEN` and `HUBDB_MODULES_TABLE_ID`
  - `npm run sync:content`
- What happens:
  - Markdown + front matter → HTML
  - Row is created/updated in HubDB by `hs_path` (slug)
  - Table is published

## Review & Go‑Live Checklist
- Front matter present; `slug` matches folder name; `description` in 120–160 char range
- At least one scenario with stable step IDs and deterministic validations
- All code blocks have languages; commands tested where reasonable
- Images/videos load; alt text present
- PR reviewed and merged; CI green
- Sync succeeded; new module appears under `/learn` list; detail page renders

## Pathways & Labs (Roadmap)
- Pathways group multiple modules; you’ll declare membership in front matter and ordering; the sync will handle relationships
- Separate “labs” content type may be introduced; you’ll be able to embed or link to labs from modules

## Templates & Examples
- Start with `docs/templates/module-README-template.md` and `docs/templates/module-meta-template.json`
- See existing modules under `content/modules/` for examples

## FAQ
- Q: Can I draft in Google Docs and paste later?
  - A: Prefer authoring directly in Markdown for accurate code blocks, headings, and diff‑friendly review
- Q: How do I include big screenshots?
  - A: Compress to web‑friendly sizes; consider linking out for very large images or videos
- Q: My module failed to sync due to WAF
  - A: Simplify suspicious strings (host headers, IP/CIDR literals), split content, or temporarily upload via HubSpot UI (document in PR)
