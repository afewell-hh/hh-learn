# Instructions for Coding Agent - Work Packet 1

**Date**: 2025-10-06
**Task**: Execute Work Packet 1 - Create HubSpot CMS Theme Structure
**Priority**: P0 - BLOCKING
**Estimated Time**: 2-3 hours

---

## ⚠️ CRITICAL: READ THIS FIRST

Before doing ANYTHING, you MUST read:
1. `docs/hubspot-architecture-correct.md` - Complete understanding of HubSpot 2025.2
2. `docs/sprint1-work-packets-corrected.md` - Your work instructions (Work Packet 1)

**WHY THIS MATTERS**: Previous work used the WRONG HubSpot workflow. Templates were uploaded to Developer Projects instead of CMS Themes. This has been corrected. You MUST understand the difference before starting.

---

## Your Task: Work Packet 1

Execute **Work Packet 1** from `docs/sprint1-work-packets-corrected.md`

**What you'll do**:
1. Create HubSpot CMS theme using `hs create website-theme hedgehog-learn-theme`
2. Customize `theme.json` with Hedgehog Learn branding
3. Create base CSS with design system variables
4. Create base layout template
5. Upload to HubSpot using `hs upload hedgehog-learn-theme hedgehog-learn-theme`
6. Verify in HubSpot Design Manager

**What you'll NOT do**:
- ❌ Don't use `hs project upload` (that's for Developer Projects, not themes!)
- ❌ Don't create `src/cms/` directory (wrong location)
- ❌ Don't add `cms:*` scripts to package.json (those were removed)

---

## Key Commands

### ✅ CORRECT (Use These!)
```bash
# Create theme boilerplate
hs create website-theme hedgehog-learn-theme

# Upload theme to Design Manager
hs upload hedgehog-learn-theme hedgehog-learn-theme

# Watch for changes (during development)
hs watch hedgehog-learn-theme hedgehog-learn-theme
```

### ❌ WRONG (Don't Use These!)
```bash
# WRONG - This is for Developer Projects (apps), not themes!
hs project upload
hs project dev
```

---

## Verification Steps

After completing Work Packet 1, verify:

1. **Theme directory exists**:
   ```bash
   ls -la hedgehog-learn-theme/
   # Should show: theme.json, templates/, css/, js/
   ```

2. **Theme uploaded to HubSpot**:
   - Go to: https://app.hubspot.com/content/21430285/design-manager
   - Look for folder: `hedgehog-learn-theme`
   - Verify files present

3. **Git workflow**:
   ```bash
   git checkout -b feature/cms-theme-setup
   git add hedgehog-learn-theme/
   git commit -m "feat: Create HubSpot CMS theme with base structure

- Generate theme boilerplate using hs create website-theme
- Customize theme.json with Hedgehog Learn branding
- Add base CSS with design system variables
- Create base layout template
- Upload to HubSpot Design Manager

Relates to #1, #2, #5"
   git push -u origin feature/cms-theme-setup
   ```

4. **Create PR**:
   ```bash
   gh pr create --title "feat: HubSpot CMS theme setup (CORRECTED)" \
     --body "Implements Work Packet 1 from docs/sprint1-work-packets-corrected.md

   Created proper HubSpot CMS theme structure using correct workflow.

   - Used hs create website-theme (not hs project create)
   - Uploaded with hs upload (not hs project upload)
   - Theme now accessible in Design Manager
   - Templates will be available in Content > Website Pages

   Relates to #1, #2, #5" \
     --base main
   ```

---

## CSS Reference

For the base CSS (step 3 of Work Packet 1), you can reference the design system from the git history.

The old CSS was removed during cleanup but is in git history:
```bash
# View the old theme CSS (for reference only)
git show 6dd47db:src/cms/css/theme.css
```

**Adapt it** to the new location: `hedgehog-learn-theme/css/main.css`

