# Issue #205 Deployment Checklist

## Pre-Deployment

- [x] Code implementation complete
- [x] TypeScript compiled successfully
- [x] All files committed to git
- [ ] Pull request created
- [ ] Code review completed
- [ ] PR approved and merged to main

## Deployment Steps

### 1. Build CJS Scripts

```bash
npm run build:scripts-cjs
```

**Expected Output**: TypeScript files compiled to `dist-cjs/` directory

### 2. Publish enrollment.js Asset

```bash
node dist-cjs/scripts/hubspot/publish-template.js \
  --path "CLEAN x HEDGEHOG/templates/assets/js/enrollment.js" \
  --local "clean-x-hedgehog-templates/assets/js/enrollment.js" \
  --validate-env published
```

**Expected Output**: Asset uploaded to HubSpot CDN
**Verification**: Check HubSpot File Manager for `/CLEAN x HEDGEHOG/templates/assets/js/enrollment.js`

### 3. Publish Pathways Page Template

```bash
node dist-cjs/scripts/hubspot/publish-template.js \
  --path "CLEAN x HEDGEHOG/templates/learn/pathways-page.html" \
  --local "clean-x-hedgehog-templates/learn/pathways-page.html" \
  --validate-env published
```

**Expected Output**: Template published successfully
**Verification**: Visit https://hedgehog.cloud/learn/pathways/course-authoring-expert (with cache-busting)

### 4. Publish Courses Page Template

```bash
node dist-cjs/scripts/hubspot/publish-template.js \
  --path "CLEAN x HEDGEHOG/templates/learn/courses-page.html" \
  --local "clean-x-hedgehog-templates/learn/courses-page.html" \
  --validate-env published
```

**Expected Output**: Template published successfully
**Verification**: Visit https://hedgehog.cloud/learn/courses/course-authoring-101 (with cache-busting)

### 5. Deploy Lambda Function

```bash
# Set required environment variables
export AWS_ACCESS_KEY_ID="<your-key>"
export AWS_SECRET_ACCESS_KEY="<your-secret>"
export AWS_REGION="us-west-2"
export APP_STAGE="dev"
export HUBSPOT_PROJECT_ACCESS_TOKEN="<project-token>"
export HUBSPOT_ACCOUNT_ID="21430285"
export ENABLE_CRM_PROGRESS="true"
export PROGRESS_BACKEND="properties"

# Deploy to AWS
npm run deploy:aws
```

**Expected Output**: 
```
Service Information
service: hedgehog-learn
stage: dev
region: us-west-2
endpoints:
  POST - https://<api-id>.execute-api.us-west-2.amazonaws.com/events/track
  POST - https://<api-id>.execute-api.us-west-2.amazonaws.com/quiz/grade
  GET - https://<api-id>.execute-api.us-west-2.amazonaws.com/progress/read
functions:
  api: hedgehog-learn-dev-api
```

**Verification**: Note the API Gateway URL and ensure it matches `constants.json`

## Post-Deployment Verification

### 1. Smoke Test - Page Load

```bash
# Pathways page
curl -I "https://hedgehog.cloud/learn/pathways/course-authoring-expert?hs_no_cache=1"

# Courses page
curl -I "https://hedgehog.cloud/learn/courses/course-authoring-101?hs_no_cache=1"
```

**Expected**: Both return `200 OK`

### 2. Smoke Test - enrollment.js Asset

```bash
curl -I "https://hedgehog.cloud/hubfs/CLEAN%20x%20HEDGEHOG/templates/assets/js/enrollment.js"
```

**Expected**: Returns `200 OK`

### 3. Run Public Verification Scripts

```bash
node scripts/verify-auth-mvp.js
node scripts/verify-detail-content.js
```

**Expected**: All checks pass

### 4. Manual Test Script

- [ ] Execute `verification-output/issue-205/MANUAL-TEST-SCRIPT.md`
- [ ] Collect all required screenshots
- [ ] Save beacon payloads
- [ ] Verify CRM updates
- [ ] Document any issues

## Evidence Collection

### Screenshots Required

Place all screenshots in `verification-output/issue-205/screenshots/`:

- [ ] pathway-enrollment-cta-before.png
- [ ] pathway-enrollment-cta-enrolling.png
- [ ] pathway-enrollment-cta-after.png
- [ ] pathway-enrollment-toast.png
- [ ] course-enrollment-cta-before.png
- [ ] course-enrollment-cta-enrolling.png
- [ ] course-enrollment-cta-after.png
- [ ] course-enrollment-toast.png
- [ ] localStorage-pathway-enrollment.png
- [ ] localStorage-course-enrollment.png
- [ ] network-beacon-pathway.png
- [ ] network-beacon-course.png
- [ ] hubspot-contact-properties-pathway.png
- [ ] hubspot-contact-properties-course.png
- [ ] pathway-unauthenticated.png
- [ ] course-unauthenticated.png
- [ ] console-debug-output.png

### Beacon Payloads Required

Place payload files in `verification-output/issue-205/payloads/`:

- [ ] pathway-enrollment-payload.json
- [ ] course-enrollment-payload.json

## Issue Closure

### PR Comment Template

```markdown
## Post-Merge Deployment Complete ✅

### Deployment Summary
- **Date**: [YYYY-MM-DD]
- **Templates Published**: pathways-page.html, courses-page.html
- **Assets Published**: enrollment.js
- **Lambda Deployed**: Yes (stage: dev)
- **Verification Scripts**: All passed

### Evidence Artifacts
See `verification-output/issue-205/` for:
- Implementation summary
- Manual test script (completed)
- Screenshots (17 total)
- Beacon payload examples

### Manual Testing Results
- ✅ Pathway enrollment flow
- ✅ Course enrollment flow
- ✅ Unauthenticated user (CTA hidden)
- ✅ Debug mode logging
- ✅ localStorage persistence
- ✅ CRM property updates
- ✅ Button state transitions
- ✅ Toast notifications

### Live URLs Verified
- https://hedgehog.cloud/learn/pathways/course-authoring-expert
- https://hedgehog.cloud/learn/courses/course-authoring-101

### Next Steps
- Issue #205 can be closed
- Consider future enhancements listed in IMPLEMENTATION-SUMMARY.md
```

### GitHub Issue Comment

Post the above comment to Issue #205, attach screenshots, and close the issue.

## Rollback Plan (If Needed)

If critical issues are discovered:

### 1. Revert Templates

```bash
# Use git to find previous version
git log --oneline clean-x-hedgehog-templates/learn/pathways-page.html

# Check out previous commit
git checkout <commit-hash> clean-x-hedgehog-templates/learn/pathways-page.html
git checkout <commit-hash> clean-x-hedgehog-templates/learn/courses-page.html

# Republish old versions
npm run build:scripts-cjs
[Run publish commands as above]
```

### 2. Remove enrollment.js Asset

Delete from HubSpot File Manager or publish empty file:

```bash
echo "" > clean-x-hedgehog-templates/assets/js/enrollment.js
[Run publish command]
```

### 3. Revert Lambda

```bash
# Find previous working version
git log --oneline src/api/lambda/index.ts

# Check out previous commit
git checkout <commit-hash> src/api/lambda/index.ts
git checkout <commit-hash> src/shared/types.ts

# Rebuild and redeploy
npm run build
npm run deploy:aws
```

## Support Contacts

- **Project Owner**: afewell-hh
- **Issue Tracker**: https://github.com/afewell-hh/hh-learn/issues/205
- **Documentation**: docs/project-management.md
