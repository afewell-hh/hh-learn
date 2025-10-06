# Sprint 1 Work Audit - What to Keep, Redo, or Salvage

**Date**: 2025-10-06
**Context**: After discovering we used wrong HubSpot workflow (Developer Projects instead of CMS Themes)

---

## Executive Summary

**Situation**: Previous work used `hs project upload` (Developer Projects) instead of `hs upload` (CMS Themes). Templates uploaded to wrong location and aren't accessible in Content > Website Pages.

**Impact**: All CMS template work must be redone using correct workflow.

**Good News**: Much of the content, design, and logic can be salvaged and migrated to proper theme structure.

---

## Completed Work Analysis

### ✅ Work Packet #1: CMS Dev Setup (PR #6 - MERGED)

**What was done**:
- Created `src/cms/` directory structure
- Added `theme.json` with metadata
- Created base CSS in `src/cms/css/theme.css`
- Added npm scripts for upload/watch
- Uploaded using `hs project upload` ❌

**Problems**:
- ❌ Wrong location: `src/cms/` should be separate `hedgehog-learn-theme/` directory
- ❌ Wrong command: Used `hs project upload` instead of `hs upload`
- ❌ Wrong npm scripts: All reference `hs project` commands
- ❌ Files went to Developer Projects, not Design Manager

**Salvageable**:
- ✅ CSS design system variables can be copied
- ✅ theme.json structure can be adapted
- ✅ Component CSS can be migrated

**Action Required**:
1. Create new theme using `hs create website-theme hedgehog-learn-theme`
2. Copy CSS from `src/cms/css/theme.css` to `hedgehog-learn-theme/css/main.css`
3. Update npm scripts to use correct commands
4. Delete `src/cms/` directory after migration
5. Update `package.json` scripts

---

### ✅ Work Packet #2: Module Detail Template (PR #7 - OPEN)

**What was done**:
- Created `src/cms/templates/learn/module-detail.html`
- Implemented sidebar navigation
- Added syntax highlighting
- Created responsive layout
- Uploaded using `hs project upload` ❌

**Problems**:
- ❌ Template in wrong location and structure
- ❌ Not accessible in HubSpot page creation UI
- ❌ Extends wrong base template path

**Salvageable**:
- ✅ Template HTML structure is excellent
- ✅ Navigation logic works
- ✅ Syntax highlighting setup correct
- ✅ Responsive CSS is good
- ✅ Content mapping approach is sound

**Action Required**:
1. Copy template to `hedgehog-learn-theme/templates/module-detail.html`
2. Update template paths (extends, require_css)
3. Move CSS to `hedgehog-learn-theme/css/module-detail.css`
4. Re-upload using `hs upload hedgehog-learn-theme hedgehog-learn-theme`
5. Close PR #7, create new PR with correct implementation

**Files to review**:
- `src/cms/templates/learn/module-detail.html` - READ THIS
- `src/cms/css/module.css` - COPY CSS FROM HERE

---

### ✅ Work Packet #3: Landing Page Template (PR #8 - OPEN)

**What was done**:
- Created `src/cms/templates/learn/landing.html`
- Implemented HubDB integration for pathways/modules
- Added client-side filtering
- Created hero, pathways, modules sections
- Uploaded using `hs project upload` ❌

**Problems**:
- ❌ Template in wrong location
- ❌ Not accessible in HubSpot UI
- ❌ Uses placeholder HubDB table IDs

**Salvageable**:
- ✅ Template structure excellent
- ✅ HubDB queries are correct approach
- ✅ Filtering logic works
- ✅ Grid layouts are responsive
- ✅ Section organization is good

**Action Required**:
1. Copy to `hedgehog-learn-theme/templates/learn-landing.html`
2. Update template paths
3. Move CSS to `hedgehog-learn-theme/css/landing.css`
4. Update HubDB table IDs (after manual creation in HubSpot)
5. Re-upload using correct command
6. Close PR #8, create new PR

**Files to review**:
- `src/cms/templates/learn/landing.html` - READ THIS
- `src/cms/css/landing.css` - COPY CSS FROM HERE

