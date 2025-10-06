# Migration Guide: Fixing Sprint 1 CMS Work

**Date**: 2025-10-06
**Status**: 🚨 Action Required
**Priority**: High

---

## Quick Summary

We used the wrong HubSpot workflow. Templates need to be migrated from Developer Projects to CMS Themes.

**Time Estimate**: 4-6 hours
**Difficulty**: Low (straightforward migration)
**Impact**: High (unblocks content launch)

---

## The Problem

❌ **Used**: `hs project upload` → Uploads to Developer Projects (for apps)
✅ **Should use**: `hs upload theme theme` → Uploads to Design Manager (for templates)

**Result**: Templates aren't accessible in Content > Website Pages

---

## The Solution

Recreate theme structure using correct workflow, migrate existing work to new structure.

---

## Prerequisites

Before starting:
- ✅ Read `docs/hubspot-architecture-correct.md` completely
- ✅ Read `docs/work-audit-sprint1.md` for detailed analysis
- ✅ HubSpot CLI authenticated: `hs account list`
- ✅ Confirm active account: `21430285`

---

## Step-by-Step Migration

### Step 1: Create Proper Theme Structure (15 minutes)

```bash
# Navigate to project root
cd /home/ubuntu/afewell-hh/hedgehog-learn

# Create CMS theme using HubSpot boilerplate
hs create website-theme hedgehog-learn-theme

# Verify structure created
cd hedgehog-learn-theme
ls -la

# Should see:
# - theme.json
# - fields.json
# - templates/ (with boilerplate files)
# - css/
# - js/
```

**Expected Output**:
```
✓ Created theme files in hedgehog-learn-theme/
```

---

### Step 2: Migrate CSS Files (30 minutes)

```bash
# Return to project root
cd /home/ubuntu/afewell-hh/hedgehog-learn

# Copy CSS files to new theme
cp src/cms/css/theme.css hedgehog-learn-theme/css/main.css
cp src/cms/css/landing.css hedgehog-learn-theme/css/landing.css
cp src/cms/css/module.css hedgehog-learn-theme/css/module-detail.css

# Verify files copied
ls -la hedgehog-learn-theme/css/
```

**Manual Edit Required**: Open `hedgehog-learn-theme/css/main.css` and review for any import paths that need updating.

---

### Step 3: Create Base Layout Template (30 minutes)

Create `hedgehog-learn-theme/templates/layouts/base.html`:

```html
<!DOCTYPE html>
<html lang="{{ html_lang }}" dir="{{ html_dir }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block page_title %}{{ page_meta.html_title }}{% endblock %}</title>

  {{ standard_header_includes }}

  {{ require_css(get_asset_url("../css/main.css")) }}

  {% block extra_css %}{% endblock %}
</head>
<body>
  <main>
    {% block body %}{% endblock %}
  </main>

  {{ standard_footer_includes }}

  {% block extra_js %}{% endblock %}
</body>
</html>
```

---

### Step 4: Migrate Landing Page Template (45 minutes)

```bash
# Copy template
cp src/cms/templates/learn/landing.html hedgehog-learn-theme/templates/learn-landing.html
```

**Manual Edit Required**: Open `hedgehog-learn-theme/templates/learn-landing.html` and update:

1. **Fix extends path** (line 1):
   ```html
   <!-- OLD -->
   {% extends "../layouts/base.html" %}

   <!-- NEW -->
   {% extends "./layouts/base.html" %}
   ```

2. **Fix CSS path** (in extra_css block):
   ```html
   <!-- OLD -->
   {{ require_css(get_asset_url("../../css/landing.css")) }}

   <!-- NEW -->
   {{ require_css(get_asset_url("../css/landing.css")) }}
   ```

3. **Update HubDB table IDs** (will do after tables created):
   ```html
   <!-- Keep for now, will update in Step 7 -->
   {% set pathways_table = hubdb_table_rows(1234567, "&orderBy=display_order") %}
   {% set modules_table = hubdb_table_rows(1234568, "&orderBy=display_order") %}
   ```

---

### Step 5: Migrate Module Detail Template (45 minutes)

```bash
# Copy template
cp src/cms/templates/learn/module-detail.html hedgehog-learn-theme/templates/module-detail.html
```

**Manual Edit Required**: Update paths in `hedgehog-learn-theme/templates/module-detail.html`:

1. **Fix extends path**:
   ```html
   {% extends "./layouts/base.html" %}
   ```

2. **Fix CSS paths**:
   ```html
   {{ require_css(get_asset_url("../css/module-detail.css")) }}
   ```

---

### Step 6: Upload Theme to HubSpot (5 minutes)

