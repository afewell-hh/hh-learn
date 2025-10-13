# Issue #60 Status: Projects App OAuth Migration

## Current Status: Ready for Manual Verification

The code changes for Issue #60 were completed in PR #61 (merged). What remains is **manual verification** that requires UI access to extract the project access token.

## What's Complete ✅

### 1. Code Changes (PR #61 - Merged)
- ✅ `src/shared/hubspot.ts` - Prefers `HUBSPOT_PROJECT_ACCESS_TOKEN` over `HUBSPOT_PRIVATE_APP_TOKEN`
- ✅ `serverless.yml` - Environment variable configured for project token
- ✅ `.env.example` - Documented project token preference
- ✅ `docs/auth-and-progress.md` - Added token precedence section
- ✅ `docs/content-sync.md` - Added verification commands with project token

### 2. App Configuration
- ✅ `src/app/app-hsmeta.json` - All required scopes configured:
  - `crm.objects.contacts.read` ✅
  - `crm.objects.contacts.write` ✅
  - `crm.schemas.contacts.write` ✅
  - `hubdb` ✅
  - `content` ✅
  - `analytics.behavioral_events.send` ✅
  - `behavioral_events.event_definitions.read_write` ✅

### 3. Verification Tooling
- ✅ `docs/issue-60-verification-guide.md` - Complete step-by-step verification guide
- ✅ `scripts/verify-issue-60.sh` - Automated verification script

## What's Needed: Manual Steps

### Step 1: Extract Project Access Token from HubSpot UI

**You need to**:
1. Navigate to https://app.hubspot.com/developer-projects/21430285/project/hedgehog-learn-dev
2. Click **Settings** → **Installation**
3. Find and click **"View Access Token"**
4. Copy the token (starts with `pat-na1-` or similar)

**Then**:
```bash
# Add to local .env
echo "HUBSPOT_PROJECT_ACCESS_TOKEN=<paste-token>" >> .env

# Add to GitHub Secrets
gh secret set HUBSPOT_PROJECT_ACCESS_TOKEN --body "<paste-token>"
```

### Step 2: Deploy Lambda with Project Token

```bash
export HUBSPOT_PROJECT_ACCESS_TOKEN="<token-from-step-1>"
export ENABLE_CRM_PROGRESS="true"
export PROGRESS_BACKEND="properties"
export AWS_ACCESS_KEY_ID="<your-key>"
export AWS_SECRET_ACCESS_KEY="<your-secret>"
export AWS_REGION="us-west-2"
export APP_STAGE="dev"
export HUBSPOT_ACCOUNT_ID="21430285"

npm run build
npm run deploy:aws
```

**Note**: There's currently a Lambda deployment issue (unzipped size error). This may need to be resolved first. See troubleshooting section in `docs/issue-60-verification-guide.md`.

### Step 3: Run Verification Script

```bash
export HUBSPOT_PROJECT_ACCESS_TOKEN="<token>"
export API_GATEWAY_URL="https://<api-id>.execute-api.us-west-2.amazonaws.com"
export TEST_EMAIL="test@hedgehog.cloud"  # Use a real test contact

./scripts/verify-issue-60.sh
```

This will:
- Get BEFORE state of contact properties
- Send test event via POST /events/track
- Read progress via GET /progress/read
- Get AFTER state of contact properties
- Show diff
- Save all artifacts to `/tmp/issue-60-verification-<timestamp>/`

### Step 4: Post Verification Artifacts to Issue #60

Post the verification results to https://github.com/afewell-hh/hh-learn/issues/60

Include:
- ✅ GitHub Secret confirmation
- ✅ Lambda deployment confirmation (with API Gateway URL)
- ✅ POST /events/track response (redact email)
- ✅ GET /progress/read response (redact email)
- ✅ Contact properties BEFORE (redact email)
- ✅ Contact properties AFTER (redact email)
- ✅ Contact properties DIFF
- ✅ Content sync verification (project token only)

## Known Issues

### Lambda Deployment Failure

**Error**: "Unzipped size must be smaller than 262144000 bytes"

**Status**: Investigation needed. The package is only ~24MB unzipped, well under the 250MB limit.

**Possible causes**:
1. Existing deployment has corrupt state
2. CloudFormation stack needs cleanup
3. Serverless packaging including unwanted files

**Workaround**:
```bash
# Try removing and redeploying
serverless remove
serverless deploy
```

Or:
```bash
# Check and fix CloudFormation stack manually in AWS Console
aws cloudformation describe-stacks --stack-name hedgehog-learn-dev --region us-west-2
```

## Files Created for Issue #60

1. `docs/issue-60-verification-guide.md` - Complete verification guide with step-by-step instructions
2. `scripts/verify-issue-60.sh` - Automated verification script
3. `ISSUE-60-STATUS.md` (this file) - Current status and next steps

## Timeline

- **2025-10-10**: PR #61 merged (initial OAuth support)
- **2025-10-12**: Verification guide and scripts created
- **Next**: Manual token extraction and verification (requires UI access)

## References

- **Issue #60**: https://github.com/afewell-hh/hh-learn/issues/60
- **PR #61**: https://github.com/afewell-hh/hh-learn/pull/61
- **Issue #59**: https://github.com/afewell-hh/hh-learn/issues/59 (Phase 2 progress)
- **Verification Guide**: `docs/issue-60-verification-guide.md`
- **Verification Script**: `scripts/verify-issue-60.sh`