---

### ✅ Work Packet #4: Sample Content (PR #9 - OPEN)

**What was done**:
- Created 3 complete Kubernetes modules in `content/modules/`
  - `intro-to-kubernetes/` - Beginner, 45 min
  - `kubernetes-storage/` - Intermediate, 60 min
  - `kubernetes-networking/` - Intermediate, 75 min
- Each module has:
  - `README.md` with front matter
  - `meta.json` with structured data
  - Complete labs with step-by-step instructions
  - Concepts section
  - Resources

**Problems**:
- ❌ No problems! Content is great!
- ⚠️ Content needs to be manually entered into HubDB and HubSpot pages

**Salvageable**:
- ✅ ALL content is 100% usable
- ✅ Can be imported into HubDB tables
- ✅ Markdown can be converted to HubSpot page content
- ✅ meta.json provides structured data for HubDB

**Action Required**:
1. Keep PR #9 OPEN - content is good!
2. Use content to populate HubDB tables (manual step)
3. Use content when creating preview pages
4. **DO NOT CLOSE THIS PR** - merge it!

**Files to keep**:
- `content/modules/intro-to-kubernetes/*` - ✅ KEEP
- `content/modules/kubernetes-storage/*` - ✅ KEEP
- `content/modules/kubernetes-networking/*` - ✅ KEEP

---

## Repository Structure Changes

### Current (INCORRECT):
```
hedgehog-learn/
├── hsproject.json
├── src/
│   ├── app/              # ✅ Correct - Developer Project
│   │   └── app-hsmeta.json
│   ├── cms/              # ❌ WRONG LOCATION
│   │   ├── templates/
│   │   ├── modules/
│   │   └── css/
│   └── api/
│       └── lambda/
├── content/
│   └── modules/          # ✅ Correct - Learning content
└── docs/
```

### Corrected (TARGET):
```
hedgehog-learn/
├── hsproject.json              # Developer Project config
├── src/
│   ├── app/                    # ✅ Developer Project (keep)
│   │   └── app-hsmeta.json
│   ├── api/                    # ✅ Lambda functions (keep)
│   │   └── lambda/
│   └── shared/                 # Shared code
├── hedgehog-learn-theme/       # ✅ NEW - CMS Theme (separate!)
│   ├── theme.json
│   ├── fields.json
│   ├── templates/
│   │   ├── layouts/
│   │   │   └── base.html
│   │   ├── learn-landing.html
│   │   └── module-detail.html
│   ├── css/
│   │   ├── main.css
│   │   ├── landing.css
│   │   └── module-detail.css
│   └── js/
│       └── main.js
├── content/
│   └── modules/                # ✅ Learning content (keep)
└── docs/
```

---

## Migration Plan

### Phase 1: Create Correct Theme Structure

**Task 1.1**: Create theme using HubSpot CLI
```bash
hs create website-theme hedgehog-learn-theme
```

**Task 1.2**: Migrate CSS
```bash
# Copy and adapt CSS files
cp src/cms/css/theme.css hedgehog-learn-theme/css/main.css
# Edit and clean up imports, variables
```

**Task 1.3**: Create base layout
```bash
# Create from scratch using correct paths
# File: hedgehog-learn-theme/templates/layouts/base.html
```

### Phase 2: Migrate Templates

**Task 2.1**: Migrate landing page template
```bash
# Copy and adapt
cp src/cms/templates/learn/landing.html hedgehog-learn-theme/templates/learn-landing.html

# Update in template:
# - Change extends path: ./layouts/base.html
# - Fix require_css paths: ../css/landing.css
# - Update HubDB table IDs (after creation)
```

**Task 2.2**: Migrate module detail template
```bash
cp src/cms/templates/learn/module-detail.html hedgehog-learn-theme/templates/module-detail.html

# Update template paths
# Fix CSS paths
```

**Task 2.3**: Migrate component CSS
```bash
cp src/cms/css/landing.css hedgehog-learn-theme/css/landing.css
cp src/cms/css/module.css hedgehog-learn-theme/css/module-detail.css
```