Key design tokens to include:
- Colors (primary: #0066CC, secondary: #00C896)
- Typography (sans-serif stack, size scale)
- Spacing scale
- Border radius
- Shadows
- Transitions

---

## Expected Output Structure

After Work Packet 1, the repository should have:

```
hedgehog-learn/
├── hedgehog-learn-theme/         # NEW - Your work
│   ├── theme.json                # Customized
│   ├── fields.json               # Generated
│   ├── templates/
│   │   └── layouts/
│   │       └── base.html         # You create this
│   ├── css/
│   │   └── main.css              # Adapted from old theme.css
│   └── js/
│       └── main.js               # Generated (can be empty)
├── src/
│   ├── app/                      # Don't touch
│   └── api/                      # Don't touch
├── content/
│   └── modules/                  # Don't touch (3 modules)
└── docs/                         # Don't touch
```

---

## If You Get Stuck

### Theme Not Uploading?
```bash
# Check HubSpot CLI authentication
hs account list
# Should show active account: 21430285

# Try upload with debug
hs upload hedgehog-learn-theme hedgehog-learn-theme --debug
```

### Files Not in Design Manager?
1. Verify upload completed without errors
2. Check you used `hs upload` (not `hs project upload`)
3. Check files exist in `hedgehog-learn-theme/` directory
4. Wait 30 seconds and refresh Design Manager

### Not Sure About File Structure?
Read `docs/sprint1-work-packets-corrected.md` Work Packet 1 in detail. All file contents are provided.

---

## Success Criteria

Work Packet 1 is complete when:

- [x] `hedgehog-learn-theme/` directory created with proper structure
- [x] `theme.json` customized with Hedgehog Learn branding
- [x] Base CSS (`main.css`) includes design system variables
- [x] Base layout template (`templates/layouts/base.html`) created
- [x] Successfully uploaded to HubSpot Design Manager
- [x] Verified files visible in HubSpot UI
- [x] Git branch created: `feature/cms-theme-setup`
- [x] All changes committed with proper message
- [x] PR created with description
- [x] No errors or warnings

---

## What Happens After You're Done

After your PR is merged, the project lead will:
1. Assign you Work Packet 2 (landing page template)
2. Or the project lead will do manual HubSpot steps:
   - Create HubDB tables
   - Activate theme
   - Create preview pages

**You don't need to worry about that - just focus on Work Packet 1!**

---

## Communication

When you're done:
1. **Create the PR** (don't merge it yourself)
2. **Comment in PR**: "Work Packet 1 complete. Theme uploaded to Design Manager and verified."
3. **Notify project lead**: PR is ready for review

If you encounter issues:
- Check `docs/MIGRATION-GUIDE.md` troubleshooting section
- Review `docs/hubspot-architecture-correct.md` again
- Ask project lead for clarification

---

## Remember

✅ **DO**:
- Read `docs/hubspot-architecture-correct.md` first
- Use `hs upload hedgehog-learn-theme hedgehog-learn-theme`
- Create files in `hedgehog-learn-theme/` directory
- Follow Work Packet 1 instructions exactly
- Verify in HubSpot Design Manager after upload

❌ **DON'T**:
- Use `hs project upload` (that's for apps!)
- Create `src/cms/` directory (wrong location)
- Skip reading the architecture doc
- Rush without verifying each step

---

## Quick Start Command

```bash
# 1. Read the docs
cat docs/hubspot-architecture-correct.md
cat docs/sprint1-work-packets-corrected.md

# 2. Start work
git checkout main
git pull origin main
git checkout -b feature/cms-theme-setup

# 3. Follow Work Packet 1 step by step
# (See docs/sprint1-work-packets-corrected.md)

# 4. When done, create PR and notify project lead
```

---

**You've got this! The instructions are clear, the docs are accurate, and the path is well-defined. Just follow Work Packet 1 step-by-step and verify each step before moving on.** 🚀
