# Architecture Overview

_Last updated: keep in sync when major platform or integration changes land._

## High-Level Components
- **HubSpot CMS** – Customer-facing learning experience. Pages under `/learn` use Clean.Pro templates backed by HubDB content.
- **Content Source (Git)** – Markdown modules in `content/modules/**` are the source of truth. `npm run sync:content` renders them to HTML and writes HubDB rows.
- **HubDB** – Stores rendered module HTML plus metadata (`hs_name`, `hs_path`, difficulty, estimated minutes, tags, etc.). Publishes the data consumed by dynamic pages.
- **External Services** – AWS Lambda + API Gateway host interactive features (quiz grading, progress tracking) accessed by HubSpot pages and future web apps.
- **CRM Integration** – HubSpot custom objects and behavioral events capture learner progress. Calls are made through the `@hubspot/api-client` from Lambda functions.

## Current Flows
1. **Authoring** – Contributors edit markdown in Git, open PRs, and merge to `main`.
2. **Sync** – `npm run sync:content` (locally or via GitHub Actions) converts markdown → HTML, applies front matter metadata, and updates the HubDB `modules` table with retry/backoff protection.
3. **Delivery** – HubSpot dynamic page template (`module-page.html`) reads HubDB rows. `/learn` lists modules, `/learn/{slug}` renders detail pages, and Clean.Pro handles styling.
4. **Analytics** – Published modules trigger HubSpot tracking (page analytics today, behavioral events once Lambda endpoints ship).

## Near-Term Enhancements
- **Lambda APIs** – Serverless functions already scaffolded in `src/` will expose quiz grading and progress endpoints. Deploy via `npm run deploy:aws` when ready.
- **HubDB Automation** – Expand sync script to support additional tables (pathways, labs) and structured relationships.
- **UI Extensions** – Evaluate HubSpot UI Extensions for authenticated widgets once Content Hub Enterprise access is available.

## Operational Touchpoints
- Secrets and retry behavior for the sync process live in [`docs/content-sync.md`](content-sync.md).
- Clean.Pro customization guardrails live in [`docs/theme-development.md`](theme-development.md).
- Infrastructure-as-code for Lambda is defined in `serverless.yml`; update this document when adding stages or cloud resources.

## Deploy Runbook: AWS Lambda (Serverless Framework)

### Prerequisites
- Node.js 22+ and npm installed
- AWS credentials configured (access key ID + secret)
- HubSpot Private App token with required scopes
- Serverless Framework installed (`npm install` includes it as dev dependency)

### Environment Variables Required

#### For Local Deployment
```bash
export AWS_REGION=us-west-2           # Target AWS region
export APP_STAGE=dev                   # Stage (dev, staging, prod)
export AWS_ACCESS_KEY_ID=<key>        # AWS credentials
export AWS_SECRET_ACCESS_KEY=<secret> # AWS credentials
export HUBSPOT_PRIVATE_APP_TOKEN=<token>  # HubSpot API token
export HUBSPOT_ACCOUNT_ID=<account-id>    # HubSpot account ID
export ENABLE_CRM_PROGRESS=false      # Enable CRM persistence (optional)
export PROGRESS_BACKEND=properties    # Backend type: properties or events (optional)
```

#### For CI/CD (GitHub Actions)
Set these as GitHub repository secrets:
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `HUBSPOT_PRIVATE_APP_TOKEN`
- `HUBSPOT_ACCOUNT_ID`

### Deployment Commands

```bash
# 1. Clean previous artifacts
rm -rf .serverless dist dist-lambda

# 2. Install dependencies (if not already done)
npm ci

# 3. Build TypeScript
npm run build

# 4. Verify package size and contents
npx serverless package
ls -lh .serverless/api.zip
unzip -l .serverless/api.zip | tail -n 5

# 5. Deploy to AWS
npm run deploy:aws
# OR with explicit region/stage:
# npx serverless deploy --stage dev --region us-west-2
```

### Package Size Verification

**Target Limits:**
- Zipped package: ≤ 10 MB (ideal), ≤ 50 MB (acceptable)
- Unzipped package: ≤ 50 MB (ideal), ≤ 250 MB (hard AWS limit)

