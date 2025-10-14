# Issue #127 Implementation Summary

## Completed Tasks

### 1. Added Debug Banners to Templates ✅

Added debug banners that display resolved table IDs when `?debug=1` query parameter is present:

#### courses-page.html
- **List view** (line 722-730): Shows `courses_table_id`, `dynamic_page_hubdb_table_id`, and `constants.HUBDB_COURSES_TABLE_ID`
- **Detail view** (line 516-528): Shows course name, `modules_table_id`, whether content_blocks_json and module_slugs_json are populated

#### pathways-page.html
- **List view** (line 733-741): Shows `pathways_table_id`, `dynamic_page_hubdb_table_id`, and `constants.HUBDB_PATHWAYS_TABLE_ID`
- **Detail view** (line 606-621): Shows pathway name, `courses_table_id`, `modules_table_id`, whether course_slugs_json and module_slugs_json are populated

### 2. Updated Course Data File ✅

Modified `courses-table-check.json` to clear the `module_slugs_json` field for the `course-authoring-101` entry (line 290). This prevents duplicate module rendering when `content_blocks_json` is present.

### 3. Uploaded Templates ✅

Successfully uploaded all 9 template files to HubSpot DRAFT using `npm run upload:templates`:
- CLEAN x HEDGEHOG/templates/learn/courses-page.html
- CLEAN x HEDGEHOG/templates/learn/pathways-page.html
- And 7 other template files

### 4. Published Pages ✅

Published all pages to LIVE using `npm run publish:pages`:
- https://hedgehog.cloud/learn
- https://hedgehog.cloud/learn/courses
- https://hedgehog.cloud/learn/pathways
- https://hedgehog.cloud/learn/my-learning

## Manual Steps Required

### Step 1: Update HubDB Row for Course Authoring 101

Navigate to HubDB Courses table (ID: 135381433) in HubSpot and:

1. Find the row with `path = "course-authoring-101"`
2. Edit the row in DRAFT mode
3. Clear the `module_slugs_json` field (set it to empty/blank)
4. Save the row

**Why**: The Course Authoring 101 course currently has BOTH `module_slugs_json` and `content_blocks_json` populated, causing modules to render twice. The template prefers `content_blocks_json` when present, so we need to clear `module_slugs_json` to avoid the duplicate fallback rendering.

### Step 2: Publish the Courses Table

After updating the row:
1. In HubDB, click "Publish" on the Courses table
2. Confirm the publication

## Verification Steps

Once the HubDB changes are published, verify the following URLs with `?debug=1`:

### 1. Courses List Page
**URL**: https://hedgehog.cloud/learn/courses?debug=1

**Expected**: Debug banner should show:
- `courses_table_id`: 135381433 (or the actual ID, not "n/a")
- `dynamic_page_hubdb_table_id`: [value]
- `constants.HUBDB_COURSES_TABLE_ID`: [value]

### 2. Course Authoring 101 Detail Page
**URL**: https://hedgehog.cloud/learn/courses/course-authoring-101?debug=1

**Expected**:
- Debug banner should show:
  - `modules_table_id`: 135621904 (or actual ID, not "n/a")
  - `has content_blocks_json: yes`
  - `has module_slugs_json: no` (after HubDB update)
- **Modules should appear only once** (authoring-basics, authoring-media-and-metadata, authoring-qa-and-troubleshooting)

### 3. Pathways List Page
**URL**: https://hedgehog.cloud/learn/pathways?debug=1

**Expected**: Debug banner should show:
- `pathways_table_id`: 135381504 (or the actual ID, not "n/a")
- `dynamic_page_hubdb_table_id`: [value]
- `constants.HUBDB_PATHWAYS_TABLE_ID`: [value]

### 4. Sample Pathway Detail
Pick any pathway and add `?debug=1` to verify the debug banner shows correct table IDs.

## Screenshots to Capture

For issue #127 verification, capture screenshots showing:

1. Courses list page with debug banner (`/learn/courses?debug=1`)
2. Course Authoring 101 page showing:
   - Debug banner with correct IDs and `has module_slugs_json: no`
   - Module cards appearing exactly once (no duplicates)
3. Pathways list page with debug banner (`/learn/pathways?debug=1`)

## Implementation Notes

### Debug Banner Logic

The debug banners compute the effective table IDs using the same fallback logic as the data-loading code:

```
courses_table_id = dynamic_page_hubdb_table_id
                   OR constants.HUBDB_COURSES_TABLE_ID
                   OR 135381433 (hardcoded fallback)
```

This ensures the debug banner shows exactly which ID will be used for queries, eliminating ambiguity when troubleshooting.

### Module Deduplication Strategy

The template uses this logic (from courses-page.html:553-682):

1. **If `content_blocks_json` is present**: Render content blocks (text, callouts, module references)
   - Track rendered module slugs
   - Show unrendered modules from `module_slugs_json` as fallback (lines 611-649)

2. **Else if only `module_slugs_json` is present**: Render modules in a grid (lines 651-682)

For Course Authoring 101, since `content_blocks_json` contains all three module references, clearing `module_slugs_json` prevents the fallback section from rendering duplicates.

## Files Changed

- `clean-x-hedgehog-templates/learn/courses-page.html`
- `clean-x-hedgehog-templates/learn/pathways-page.html`
- `courses-table-check.json`

## References

- Issue: #127
- Related issues: #113 (cache discussion), #114 (cache fallback), #118, #119, #122 (authoring modules)
