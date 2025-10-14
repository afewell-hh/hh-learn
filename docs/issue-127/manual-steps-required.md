# Manual Steps Required for Issue #127

## Overview

The templates have been updated and published with debug banners. However, there are manual steps required to complete the deduplication fix for Course Authoring 101.

## Step 1: Update HubDB Courses Table

### Navigate to HubDB
1. Log into HubSpot
2. Go to Marketing > Files and Templates > HubDB
3. Find the "Courses" table (ID: 135381433)

### Edit the Course Authoring 101 Row
1. Click on the Courses table to open it
2. Find the row where `path = "course-authoring-101"`
3. Click the row to edit it
4. Locate the `module_slugs_json` column
5. **Clear the field completely** (remove the JSON array)
6. Save the changes

### Why This Is Needed
The Course Authoring 101 row currently has BOTH:
- `module_slugs_json`: Contains ["authoring-basics", "authoring-media-and-metadata", "authoring-qa-and-troubleshooting"]
- `content_blocks_json`: Contains a rich layout with the same three modules embedded

The template code prefers `content_blocks_json` when present, but also has a fallback that renders modules from `module_slugs_json` if they weren't rendered in the content blocks. Since both fields are populated, the modules appear twice.

By clearing `module_slugs_json`, we ensure modules only render once through the content blocks.

## Step 2: Publish the Courses Table

After saving the row changes:
1. Click the "Publish" button in the top-right of the HubDB table view
2. Confirm the publication

The changes will now be live on the website.

## Step 3: Verification

Visit the following URL to verify the fix:
**https://hedgehog.cloud/learn/courses/course-authoring-101?debug=1**

### What to Check:

1. **Debug Banner Should Show:**
   ```
   🔍 Debug Info (Course Detail):
   Course: Course Authoring 101
   modules_table_id: 135621904 (not "n/a")
   constants.HUBDB_MODULES_TABLE_ID: 135621904 (or appropriate value)
   has content_blocks_json: yes
   has module_slugs_json: no  ← This should be "no" after the update
   ```

2. **Module Cards Should Appear Exactly Once:**
   - Module 1: Authoring Basics
   - Module 2: Authoring Media and Metadata
   - Module 3: Authoring QA and Troubleshooting

   Each module should appear only ONE time on the page.

## Step 4: Capture Screenshots

For documentation in issue #127, capture screenshots of:

1. **Courses list with debug mode:**
   - URL: https://hedgehog.cloud/learn/courses?debug=1
   - Show the debug banner with table IDs

2. **Course Authoring 101 detail with debug mode:**
   - URL: https://hedgehog.cloud/learn/courses/course-authoring-101?debug=1
   - Show the debug banner (with `has module_slugs_json: no`)
   - Show the module cards appearing only once

3. **Pathways list with debug mode:**
   - URL: https://hedgehog.cloud/learn/pathways?debug=1
   - Show the debug banner with table IDs

## Step 5: Post Verification Comment

Post a comment in issue #127 with:
- Screenshots from Step 4
- Confirmation that:
  - Debug banners show correct table IDs (no "n/a" values)
  - Course Authoring 101 modules appear exactly once
  - All tested URLs work as expected

## Troubleshooting

### If modules still appear twice:
- Verify that `module_slugs_json` was completely cleared (not just set to `[]` but truly empty)
- Ensure the Courses table was published after the change
- Clear browser cache and reload the page

### If debug banner doesn't appear:
- Make sure you're using `?debug=1` in the URL
- Verify the templates were published (already completed via `npm run publish:pages`)
- Check that you're viewing the live site at hedgehog.cloud, not a preview URL

## Files Modified (Already Completed)

- ✅ `clean-x-hedgehog-templates/learn/courses-page.html` - Added debug banners
- ✅ `clean-x-hedgehog-templates/learn/pathways-page.html` - Added debug banners
- ✅ Templates uploaded to HubSpot
- ✅ Pages published to live site

## What's Left

- ⏳ Manually update HubDB row for course-authoring-101
- ⏳ Publish Courses table
- ⏳ Verify and screenshot
- ⏳ Post verification comment in issue #127
