# Issue #206 Deployment Guide

## Pre-Deployment Checklist

- [x] TypeScript build succeeds
- [x] No TypeScript errors
- [x] Integration test script created
- [x] Documentation complete
- [ ] Environment variables verified
- [ ] AWS credentials configured

## Environment Variables Required

The implementation uses **existing environment variables** only. No new variables needed.

### Required Variables

```bash
# HubSpot Authentication
export HUBSPOT_PROJECT_ACCESS_TOKEN="pat-na1-..." # Required

# CRM Progress Configuration
export ENABLE_CRM_PROGRESS="true"  # Must be true for enrollment tracking
export PROGRESS_BACKEND="properties"  # Default backend

# AWS Configuration
export AWS_REGION="us-west-2"  # Or your preferred region
export APP_STAGE="dev"  # or prod, staging, etc.
export AWS_ACCESS_KEY_ID="..."  # For deployment
export AWS_SECRET_ACCESS_KEY="..."  # For deployment

# HubSpot Account
export HUBSPOT_ACCOUNT_ID="21430285"  # Your account ID

# Testing (optional, for verification)
export HUBSPOT_TEST_USERNAME="test@hedgehog.cloud"  # Test contact email
```

### Variable Verification

```bash
# Check that required variables are set
echo "HUBSPOT_PROJECT_ACCESS_TOKEN: ${HUBSPOT_PROJECT_ACCESS_TOKEN:0:10}..."
echo "ENABLE_CRM_PROGRESS: $ENABLE_CRM_PROGRESS"
echo "AWS_REGION: $AWS_REGION"
echo "APP_STAGE: $APP_STAGE"
```

## Deployment Steps

### Step 1: Build the Project

```bash
# Build TypeScript (both main and lambda)
npm run build

# Verify build success
echo $?  # Should output 0
```

Expected output:
```
> hedgehog-learn@0.1.0 build
> tsc -p tsconfig.json && tsc -p tsconfig.lambda.json
```

### Step 2: Deploy to AWS

```bash
# Deploy using npm script
npm run deploy:aws

# OR deploy directly with serverless
serverless deploy
```

Expected output:
```
Deploying hedgehog-learn to stage dev (us-west-2)

✔ Service deployed to stack hedgehog-learn-dev (142s)

endpoints:
  POST - https://<api-id>.execute-api.us-west-2.amazonaws.com/events/track
  POST - https://<api-id>.execute-api.us-west-2.amazonaws.com/quiz/grade
  GET - https://<api-id>.execute-api.us-west-2.amazonaws.com/progress/read
  GET - https://<api-id>.execute-api.us-west-2.amazonaws.com/enrollments/list  # NEW!
functions:
  api: hedgehog-learn-dev-api (XX MB)
```

### Step 3: Save API Gateway URL

```bash
# Extract and save the API URL
export API_URL="https://<api-id>.execute-api.us-west-2.amazonaws.com"
echo $API_URL

# Save to .env for future use
echo "API_URL=$API_URL" >> .env
```

### Step 4: Update Constants (if URL changed)

If the API Gateway URL changed, update constants.json:

```bash
# Edit clean-x-hedgehog-templates/config/constants.json
# Update TRACK_EVENTS_URL to match API_URL

# Then publish to HubSpot
npm run publish:constants
```

## Post-Deployment Verification

### Step 1: Run Integration Tests

```bash
# Set environment variables
export API_URL="https://<api-id>.execute-api.us-west-2.amazonaws.com"
export HUBSPOT_TEST_USERNAME="test@hedgehog.cloud"

# Run integration tests
./tests/test-enrollments-api.sh
```

Expected output:
```
=========================================
Integration Tests: /enrollments/list
=========================================

API_URL: https://...
TEST_EMAIL: test@hedgehog.cloud

Test 1: Request without email or contactId (should return 400)
--------------------------------------
✓ PASS: Got expected 400 Bad Request
{
  "error": "email or contactId required"
}

Test 2: Request with valid email (should return 200 with enrollments)
--------------------------------------
✓ PASS: Got expected 200 OK
✓ PASS: Response has mode=authenticated
✓ PASS: Response has enrollments object
✓ PASS: Enrollments has pathways and courses arrays

Test 3: Request with non-existent email (should return 404)
--------------------------------------
✓ PASS: Got expected 404 Not Found

=========================================
All tests passed! ✓
=========================================
```

### Step 2: Manual API Testing

```bash
# Test enrollment tracking with source
curl -X POST "${API_URL}/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_pathway_enrolled",
    "contactIdentifier": {"email": "'${HUBSPOT_TEST_USERNAME}'"},
    "enrollment_source": "pathway_page",
    "pathway_slug": "test-pathway-verification",
    "payload": {"ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
  }' | jq '.'

# Expected response:
# {
#   "status": "persisted",
#   "mode": "authenticated",
#   "backend": "properties"
# }

# Wait 5 seconds for CRM persistence
sleep 5

# Verify enrollment was persisted
curl "${API_URL}/enrollments/list?email=${HUBSPOT_TEST_USERNAME}" | jq '.'

# Expected response:
# {
#   "mode": "authenticated",
#   "enrollments": {
#     "pathways": [
#       {
#         "slug": "test-pathway-verification",
#         "enrolled_at": "2025-10-19T...",
#         "enrollment_source": "pathway_page"
#       }
#     ],
#     "courses": []
#   }
# }
```

