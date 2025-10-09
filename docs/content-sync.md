# Content Sync Runbook

_Owner: Platform team. Update whenever scopes, table schema, or automation logic changes._

## Source of Truth
- Markdown modules under `content/modules/**` define titles, metadata, and body copy.
- `npm run sync:content` converts markdown to HTML and manages HubDB rows.
- HubSpot dynamic pages render the `learning_modules` table via the Clean.Pro template `module-page.html`.

## HubDB Table Schema
Create a single table named `learning_modules` and publish it. HubSpot provides system columns we populate alongside custom metadata.

| Column | Internal name | Type | Notes |
|--------|---------------|------|-------|
| **Name** | `hs_name` | System | Module title used in listings and detail pages. Populated from front matter `title`.
| **Page Path** | `hs_path` | System | URL slug. Populated from `slug` or folder name.
| **Page Title** | varies | System | SEO/browser title. `sync:content` builds it from the module title.
| `meta_description` | `meta_description` | Text | Short SEO description for metadata mapping.
| `featured_image` | `featured_image` | Image | Optional social image URL.
| `difficulty` | `difficulty` | Select | Values: `beginner`, `intermediate`, `advanced`.
| `estimated_minutes` | `estimated_minutes` | Number | Estimated time to complete.
| `tags` | `tags` | Text | Comma separated topics.
| `full_content` | `full_content` | Rich Text | Rendered HTML body from markdown.
| `display_order` | `display_order` | Number | Used for manual ordering in list views.

Ensure the table uses `hs_path` for dynamic page routing when configuring the `/learn` page.

## Local Workflow
1. Copy `.env.example` → `.env` and provide:
   ```env
   HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-...
   HUBDB_MODULES_TABLE_ID=<numeric id>
   ```
2. Install dependencies: `npm install`.
3. Run a sync: `npm run sync:content`.
4. Confirm output logs show rows created/updated and `Summary: <n> succeeded`.

The script automatically:
- Retries HubSpot API calls on 429/403 responses with exponential backoff.
- Waits 1.5 seconds between modules to avoid Cloudflare throttling.
- Publishes the HubDB table after successful writes and reports any failures without aborting the run.

## CI/CD Automation
GitHub Actions workflow `.github/workflows/sync-content.yml` runs `npm run sync:content` on pushes to `main` that touch `content/modules/**`.

Required repository secrets:
- `HUBSPOT_PRIVATE_APP_TOKEN`
- `HUBDB_MODULES_TABLE_ID`

After updating secrets, trigger the workflow manually from the Actions tab to validate access.

## HubSpot Configuration Checklist
1. **Create HubDB table** using the schema above and record its numeric ID.
2. **Upload templates** from `clean-x-hedgehog-templates/learn/` to `Clean.Pro/templates/learn/` via HubSpot CLI or Design Manager.
3. **Create a single page** at `/learn` using `module-page.html` and enable HubDB dynamic content with the `learning_modules` table. HubSpot will route detail pages using `hs_path`.
4. **Publish** the page once list and detail views render as expected.

## Access Token & Scope Maintenance
- **Scope changes**: If `app/app-hsmeta.json` scopes change, redeploy the project and click “Update installation” (or reinstall) in Developer Projects to grant new scopes.
- **Token rotation**: Generate a fresh token from the Private App page whenever scopes change or a credential leak is suspected. Update the `.env`, GitHub secrets, and any CI secrets in other environments.

### Quick Regeneration Steps
1. HubSpot **Settings → Integrations → Private Apps**.
2. Select the Hedgehog Learn app, ensure HubDB read/write scopes are enabled.
3. Click **Generate new token** and replace local/CI secrets.
4. Run `npm run sync:content` to confirm the token works.

### Updating the Installation
1. Developer Projects → `hedgehog-learn-dev`.
2. Accept any “update installation” prompt referencing new scopes; otherwise uninstall/reinstall from **Settings → Integrations → Connected Apps**.
3. Rerun the sync to verify scope errors are resolved.

