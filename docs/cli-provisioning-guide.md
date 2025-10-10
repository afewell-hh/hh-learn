# CLI-Only Provisioning Guide (Issue #59 Path A)

This guide documents the CLI-only workflow for provisioning HubSpot CMS resources without requiring changes to Private App scopes beyond what's already configured.

## Overview

This approach uses:
- HubSpot CMS Source Code API v3 for uploading templates and constants
- HubSpot CMS Pages API v3 for creating/updating pages
- Private App token with existing scopes (no additional scope changes needed)
- Node.js scripts via npm for all operations

## Prerequisites

1. **Environment Variables** (.env file):
   ```bash
   HUBSPOT_PRIVATE_APP_TOKEN=<your-token>
   HUBSPOT_ACCOUNT_ID=<your-account-id>
   HUBDB_MODULES_TABLE_ID=<modules-table-id>
   HUBDB_COURSES_TABLE_ID=<courses-table-id>
   HUBDB_PATHWAYS_TABLE_ID=<pathways-table-id>
   AWS_REGION=us-west-2
   APP_STAGE=dev
   ENABLE_CRM_PROGRESS=false  # Phase 1: anonymous beacons only
   ```

2. **HubSpot CLI Authentication**:
   ```bash
   hs accounts list
   # Should show your account authenticated
   ```

3. **Build TypeScript**:
   ```bash
   npm run build
   ```

## Step-by-Step Provisioning Workflow

### Step 1: Upload Templates and Constants to HubSpot

Upload local template files and constants.json to HubSpot Design Manager (Draft state):

```bash
# Dry run first (recommended)
npm run upload:templates -- --dry-run

# Upload for real
npm run upload:templates
```

**What it does:**
- Uploads all files from `clean-x-hedgehog-templates/` to `CLEAN x HEDGEHOG/templates/` in HubSpot
- Uses Source Code API v3 (`/cms/v3/source-code/draft/content/{path}`)
- Files uploaded to DRAFT environment
- Includes:
  - `config/constants.json` - Configuration constants
  - `learn/module-page.html` - Module detail page template
  - `learn/courses-page.html` - Courses list page template
  - `learn/pathways-page.html` - Pathways list page template
  - `learn/my-learning.html` - My Learning dashboard template

**Expected Output:**
```
📤 Uploading: CLEAN x HEDGEHOG/templates/config/constants.json
   ✓ Uploaded successfully
📤 Uploading: CLEAN x HEDGEHOG/templates/learn/courses-page.html
   ✓ Uploaded successfully
...
============================================================
📊 Upload Summary
============================================================
✓ Success: 5
✗ Failed: 0

✅ Upload complete!
```

### Step 2: Provision or Update CMS Pages

Create or update CMS pages that use the uploaded templates:

```bash
# Dry run first (recommended)
npm run provision:pages -- --dry-run

# Provision for real (updates existing pages, requires --allow-create for new pages)
npm run provision:pages -- --allow-create
```

**What it does:**
- Creates or updates 4 CMS pages:
  - `/learn` - Module listing (binds to Modules HubDB table)
  - `/learn/courses` - Courses listing (binds to Courses HubDB table)
  - `/learn/pathways` - Pathways listing (binds to Pathways HubDB table)
  - `/learn/my-learning` - My Learning dashboard (binds to Modules HubDB table)
- Uses CMS Pages API v3 (`/cms/v3/pages/site-pages`)
- **Idempotent**: Updates existing pages by slug, only creates new pages with `--allow-create`
- Validates templates exist before creating/updating pages
- Checks for common misnamed template paths