```bash
# From project root
cd /home/ubuntu/afewell-hh/hedgehog-learn

# Upload theme to Design Manager (correct command!)
hs upload hedgehog-learn-theme hedgehog-learn-theme
```

**Expected Output**:
```
Uploading hedgehog-learn-theme to hedgehog-learn-theme...
✓ Upload complete
```

**Verify in HubSpot**:
1. Open HubSpot: https://app.hubspot.com/content/21430285/design-manager
2. Look for folder: `hedgehog-learn-theme`
3. Verify files uploaded:
   - `theme.json`
   - `templates/layouts/base.html`
   - `templates/learn-landing.html`
   - `templates/module-detail.html`
   - `css/main.css`
   - `css/landing.css`
   - `css/module-detail.css`

---

### Step 7: Create HubDB Tables (30 minutes - Manual in HubSpot UI)

**Note**: HubDB tables cannot be created via CLI, must use UI.

#### Table 1: learning_pathways

1. Go to: **Content > HubDB**
2. Click: **Create table**
3. Name: `learning_pathways`
4. Add columns:
   - `title` (Text)
   - `slug` (Text)
   - `description` (Rich Text)
   - `icon_url` (URL)
   - `module_count` (Number)
   - `estimated_hours` (Number)
   - `display_order` (Number)
5. **Publish table**
6. **Note the Table ID** (appears in URL: `/hubdb/XXXXX`)

#### Table 2: learning_modules

1. **Create table**: `learning_modules`
2. Add columns:
   - `title` (Text)
   - `slug` (Text)
   - `description` (Rich Text)
   - `difficulty` (Select: beginner, intermediate, advanced)
   - `estimated_minutes` (Number)
   - `tags` (Text)
   - `display_order` (Number)
3. **Publish table**
4. **Note the Table ID**

#### Update Templates with Real IDs

Edit `hedgehog-learn-theme/templates/learn-landing.html`:

```html
<!-- Replace placeholder IDs with real ones -->
{% set pathways_table = hubdb_table_rows(YOUR_PATHWAYS_TABLE_ID, "&orderBy=display_order") %}
{% set modules_table = hubdb_table_rows(YOUR_MODULES_TABLE_ID, "&orderBy=display_order") %}
```

Re-upload theme:
```bash
hs upload hedgehog-learn-theme hedgehog-learn-theme
```

---

### Step 8: Activate Theme (5 minutes - Manual in HubSpot UI)

1. Go to: **Settings > Website > Themes**
2. Find: `hedgehog-learn-theme`
3. Click: **Make active** (or **Activate**)
4. Confirm activation

**Verify**: Theme should show as "Active" in themes list.

---

### Step 9: Create Preview Pages (30 minutes - Manual in HubSpot UI)

#### Create Landing Page Preview

1. Go to: **Content > Website Pages**
2. Click: **Create > Website page**
3. **Check**: Template dropdown should show `learn-landing.html` ✅
   - If template doesn't appear, theme wasn't uploaded or activated correctly
4. Select: `learn-landing.html`
5. Page settings:
   - **Page title**: "Learn - Preview"
   - **Page URL**: `/learn-preview`
   - **Status**: Draft (not published)
6. Content settings:
   - **hero_title**: "Master Cloud Native Technologies"
   - **hero_subtitle**: "Hands-on learning paths for Kubernetes, containers, and cloud infrastructure"
7. **Save as draft**
8. Click: **Preview**
9. **Copy preview URL** and test in browser

#### Create Module Page Preview

1. **Content > Website Pages > Create > Website page**
2. Select: `module-detail.html`
3. Page settings:
   - **Page title**: "Introduction to Kubernetes - Preview"
   - **Page URL**: `/learn/module/intro-to-kubernetes-preview`
   - **Status**: Draft
4. Map content from `content/modules/intro-to-kubernetes/README.md`:
   - Use markdown content for each section
   - Set metadata from `meta.json`
5. **Save as draft**
6. **Preview** and test

---

### Step 10: Populate HubDB with Sample Data (30 minutes - Manual)

#### Add Module to HubDB

1. **Content > HubDB > learning_modules**
2. Click: **Add row**
3. Fill data from `content/modules/intro-to-kubernetes/meta.json`:
   - **title**: "Introduction to Kubernetes"
   - **slug**: "intro-to-kubernetes"
   - **description**: "Learn Kubernetes fundamentals and deploy your first pod..."
   - **difficulty**: beginner
   - **estimated_minutes**: 45
   - **tags**: kubernetes,containers,pods,fundamentals
   - **display_order**: 1
4. **Publish table**

Repeat for other modules:
- kubernetes-storage (order: 2)
- kubernetes-networking (order: 3)

#### Add Pathway to HubDB (Optional for now)