### Step 3: Save Verification Outputs

```bash
# Create timestamped verification outputs
TIMESTAMP=$(date -u +%Y-%m-%dT%H%M%SZ)

# Save successful enrollment tracking
curl -X POST "${API_URL}/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_pathway_enrolled",
    "contactIdentifier": {"email": "'${HUBSPOT_TEST_USERNAME}'"},
    "enrollment_source": "pathway_page",
    "pathway_slug": "verification-pathway",
    "payload": {"ts": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
  }' | jq '.' > "verification-output/issue-206/track-event-${TIMESTAMP}.json"

sleep 5

# Save enrollment list response
curl "${API_URL}/enrollments/list?email=${HUBSPOT_TEST_USERNAME}" | \
  jq '.' > "verification-output/issue-206/enrollments-list-${TIMESTAMP}.json"

# Save CloudWatch logs
aws logs tail /aws/lambda/hedgehog-learn-${APP_STAGE}-api --since 10m \
  > "verification-output/issue-206/cloudwatch-logs-${TIMESTAMP}.txt"
```

### Step 4: Verify CRM Contact Properties

```bash
# Use HubSpot API to check contact properties directly
AUTH_TOKEN="${HUBSPOT_PROJECT_ACCESS_TOKEN}"

curl -s -H "Authorization: Bearer ${AUTH_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/${HUBSPOT_TEST_USERNAME}?idProperty=email&properties=hhl_progress_state" | \
  jq '.properties.hhl_progress_state | fromjson' \
  > "verification-output/issue-206/crm-progress-state-${TIMESTAMP}.json"

# Verify enrollment_source is present
cat "verification-output/issue-206/crm-progress-state-${TIMESTAMP}.json" | \
  jq '."verification-pathway".enrollment_source'
# Expected: "pathway_page"
```

### Step 5: Monitor CloudWatch Logs

```bash
# Tail logs in real-time
aws logs tail /aws/lambda/hedgehog-learn-${APP_STAGE}-api --follow

# Look for:
# - "Track event (persisted via properties) learning_pathway_enrolled"
# - "listEnrollments: Found X pathway enrollments, Y course enrollments"
# - No error messages
```

## Rollback Procedure

If issues are encountered:

### Option 1: Rollback Lambda Function

```bash
# List recent deployments
serverless deploy list

# Rollback to previous version
serverless rollback --timestamp <timestamp>
```

### Option 2: Disable CRM Progress

```bash
# Temporarily disable CRM progress tracking
aws lambda update-function-configuration \
  --function-name hedgehog-learn-${APP_STAGE}-api \
  --environment "Variables={ENABLE_CRM_PROGRESS=false,...}"
```

### Option 3: Remove Deployment

```bash
# Complete removal (use with caution)
serverless remove
```

## Troubleshooting

### Issue: 401 "CRM progress not enabled"

**Cause:** `ENABLE_CRM_PROGRESS` environment variable not set to "true"

**Fix:**
```bash
# Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name hedgehog-learn-${APP_STAGE}-api \
  --environment "Variables={ENABLE_CRM_PROGRESS=true,...}"
```

### Issue: 404 "Contact not found"

**Cause:** Test email doesn't exist in HubSpot CRM

**Fix:**
1. Verify contact exists: Go to HubSpot Contacts
2. Or create test contact via API:
```bash
curl -X POST "https://api.hubapi.com/crm/v3/objects/contacts" \
  -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "properties": {
      "email": "'${HUBSPOT_TEST_USERNAME}'",
      "firstname": "Test",
      "lastname": "User"
    }
  }'
```

### Issue: enrollment_source shows as null

**Cause:** Frontend not sending enrollment_source field

**Fix:**
1. Verify enrollment.js is deployed to HubSpot
2. Check browser console for errors
3. Verify constants.json has correct TRACK_EVENTS_URL
4. Test manually with curl to confirm backend works

### Issue: Build fails with TypeScript errors

**Cause:** Type mismatch or syntax error

**Fix:**
```bash
# Check specific errors
npm run build 2>&1 | grep error

# Verify types.ts matches lambda usage
grep -A 5 "TrackEventInput" src/shared/types.ts
grep -A 5 "enrollment_source" src/api/lambda/index.ts
```

## Success Criteria

- [x] Build succeeds with no errors
- [ ] Deployment completes successfully
- [ ] All 3 integration tests pass
- [ ] `/enrollments/list` returns proper structure
- [ ] Enrollment with `enrollment_source` persists to CRM
- [ ] CloudWatch logs show no errors
- [ ] CRM contact properties contain `enrollment_source`
- [ ] Backward compatibility verified (old format still works)

## Post-Deployment Actions

1. **Update Issue #206** with verification results
2. **Attach verification outputs** from verification-output/issue-206/
3. **Document any issues encountered** and resolutions
4. **Monitor for 24 hours** for any Lambda errors or throttles
5. **Close issue** after successful verification

## Related Documentation

- Implementation Summary: `verification-output/issue-206/IMPLEMENTATION-SUMMARY.md`
- Sample curl commands: `verification-output/issue-206/sample-curl-commands.sh`
- Integration tests: `tests/test-enrollments-api.sh`
- Issue #181: Rehydrate Runbook
- Issue #191: Agent Training Guide for HubSpot Project Apps