**Expected Output:**
```
📝 Updating page: Learn (ID: 197177162603)
   ✓ Page updated
📝 Updating page: Courses (ID: 197280289288)
   ✓ Page updated
📝 Updating page: Pathways (ID: 197280289546)
   ✓ Page updated
📝 Creating page: My Learning
   ✓ Page created with ID: 197399202740

============================================================
📊 Page Provisioning Summary
============================================================

Page: Learn
  Slug: learn
  ID: 197177162603
  State: DRAFT
  URL: https://hedgehog.cloud/learn

Page: Courses
  Slug: learn/courses
  ID: 197280289288
  State: DRAFT
  URL: https://hedgehog.cloud/learn/courses

Page: Pathways
  Slug: learn/pathways
  ID: 197280289546
  State: DRAFT
  URL: https://hedgehog.cloud/learn/pathways

Page: My Learning
  Slug: learn/my-learning
  ID: 197399202740
  State: DRAFT
  URL: https://hedgehog.cloud/learn/my-learning

✅ Page provisioning complete!
```

### Step 3: Verify Anonymous Beacon Flow (Phase 1)

Test that anonymous beacons (without authentication) work correctly:

```bash
# Test endpoint
curl -X POST "https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_started",
    "payload": {
      "module_slug": "test-module",
      "ts": "2025-10-10T12:00:00Z"
    }
  }'
```

**Expected Response:**
```json
{
  "status": "logged",
  "mode": "anonymous"
}
```

**What this verifies:**
- Serverless `/events/track` endpoint is deployed and accessible
- CORS is configured correctly for HubSpot domains
- Anonymous beacons (no `contactIdentifier`) are logged but NOT persisted to CRM
- `ENABLE_CRM_PROGRESS=false` is working as expected

### Step 4: Publish Pages (When Ready)

Pages are created in DRAFT state by default. To publish:

**Option A: Publish via HubSpot UI**
1. Log into HubSpot
2. Go to Marketing > Files and Templates > Design Manager
3. Navigate to each page in the list
4. Click "Publish" button

**Option B: Publish via Script (future enhancement)**
```bash
npm run provision:pages -- --publish
```
*Note: Auto-publish may require additional testing/implementation*

## Phase 1 Verification Checklist

- [x] TypeScript compiles without errors (`npm run build`)
- [x] HubSpot CLI authenticated (`hs accounts list`)
- [x] Templates uploaded to Design Manager in DRAFT state
- [x] Constants.json uploaded with correct table IDs and `ENABLE_CRM_PROGRESS=false`
- [x] 4 CMS pages created/updated in DRAFT state
- [x] Anonymous beacon endpoint returns `{"status":"logged","mode":"anonymous"}`
- [ ] Manual verification: Visit pages in browser (after publishing)
- [ ] Manual verification: Check Network tab shows POST to `/events/track`
- [ ] Manual verification: Confirm no `contactIdentifier` in beacon payload
- [ ] Manual verification: Confirm no events appear in HubSpot CRM (anonymous mode)

## Troubleshooting

### Templates Not Found Error

**Error:**
```
❌ ERROR: Template not found at "CLEAN x HEDGEHOG/templates/learn/module-page.html"
```

**Solution:**
1. Ensure templates are uploaded first: `npm run upload:templates`
2. Check that files exist in `clean-x-hedgehog-templates/` locally
3. Verify HubSpot Private App token has Source Code API access

### Page Already Exists (Duplicate Pages)

**Error:**
```
✗ Failed to provision page: Page with slug "learn" already exists
```

**Solution:**
1. The script is idempotent - it should UPDATE existing pages by default
2. If you see duplicates (e.g., `learn`, `learn-1`, `learn-2`), manually delete duplicates in HubSpot
3. Re-run `npm run provision:pages -- --dry-run` to verify only 1 page per slug will be updated

### CORS Error in Browser

**Error (in browser console):**
```
Access to fetch at 'https://...amazonaws.com/events/track' from origin 'https://hedgehog.cloud' has been blocked by CORS policy
```

**Solution:**
1. Check `serverless.yml` includes your domain in `allowedOrigins`:
   ```yaml
   cors:
     allowedOrigins:
       - https://hedgehog.cloud
       - https://www.hedgehog.cloud
       - https://*.hubspotusercontent-na1.net
   ```
2. Redeploy serverless API: `npm run deploy:aws`

### Beacon Returns 500 Error