1. **Content > HubDB > learning_pathways**
2. Add sample pathway:
   - **title**: "Kubernetes Fundamentals"
   - **slug**: "kubernetes-fundamentals"
   - **description**: "Master the basics of Kubernetes..."
   - **module_count**: 3
   - **estimated_hours**: 3
   - **display_order**: 1
3. **Publish table**

---

### Step 11: Test Preview Pages (30 minutes)

#### Landing Page Test Checklist

- [ ] Preview URL loads without errors
- [ ] Hero section displays correctly
- [ ] Pathways section shows data from HubDB (or empty state if no data)
- [ ] Modules section shows all 3 modules from HubDB
- [ ] Search/filter inputs render
- [ ] Module cards are clickable
- [ ] Responsive design works on mobile (resize browser)
- [ ] No console errors in browser dev tools

#### Module Page Test Checklist

- [ ] Preview URL loads
- [ ] Breadcrumbs render
- [ ] Module header with difficulty and time displays
- [ ] Sidebar navigation visible
- [ ] All content sections render
- [ ] Code blocks have syntax highlighting
- [ ] Responsive sidebar (collapses on mobile)
- [ ] No console errors

**If tests pass**: Migration successful! ✅

---

### Step 12: Update Git Repository (1 hour)

#### Update package.json Scripts

Edit `package.json` to fix npm scripts:

```json
{
  "scripts": {
    "theme:upload": "hs upload hedgehog-learn-theme hedgehog-learn-theme",
    "theme:watch": "hs watch hedgehog-learn-theme hedgehog-learn-theme",
    "theme:fetch": "hs fetch hedgehog-learn-theme hedgehog-learn-theme"
  }
}
```

#### Remove Old CMS Directory

```bash
# After confirming migration works
git rm -r src/cms/
```

#### Create Migration PR

```bash
# Create branch
git checkout -b feature/cms-migration-corrected

# Stage new theme
git add hedgehog-learn-theme/

# Stage updated files
git add package.json

# Stage removed directory
git rm -r src/cms/

# Commit
git commit -m "feat: Migrate CMS to proper HubSpot theme structure

BREAKING CHANGE: Migrate from Developer Projects to CMS Themes

This migration fixes the incorrect use of Developer Projects for CMS
templates. Templates are now properly structured as a CMS theme.

Changes:
- Create hedgehog-learn-theme/ using hs create website-theme
- Migrate templates from src/cms/templates/ to hedgehog-learn-theme/templates/
- Migrate CSS from src/cms/css/ to hedgehog-learn-theme/css/
- Update template paths (extends, require_css)
- Update npm scripts to use correct hs upload commands
- Remove src/cms/ directory (incorrect structure)

Templates now accessible in Content > Website Pages UI.

Migration docs: docs/MIGRATION-GUIDE.md
Architecture: docs/hubspot-architecture-correct.md
Work audit: docs/work-audit-sprint1.md

Relates to #1, #2, #5"

# Push
git push -u origin feature/cms-migration-corrected
```

#### Update Pull Requests

**Close PR #7** (Module template):
```
Closing this PR. We used the incorrect HubSpot workflow (Developer Projects instead of CMS Themes).

The work was excellent, but templates were uploaded to the wrong location and aren't accessible in the HubSpot page creation UI.

Migration completed in PR #[NEW_PR_NUMBER]

See docs/hubspot-architecture-correct.md for details.
```

**Close PR #8** (Landing page):
```
Closing this PR. We used the incorrect HubSpot workflow (Developer Projects instead of CMS Themes).

Migration completed in PR #[NEW_PR_NUMBER]

See docs/MIGRATION-GUIDE.md for migration details.
```

**Merge PR #9** (Sample content):
```
This content is excellent and fully usable! Merging.

The markdown content will be used to populate HubDB tables and HubSpot pages manually.

Great work!
```

---

## Verification Checklist

Before considering migration complete:

### File Structure
- [ ] `hedgehog-learn-theme/` directory exists
- [ ] `hedgehog-learn-theme/theme.json` exists
- [ ] `hedgehog-learn-theme/templates/layouts/base.html` exists
- [ ] `hedgehog-learn-theme/templates/learn-landing.html` exists
- [ ] `hedgehog-learn-theme/templates/module-detail.html` exists
- [ ] `hedgehog-learn-theme/css/main.css` exists
- [ ] `hedgehog-learn-theme/css/landing.css` exists
- [ ] `hedgehog-learn-theme/css/module-detail.css` exists

### HubSpot UI
- [ ] Theme visible in Content > Design Manager
- [ ] Theme active in Settings > Website > Themes
- [ ] Templates appear in Content > Website Pages > Create dropdown
- [ ] HubDB tables created (learning_pathways, learning_modules)
- [ ] HubDB tables published
- [ ] Sample data added to HubDB tables

