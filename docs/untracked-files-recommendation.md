# Untracked Files Cleanup Recommendation

## Files to COMMIT (Valuable Additions)

### Scripts - Keep & Commit
```bash
git add scripts/force-republish-page.ts
git add scripts/hubspot/validate-inline-constants.ts
git add scripts/publish-action-runner-page.ts
```
**Reason**: Reusable utilities for template/page management

### Documentation - Keep & Commit
```bash
git add docs/issue-326-final-resolution.md
git add docs/issue-326-resolution.md
```
**Reason**: Documents the HubL limitation and inline constants solution

**Optional** (if useful for future reference):
```bash
git add docs/issue-317-*.md
git add docs/issue-319-*.md
```

## Files to REMOVE or GITIGNORE

### Temporary/Test Files - Remove
```bash
rm run-issue-318-tests.sh  # Temporary test script
```

### Build Artifacts - Check if needed
```bash
# Check if these are build outputs that should be in .gitignore
ls -la dist-lambda/src/api/lambda/protected-api.js
ls -la clean-x-hedgehog-templates/assets/js/enrollment-auth.js
```

If they're generated, add to .gitignore:
```
dist-lambda/**/*.js
clean-x-hedgehog-templates/assets/js/enrollment-auth.js
```

### Directories to Investigate
```bash
# Check what's in hubspot-functions/
ls -la hubspot-functions/

# If it's old/unused, remove it:
# rm -rf hubspot-functions/
```

## Files Already Handled

### Agent Handoff Docs - Obsolete (Issue Closed)
```bash
rm docs/issue-326-agent-c-handoff.md  # No longer needed since issue is closed
```

## Verification Outputs

Already properly gitignored:
```
verification-output/
tests/e2e/.auth/
```

## Recommended .gitignore Additions

Add to `.gitignore` if not already there:
```
# Build outputs
dist-lambda/**/*.js
dist-cjs/

# Temporary files
run-*.sh
upload-log.txt

# Agent coordination (if you don't want to commit these)
docs/*-agent-*-handoff.md
docs/*-coordination-log.md
```

## Summary Commit Message

```
feat: add Issue #326 resolution scripts and docs

- Add validate-inline-constants script to prevent config drift
- Add force-republish-page utility for template updates
- Add publish-action-runner-page helper
- Document HubL limitation and inline constants solution

Resolves #326
```
