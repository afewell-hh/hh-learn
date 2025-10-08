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

## Courses Mapping

Courses group multiple modules into structured, narrative-driven learning units. Courses sit between Modules and Pathways in the content hierarchy.

### Input Source
JSON files at `content/courses/<slug>.json`

### HubDB Courses Table Schema

| Field | HubDB Column | Type | Notes |
|-------|--------------|------|-------|
| `slug` | `slug` | Text | Unique course identifier. Required, unique.
| `title` | `title` | Text | Display name for the course.
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
| `summary_markdown` | `summary_markdown` | Rich Text | Markdown description (no H1 headings).
| `courses` | `course_slugs_json` | Rich Text | JSON array string of ordered course slugs (preferred).
| `modules` | `module_slugs_json` | Rich Text | JSON array string of ordered module slugs (fallback).
| `estimated_minutes` | `estimated_minutes` | Number | Total time to complete all modules (computed from modules only).
| `badge_image_url` | `badge_image_url` | Text | URL to completion badge graphic.
| `display_order` | `display_order` | Number | Manual sorting weight for pathway lists.
| `tags` | `tags` | Text | Comma-separated topic tags.

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

## Notes
- Running locally with ESM: this repo uses `"type": "module"`; scripts call Node with the ts-node ESM loader. If you previously ran `ts-node src/...` and saw `Unknown file extension ".ts"`, use `npm run sync:content` (which executes `node --loader ts-node/esm ...`).
- Deletions: the sync will delete HubDB rows whose slugs are not present under `content/modules/` (defaults on). To disable deletion, set `SYNC_DELETE_MISSING=false` in your environment.
- Archiving: placing a module under `content/archive/` marks the corresponding HubDB row with a `archived` tag instead of deleting it. The list page hides archived modules; their detail pages show an "archived" banner. You can also soft‑archive by adding `archived: true` in front matter and resyncing.