## Troubleshooting
| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| `requiredGranularScopes: ["hubdb"]` | Private app missing HubDB scope or installation not updated | Enable HubDB read/write scopes, update installation, regenerate token.
| `Authentication credentials not found` (401) | Token missing or incorrect | Confirm `.env`/secrets contain the active token and rerun.
| `Cannot parse content. No Content-Type defined.` | Cloudflare block or transient API issue | Wait 5–10 minutes and retry; script handles retries automatically but persistent issues may require a new IP or contacting HubSpot support.
| `Cloudflare block detected` on a specific module | HubSpot WAF rejected the rendered HTML (raw HTTP headers, `wget` commands, etc.) | Update the markdown to avoid suspicious strings (use `curl --resolve` instead of raw `Host:` headers, prefer `curl` over `wget`), then rerun the sync.
| Workflow fails in CI with missing secrets | Secrets typo or not configured | Re-add secrets exactly matching names above.

## Verification Commands
```bash
# Check local env configuration
rg 'HUBDB_MODULES_TABLE_ID' .env

# Test API connectivity
TOKEN=$(grep HUBSPOT_PRIVATE_APP_TOKEN .env | cut -d'=' -f2)
TABLE_ID=$(grep HUBDB_MODULES_TABLE_ID .env | cut -d'=' -f2)
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.hubapi.com/cms/v3/hubdb/tables/${TABLE_ID}"
```

Record any new failure signatures here so future contributors know how to respond.

## Pathway Progress (Placeholder)

For v0.2, module detail pages expose a minimal, no‑auth progress affordance that cooperates with the pathway page’s localStorage‑based progress API.

- UI: Two buttons appear on module detail pages — “Mark as started” and “Mark complete”. If you navigated from a pathway detail page, a “Back to pathway” link is also shown.
- Behavior: Buttons call a global function `window.hhUpdatePathwayProgress(started, completed)` if it exists. If not present, the clicks are no‑ops (no errors thrown).
- Storage: Progress is stored client‑side in `localStorage` by the pathway page script. There is no server‑side persistence or authentication in this placeholder.

How to test
1. Open a pathway detail page under `/learn/pathways/<slug>` so its progress script is loaded.
2. Click into a module from that pathway (the “Back to pathway” link should appear on the module detail page).
3. Click “Mark complete”.
4. Use the “Back to pathway” link (or browser back) — the pathway’s progress bar should reflect the completion for that module.

Notes
- The module template guards all browser APIs behind `DOMContentLoaded` and does not reference `window` in HubL, keeping server‑side rendering safe.
- Accessibility: buttons include `aria-label`s and are keyboard‑focusable.

## Courses Mapping

Courses group multiple modules into structured, narrative-driven learning units. Courses sit between Modules and Pathways in the content hierarchy.

### Input Source
JSON files at `content/courses/<slug>.json`

### HubDB Courses Table Schema

| Field | HubDB Column | Type | Notes |
|-------|--------------|------|-------|
| `slug` | `slug` | Text | Unique course identifier. Required, unique.
| `title` | `title` | Text | Display name for the course.
| `meta_description` | `meta_description` | Text | SEO meta description (auto-generated from summary if not provided).
| `summary_markdown` | `summary_markdown` | Rich Text | Markdown description converted to HTML (no H1 headings).
| `modules` | `module_slugs_json` | Rich Text | JSON array string of ordered module slugs.
| `estimated_minutes` | `estimated_minutes` | Number | Auto-computed total time from included modules.
| `badge_image_url` | `badge_image_url` | Text | URL to completion badge graphic (optional).
| `display_order` | `display_order` | Number | Manual sorting weight for course lists (default: 999).
| `tags` | `tags` | Text | Comma-separated topic tags.
| `content_blocks` | `content_blocks_json` | Rich Text | Optional JSON array of narrative content blocks (see below).

