# Untracked Files Status

**Date**: 2025-10-28 (updated)
**Branch**: main
**Status**: Historical reference — files documented below have now been reviewed and brought into source control as part of the membership baseline cleanup.

---

## Summary

The following untracked files are from previous research and implementation work on related issues. They are intentionally **not included** in PR #254 (Issue #253) as they belong to separate issues and should be handled in their own PRs.

---

## Untracked Files

### Templates (Issues #244, #245)

**Files:**
- `clean-x-hedgehog-templates/learn/action-runner.html` (Issue #245)
- `clean-x-hedgehog-templates/assets/js/action-runner.js` (Issue #245)
- `clean-x-hedgehog-templates/learn/auth-handshake.html` (Issue #244)

**Purpose:** Private HubSpot pages for authentication handshake and action runner patterns

**Status:** Ready for separate PR when Issues #244 and #245 are ready

**Action (2025-10-28):** Added to repository and covered by the native membership baseline commit.

---

### Documentation

**File:** `docs/auth-public-login-alternative.md`

**Purpose:** Research documentation for public-page authentication alternatives

**Status:** Research documentation from Issue #242

**Action (2025-10-28):** Archived into the repository for posterity.

---

### Test Files

**File:** `tests/e2e/membership-diagnostic.spec.ts`

**Purpose:** Diagnostic test for membership flows

**Status:** Experimental test file

**Action (2025-10-28):** Converted into tracked Playwright helpers/tests.

---

### Verification Output Directories

**Directories:**
- `verification-output/issue-232/`
- `verification-output/issue-233/`
- `verification-output/issue-235/`
- `verification-output/issue-237/`
- `verification-output/issue-244/`
- `verification-output/issue-245/`
- `verification-output/issue-246/`

**Purpose:** Research and verification artifacts from related issues

**Status:** Historical research documentation

**Action (2025-10-28):** Archived into `verification-output/` for long-term reference.

---

### Other Files

**File:** `verification-output/issue-237/PR-240-SUMMARY.md`

**Purpose:** PR summary for Issue #237

**Status:** Historical documentation

**Action (2025-10-28):** Archived alongside other verification docs.

---

## What's Included in PR #254

**Only these files are part of PR #254:**
1. `tests/e2e/enrollment-flow.spec.ts` (NEW)
2. `tests/api/membership-smoke.spec.ts` (UPDATED)
3. `verification-output/issue-242/PHASE-3-TEST-UPDATES-SUMMARY.md` (NEW)
4. `verification-output/issue-242/QUICK-START-TESTING-GUIDE.md` (NEW)
5. `verification-output/issue-242/IMPLEMENTATION-COMPLETE.md` (NEW)
6. `.gitignore` (UPDATED - added patterns for temporary files)

---

## .gitignore Updates

Added patterns to ignore temporary/debug files:
```gitignore
# Build output
dist-cjs/

# Debug and test scripts (temporary)
scripts/debug-*.js
scripts/test-*.js
scripts/fetch-*.js

# Temporary research files
verification-output/LINKED-*.md
```

These patterns prevent accidental commits of temporary debug scripts and build artifacts.

---

## Stashed Changes

**Stash:** "Stash unrelated changes from previous work"

**Contains:** Modified template files and documentation from previous work
- `clean-x-hedgehog-templates/layouts/base.html`
- `clean-x-hedgehog-templates/learn/courses-page.html`
- `clean-x-hedgehog-templates/learn/macros/left-nav.html`
- `clean-x-hedgehog-templates/learn/my-learning.html`
- `clean-x-hedgehog-templates/learn/pathways-page.html`
- `clean-x-hedgehog-templates/learn/register.html`
- `docs/auth-and-progress.md`
- `docs/deployment-guide-v0.3.md`
- `docs/iterations/2025-10-20-plan.md`

**Action (2025-10-28):** Changes applied and committed as part of the membership baseline cleanup; stash no longer required.

**To view stash:**
```bash
git stash list
git stash show -p stash@{0}
```

---

## Recommendations

### For Untracked Template Files (Issues #244, #245)
1. Create separate branch for action-runner implementation
2. Add template files with proper testing
3. Create PR referencing Issues #244 and #245
4. Include verification artifacts from `verification-output/issue-244/` and `issue-245/`

### For Documentation Files
1. Review `docs/auth-public-login-alternative.md`
2. Determine if it should be formal documentation or archived
3. Either commit in documentation PR or remove if obsolete

### For Test Files
1. Review `tests/e2e/membership-diagnostic.spec.ts`
2. If useful, clean up and commit in separate testing PR
3. If obsolete, delete

### For Verification Output
1. These directories serve as historical research
2. Consider creating an archive directory: `verification-output/archive/`
3. Move older issue directories there to keep repo organized
4. Or keep as-is for reference (they're ignored in deployment)

---

## Clean Working State Verification

```bash
# Current branch status (clean except for untracked files)
git status

# Files in PR #254
git diff --name-only origin/main...HEAD

# View stashed changes
git stash list
```

**Expected:**
- Branch has 2 commits (test updates + gitignore)
- No uncommitted changes (except untracked files)
- Untracked files documented above
- Stash contains unrelated work from previous sessions

---

## Summary

✅ **Git repository is clean and organized**
✅ **PR #254 contains only Issue #253 changes**
✅ **Untracked files documented for future PRs**
✅ **Stashed changes preserved for review**
✅ **.gitignore updated to prevent future clutter**

No action required for PR #254. Untracked files and stashed changes can be handled in future PRs for their respective issues.
