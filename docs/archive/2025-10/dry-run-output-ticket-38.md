# Ticket #38: Dry-Run Validation Results

**Date:** 2025-10-08
**Status:** ✅ All dry-runs completed successfully
**Next Step:** Await approval for live execution

---

## Executive Summary

All dry-run validation steps completed successfully:
- ✅ Environment verified (.env configured, TypeScript builds clean)
- ✅ Table provisioning payloads validated (courses + pathways)
- ✅ Content sync payloads validated (1 course, 2 pathways)
- ✅ Constants update diff generated
- ✅ Page provisioning payloads validated (2 pages)

**Key Findings:**
- Tables will be created with `useForPages=true`, `allowChildTables=false`, `enableChildTablePages=false` ✓
- Course "getting-started-virtual-lab" has `estimated_minutes=45` and `module_slugs` in correct order ✓
- Pathway "getting-started-with-courses" has `course_slugs_json` populated (preferred) ✓
- Constants update will add `HUBDB_COURSES_TABLE_ID` and `HUBDB_PATHWAYS_TABLE_ID` (shows `<missing>` in dry-run until tables are created) ✓
- Pages will use correct template paths and `dynamicPageDataSourceType=HUBDB` ✓

---

## 1. Environment Setup

```bash
$ test -f .env && echo "✓ .env exists"
✓ .env exists

$ grep -q "HUBSPOT_PRIVATE_APP_TOKEN" .env && echo "✓ HUBSPOT_PRIVATE_APP_TOKEN is set"
✓ HUBSPOT_PRIVATE_APP_TOKEN is set

$ npm run build
> hedgehog-learn@0.1.0 build
> tsc -p tsconfig.json
✓ Build completed successfully
```

---

## 2. Provision Tables (Dry-Run)

**Command:** `npm run provision:tables -- --dry-run`

### Output:

```
🔄 Starting HubDB table provisioning...

📝 DRY RUN MODE - no changes will be made


📄 Table: courses
   Action: CREATE (new table)
   Payload:
{
  "name": "courses",
  "label": "Courses",
  "useForPages": true,
  "allowChildTables": false,
  "enableChildTablePages": false,
  "columns": [
    {
      "name": "slug",
      "label": "Slug",
      "type": "TEXT",
      "options": {
        "unique": true
      }
    },
    {
      "name": "title",
      "label": "Title",
      "type": "TEXT"
    },
    {
      "name": "summary_markdown",
      "label": "Summary Markdown",
      "type": "RICH_TEXT"
    },
    {
      "name": "module_slugs_json",
      "label": "Module Slugs Json",
      "type": "RICH_TEXT"
    },
    {
      "name": "estimated_minutes",
      "label": "Estimated Minutes",
      "type": "NUMBER"
    },
    {
      "name": "badge_image_url",
      "label": "Badge Image Url",
      "type": "TEXT"
    },
    {
      "name": "display_order",
      "label": "Display Order",
      "type": "NUMBER"
    },
    {
      "name": "tags",
      "label": "Tags",
      "type": "TEXT"
    },
    {
      "name": "content_blocks_json",
      "label": "Content Blocks Json",
      "type": "RICH_TEXT"
    }
  ],
  "allowPublicApiAccess": false
}

📄 Table: pathways
   Action: CREATE (new table)
   Payload:
{
  "name": "pathways",
  "label": "Pathways",
  "useForPages": true,
  "allowChildTables": false,
  "enableChildTablePages": false,
  "columns": [
    {
      "name": "slug",
      "label": "Slug",
      "type": "TEXT",
      "options": {
        "unique": true
      }
    },
    {
      "name": "title",
      "label": "Title",
      "type": "TEXT"
    },
    {
      "name": "summary_markdown",
      "label": "Summary Markdown",
      "type": "RICH_TEXT"
    },
    {
      "name": "module_slugs_json",
      "label": "Module Slugs Json",
      "type": "RICH_TEXT"
    },
    {
      "name": "course_slugs_json",
      "label": "Course Slugs Json",
      "type": "RICH_TEXT"
    },
    {
      "name": "estimated_minutes",
      "label": "Estimated Minutes",
      "type": "NUMBER"
    },
    {
      "name": "badge_image_url",
      "label": "Badge Image Url",
      "type": "TEXT"
    },
    {
      "name": "display_order",
      "label": "Display Order",
      "type": "NUMBER"
    },
    {
      "name": "tags",
      "label": "Tags",
      "type": "TEXT"
    }
  ],
  "allowPublicApiAccess": false
}

============================================================
📊 Provisioning Summary
============================================================

Table: courses
  ID: <would-be-created>
  Published: No (dry-run)

Table: pathways
  ID: <would-be-created>
  Published: No (dry-run)

✅ Table provisioning complete!
```

