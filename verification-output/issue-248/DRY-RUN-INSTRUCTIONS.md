# Issue #248 - Dry Run Instructions

## Local Test Execution

The GitHub Secrets are configured for CI/CD, but to run tests locally you need to add the test credentials to your `.env` file.

### Step 1: Add Test Variables to .env

Add these lines to your `.env` file (at the root of the repository):

```bash
# API Smoke Test Configuration (Issue #248)
HUBSPOT_TEST_EMAIL=your-test-contact@example.com  # Replace with actual test contact email
HUBSPOT_TEST_CONTACT_ID=12345  # Optional: Replace with actual contact ID for faster lookups

# API Gateway URL (optional - defaults to production)
API_BASE_URL=https://hvoog2lnha.execute-api.us-west-2.amazonaws.com
```

**Note:** The `HUBSPOT_PROJECT_ACCESS_TOKEN` should already be in your `.env` file. If not, add it:

```bash
HUBSPOT_PROJECT_ACCESS_TOKEN=pat-na1-...  # Your HubSpot Project Access Token
```

### Step 2: Verify Test Contact Exists

Ensure the test contact exists in HubSpot CRM:

```bash
# Quick verification using HubSpot API
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/${HUBSPOT_TEST_EMAIL}?idProperty=email" \
  | jq '.properties.email'
```

**Expected output:** Should return the contact email

**If contact doesn't exist:** Create it in HubSpot CRM or use the helper:

```typescript
import { ensureTestContact } from './tests/api/helpers/hubspot-cleanup';
await ensureTestContact('test@example.com', {
  firstname: 'Test',
  lastname: 'User',
});
```

### Step 3: Run the Dry-Run Test

```bash
# Load environment variables
source .env  # or: export $(cat .env | xargs)

# Run all API smoke tests
npx playwright test tests/api/membership-smoke.spec.ts --reporter=list

# Or run with HTML report
npx playwright test tests/api/membership-smoke.spec.ts --reporter=html

# Or run specific test suite
npx playwright test tests/api/membership-smoke.spec.ts -g "Course Enrollment"
```

### Step 4: Review Results

**Success Output:**
```
Running 13 tests using 1 worker

  ✓  1 should enroll in a course and verify via enrollments API (1.2s)
  ✓  2 should mark course module as started and verify progress (0.8s)
  ✓  3 should mark course module as completed and verify progress (0.9s)
  ✓  4 should enroll in a pathway and verify via enrollments API (1.1s)
  ✓  5 should mark pathway module as started and verify progress (0.7s)
  ✓  6 should retrieve course progress aggregate (0.6s)
  ✓  7 should retrieve pathway progress aggregate (0.5s)
  ✓  8 should handle anonymous events (0.4s)
  ✓  9 should handle authenticated events with email (0.6s)
  ✓  10 should return 400 for invalid event payload (0.3s)
  ✓  11 should return 400 for missing contact identifier (0.2s)
  ✓  12 should return 400 for invalid email format (0.3s)

  13 passed (8.1s)
```

**Artifacts Generated:**
- `playwright-report/` - HTML test report
- `test-results/` - Individual test traces

### Step 5: Capture Verification Evidence

```bash
# Create timestamped evidence directory
mkdir -p verification-output/issue-248/test-run-$(date +%Y%m%d-%H%M%S)

# Copy test results
cp -r playwright-report verification-output/issue-248/test-run-$(date +%Y%m%d-%H%M%S)/
cp -r test-results verification-output/issue-248/test-run-$(date +%Y%m%d-%H%M%S)/

# Generate summary
npx playwright test tests/api/membership-smoke.spec.ts --reporter=json > \
  verification-output/issue-248/test-run-$(date +%Y%m%d-%H%M%S)/results.json
```

## CI/CD Verification

Once local dry-run passes, verify GitHub Actions:

### Manual Workflow Trigger

1. Go to GitHub Actions → **API Smoke Tests** workflow
2. Click **Run workflow**
3. Select branch (usually `main` or your PR branch)
4. Click **Run workflow** button

### Verify Workflow Execution

Monitor the workflow run:
- ✅ `verify-endpoints` job should pass (health checks)
- ✅ `api-smoke-tests` job should pass (full test suite)
- ✅ Artifacts uploaded on completion

### Check Workflow Logs

If tests fail, download the `api-smoke-test-results` artifact:
- Contains `playwright-report/` with detailed HTML report
- Contains `test-results/` with traces for debugging

## Troubleshooting

### Error: "TEST_EMAIL is required"

**Cause:** Environment variable not set

**Solution:** Add `HUBSPOT_TEST_EMAIL` to `.env` and reload:
```bash
echo "HUBSPOT_TEST_EMAIL=test@example.com" >> .env
source .env
```

### Error: "No HubSpot access token available"

**Cause:** `HUBSPOT_PROJECT_ACCESS_TOKEN` not set

**Solution:** Add token to `.env`:
```bash
echo "HUBSPOT_PROJECT_ACCESS_TOKEN=pat-na1-..." >> .env
source .env
```

### Error: "Contact not found for email"

**Cause:** Test contact doesn't exist in HubSpot CRM

**Solution:** Create contact in HubSpot or use a different test email

### Error: "fetch failed" or timeout

**Cause:** Lambda function not responding or API Gateway URL wrong

**Solution:**
1. Verify API Gateway URL: `echo $API_BASE_URL`
2. Check Lambda is deployed: `aws lambda get-function --function-name hedgehog-learn-dev-api`
3. Check Lambda logs: `aws logs tail /aws/lambda/hedgehog-learn-dev-api --follow`

### Error: "SCHEMA_VALIDATION_FAILED"

**Cause:** Invalid payload sent to Lambda

**Solution:** Check the error `details` array in response for specific validation errors

## Next Steps

After successful dry-run:

1. ✅ Commit test evidence to `verification-output/issue-248/`
2. ✅ Create PR for Issue #248
3. ✅ Verify GitHub Actions runs successfully on PR
4. ✅ Merge PR
5. ✅ Monitor nightly test runs

---

**Last Updated:** 2025-10-26
**Status:** Ready for execution