### Preview Pages
- [ ] Landing page draft created at `/learn-preview`
- [ ] Landing page preview URL works
- [ ] Module page draft created at `/learn/module/intro-to-kubernetes-preview`
- [ ] Module page preview URL works
- [ ] No console errors on either page

### Git
- [ ] `src/cms/` directory removed
- [ ] `hedgehog-learn-theme/` committed
- [ ] package.json scripts updated
- [ ] Migration PR created
- [ ] Old PRs (#7, #8) closed with explanation
- [ ] Content PR (#9) merged

---

## Troubleshooting

### Templates don't appear in page creation UI

**Problem**: Can't see `learn-landing.html` or `module-detail.html` in template dropdown.

**Possible causes**:
1. Theme not uploaded to Design Manager
2. Theme not activated
3. Templates not in correct location

**Solutions**:
```bash
# Re-upload theme
hs upload hedgehog-learn-theme hedgehog-learn-theme

# Verify in HubSpot: Content > Design Manager
# Check: hedgehog-learn-theme/ folder exists

# Verify in HubSpot: Settings > Website > Themes
# Check: hedgehog-learn-theme is active
```

---

### HubDB data doesn't show in templates

**Problem**: Landing page shows empty pathways/modules sections.

**Possible causes**:
1. HubDB tables not published
2. Wrong table IDs in template
3. No data in tables

**Solutions**:
1. Go to Content > HubDB
2. Click table name
3. Click **Publish** (top right)
4. Verify table ID in URL matches template
5. Verify rows exist in table

---

### CSS not loading on preview pages

**Problem**: Pages render but styling is broken.

**Possible causes**:
1. CSS files not uploaded
2. Wrong CSS paths in templates
3. Cache issue

**Solutions**:
```bash
# Re-upload theme
hs upload hedgehog-learn-theme hedgehog-learn-theme

# Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

# Check CSS paths in templates:
# Should be: ../css/main.css (not ../../css/ or /css/)
```

---

### Syntax highlighting not working

**Problem**: Code blocks render but no syntax colors.

**Possible causes**:
1. Prism.js not loading
2. Wrong Prism version/theme

**Solution**: Check `module-detail.html` includes:
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
```

---

## Success Criteria

Migration is complete when:

✅ **All files uploaded correctly**
✅ **Theme activated in HubSpot**
✅ **Templates accessible in page creation UI**
✅ **Preview pages render without errors**
✅ **HubDB integration works**
✅ **Old structure removed from git**
✅ **PRs updated appropriately**

---

## Next Steps After Migration

Once migration complete:

1. **Continue with Sprint 1 work**:
   - Use `docs/sprint1-work-packets-corrected.md`
   - Follow Work Packets 1-4 (now with correct workflow)

2. **Create production pages** (when ready):
   - Change page URLs from `/learn-preview` to `/learn`
   - Change status from Draft to Published

3. **Populate more content**:
   - Add more modules to HubDB
   - Create pathway definitions
   - Build out module pages

4. **Add interactivity** (Phase 2):
   - External Next.js app for quizzes
   - Progress tracking
   - User authentication

---

## Need Help?

If stuck during migration:

1. **Check documentation**:
   - `docs/hubspot-architecture-correct.md` - Architecture details
   - `docs/work-audit-sprint1.md` - Detailed work analysis
   - `docs/sprint1-work-packets-corrected.md` - Corrected workflow

2. **Verify HubSpot CLI**:
   ```bash
   hs --version  # Should be 7.7.0+
   hs account list  # Should show active account
   ```

3. **Check HubSpot account**:
   - Account ID: 21430285
   - Ensure user has CMS permissions

4. **Review this guide** from the beginning

---

## Timeline

**Estimated total time**: 4-6 hours

- ✅ Steps 1-5 (File migration): 2-3 hours
- ✅ Step 6 (Upload): 5 minutes
- ✅ Step 7 (HubDB): 30 minutes
- ✅ Step 8 (Activate): 5 minutes
- ✅ Step 9 (Preview pages): 30 minutes
- ✅ Step 10 (Sample data): 30 minutes
- ✅ Step 11 (Testing): 30 minutes
- ✅ Step 12 (Git): 1 hour

---

## Conclusion

This migration corrects the fundamental mistake of using Developer Projects for CMS templates. Once complete, templates will be accessible in HubSpot's page creation UI and the project can proceed with content launch.

**The good news**: Most of the work is salvageable - it just needs to be moved to the correct structure with path updates.

**Ready to start?** Begin with Step 1!