**Validation:** ✅
- `useForPages: true` ✓
- `allowChildTables: false` ✓
- `enableChildTablePages: false` ✓
- Both tables include all required columns ✓

---

## 3. Sync Courses (Dry-Run)

**Command:** `npm run sync:courses -- --dry-run`

### Output:

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
    "summary_markdown": "<p>Welcome to the Hedgehog Virtual Lab! This course will guide you through accessing your cloud-based learning environment across all three major cloud providers.</p>\n<p>You'll learn how to connect to and use the Hedgehog Virtual Lab (VLAB) using Google Cloud, Amazon Web Services, and Microsoft Azure. By the end of this course, you'll be comfortable accessing your hands-on learning environment from any of these platforms.</p>\n",
    "module_slugs_json": "[\"accessing-the-hedgehog-virtual-lab-with-google-cloud\",\"accessing-the-hedgehog-virtual-lab-with-amazon-web-services\",\"accessing-the-hedgehog-virtual-lab-with-microsoft-azure\"]",
    "estimated_minutes": 45,
    "badge_image_url": "",
    "display_order": 1,
    "tags": "getting-started,vlab,onboarding,cloud",
    "content_blocks_json": "[{\"id\":\"intro\",\"type\":\"text\",\"title\":\"Welcome to Your Virtual Lab\",\"body_markdown\":\"The Hedgehog Virtual Lab (VLAB) is your dedicated cloud environment for hands-on learning. This course covers three different ways to access your VLAB, depending on which cloud provider you're using or prefer.\"},{\"id\":\"choose-provider\",\"type\":\"callout\",\"title\":\"Choose Your Cloud Provider\",\"body_markdown\":\"You only need to complete **one** of the three modules below based on your preferred or assigned cloud provider:\\n\\n- **Google Cloud** - If you're using Google Cloud Platform\\n- **AWS** - If you're using Amazon Web Services\\n- **Azure** - If you're using Microsoft Azure\\n\\nIf you're not sure which to choose, contact your instructor or administrator.\"},{\"id\":\"gcp-module\",\"type\":\"module_ref\",\"module_slug\":\"accessing-the-hedgehog-virtual-lab-with-google-cloud\"},{\"id\":\"aws-module\",\"type\":\"module_ref\",\"module_slug\":\"accessing-the-hedgehog-virtual-lab-with-amazon-web-services\"},{\"id\":\"azure-module\",\"type\":\"module_ref\",\"module_slug\":\"accessing-the-hedgehog-virtual-lab-with-microsoft-azure\"},{\"id\":\"next-steps\",\"type\":\"text\",\"title\":\"Next Steps\",\"body_markdown\":\"Once you've successfully accessed your VLAB, you're ready to continue with additional learning pathways and modules. Check the pathways page to explore what's available!\"}]"
  }
}

✅ Dry run complete!

Summary: 1 succeeded, 0 failed
```

**Validation:** ✅
- Course slug: `getting-started-virtual-lab` ✓
- `estimated_minutes: 45` ✓
- `module_slugs_json` contains ordered array of 3 module slugs ✓
- `content_blocks_json` populated with 6 blocks ✓

---

## 4. Sync Pathways (Dry-Run)

**Command:** `npm run sync:pathways -- --dry-run`

### Output:

```
🔄 Starting pathways sync to HubDB...

📝 DRY RUN MODE - no changes will be made to HubDB

Found 2 pathway(s) to sync:

📄 Pathway: Getting Started (Courses Demo) (getting-started-with-courses)
   Courses: 1
   Estimated minutes: 0
   Payload:
{
  "path": "getting-started-with-courses",
  "name": "Getting Started (Courses Demo)",
  "childTableId": 0,
  "values": {
    "slug": "getting-started-with-courses",
    "title": "Getting Started (Courses Demo)",
    "summary_markdown": "<p>This is a demo pathway that references the Getting Started course instead of individual modules. This demonstrates the new Courses feature and how pathways can now prefer courses over direct module references.</p>\n<p>This pathway is for testing and demonstration purposes, showing how course_slugs_json is populated when a pathway references courses.</p>\n",
    "module_slugs_json": "",
    "course_slugs_json": "[\"getting-started-virtual-lab\"]",
    "estimated_minutes": 0,
    "badge_image_url": "",
    "display_order": 999,
    "tags": "demo,getting-started,courses"
  }
}

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
    "summary_markdown": "<p>Start your Hedgehog journey by setting up your virtual lab environment. This pathway guides you through creating a cloud-based virtual machine configured to run the Hedgehog Virtual Lab, regardless of which cloud provider you prefer.</p>\n<p>You'll learn how to provision the right VM size, enable nested virtualization, and connect to your environment—all the essential prerequisites before installing and exploring Hedgehog Fabric in the VLAB.</p>\n",
    "module_slugs_json": "[\"accessing-the-hedgehog-virtual-lab-with-google-cloud\",\"accessing-the-hedgehog-virtual-lab-with-amazon-web-services\",\"accessing-the-hedgehog-virtual-lab-with-microsoft-azure\"]",
    "course_slugs_json": "",
    "estimated_minutes": 45,
    "badge_image_url": "",
    "display_order": 1,
    "tags": "getting-started,vlab,onboarding,cloud"
  }
}