### Phase 3: Upload Using Correct Workflow

**Task 3.1**: Upload theme
```bash
hs upload hedgehog-learn-theme hedgehog-learn-theme

# Watch for changes during development
hs watch hedgehog-learn-theme hedgehog-learn-theme
```

**Task 3.2**: Verify in HubSpot
- Check Content > Design Manager for theme files
- Verify all templates and CSS uploaded

### Phase 4: Activate Theme and Test

**Task 4.1**: Activate theme (Manual in HubSpot UI)
- Settings > Website > Themes
- Make hedgehog-learn-theme active

**Task 4.2**: Create HubDB tables (Manual)
- Content > HubDB
- Create `learning_pathways` table
- Create `learning_modules` table
- Note table IDs

**Task 4.3**: Update templates with real table IDs
```bash
# Edit templates to replace placeholder IDs
# Upload again
hs upload hedgehog-learn-theme hedgehog-learn-theme
```

**Task 4.4**: Create preview pages (Manual)
- Content > Website Pages > Create
- Use templates to create draft pages
- Test preview URLs

### Phase 5: Clean Up Old Structure

**Task 5.1**: Remove incorrect CMS directory
```bash
git rm -r src/cms/
```

**Task 5.2**: Update npm scripts in package.json
```json
{
  "scripts": {
    "theme:upload": "hs upload hedgehog-learn-theme hedgehog-learn-theme",
    "theme:watch": "hs watch hedgehog-learn-theme hedgehog-learn-theme",
    "theme:fetch": "hs fetch hedgehog-learn-theme hedgehog-learn-theme"
  }
}
```

**Task 5.3**: Update documentation
- Update all work packets
- Update cms-development.md
- Add migration notes

### Phase 6: Update Pull Requests

**Task 6.1**: Close incorrect PRs
- Close PR #7 (module template) with note: "Closing - incorrect workflow, reopening with corrected implementation"
- Close PR #8 (landing page) with note: "Closing - incorrect workflow, reopening with corrected implementation"

**Task 6.2**: Merge good PR
- **Merge PR #9** (sample content) - content is perfect!

**Task 6.3**: Create new PRs
- Create PR for theme setup (Work Packet 1)
- Create PR for landing page (Work Packet 2)
- Create PR for module detail (Work Packet 3)
- Create PR for activation (Work Packet 4)

---

## Files to Keep vs Delete

### ✅ KEEP (No Changes Needed)

**Infrastructure**:
- ✅ `hsproject.json` - Developer Project config
- ✅ `src/app/app-hsmeta.json` - App configuration
- ✅ `.env` - Environment variables
- ✅ `serverless.yml` - Lambda config
- ✅ `src/api/lambda/*` - Lambda functions
- ✅ `.github/workflows/*` - CI/CD

**Content**:
- ✅ `content/modules/intro-to-kubernetes/*`
- ✅ `content/modules/kubernetes-storage/*`
- ✅ `content/modules/kubernetes-networking/*`

**Documentation**:
- ✅ `docs/ROADMAP.md`
- ✅ `docs/adr-*.md`
- ✅ `AGENTS.md`
- ✅ `docs/hubspot-architecture-correct.md` ⭐

**Database Schemas**:
- ✅ `hubdb-schemas/*`

### 🔄 MIGRATE (Copy to New Location)

**From `src/cms/` to `hedgehog-learn-theme/`**:
- 🔄 `src/cms/css/theme.css` → `hedgehog-learn-theme/css/main.css`
- 🔄 `src/cms/css/landing.css` → `hedgehog-learn-theme/css/landing.css`
- 🔄 `src/cms/css/module.css` → `hedgehog-learn-theme/css/module-detail.css`
- 🔄 `src/cms/templates/learn/landing.html` → `hedgehog-learn-theme/templates/learn-landing.html`
- 🔄 `src/cms/templates/learn/module-detail.html` → `hedgehog-learn-theme/templates/module-detail.html`
- 🔄 `src/cms/theme.json` → Review for `hedgehog-learn-theme/theme.json`

### ❌ DELETE (After Migration)