### Environment Configuration
Add to `.env`:
```env
HUBDB_COURSES_TABLE_ID=<numeric id>
```

Use a staging or test table during initial development. Production table ID should be configured in CI secrets.

### Content Blocks Structure

The optional `content_blocks` field allows expressive narrative content within a course. Each block has:

```json
{
  "id": "unique-block-id",
  "type": "text|callout|module_ref",
  "title": "Block title (optional, for text/callout)",
  "body_markdown": "Markdown content (optional, for text/callout)",
  "module_slug": "module-slug-reference (required for module_ref)"
}
```

**Block Types:**
- **text**: Narrative paragraph or section with optional title
- **callout**: Highlighted info/warning box with optional title
- **module_ref**: Reference to a module from the `modules` array

### Courses Sync Usage

The `sync:courses` script upserts courses to the HubDB courses table.

#### Basic Usage
```bash
# Dry-run (prints payloads without writing to HubDB)
npm run sync:courses -- --dry-run

# Live sync (writes to HubDB and publishes table)
npm run sync:courses
```

#### What It Does
1. Reads all `.json` files from `content/courses/`
2. Validates required fields: `slug`, `title`, `summary_markdown`, `modules`
3. Computes `estimated_minutes` by summing module times from front matter
4. Converts `summary_markdown` to HTML for the RICH_TEXT column
5. Serializes `modules` array to `module_slugs_json` as a JSON string
6. Serializes optional `content_blocks` to `content_blocks_json` as a JSON string
7. Upserts rows to the courses table by `slug`
8. Publishes the table (unless `--dry-run` is specified)

#### Expected Output (Dry-run)
```
🔄 Starting courses sync to HubDB...

📝 DRY RUN MODE - no changes will be made to HubDB

Found 1 course(s) to sync:

📄 Course: Getting Started: Virtual Lab (getting-started-virtual-lab)
   Modules: 3
   Estimated minutes: 45
   Content blocks: 6
   Payload:
{
  "path": "getting-started-virtual-lab",
  "name": "Getting Started: Virtual Lab",
  "childTableId": 0,
  "values": {
    "slug": "getting-started-virtual-lab",
    "title": "Getting Started: Virtual Lab",
    "summary_markdown": "<p>Welcome to the Hedgehog Virtual Lab...</p>",
    "module_slugs_json": "[\"accessing-the-hedgehog-virtual-lab-with-google-cloud\",\"accessing-the-hedgehog-virtual-lab-with-amazon-web-services\",\"accessing-the-hedgehog-virtual-lab-with-microsoft-azure\"]",
    "estimated_minutes": 45,
    "badge_image_url": "",
    "display_order": 1,
    "tags": "getting-started,vlab,onboarding,cloud",
    "content_blocks_json": "[{\"id\":\"intro\",\"type\":\"text\",\"title\":\"Welcome\"...}]"
  }
}

✅ Dry run complete!

Summary: 1 succeeded, 0 failed
```

### Notes
- **No deletions**: Removed course JSON files will not delete HubDB rows (v0.2 scope limitation).
- **Idempotent**: Re-running the sync with the same data produces no diff.
- **Module ordering**: The order of the `modules` array in the course JSON is preserved in `module_slugs_json`.
- **estimated_minutes**: Auto-computed by summing `estimated_minutes` from each module's front matter (defaults to 0 if missing).

## Pathways Mapping

Pathways group multiple courses or modules into structured learning journeys. Pathways prefer courses when available, falling back to direct module references.

### Input Source
JSON files at `content/pathways/<slug>.json`

### HubDB Pathways Table Schema