**Error:**
```json
{"error": "Internal error"}
```

**Solution:**
1. Check serverless logs:
   ```bash
   aws logs tail /aws/lambda/hedgehog-learn-dev-api --follow
   ```
2. Verify environment variables are set correctly in AWS Lambda:
   - `HUBSPOT_PRIVATE_APP_TOKEN`
   - `HUBSPOT_ACCOUNT_ID`
   - `ENABLE_CRM_PROGRESS`
3. Redeploy if needed: `npm run deploy:aws`

## NPM Scripts Reference

| Script | Description | Flags |
|--------|-------------|-------|
| `npm run build` | Compile TypeScript to JavaScript | - |
| `npm run upload:templates` | Upload templates/constants to HubSpot | `--dry-run` |
| `npm run provision:pages` | Create/update CMS pages | `--dry-run`, `--allow-create`, `--publish` |
| `npm run provision:tables` | Provision HubDB tables | `--dry-run` |
| `npm run provision:constants` | Update constants.json in HubSpot | `--dry-run`, `--publish` |
| `npm run provision:all` | Run all provisioning steps | - |
| `npm run validate:cms` | Dry-run all provisioning steps | - |
| `npm run deploy:aws` | Deploy serverless API to AWS | - |

## Key Files

| File | Purpose |
|------|---------|
| `clean-x-hedgehog-templates/` | Local template source files |
| `clean-x-hedgehog-templates/config/constants.json` | Configuration constants |
| `scripts/hubspot/upload-templates.ts` | Upload script for templates |
| `scripts/hubspot/provision-pages.ts` | Page provisioning script |
| `scripts/hubspot/update-constants.ts` | Constants update script |
| `src/api/lambda/index.ts` | Serverless API handler (beacons) |
| `serverless.yml` | AWS Lambda/API Gateway configuration |
| `.env` | Environment variables (DO NOT COMMIT) |

## API Endpoints Used

### HubSpot APIs

1. **Source Code API v3** (Upload templates):
   - `PUT /cms/v3/source-code/draft/content/{path}`
   - Auth: Bearer token
   - Content-Type: multipart/form-data

2. **Pages API v3** (Create/update pages):
   - `POST /cms/v3/pages/site-pages/search` (search by slug)
   - `GET /cms/v3/pages/site-pages` (list pages)
   - `POST /cms/v3/pages/site-pages` (create page)
   - `PATCH /cms/v3/pages/site-pages/{pageId}` (update page)
   - Auth: Bearer token

3. **Metadata API v3** (Validate templates):
   - `GET /cms/v3/source-code/draft/metadata/{path}`
   - Auth: Bearer token

### Serverless API

- **POST /events/track** (Track learning events):
  - Request: `{"eventName": "...", "payload": {...}, "contactIdentifier": {...}}`
  - Response: `{"status": "logged|persisted", "mode": "anonymous|authenticated|fallback"}`

## Next Steps (Issue #60 - Future Work)

1. **Migrate to Project App Scopes**:
   - Define `app/app-hsmeta.json` with required scopes
   - Deploy project app: `hs project deploy`
   - Update installation scopes in HubSpot
   - Refactor scripts to use OAuth access token

2. **Phase 2: Authenticated Beacons**:
   - Enable HubSpot CMS Membership
   - Create Custom Event Definitions in HubSpot
   - Set `ENABLE_CRM_PROGRESS=true` in constants and environment
   - Test authenticated beacons with `contactIdentifier`
   - Verify events persist to HubSpot CRM

## References

- [Issue #59: Staging Validation v0.3 Auth & Progress](https://github.com/your-repo/issues/59)
- [Issue #60: Migrate to Project App Scopes](https://github.com/your-repo/issues/60)
- [HubSpot Source Code API Docs](https://developers.hubspot.com/docs/guides/api/cms/source-code)
- [HubSpot Pages API Docs](https://developers.hubspot.com/docs/reference/api/cms/pages)
- [Auth & Progress Architecture Docs](./auth-and-progress.md)
