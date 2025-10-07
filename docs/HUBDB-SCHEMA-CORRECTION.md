# HubDB Schema Correction for Dynamic Pages

## The Issue

Our current `learning_modules` table schema doesn't align with HubSpot's dynamic page requirements. When you enable dynamic pages, HubSpot automatically adds columns and expects specific metadata mappings.

## HubSpot's Auto-Generated Columns

When you enable "Use for dynamic pages" in table settings, HubSpot adds:

| Column Name | Internal Name | Type | Purpose |
|------------|---------------|------|---------|
| **Name** | `name` or `hs_name` | TEXT | Internal page name/identifier |
| **Page Path** | `hs_path` | TEXT | URL slug (e.g., "intro-to-kubernetes") |
| **Page Title** | varies | TEXT | Browser/SEO title |

These are **automatic** and cannot be deleted.

## Required Schema Changes

### Current Schema (Problematic):
```
- title (TEXT) ← Display title
- slug (TEXT) ← Not the same as hs_path!
- description (RICH TEXT)
- difficulty (SELECT)
- estimated_minutes (NUMBER)
- tags (TEXT)
- full_content (RICH TEXT)
- display_order (NUMBER)
```

### Corrected Schema:

#### System Columns (Auto-generated):
```
✅ Name (hs_name) - Auto-added by HubSpot
✅ Page Path (hs_path) - Auto-added by HubSpot
✅ Page Title - Auto-added by HubSpot
```

#### Your Custom Columns:
```
1. title (TEXT) - Display title in list/detail view
2. meta_description (TEXT) - For SEO
3. featured_image (IMAGE) - Social sharing image
4. canonical_url (URL) - SEO canonical (optional)
5. difficulty (SELECT: beginner, intermediate, advanced)
6. estimated_minutes (NUMBER)
7. tags (TEXT) - Comma-separated
8. full_content (RICH TEXT) - Module HTML content
9. display_order (NUMBER) - Sort order in list view
```

#### Remove:
```
❌ slug - Replace with hs_path
```

## Metadata Column Mappings

In table settings, map these:

| Metadata Field | Map To Column | Column Type Required |
|---------------|---------------|---------------------|
| **Meta Description Column** | `meta_description` | TEXT |
| **Featured Image Column** | `featured_image` | IMAGE |
| **Canonical URL Column** | `canonical_url` | URL (optional) |

## How to Fix Your Existing Table

### Option A: Modify Existing Table (Recommended)

**Step 1: Add New Columns**

Go to: Content > HubDB > learning_modules > Edit columns

**Add:**
1. **meta_description**
   - Type: TEXT
   - Label: "Meta Description"
   - Description: "SEO description for search engines"

2. **featured_image**
   - Type: IMAGE
   - Label: "Featured Image"
   - Description: "Social sharing image"

3. **canonical_url** (optional)
   - Type: URL
   - Label: "Canonical URL"
   - Description: "SEO canonical URL"

**Step 2: Populate System Columns**

For each existing row:

1. **Name** (hs_name): Set to the display title
   - Example: "Introduction to Kubernetes"

2. **Page Path** (hs_path): Set to URL slug (what was in your `slug` column)
   - Example: "intro-to-kubernetes"
   - **IMPORTANT**: Must be lowercase, no spaces

3. **Page Title**: Set to SEO-optimized title
   - Example: "Introduction to Kubernetes - Hedgehog Learn"

**Step 3: Configure Metadata Mappings**

In table settings:
- **Meta Description Column**: Select `meta_description`
- **Featured Image Column**: Select `featured_image`
- **Canonical URL Column**: Select `canonical_url` (if you added it)

**Step 4: Update Template**

Change template references from:
```html
{{ dynamic_page_hubdb_row.slug }}        → {{ dynamic_page_hubdb_row.hs_path }}
{{ dynamic_page_hubdb_row.title }}       → Keep as is (display title)
```

Add to list view loop:
```html
{% for module in modules %}
  <a href="{{ request.path }}/{{ module.hs_path }}">  <!-- Changed from .slug -->
```

### Option B: Fresh Start (If Easier)

**Delete and recreate table** with correct schema from the start.

1. **Enable Dynamic Pages First**
   - Create new table
   - In settings: Enable "Use for dynamic pages"
   - HubSpot adds Name, Page Path, Page Title automatically

2. **Add Custom Columns** (in order):
   ```
   - title (TEXT)
   - meta_description (TEXT)
   - featured_image (IMAGE)
   - difficulty (SELECT: beginner, intermediate, advanced)
   - estimated_minutes (NUMBER)
   - tags (TEXT)
   - full_content (RICH TEXT)
   - display_order (NUMBER)
   ```

3. **Configure Metadata**
   - Map meta_description → Meta Description Column
   - Map featured_image → Featured Image Column

4. **Populate Rows**
   - Use sync script or CSV upload
   - Make sure to populate hs_path and hs_name for each row

## Updated Sync Script

The sync script needs to populate the HubSpot system columns:

```typescript
const row = {
  name: fm.title,  // Maps to hs_name
  path: fm.slug || moduleSlug,  // Maps to hs_path
  values: {
    title: fm.title,
    meta_description: fm.description || '',
    // featured_image: fm.featured_image || '',  // Add if in frontmatter
    difficulty: difficultyId,
    estimated_minutes: fm.estimated_minutes || 30,
    tags: Array.isArray(fm.tags) ? fm.tags.join(',') : '',
    full_content: html,
    display_order: fm.order || 999
  }
};
```

**Note**: `name` and `path` are at the row level, not in `values`.

## Your Glossary Schema (For Reference)

Looking at your glossary template, your `tech_glossary` table uses:

```
✅ hs_name - Term name
✅ hs_path - URL slug
✅ subtitle - Custom column
✅ body - Custom column
✅ keywords - Custom column
```

Same pattern we need for learning_modules!

## Testing After Changes

1. Go to: Content > HubDB > learning_modules
2. Click a row
3. Verify:
   - **Name** field is populated
   - **Page Path** field is populated (lowercase, no spaces)
   - All custom columns have data

4. In page settings:
   - Dynamic source: learning_modules table
   - Row identifier: Should automatically use hs_path

5. Preview `/learn`:
   - Should show all modules
   - Click a module card
   - Should open `/learn/intro-to-kubernetes` (using hs_path)

## Recommended Values

### Meta Description (150-160 characters):
```
intro-to-kubernetes: "Learn Kubernetes fundamentals with hands-on labs. Deploy your first containerized application and master core K8s concepts."

kubernetes-storage: "Master Kubernetes storage with persistent volumes, storage classes, and dynamic provisioning in this hands-on lab."

kubernetes-networking: "Understand Kubernetes networking with services, ingress, and network policies through practical examples."
```

### Featured Image:
Use a common image for all modules, or create module-specific images:
- Recommended size: 1200x630px (standard social sharing)
- Format: PNG or JPG
- Upload to HubSpot Files, get URL

### Canonical URL:
Usually leave blank - HubSpot auto-generates based on page URL

## Summary

**Key Changes Needed:**

1. ✅ Use `hs_path` instead of custom `slug` column
2. ✅ Populate `Name` (hs_name) for each row
3. ✅ Add `meta_description` (TEXT) column
4. ✅ Add `featured_image` (IMAGE) column
5. ✅ Map metadata columns in table settings
6. ✅ Update template to use `hs_path`
7. ✅ Update sync script to populate `name` and `path` at row level

**Result**: Properly aligned with HubSpot's dynamic page schema, just like your glossary! ✅