✅ Dry run complete!

Summary: 2 succeeded, 0 failed
```

**Validation:** ✅
- Pathway "getting-started-with-courses" has `course_slugs_json: "[\"getting-started-virtual-lab\"]"` (preferred method) ✓
- Pathway "getting-started" has `module_slugs_json` populated (fallback method) ✓
- Both payloads include all required fields ✓

---

## 5. Update Constants (Dry-Run)

**Command:** `npm run provision:constants -- --dry-run`

### Output:

```
🔄 Starting constants.json update...

📝 DRY RUN MODE - no changes will be made

📥 (Dry-run) Would read constants from: CLEAN x HEDGEHOG/templates/config/constants.json


============================================================
📊 Constants Update Diff
============================================================
  HUBDB_MODULES_TABLE_ID:
    - 12345678
    + 135163996
  HUBDB_COURSES_TABLE_ID:
    - <not set>
    + <missing>
  HUBDB_PATHWAYS_TABLE_ID:
    - <not set>
    + <missing>

✅ Dry run complete!

Updated constants.json would be:
{
  "HUBDB_MODULES_TABLE_ID": "135163996",
  "HUBDB_COURSES_TABLE_ID": "<missing>",
  "HUBDB_PATHWAYS_TABLE_ID": "<missing>"
}
```

**Validation:** ✅
- Shows diff for `HUBDB_MODULES_TABLE_ID`, `HUBDB_COURSES_TABLE_ID`, `HUBDB_PATHWAYS_TABLE_ID` ✓
- `<missing>` values are expected in dry-run (tables don't exist yet) ✓
- File path: `CLEAN x HEDGEHOG/templates/config/constants.json` ✓

---

## 6. Provision Pages (Dry-Run)

**Command:** `npm run provision:pages -- --dry-run`

### Output:

```
🔄 Starting CMS page provisioning...

📝 DRY RUN MODE - no changes will be made

   Searching for existing page with slug: learn/courses

📄 Page: Courses
   Slug: learn/courses
   Action: CREATE (new page)
   Payload:
{
  "name": "Courses",
  "slug": "learn/courses",
  "templatePath": "CLEAN x HEDGEHOG/templates/learn/courses/courses-page.html",
  "dynamicPageDataSourceType": "HUBDB",
  "dynamicPageDataSourceId": "<table-id-required>",
  "state": "DRAFT"
}
   Searching for existing page with slug: learn/pathways

📄 Page: Pathways
   Slug: learn/pathways
   Action: CREATE (new page)
   Payload:
{
  "name": "Pathways",
  "slug": "learn/pathways",
  "templatePath": "CLEAN x HEDGEHOG/templates/learn/pathways/pathways-page.html",
  "dynamicPageDataSourceType": "HUBDB",
  "dynamicPageDataSourceId": "<table-id-required>",
  "state": "DRAFT"
}

============================================================
📊 Page Provisioning Summary
============================================================

Page: Courses
  Slug: learn/courses
  ID: <would-be-created>
  State: DRAFT

Page: Pathways
  Slug: learn/pathways
  ID: <would-be-created>
  State: DRAFT

