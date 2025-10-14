---
title: Course Authoring Guide
owner: hh-learn content lead
status: living
last-reviewed: 2025-10-14
---

# Hedgehog Learn – Course Authoring Guide

This is the comprehensive reference guide for creating and publishing learning content on Hedgehog Learn, including modules, courses, and pathways.

**For new contributors:**
- Start with the [Contributor Guide](contributor-guide.md) for a step-by-step walkthrough
- Review the [Content Standard](content-standard.md) for normative requirements

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

## Prerequisites

Prerequisites allow you to guide learners by indicating what knowledge or resources they need before starting a module. The system supports smart linking for internal modules and external resources.

### How to Define Prerequisites

Prerequisites are defined in the optional `meta.json` file as an array under the `prerequisites` key. Each prerequisite can be:

1. **Internal module slug** (string): References another module by its slug. The system automatically resolves this to a clickable link with the module's title.
   ```json
   "prerequisites": [
     "intro-to-kubernetes",
     "kubernetes-networking"
   ]
   ```

2. **External resource** (object): Links to external documentation or resources.
   ```json
   "prerequisites": [
     {
       "title": "AWS account with an active subscription",
       "url": "https://aws.amazon.com/free/"
     },
     {
       "title": "Docker installed on your local machine",
       "url": "https://docs.docker.com/get-docker/"
     }
   ]
   ```

3. **Plain text** (string without a matching module): Use for general requirements that don't need links.
   ```json
   "prerequisites": [
     "Basic familiarity with command-line tools",
     "Understanding of networking concepts"
   ]
   ```

### Mixed Example

You can combine all three types in a single module:

```json
{
  "prerequisites": [
    "intro-to-kubernetes",
    {
      "title": "AWS CLI v2",
      "url": "https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    },
    "Basic familiarity with YAML syntax"
  ],
  "learning_objectives": [
    "Deploy a Kubernetes cluster on AWS",
    "Configure kubectl for cluster access"
  ]
}
```

### Rendering Behavior

- **Internal module slugs**: The template queries the Modules HubDB table to resolve the slug to a module title and creates a link to `/learn/<module-slug>`.
- **Unknown slugs**: If a slug doesn't match any published module, it renders as plain text with an HTML comment warning (no broken links).
- **External resources**: Rendered as `<a href>` with `rel="noopener" target="_blank"` attributes for security.
- **Empty prerequisites**: If no prerequisites are defined or the array is empty, the section is hidden.

### Best Practices

- **Be specific**: Instead of "Kubernetes knowledge", use `"intro-to-kubernetes"` to link to your intro module.
- **Order logically**: List prerequisites in the order learners should complete them.
- **Link external resources**: If you reference a tool or service, provide a URL so learners can find it quickly.
- **Test after sync**: After running `npm run sync:content`, verify that internal links resolve correctly and external links open properly.

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

## Archiving a Module
Choose one of the following:
- Soft archive (recommended):
  - Move the module folder to `content/archive/<slug>/` and run `npm run sync:content`.
    - The sync tags the HubDB row with `archived` and it is hidden from the list view (detail page shows an archived banner).
  - Or add `archived: true` to the module front matter and resync (keeps content under `content/modules/`).
- Hard delete:
  - Remove the module from `content/modules/` without moving it to `content/archive/` and run `npm run sync:content`.
    - The sync will delete the corresponding HubDB row (set `SYNC_DELETE_MISSING=false` to prevent deletions if needed).

## Pathways

Pathways group multiple modules into a curated learning journey. Authors declare pathways in JSON files and modules reference them in front matter.

### Purpose
- Provide structured learning sequences with clear progression
- Group related modules by topic, product, or skill level
- Track learner progress through multi-module journeys
- Display estimated completion time and award badges

### Author Workflow

#### Creating a Pathway
Create a JSON file at `content/pathways/<pathway-slug>.json` with the following structure:

```json
{
  "slug": "kubernetes-fundamentals",
  "title": "Kubernetes Fundamentals",
  "summary_markdown": "Learn Kubernetes core concepts and operations through hands-on labs. This pathway covers pods, deployments, services, and essential cluster management skills.\n\n**What you'll learn:**\n- Container orchestration basics\n- Kubernetes architecture and components\n- Deploying and managing applications\n- Troubleshooting common issues",
  "module_slugs": [
    "intro-to-kubernetes",
    "pods-and-deployments",
    "services-and-networking",
    "storage-and-persistence",
    "troubleshooting-k8s"
  ],
  "estimated_minutes": 240,
  "badge_image_url": "https://example.com/badges/k8s-fundamentals.png",
  "display_order": 10,
  "tags": "kubernetes,containers,orchestration"
}
```

#### Fallback: Module Front Matter
Alternatively, modules can declare pathway membership in their front matter (useful for migrating existing content):