| Field | HubDB Column | Type | Notes |
|-------|--------------|------|-------|
| `slug` | `slug` | Text | Unique pathway identifier. Required, unique.
| `title` | `title` | Text | Display name for the pathway.
| `meta_description` | `meta_description` | Text | SEO meta description (auto-generated from summary if not provided).
| `summary_markdown` | `summary_markdown` | Rich Text | Markdown description (no H1 headings).
| `courses` | `course_slugs_json` | Rich Text | JSON array string of ordered course slugs (preferred).
| `modules` | `module_slugs_json` | Rich Text | JSON array string of ordered module slugs (fallback).
| `module_count` | `module_count` | Number | Count of modules in pathway (auto-computed).
| `total_estimated_minutes` | `total_estimated_minutes` | Number | Alias for estimated_minutes (for template clarity).
| `estimated_minutes` | `estimated_minutes` | Number | Total time to complete all modules (computed from modules only).
| `badge_image_url` | `badge_image_url` | Text | URL to completion badge graphic.
| `display_order` | `display_order` | Number | Manual sorting weight for pathway lists.
| `tags` | `tags` | Text | Comma-separated topic tags.
| `content_blocks` | `content_blocks_json` | Rich Text | Optional JSON array of narrative content blocks (same structure as Courses).

### Precedence Rules
- **Preferred**: Use `courses` array to reference courses. The `course_slugs_json` column will be populated.
- **Fallback**: Use `modules` array to directly reference modules. The `module_slugs_json` column will be populated.
- **Either is required**: A pathway must have either `courses` or `modules` (or both), but at least one must be present.

### Environment Configuration
Add to `.env`:
```env
HUBDB_PATHWAYS_TABLE_ID=<numeric id>
```

Use a staging or test table during initial development. Production table ID should be configured in CI secrets.

### Sync Behavior
- Pathways are synced via `npm run sync:pathways`
- The script reads `content/pathways/*.json` and creates/updates HubDB rows by `slug`
- **Deletions are out of scope** for the v0.2 initial implementation (removed pathways will remain in HubDB)
- Ordering is single-sourced via the `courses` or `modules` array in each pathway JSON file
- Optional `content_blocks` array supports narrative content (same structure as Courses)
- The table is published after successful writes

### Example Pathway JSON (with Courses)
```json
{
  "slug": "kubernetes-fundamentals",
  "title": "Kubernetes Fundamentals",
  "summary_markdown": "Learn Kubernetes core concepts...",
  "courses": [
    "k8s-getting-started",
    "k8s-deployments",
    "k8s-networking"
  ],
  "badge_image_url": "https://example.com/badges/k8s.png",
  "display_order": 10,
  "tags": "kubernetes,containers,orchestration"
}
```

### Example Pathway JSON (with Modules fallback)
```json
{
  "slug": "docker-basics",
  "title": "Docker Basics",
  "summary_markdown": "Learn Docker fundamentals...",
  "modules": [
    "intro-to-docker",
    "docker-images",
    "docker-compose"
  ],
  "badge_image_url": "https://example.com/badges/docker.png",
  "display_order": 5,
  "tags": "docker,containers"
}
```

See `docs/course-authoring.md` § Pathways for full authoring guidelines.

## Pathways Sync Usage

The `sync:pathways` script upserts pathways to the HubDB pathways table.

### Basic Usage
```bash
# Dry-run (prints payloads without writing to HubDB)
npm run sync:pathways -- --dry-run

# Live sync (writes to HubDB and publishes table)
npm run sync:pathways
```

### What It Does
1. Reads all `.json` files from `content/pathways/`
2. Validates required fields: `slug`, `title`, `summary_markdown`, and either `courses` or `modules`
3. Computes `estimated_minutes` by summing module times from front matter (if `modules` present)
4. Converts `summary_markdown` to HTML for the RICH_TEXT column
5. Serializes `courses` array to `course_slugs_json` as a JSON string (if present)
6. Serializes `modules` array to `module_slugs_json` as a JSON string (if present)
7. Upserts rows to the pathways table by `slug`
8. Publishes the table (unless `--dry-run` is specified)

