# Correct Dynamic Page Setup

## My Mistake - Apologies!

I made a fundamental error in my initial instructions. I told you to create separate templates and pages for list and detail views, but that's not how HubSpot dynamic pages work!

The **correct approach** (like your glossary solution):
1. ONE template that handles BOTH list and detail views
2. ONE page that uses dynamic HubDB source
3. HubSpot automatically creates:
   - `/learn` - shows list of all modules
   - `/learn/intro-to-kubernetes` - shows detail for that module
   - `/learn/kubernetes-storage` - shows detail for that module
   - etc.

## The Correct Template

**File**: `CLEAN x HEDGEHOG/templates/learn/module-page.html`

**Already uploaded** ✅

This template uses the same logic as your glossary:
```html
{% if dynamic_page_hubdb_row %}
  {# Show single module detail #}
{% else %}
  {# Show list of all modules #}
{% endif %}
```

## How to Create the Page (5 minutes)

### Step 1: Create One Page

**Navigate to**: Content > Website Pages > Create Page

**Configure**:
- **Template**: Select `CLEAN x HEDGEHOG > templates > learn > module-page.html`
- **Page name**: "Learning Portal"
- **URL**: `/learn`
- **Status**: Draft

Click **Create**

### Step 2: Set Dynamic Page Source

On the page edit screen:

1. Go to **Settings** tab (or look for "Advanced Options")
2. Find **"Dynamic Page" or "Use HubDB for dynamic pages"** section
3. **Enable dynamic pages**
4. **Select HubDB table**: `learning_modules` (Table ID: 135163996)
5. **Row identifier column**: Select `slug` column

This tells HubSpot:
- Use the `slug` column value in URLs
- When visiting `/learn/intro-to-kubernetes`, find row where slug = "intro-to-kubernetes"

### Step 3: Save and Preview

1. Click **Save** (stays as draft)
2. Click **Preview**

**You should see**:
- The `/learn` page shows a grid of all 3 modules
- Click any module card
- Opens `/learn/intro-to-kubernetes` (or whichever you clicked)
- Shows the full module content from HubDB

### Step 4: Publish

Once it looks good:
1. Change status from **Draft** to **Published**
2. Your learning portal is live!

## How It Works

**List View** (`/learn`):
- No row specified in URL
- Template checks `{% if dynamic_page_hubdb_row %}` → False
- Shows `else` block with all modules from `hubdb_table_rows()`

**Detail View** (`/learn/intro-to-kubernetes`):
- HubSpot finds row where `slug = "intro-to-kubernetes"`
- Template checks `{% if dynamic_page_hubdb_row %}` → True
- Shows module detail from `dynamic_page_hubdb_row.full_content`

**No manual page creation needed** for each module! HubSpot creates pages dynamically from HubDB rows.

## What You Created Manually

In your HubDB table, you created 3 rows:
1. intro-to-kubernetes
2. kubernetes-storage
3. kubernetes-networking

**Result**: HubSpot automatically creates 3 detail pages:
- `/learn/intro-to-kubernetes`
- `/learn/kubernetes-storage`
- `/learn/kubernetes-networking`

Plus the list page:
- `/learn`

All from ONE template and ONE page configuration! ✨

## Future Modules

To add more modules:

**Option A**: Add row in HubDB GUI
- Content > HubDB > learning_modules > Add row
- HubSpot automatically creates the page

**Option B**: Use sync script (once Cloudflare clears)
```bash
npm run sync:content
```
- Pages automatically created

## Comparison to Your Glossary

**Your glossary setup**:
- Template: `glossary-item-page.html`
- Page: `/glossary` with dynamic source from `tech_glossary` table
- Result: List at `/glossary`, details at `/glossary/{term}`

**Your learning portal setup** (corrected):
- Template: `module-page.html`
- Page: `/learn` with dynamic source from `learning_modules` table
- Result: List at `/learn`, details at `/learn/{slug}`

**Exactly the same pattern!** ✅

## Why My Initial Instructions Were Wrong

I mistakenly told you to:
- ❌ Create separate `landing-simple.html` and `module-simple.html` templates
- ❌ Create individual pages for each module
- ❌ Manually populate content fields

This was wrong because:
- It defeats the purpose of dynamic pages
- Would require manually creating a page for every new module
- Not scalable

**The correct way** (now implemented):
- ✅ One template with conditional logic
- ✅ One page with dynamic HubDB source
- ✅ Automatically creates pages for all rows
- ✅ Scales infinitely

## Troubleshooting

### "No modules showing on list page"

**Check**:
- HubDB table `learning_modules` has published rows
- Page has dynamic source configured
- Table ID matches (135163996)

### "Detail pages return 404"

**Check**:
- Row identifier column set to `slug`
- Slug values in HubDB match URL paths
- Rows are published (not just draft)

### "Content looks broken"

**Check**:
- Template column names match HubDB columns:
  - `difficulty` (SELECT field with label)
  - `full_content` (Rich Text with HTML)
  - `estimated_minutes` (Number)
  - `tags` (Text, comma-separated)

## Summary

**What you need to do**:
1. Create ONE page at `/learn`
2. Use template: `module-page.html`
3. Set dynamic source to `learning_modules` table
4. Set row identifier to `slug` column
5. Publish

**Result**:
- ✅ `/learn` → List of 3 modules
- ✅ `/learn/intro-to-kubernetes` → Full module detail
- ✅ `/learn/kubernetes-storage` → Full module detail
- ✅ `/learn/kubernetes-networking` → Full module detail

All from ONE page configuration! 🎉

Sorry for the confusion earlier - this is the correct way that matches your glossary approach.