```yaml
---
title: Intro to Kubernetes
slug: intro-to-kubernetes
pathway_slug: kubernetes-fundamentals
pathway_name: Kubernetes Fundamentals
order: 1
---
```

The sync script can support both approaches; the primary JSON file takes precedence.

### Required Fields
- `slug` (string): Unique identifier for the pathway (lowercase, hyphen-separated)
- `title` (string): Display name for the pathway
- `summary_markdown` (string): Rich description of the pathway goals and content
- `module_slugs` (array of strings): Ordered list of module slugs in the pathway

### Optional Fields
- `estimated_minutes` (number): Total estimated time to complete all modules
- `badge_image_url` (string): URL to badge graphic awarded upon completion
- `display_order` (number): Manual sorting weight for pathway lists
- `tags` (string): Comma-separated topics for filtering

### Authoring Guidelines

#### Ordering
- The `module_slugs` array is the **single source of truth** for ordering
- List modules in the sequence learners should follow
- Prerequisites or dependencies may be noted in the `summary_markdown` prose
- Do not introduce duplicate ordering fields; ordering is managed exclusively via `module_slugs`

#### Summary Content
- Use markdown for formatting (lists, bold, links)
- **Do not include H1 headings** in summaries (violates single-H1-per-page rule)
- Keep summaries focused: 2-4 paragraphs covering goals, topics, and outcomes
- Include learning objectives, target audience, or prerequisites as appropriate

#### Examples
See `content/pathways/` for reference implementations.

### Sync & Publishing
- Pathways sync to HubDB via `npm run sync:content` (separate from modules)
- The `HUBDB_PATHWAYS_TABLE_ID` environment variable controls the target table
- Deletions are out of scope for the v0.2 initial implementation
- Templates will render pathway list and detail pages from the HubDB table

## Module Progress Tracking

Module detail pages include lightweight progress UI that integrates with localStorage-based pathway progress tracking.

### What It Does
- Two buttons appear on every module detail page: "Mark as started" and "Mark complete"
- Clicking either button calls the global `window.hhUpdatePathwayProgress(started, completed)` function (if available)
- Progress state is stored in the browser's localStorage (no authentication required)
- A "Back to pathway" link appears automatically if the visitor came from a pathway detail page
- Progress updates immediately reflect in pathway progress bars

### For Content Authors
The progress UI is template-driven and requires no action from module authors. However:

- **No inline `<script>` tags** in module content: The template already includes the necessary client-side logic
- **Testing:** After publishing a module, verify:
  1. Both buttons appear on the module detail page
  2. Clicking "Mark as started" updates the progress bar on any pathway containing the module
  3. Clicking "Mark complete" marks the module as 100% complete
  4. No JavaScript console errors occur
  5. Buttons are keyboard accessible (test with Tab key and Enter)

### Technical Details
- The progress UI is rendered in `module-page.html` at lines 312–350
- The script waits for `DOMContentLoaded` before attaching event listeners
- Calls to `hhUpdatePathwayProgress` are wrapped in try/catch to avoid errors if the function is unavailable
- The "Back to pathway" link checks `document.referrer` for `/learn/pathways/` and only displays if matched
- All buttons use semantic HTML and include `aria-label` attributes for accessibility

### Lighthouse & Accessibility
- The progress UI passes Lighthouse accessibility checks
- Buttons are fully keyboard navigable
- ARIA labels provide context for screen readers
- Mobile-responsive design (buttons wrap on narrow screens)

## Labs (Roadmap)
- Separate "labs" content type may be introduced; you'll be able to embed or link to labs from modules

## Templates & Examples
- Start with `docs/templates/module-README-template.md` and `docs/templates/module-meta-template.json`
- See existing modules under `content/modules/` for examples

## My Learning – Authenticated Hydration (Info)
As of Oct 12, 2025, the My Learning dashboard hydrates from CRM when a learner is signed in and `ENABLE_CRM_PROGRESS=true`.
The system reads three Contact Properties (`hhl_progress_state`, `hhl_progress_updated_at`, `hhl_progress_summary`) to
populate In Progress and Completed modules. When logged out, the dashboard falls back to localStorage.
No authoring changes are required.

## FAQ
- Q: Can I draft in Google Docs and paste later?
  - A: Prefer authoring directly in Markdown for accurate code blocks, headings, and diff‑friendly review
- Q: How do I include big screenshots?
  - A: Compress to web‑friendly sizes; consider linking out for very large images or videos
- Q: My module failed to sync due to WAF
  - A: Simplify suspicious strings (host headers, IP/CIDR literals), split content, or temporarily upload via HubSpot UI (document in PR)

## Learner Progress (Info)

As of Oct 12, 2025, learner progress syncs to CRM when the learner is signed in. The system writes to three contact properties (`hhl_progress_state`, `hhl_progress_updated_at`, `hhl_progress_summary`). When logged out, progress is tracked locally in the browser. No authoring changes are needed.