### Expected Output (Dry-run)
```
🔄 Starting pathways sync to HubDB...

📝 DRY RUN MODE - no changes will be made to HubDB

Found 1 pathway(s) to sync:

📄 Pathway: Getting Started (getting-started)
   Modules: 3
   Estimated minutes: 45
   Payload:
{
  "path": "getting-started",
  "name": "Getting Started",
  "childTableId": 0,
  "values": {
    "slug": "getting-started",
    "title": "Getting Started",
    "summary_markdown": "<p>Start your Hedgehog journey...</p>",
    "module_slugs_json": "[\"accessing-the-hedgehog-virtual-lab-with-google-cloud\",\"accessing-the-hedgehog-virtual-lab-with-amazon-web-services\",\"accessing-the-hedgehog-virtual-lab-with-microsoft-azure\"]",
    "estimated_minutes": 45,
    "badge_image_url": "",
    "display_order": 1,
    "tags": "getting-started,vlab,onboarding,cloud"
  }
}

✅ Dry run complete!

Summary: 1 succeeded, 0 failed
```

### Notes
- **No deletions**: Removed pathway JSON files will not delete HubDB rows (v0.2 scope limitation).
- **Idempotent**: Re-running the sync with the same data produces no diff.
- **Course/Module ordering**: The order of the `courses` or `modules` array in the pathway JSON is preserved in the respective JSON column.
- **Precedence**: When both `courses` and `modules` are present, templates should prefer `course_slugs_json` when rendering pathways.

## Automation / Provisioning

The project includes automation scripts for one-command staging setup. These scripts provision HubDB tables, create dynamic pages, and update theme constants with table IDs.

### Provisioning Overview

The provisioning workflow automates:
1. **HubDB Table Creation**: Creates or updates `courses` and `pathways` tables from `hubdb-schemas/*.schema.json`
2. **Content Sync**: Syncs course and pathway data to the tables
3. **Theme Constants Update**: Updates `constants.json` with table IDs
4. **Dynamic Page Creation**: Creates `/learn/courses` and `/learn/pathways` pages bound to HubDB tables

### Quick Start

#### Full Provisioning (Recommended)

Run the complete provisioning workflow with a single command:

```bash
npm run provision:all
```

This runs all steps in sequence:
1. `provision:tables` — Creates/updates HubDB tables
2. `sync:courses` — Syncs course data
3. `sync:pathways` — Syncs pathway data
4. `provision:constants` — Updates theme constants
5. `provision:pages` — Creates/updates dynamic pages

#### Individual Provisioning Commands

Run individual steps as needed:

```bash
# Provision HubDB tables only
npm run provision:tables

# Update theme constants only
npm run provision:constants

# Provision dynamic pages only
npm run provision:pages
```

### Script Details

#### `provision:tables` — HubDB Table Provisioning

Creates or updates the `courses` and `pathways` HubDB tables.

**Usage:**
```bash
# Dry-run (shows payloads without making changes)
npm run provision:tables -- --dry-run

# Live run (creates/updates and publishes tables)
npm run provision:tables
```

**What it does:**
- Reads table schemas from `hubdb-schemas/courses.schema.json` and `hubdb-schemas/pathways.schema.json`
- Creates new tables or updates existing ones (idempotent)
- Sets `useForPages=true`, `allowChildTables=false`, `allowPublicApiAccess=false`
- Publishes tables after creation/update
- Outputs table IDs for use in `.env` file

**Expected output:**
```
🔄 Starting HubDB table provisioning...

📝 Creating table: courses
   ✓ Table created with ID: 12345678
📤 Publishing table: courses
   ✓ Table published

📝 Creating table: pathways
   ✓ Table created with ID: 87654321
📤 Publishing table: pathways
   ✓ Table published

============================================================
📊 Provisioning Summary
============================================================

Table: courses
  ID: 12345678
  Published: Yes

Table: pathways
  ID: 87654321
  Published: Yes

✅ Table provisioning complete!

📋 Add these to your .env file:

HUBDB_COURSES_TABLE_ID=12345678
HUBDB_PATHWAYS_TABLE_ID=87654321
```