**Wrong structure**:
- ❌ `src/cms/` - Entire directory (after migrating files)
- ❌ Old npm scripts in package.json (replace with correct ones)

**Incorrect documentation**:
- ❌ Update or remove: `docs/cms-development.md` (has wrong instructions)
- ❌ Archive: `docs/sprint1-work-packets.md` (replaced by corrected version)

---

## Success Criteria for Migration

### Verification Steps:

1. **Theme exists in correct location**:
   ```bash
   ls -la hedgehog-learn-theme/
   # Should see: theme.json, templates/, css/, js/
   ```

2. **Theme uploaded to Design Manager**:
   - HubSpot UI: Content > Design Manager
   - Folder: `hedgehog-learn-theme` visible

3. **Templates accessible for page creation**:
   - Content > Website Pages > Create > Website page
   - Templates dropdown shows: `learn-landing.html`, `module-detail.html`

4. **Theme activated**:
   - Settings > Website > Themes
   - `hedgehog-learn-theme` shows as active

5. **Preview pages work**:
   - Draft page created with template
   - Preview URL renders correctly
   - No console errors

6. **Old structure removed**:
   ```bash
   ls src/cms/
   # Should error: No such file or directory
   ```

---

## Estimated Effort

**Total Effort**: ~4-6 hours

**Breakdown**:
- Phase 1 (Theme structure): 30 min
- Phase 2 (Migrate templates): 1-2 hours
- Phase 3 (Upload): 15 min
- Phase 4 (Activate & test): 1-2 hours
- Phase 5 (Clean up): 30 min
- Phase 6 (Update PRs): 1 hour

**Note**: Most time spent on testing and manual HubSpot UI steps (HubDB creation, theme activation, page creation).

---

## Risk Assessment

### Low Risk
- ✅ Content migration (straightforward copy)
- ✅ CSS migration (minor path updates)
- ✅ Template logic (already works, just needs new structure)

### Medium Risk
- ⚠️ HubDB integration (table IDs must be updated manually)
- ⚠️ Template path references (easy to miss one)
- ⚠️ Theme activation (manual UI step, could have edge cases)

### Mitigation
- Use draft pages for all testing
- Keep preview URLs separate from production
- Test thoroughly before publishing
- Document every manual step

---

## Next Actions for Project Lead

1. **Review this audit** - Confirm analysis is correct
2. **Assign Work Packet 1** to coding agent (create theme structure)
3. **Close PRs #7 and #8** with explanation
4. **Merge PR #9** (content is good!)
5. **Monitor migration progress** using corrected work packets
6. **Perform manual HubSpot steps**:
   - Theme activation
   - HubDB table creation
   - Preview page creation

---

## Lessons Learned

### What Went Wrong
1. ❌ Didn't understand HubSpot has two separate systems
2. ❌ Used wrong CLI commands (`hs project` instead of `hs upload`)
3. ❌ Created templates in wrong directory structure
4. ❌ Didn't verify templates appeared in HubSpot UI early enough

### What Went Right
1. ✅ Content creation was excellent (PR #9)
2. ✅ Template design and logic are solid
3. ✅ CSS architecture is clean
4. ✅ Git workflow and branching were correct
5. ✅ Caught the issue before publishing to production

### Improvements for Future
1. ✅ Always verify work in HubSpot UI immediately after upload
2. ✅ Read official HubSpot docs for 2025.2 architecture
3. ✅ Test with minimal example first (one template) before building all
4. ✅ Document both Developer Projects AND CMS Themes clearly
5. ✅ Have project lead verify manual HubSpot steps personally

---

## Conclusion

**Bottom Line**: We used the wrong workflow, but most work is salvageable. The fix is straightforward:
1. Create proper theme structure using `hs create website-theme`
2. Copy templates and CSS to new location with path updates
3. Upload using `hs upload` (not `hs project upload`)
4. Activate theme and test

**Timeline**: Can complete migration in 4-6 hours of focused work.

**Confidence**: High - we understand the problem and have clear solution.

**Recommendation**: Proceed with migration using corrected work packets.