**Check package size:**
```bash
du -h .serverless/api.zip
unzip -l .serverless/api.zip | grep -E "^-" | awk '{print "Unzipped: " $1/1024/1024 " MB"}'
```

**Current package metrics (as of 2025-10-13):**
- Zipped: 3.2 MB
- Unzipped: 21.2 MB
- Files: ~3,200

### Troubleshooting

#### Package Size Too Large
**Symptom:** Error "Unzipped size must be smaller than 262144000 bytes"

**Solutions:**
1. Verify only `dist-lambda/` is included (not `dist/`)
2. Check for unwanted files:
   ```bash
   unzip -l .serverless/api.zip | grep -E "(dist/src|eslint|scratch|\.map|\.d\.ts)"
   ```
3. Review `package.patterns` in `serverless.yml`
4. Consider tree-shaking with esbuild (future enhancement)

#### CloudFormation Stack Stuck
**Symptom:** Stack in `UPDATE_ROLLBACK_FAILED` or similar failed state

**Recovery:**
```bash
# Option 1: Remove stack and redeploy
npx serverless remove --stage dev --region us-west-2
npx serverless deploy --stage dev --region us-west-2

# Option 2: Manual cleanup via AWS Console
# Go to CloudFormation → Select stack → Delete
# Then redeploy

# Check stack events for details
aws cloudformation describe-stack-events \
  --stack-name hedgehog-learn-dev \
  --region us-west-2 \
  --max-items 20
```

#### CORS Issues
**Symptom:** Browser errors about CORS, or API Gateway deployment fails with CORS configuration error

**Notes:**
- API Gateway HTTP API does NOT support wildcard origins (`https://*.example.com`)
- CORS is handled in Lambda function code (`src/api/lambda/index.ts`) for dynamic origin checking
- Only static origins should be listed in `serverless.yml` provider-level CORS config
- HubSpot CDN origins are validated dynamically in Lambda response headers

#### Serverless Configuration Warnings
**Symptom:** Warnings during `serverless deploy` about invalid properties

**Common Issues:**
- `cors` property directly on `httpApi` events is invalid (use provider-level config instead)
- Runtime must match allowed values exactly (e.g., `nodejs20.x`)

#### Region Mismatch
**Symptom:** Stack deploys to wrong region or can't find existing stack

**Fix:**
- Ensure `AWS_REGION` env var is set before deploy
- Default in `serverless.yml` is `us-east-1` if not specified
- Production uses `us-west-2`
- Verify with: `npx serverless print --stage dev --region us-west-2 | grep region`

### Deployed Endpoints

After successful deployment, endpoints are available at:
```
Base URL: https://hvoog2lnha.execute-api.us-west-2.amazonaws.com

POST /events/track   - Track learning events (module started/completed, pathway enrolled)
POST /quiz/grade     - Grade quiz submissions
GET  /progress/read  - Read learner progress (requires email or contactId)
```

### Verification Steps

```bash
# Test anonymous event tracking
curl -X POST https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track \
  -H "Content-Type: application/json" \
  -H "Origin: https://hedgehog.cloud" \
  -d '{"eventName":"learning_module_started","payload":{"module_slug":"test"}}'
# Expected: {"status":"logged","mode":"anonymous"}

# Test progress read (anonymous mode)
curl "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/progress/read?email=test@example.com" \
  -H "Origin: https://hedgehog.cloud"
# Expected: {"mode":"anonymous"}

# Test quiz grading
curl -X POST https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/quiz/grade \
  -H "Content-Type: application/json" \
  -d '{"module_slug":"test","answers":[{"id":"q1","value":"a"}]}'
# Expected: {"score":100,"pass":true}
```

### CI/CD Integration

GitHub Actions workflow (`.github/workflows/deploy-aws.yml`) handles automated deployment:
- Triggered manually via `workflow_dispatch`
- Builds TypeScript → Packages → Deploys to AWS
- Uses repository secrets for credentials
- Target stage: `prod` (for production deployments)

### Related Documentation
- [Authentication & Progress](./auth-and-progress.md) - CRM persistence and event tracking
- [Serverless Framework Docs](https://www.serverless.com/framework/docs)