#### `provision:constants` — Theme Constants Update

Updates the theme's `constants.json` file with HubDB table IDs.

**Usage:**
```bash
# Dry-run (shows diff without making changes)
npm run provision:constants -- --dry-run

# Live run (updates draft constants)
npm run provision:constants

# Live run + publish (updates and publishes theme)
npm run provision:constants -- --publish
```

**What it does:**
- Reads current `CLEAN x HEDGEHOG/templates/config/constants.json` via CMS Source Code API
- Updates `HUBDB_MODULES_TABLE_ID` (if missing), `HUBDB_COURSES_TABLE_ID`, `HUBDB_PATHWAYS_TABLE_ID`
- Writes updated constants back to draft
- Optionally publishes with `--publish` flag (requires manual theme publish in Design Manager)

**Expected output:**
```
🔄 Starting constants.json update...

📥 Reading constants file: CLEAN x HEDGEHOG/templates/config/constants.json
   ✓ Current constants loaded

============================================================
📊 Constants Update Diff
============================================================
  HUBDB_MODULES_TABLE_ID: 11111111 (no change)
  HUBDB_COURSES_TABLE_ID:
    - <not set>
    + 12345678
  HUBDB_PATHWAYS_TABLE_ID:
    - <not set>
    + 87654321

📝 Writing updated constants to: CLEAN x HEDGEHOG/templates/config/constants.json
   ✓ Draft constants updated

✅ Constants update complete!

💡 Constants updated in DRAFT. Publish the theme in Design Manager or run with --publish.
```

#### `provision:pages` — Dynamic Page Creation

Creates or updates the two dynamic pages for courses and pathways.

**Usage:**
```bash
# Dry-run (shows payloads without making changes)
npm run provision:pages -- --dry-run

# Live run (creates/updates pages in DRAFT state)
npm run provision:pages

# Live run + publish (creates/updates and publishes pages)
npm run provision:pages -- --publish
```

**What it does:**
- Creates or updates two site pages via CMS Pages API:
  - **Courses**: slug `learn/courses`, template `CLEAN x HEDGEHOG/templates/learn/courses/courses-page.html`
  - **Pathways**: slug `learn/pathways`, template `CLEAN x HEDGEHOG/templates/learn/pathways/pathways-page.html`
- Binds pages to HubDB tables using `dynamicPageDataSourceType=HUBDB` and `dynamicPageDataSourceId`
- Creates pages in DRAFT state by default
- Idempotent: if page exists (by slug), updates the draft instead of creating duplicates
- Optionally schedules immediate publish with `--publish` flag

**Expected output:**
```
🔄 Starting CMS page provisioning...

📝 Creating page: Courses
   ✓ Page created with ID: 98765432
📝 Creating page: Pathways
   ✓ Page created with ID: 23456789

============================================================
📊 Page Provisioning Summary
============================================================

Page: Courses
  Slug: learn/courses
  ID: 98765432
  State: DRAFT
  URL: https://example.hubspotpagebuilder.com/...

Page: Pathways
  Slug: learn/pathways
  ID: 23456789
  State: DRAFT
  URL: https://example.hubspotpagebuilder.com/...

✅ Page provisioning complete!

💡 Pages created in DRAFT state. To publish, run with --publish flag.
```

### Environment Configuration

Ensure these environment variables are set in your `.env` file:

```env
HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-...
HUBDB_MODULES_TABLE_ID=<numeric id>
HUBDB_COURSES_TABLE_ID=<numeric id>
HUBDB_PATHWAYS_TABLE_ID=<numeric id>
```

The provisioning scripts will output the table IDs after creating tables. Add them to your `.env` file.

