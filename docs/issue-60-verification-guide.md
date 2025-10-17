---
title: Issue #60 Verification Guide
owner: hh-learn project lead
status: in-progress
last-reviewed: 2025-10-17
---

# Issue #60 Verification Guide: HubSpot Projects Access Token Migration

> **Status Snapshot (2025-10-17):** Issue #60 remains open for **manual verification**. No production change should assume the Projects Access Token migration is complete until the validation steps in this guide produce green results and are posted back to the issue.

> **Terminology Note**: "Projects Access Token" is a **static bearer token** issued by HubSpot Projects. No OAuth flow (authorization code, refresh tokens, etc.) is implemented. All server-to-server API calls use long-lived static bearer tokens passed as `Authorization: Bearer <token>` headers.

This guide provides step-by-step instructions to complete the migration from Private App token to HubSpot Projects Access Token (static bearer token).

## Prerequisites

- HubSpot project `hedgehog-learn-dev` deployed (Build #16+ with required scopes)
- AWS Lambda function deployed (or ready to deploy)
- Test contact in HubSpot CRM with known email address
- GitHub repository access to add secrets

## Part 1: Extract Project Access Token

### Step 1.1: Open Project in HubSpot

```bash
hs project open
```

Or navigate manually to:
https://app.hubspot.com/developer-projects/21430285/project/hedgehog-learn-dev

### Step 1.2: Get Access Token from UI

1. Click **Settings** tab
2. Click **Installation** section
3. Find **"View Access Token"** button/link
4. Copy the token value (starts with `pat-na1-` or similar)
5. **DO NOT commit this token to git**

### Step 1.3: Add Token to Local Environment

```bash
# In your local .env file
echo "HUBSPOT_PROJECT_ACCESS_TOKEN=<paste-token-here>" >> .env
```

Verify:
```bash
grep HUBSPOT_PROJECT_ACCESS_TOKEN .env
```

## Part 2: Add GitHub Secret

### Step 2.1: Add Repository Secret

```bash
# Via GitHub CLI
gh secret set HUBSPOT_PROJECT_ACCESS_TOKEN --body "<paste-token-here>"
```

Or manually:
1. Go to https://github.com/afewell-hh/hh-learn/settings/secrets/actions
2. Click **New repository secret**
3. Name: `HUBSPOT_PROJECT_ACCESS_TOKEN`
4. Value: `<paste-token-here>`
5. Click **Add secret**

### Step 2.2: Verify Secret Added

```bash
gh secret list | grep HUBSPOT_PROJECT_ACCESS_TOKEN
```

Expected output:
```
HUBSPOT_PROJECT_ACCESS_TOKEN  Updated YYYY-MM-DD
```

## Part 3: Deploy Lambda with Project Token

### Step 3.1: Set Environment Variables for Deployment

```bash
export AWS_ACCESS_KEY_ID="<your-aws-key>"
export AWS_SECRET_ACCESS_KEY="<your-aws-secret>"
export AWS_REGION="us-west-2"
export APP_STAGE="dev"
export HUBSPOT_PROJECT_ACCESS_TOKEN="<token-from-part-1>"
export HUBSPOT_ACCOUNT_ID="21430285"
export ENABLE_CRM_PROGRESS="true"
export PROGRESS_BACKEND="properties"
```

### Step 3.2: Build and Deploy

```bash
# Build TypeScript
npm run build

# Deploy to AWS
npm run deploy:aws
```

### Step 3.3: Note API Gateway URL

After deployment, note the endpoint URL:
```
endpoints:
  POST - https://<api-id>.execute-api.us-west-2.amazonaws.com/events/track
  POST - https://<api-id>.execute-api.us-west-2.amazonaws.com/quiz/grade
  GET - https://<api-id>.execute-api.us-west-2.amazonaws.com/progress/read
```

Save this for Part 4.

## Part 4: Verify Project Token Authentication Endpoints (No Browser Required)

### Step 4.1: Prepare Test Contact Email

Choose a test contact email that exists in HubSpot CRM (or create one):
```bash
TEST_EMAIL="test@hedgehog.cloud"  # Replace with your test email
```

### Step 4.2: Get BEFORE State of Contact Properties

> Prefer the Projects Access Token. The snippet below falls back to `HUBSPOT_PRIVATE_APP_TOKEN` only if the project token is unavailable (for troubleshooting only).

```bash
AUTH_TOKEN="${HUBSPOT_PROJECT_ACCESS_TOKEN:-$HUBSPOT_PRIVATE_APP_TOKEN}"

if [ -z "${AUTH_TOKEN}" ]; then
  echo "Missing HUBSPOT_PROJECT_ACCESS_TOKEN (preferred) or HUBSPOT_PRIVATE_APP_TOKEN (fallback)." >&2
  exit 1
fi

curl -s -H "Authorization: Bearer ${AUTH_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/${TEST_EMAIL}?idProperty=email&properties=hhl_progress_state,hhl_progress_updated_at,hhl_progress_summary" \
  | jq '{
      id: .id,
      email: .properties.email,
      hhl_progress_state: .properties.hhl_progress_state,
      hhl_progress_updated_at: .properties.hhl_progress_updated_at,
      hhl_progress_summary: .properties.hhl_progress_summary
    }' > /tmp/contact-before.json

cat /tmp/contact-before.json
```

Save this output as **Artifact 1: Contact BEFORE**.

### Step 4.3: Test POST /events/track (Authenticated Mode)

```bash
API_URL="https://<api-id>.execute-api.us-west-2.amazonaws.com"

curl -X POST "${API_URL}/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_started",
    "contactIdentifier": {
      "email": "'"${TEST_EMAIL}"'"
    },
    "payload": {
      "module_slug": "test-module-project-token",
      "pathway_slug": "test-pathway",
      "ts": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
    }
  }' | jq
```

**Expected Response**:
```json
{
  "status": "persisted",
  "mode": "authenticated",
  "backend": "properties"
}
```

Save this output as **Artifact 2: POST /events/track Response**.

### Step 4.4: Test GET /progress/read (Authenticated Mode)

```bash
curl -X GET "${API_URL}/progress/read?email=${TEST_EMAIL}" \
  -H "Content-Type: application/json" | jq
```

**Expected Response**:
```json
{
  "mode": "authenticated",
  "backend": "properties",
  "progress": {
    "modules": {
      "test-module-project-token": {
        "status": "started",
        "lastActivity": "2025-10-12T23:45:00Z"
      }
    },
    "pathways": {
      "test-pathway": {
        "enrolled": true,
        "lastActivity": "2025-10-12T23:45:00Z"
      }
    }
  }
}
```

Save this output as **Artifact 3: GET /progress/read Response**.

### Step 4.5: Get AFTER State of Contact Properties

```bash
# Wait 5-10 seconds for Lambda to finish processing
sleep 10

AUTH_TOKEN="${HUBSPOT_PROJECT_ACCESS_TOKEN:-$HUBSPOT_PRIVATE_APP_TOKEN}"

curl -s -H "Authorization: Bearer ${AUTH_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/${TEST_EMAIL}?idProperty=email&properties=hhl_progress_state,hhl_progress_updated_at,hhl_progress_summary" \
  | jq '{
      id: .id,
      email: .properties.email,
      hhl_progress_state: .properties.hhl_progress_state,
      hhl_progress_updated_at: .properties.hhl_progress_updated_at,
      hhl_progress_summary: .properties.hhl_progress_summary
    }' > /tmp/contact-after.json

cat /tmp/contact-after.json
```

Save this output as **Artifact 4: Contact AFTER**.

### Step 4.6: Compare BEFORE vs AFTER

```bash
echo "=== BEFORE ==="
cat /tmp/contact-before.json

echo ""
echo "=== AFTER ==="
cat /tmp/contact-after.json

echo ""
echo "=== DIFF ==="
diff -u /tmp/contact-before.json /tmp/contact-after.json || true
```

**Expected Changes**:
- `hhl_progress_state` should contain new module/pathway data
- `hhl_progress_updated_at` should be updated to recent timestamp
- `hhl_progress_summary` should reflect 1 module started, 1 pathway enrolled

Save this output as **Artifact 5: Contact Property Diff**.

## Part 5: Verify CMS Workflows with Project Token Only

### Step 5.1: Test Content Sync Workflow

```bash
# Temporarily remove Private App token to ensure project token is used
export HUBSPOT_PRIVATE_APP_TOKEN=""
export HUBSPOT_PROJECT_ACCESS_TOKEN="<token-from-part-1>"

# Run content sync
npm run sync:content
```

**Expected**: Script should complete successfully using only project token.

Save output as **Artifact 6: Content Sync Output (Project Token Only)**.

### Step 5.2: Test CMS Validation Workflow

```bash
npm run validate:cms
```

**Expected**: Validation should pass with project token.

Save output as **Artifact 7: CMS Validation Output**.

### Step 5.3: Verify GitHub Actions Workflow

1. Trigger `sync-content.yml` workflow manually:
   ```bash
   gh workflow run sync-content.yml
   ```

2. Check workflow run:
   ```bash
   gh run list --workflow=sync-content.yml --limit=1
   ```

3. View logs:
   ```bash
   gh run view <run-id> --log
   ```

**Expected**: Workflow should succeed with `HUBSPOT_PROJECT_ACCESS_TOKEN` secret.

Save relevant logs as **Artifact 8: GitHub Actions Workflow Log**.

## Part 6: Post Verification Artifacts to Issue #60

### Step 6.1: Create Artifact Summary

Create a comment on Issue #60 with all artifacts:

```markdown
## Issue #60 Verification Complete ✅

### Environment
- **Project**: hedgehog-learn-dev (Account 21430285)
- **Lambda Stage**: dev
- **Region**: us-west-2
- **API Gateway URL**: https://<api-id>.execute-api.us-west-2.amazonaws.com
- **Test Contact**: test@hedgehog.cloud (redacted in artifacts)

### Verification Results

#### 1. GitHub Secret Added
✅ `HUBSPOT_PROJECT_ACCESS_TOKEN` added to repository secrets

#### 2. Lambda Deployment
✅ Deployed with `ENABLE_CRM_PROGRESS=true` and `PROGRESS_BACKEND=properties`
✅ Function uses `HUBSPOT_PROJECT_ACCESS_TOKEN` (code in `src/shared/hubspot.ts:5`)

#### 3. Endpoint Verification (Project Token Authentication, No Browser)

**POST /events/track (Authenticated)**:
\`\`\`json
{
  "status": "persisted",
  "mode": "authenticated",
  "backend": "properties"
}
\`\`\`

**GET /progress/read (Authenticated)**:
\`\`\`json
{
  "mode": "authenticated",
  "backend": "properties",
  "progress": { ... }
}
\`\`\`

#### 4. Contact Properties Update

**BEFORE**:
\`\`\`json
{
  "id": "12345",
  "email": "t***@hedgehog.cloud",
  "hhl_progress_state": null,
  "hhl_progress_updated_at": null,
  "hhl_progress_summary": null
}
\`\`\`

**AFTER**:
\`\`\`json
{
  "id": "12345",
  "email": "t***@hedgehog.cloud",
  "hhl_progress_state": "{\"modules\":{\"test-module-project-token\":{...}}}",
  "hhl_progress_updated_at": "2025-10-12T23:45:00Z",
  "hhl_progress_summary": "1 module started, 1 pathway enrolled"
}
\`\`\`

#### 5. CMS Workflows
✅ Content sync succeeded with project token only
✅ CMS validation passed
✅ GitHub Actions workflow `sync-content.yml` succeeded

### Artifacts
- See verification outputs in comments below (redacted PII)

### Scope Inventory
From `src/app/app-hsmeta.json`:
- ✅ `crm.objects.contacts.read` - Read contacts
- ✅ `crm.objects.contacts.write` - Write contact properties
- ✅ `crm.schemas.contacts.write` - Manage contact schemas
- ✅ `hubdb` - HubDB read/write
- ✅ `content` - CMS content access
- ✅ `analytics.behavioral_events.send` - Send behavioral events (future)
- ✅ `behavioral_events.event_definitions.read_write` - Manage event definitions (future)

### Documentation Updates
- ✅ `docs/auth-and-progress.md` - Added token precedence section
- ✅ `docs/content-sync.md` - Added verification commands with project token
- ✅ `docs/issue-60-verification-guide.md` - Complete verification guide (this doc)

### Success Criteria Status
- ✅ Project app scopes validated
- ✅ `HUBSPOT_PROJECT_ACCESS_TOKEN` wired in serverless and CI
- ✅ Progress endpoints succeed using project token (proof: curl outputs above)
- ✅ Contact properties updated (`hhl_progress_*` before/after shown)
- ✅ Docs updated with token precedence
- ✅ Private app token not required for dev (verified with content sync)

**Ready for PR merge and Issue #60 closure.**
\`\`\`

## Appendix: Troubleshooting

### Issue: Lambda deployment fails with "Unzipped size" error

This is a known issue with the current serverless packaging. Workaround:

1. Check current CloudFormation stack status:
   ```bash
   aws cloudformation describe-stacks --stack-name hedgehog-learn-dev --region us-west-2
   ```

2. If stuck in UPDATE_FAILED, delete and recreate:
   ```bash
   serverless remove
   serverless deploy
   ```

3. Verify package size:
   ```bash
   du -h .serverless/api.zip
   ```

Expected: ~3-4MB zipped, ~20-25MB unzipped.

### Issue: Token extraction fails

If "View Access Token" is not visible in the UI:
1. Verify project is deployed: `hs project list-builds`
2. Ensure installation is updated with latest scopes
3. Check account permissions (must be Super Admin)

### Issue: Endpoints return 401 Unauthorized

Check:
1. `HUBSPOT_PROJECT_ACCESS_TOKEN` is correctly set in Lambda environment
2. Token is not expired (project tokens don't expire but can be revoked)
3. Lambda code is using `process.env.HUBSPOT_PROJECT_ACCESS_TOKEN`

### Issue: Contact properties not updating

Check:
1. `ENABLE_CRM_PROGRESS=true` in Lambda environment
2. `PROGRESS_BACKEND=properties` in Lambda environment
3. Contact exists in HubSpot CRM with matching email
4. Properties `hhl_progress_state`, `hhl_progress_updated_at`, `hhl_progress_summary` exist

## References

- **Issue #60**: https://github.com/afewell-hh/hh-learn/issues/60
- **Issue #59**: https://github.com/afewell-hh/hh-learn/issues/59 (Phase 2 authenticated progress)
- **PR #61**: https://github.com/afewell-hh/hh-learn/pull/61 (Initial Projects Access Token support)
- **HubSpot Projects Docs**: https://developers.hubspot.com/docs/platform/build-and-deploy-using-hubspot-projects
- **App Scopes Reference**: `src/app/app-hsmeta.json`