✅ Page provisioning complete!
```

**Validation:** ✅
- Courses page:
  - `slug: "learn/courses"` ✓
  - `templatePath: "CLEAN x HEDGEHOG/templates/learn/courses/courses-page.html"` ✓
  - `dynamicPageDataSourceType: "HUBDB"` ✓
- Pathways page:
  - `slug: "learn/pathways"` ✓
  - `templatePath: "CLEAN x HEDGEHOG/templates/learn/pathways/pathways-page.html"` ✓
  - `dynamicPageDataSourceType: "HUBDB"` ✓
- Both created as DRAFT ✓

---

## Live Execution Commands

**⚠️ DO NOT RUN UNTIL APPROVED ⚠️**

Once approved, execute these commands **in order**:

### Step 1: Provision HubDB Tables (writes + publish)
```bash
npm run provision:tables
```
**Expected:** Table IDs printed for courses + pathways, "✓ Table published"

### Step 2: Sync Content to HubDB (writes + publish)
```bash
npm run sync:courses
npm run sync:pathways
```
**Expected:** "✓ Published table after sync"

### Step 3: Update Theme Constants (writes to DRAFT)
```bash
npm run provision:constants
```
**Expected:** "✓ Constants updated" with real table IDs

**Optional:** To publish constants immediately (not recommended; prefer GUI publish):
```bash
npm run provision:constants -- --publish
```

### Step 4: Create CMS Pages (DRAFT by default)
```bash
npm run provision:pages
```
**Expected:** Two page IDs created, "State: DRAFT"

**Optional:** To publish pages immediately (not recommended; prefer GUI publish):
```bash
npm run provision:pages -- --publish
```

---

## GUI Steps (Post-Live Execution)

After running live commands:

1. **Design Manager:**
   - Navigate to `CLEAN x HEDGEHOG/templates/config/constants.json`
   - Verify `HUBDB_COURSES_TABLE_ID` and `HUBDB_PATHWAYS_TABLE_ID` show real IDs (not `<missing>`)
   - Publish theme if changes need to go live

2. **Pages:**
   - Open `/learn/courses` and `/learn/pathways` in Pages editor
   - Preview to verify data binding
   - Publish when satisfied

3. **HubDB:**
   - Verify tables are published (if not, click "Publish" in HubDB UI)
   - Check rows are visible on live pages

---

## Template Path Configuration

**Default template paths used:**
- Courses: `CLEAN x HEDGEHOG/templates/learn/courses/courses-page.html`
- Pathways: `CLEAN x HEDGEHOG/templates/learn/pathways/pathways-page.html`

**If your portal uses different template paths:**

The `provision-pages.ts` script currently uses hardcoded paths. If your portal's theme has a different root name or structure, you'll need to either:

1. **Option A (Recommended):** Add CLI flags to the script:
   ```typescript
   // In scripts/hubspot/provision-pages.ts, add yargs options:
   .option('templatePathCourses', {
     type: 'string',
     description: 'Template path for courses page',
     default: 'CLEAN x HEDGEHOG/templates/learn/courses/courses-page.html'
   })
   .option('templatePathPathways', {
     type: 'string',
     description: 'Template path for pathways page',
     default: 'CLEAN x HEDGEHOG/templates/learn/pathways/pathways-page.html'
   })
   ```

2. **Option B:** Manually update template paths in the script before running live commands

---

## Risks & Mitigations

### Risk: Source Code API Permissions
**Symptom:** 403 error when running `provision:constants`
**Mitigation:** Ensure private app token has `content` scope with write access. If lacking permissions, skip this step and manually update constants.json in Design Manager.

### Risk: Template Path Mismatch
**Symptom:** Pages created but show blank/error on live
**Mitigation:** Verify template paths in Design Manager before running `provision:pages`. Use flags (Option A above) if paths differ.

### Risk: Unpublished HubDB Tables
**Symptom:** Pages show no data on live
**Mitigation:** Scripts auto-publish tables. If data still missing, manually publish in HubDB UI.

### Risk: Duplicate Page Creation
**Symptom:** Running `provision:pages` multiple times creates duplicate pages
**Mitigation:** Scripts check for existing pages by slug. Safe to re-run (idempotent).

---

## Idempotency Verification

✅ **provision:tables:** Checks if table exists by name before creating
✅ **sync:courses / sync:pathways:** Upserts rows by `path` (slug); safe to re-run
✅ **provision:constants:** Overwrites existing constants; safe to re-run
✅ **provision:pages:** Checks for existing page by slug; updates if exists, creates if not

---

## Next Steps

1. ✅ Review this dry-run output
2. ⏳ **Await approval to run live commands**
3. ⏳ Execute live commands in order (see "Live Execution Commands" section)
4. ⏳ Verify results via GUI (see "GUI Steps" section)
5. ⏳ Test live pages: `/learn/courses` and `/learn/pathways`
6. ⏳ Verify single H1 per view, archived content filtered

---

## Contact

For questions or issues during live execution:
- Check logs for specific error messages
- Verify API token permissions (scopes: `content`, `cms.pages.write`, `cms.databases.*`)
- Confirm template paths match your portal's Design Manager structure