### Idempotency

All provisioning scripts are idempotent:
- **Tables**: Re-running with existing tables updates them in place (by table name)
- **Pages**: Re-running with existing pages updates the draft (by slug)
- **Constants**: Re-running with same values shows "no change"

Running `provision:all` multiple times is safe and will only update changed values.

### Verification

#### Tables
```bash
# Dry-run shows intended payloads
npm run provision:tables -- --dry-run

# Live run creates/updates tables
npm run provision:tables
```

#### Sync
```bash
# Dry-run shows course payloads (with computed estimated_minutes)
npm run sync:courses -- --dry-run

# Dry-run shows pathway payloads
npm run sync:pathways -- --dry-run

# Live syncs
npm run sync:courses
npm run sync:pathways
```

#### Constants
```bash
# Dry-run shows diff
npm run provision:constants -- --dry-run

# Live update (draft only)
npm run provision:constants

# Live update + publish (requires manual theme publish in Design Manager)
npm run provision:constants -- --publish
```

#### Pages
```bash
# Dry-run shows page payloads
npm run provision:pages -- --dry-run

# Live run (creates DRAFT pages)
npm run provision:pages

# Live run + publish
npm run provision:pages -- --publish
```

### GUI Verification Steps

After running `provision:all`, verify in HubSpot:

1. **Tables** (Design Manager → HubDB):
   - Confirm `courses` and `pathways` tables exist with correct schema
   - Verify `useForPages=true` and tables are published
   - Check that synced rows are present

2. **Constants** (Design Manager → Theme Files):
   - Open `CLEAN x HEDGEHOG/templates/config/constants.json`
   - Verify table IDs are correct
   - Publish theme if needed

3. **Pages** (Content → Website Pages):
   - Open `/learn/courses` and `/learn/pathways` pages in editor
   - Verify `dynamicPageDataSourceType=HUBDB` and table binding
   - Publish pages (or schedule publish)

4. **Live Site**:
   - Visit `/learn/courses` and `/learn/pathways`
   - Verify list pages render cards from HubDB
   - Click a card to verify detail pages load
   - Confirm single H1 per view, archived filtering in lists

### Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| `HUBSPOT_PRIVATE_APP_TOKEN environment variable not set` | Missing `.env` file or token | Ensure `.env` contains `HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-...` |
| `HUBDB_COURSES_TABLE_ID environment variable not set` | Tables not provisioned yet | Run `provision:tables` first, then add IDs to `.env` |
| `Error finding table` | API permissions or network issue | Check private app has HubDB read/write scopes; retry after delay |
| `Error finding page with slug` | Pages API permissions | Check private app has CMS Pages read/write scopes |
| `Failed to read constants file` | File path incorrect or permissions | Verify theme path is `CLEAN x HEDGEHOG/templates/config/constants.json`; check Source Code API access |

### Notes on Publishing

- **Tables**: Auto-published after creation/update
- **Constants**: Updated in draft; requires manual theme publish in Design Manager (or `--publish` flag + manual theme publish)
- **Pages**: Created in DRAFT by default; use `--publish` flag to schedule immediate publish, or publish manually in CMS editor

## Notes
- Running locally with ESM: this repo uses `"type": "module"`; scripts call Node with the ts-node ESM loader. If you previously ran `ts-node src/...` and saw `Unknown file extension ".ts"`, use `npm run sync:content` (which executes `node --loader ts-node/esm ...`).
- Deletions: the sync will delete HubDB rows whose slugs are not present under `content/modules/` (defaults on). To disable deletion, set `SYNC_DELETE_MISSING=false` in your environment.
- Archiving: placing a module under `content/archive/` marks the corresponding HubDB row with a `archived` tag instead of deleting it. The list page hides archived modules; their detail pages show an "archived" banner. You can also soft‑archive by adding `archived: true` in front matter and resyncing.
