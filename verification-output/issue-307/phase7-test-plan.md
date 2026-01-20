# Phase 7: Test Execution + Rollout Checklist

**Issue:** #307
**Date:** 2026-01-19
**Phase:** External SSO Test Execution & Production Rollout
**Parent Issue:** [#299 - External SSO + Progress Store](https://github.com/afewell-hh/hh-learn/issues/299)
**Environment:** AWS us-west-2, Stage: dev
**Tester:** Agent A (Project Lead)

## Overview

Phase 7 is the final validation phase before production rollout of the External SSO + Progress Store feature. This phase executes comprehensive testing across all integration points and prepares production deployment artifacts.

## Test Environment

- **AWS Region:** us-west-2
- **Stage:** dev
- **Cognito User Pool:** us-west-2_XWB9UclRK
- **Cognito Client:** 2um886mpdk65cbbb6pgsvqkchf
- **Cognito Domain:** hedgehog-learn.auth.us-west-2.amazoncognito.com
- **Production URL:** https://hedgehog.cloud
- **Test User:** afewell@gmail.com

## Testing Scope

### 1. Playwright E2E Test Suite ✅

**Objective:** Validate complete user flows from frontend to backend

**Test Files:**
- `tests/e2e/cognito-frontend-ux.spec.ts` - Frontend auth integration (14 tests)
- `tests/e2e/auth.spec.ts` - Auth flow validation
- `tests/e2e/enrollment-flow.spec.ts` - Enrollment UX
- `tests/e2e/enrollment-cta.spec.ts` - Enrollment CTAs
- `tests/e2e/cognito-auth-flow.spec.ts` - Cognito OAuth flow
- `tests/e2e/auth-redirect.spec.ts` - Auth redirects
- `tests/e2e/login-and-track.spec.ts` - Login + progress tracking
- `tests/e2e/native-login-flow.spec.ts` - Native login UI

**Expected Coverage:**
- Anonymous browsing (public content)
- Sign-in CTA display
- OAuth login flow (Google/GitHub/Email)
- Callback handling + cookie setup
- Authenticated state rendering
- Enrollment creation/deletion
- Progress tracking
- Logout flow
- Cookie security validation

**Command:**
```bash
npm run test:e2e
```

**Success Criteria:**
- All tests pass (0 failures)
- No timeout errors
- Screenshots/traces captured for any failures

---

### 2. API Smoke Tests ✅

**Objective:** Verify backend Lambda endpoints respond correctly

**Test Files:**
- `tests/api/auth-endpoints-negative.spec.ts` - Auth error cases
- `tests/api/auth-me.spec.ts` - /auth/me endpoint
- `tests/api/membership-smoke.spec.ts` - Membership API

**Endpoints to Test:**
- `GET /auth/login` - Initiates OAuth flow
- `GET /auth/callback` - Handles OAuth callback
- `GET /auth/me` - Returns authenticated user profile
- `POST /auth/logout` - Clears session cookies
- `GET /enrollments/list` - Returns user enrollments
- `GET /progress/read` - Returns user progress
- `POST /events/track` - Tracks user events

**Expected Behavior:**
- `/auth/login` → 302 redirect to Cognito
- `/auth/callback` → 302 redirect with cookies set
- `/auth/me` (authenticated) → 200 with user profile
- `/auth/me` (unauthenticated) → 401
- `/auth/logout` → 302 with cookies cleared

**Command:**
```bash
npx playwright test tests/api/ --reporter=list
```

**Success Criteria:**
- All API tests pass
- Response times < 1000ms (p95)
- Proper error codes for invalid requests

---

### 3. CloudWatch Logs & Alarms Verification ✅

**Objective:** Ensure observability infrastructure is functional

**Log Groups:**
- `/aws/lambda/hedgehog-learn-dev-api` - Lambda function logs

**Alarms to Verify:**
- `hedgehog-learn-dev-lambda-errors` - Lambda errors > 5/min
- `hedgehog-learn-dev-lambda-throttles` - Lambda throttles detected
- `hedgehog-learn-dev-httpapi-5xx` - API Gateway 5xx > 5/min
- `hedgehog-learn-dev-httpapi-latency` - Avg latency > 1s over 5min
- `hedgehog-learn-dev-api-red` - Composite alarm (any alarm triggered)

**Verification Steps:**
1. Verify log group exists and has retention policy (30 days)
2. Confirm recent log entries from auth/API calls
3. Check all alarms are in OK state
4. Verify alarm configurations match serverless.yml

**AWS CLI Commands:**
```bash
# List log groups
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/hedgehog-learn-dev --region us-west-2

# Check recent logs
aws logs tail /aws/lambda/hedgehog-learn-dev-api --region us-west-2 --since 1h

# List alarms
aws cloudwatch describe-alarms --alarm-name-prefix hedgehog-learn-dev --region us-west-2
```

**Success Criteria:**
- Log group exists with 30-day retention
- Recent successful auth/API requests logged
- All alarms in OK state
- No ERROR level logs in recent entries

---

### 4. DynamoDB Table Verification ✅

**Objective:** Validate DynamoDB writes for enrollments and progress

**Tables:**
- `hedgehog-learn-users-dev` - User profiles
- `hedgehog-learn-enrollments-dev` - Course enrollments
- `hedgehog-learn-progress-dev` - Module progress tracking
- `hedgehog-learn-badges-dev` - Achievement badges

**Verification Steps:**
1. Verify all tables exist with correct schema
2. Confirm tables have DynamoDB Streams enabled
3. Check Point-in-Time Recovery enabled
4. Verify encryption at rest (SSE)
5. Query sample data for test user
6. Validate GSI indexes on Users/Enrollments tables

**AWS CLI Commands:**
```bash
# Describe Users table
aws dynamodb describe-table --table-name hedgehog-learn-users-dev --region us-west-2

# Query test user profile
aws dynamodb query \
  --table-name hedgehog-learn-users-dev \
  --key-condition-expression "PK = :pk AND SK = :sk" \
  --expression-attribute-values '{":pk":{"S":"USER#<cognito-sub>"},":sk":{"S":"PROFILE"}}' \
  --region us-west-2

# List enrollments for test user
aws dynamodb query \
  --table-name hedgehog-learn-enrollments-dev \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"USER#<user-id>"}}' \
  --region us-west-2
```

**Test Scenario:**
1. Login as test user via Playwright
2. Enroll in a test course
3. Complete a module
4. Query DynamoDB to verify:
   - User record created
   - Enrollment record created
   - Progress record updated
   - Timestamps match user actions

**Success Criteria:**
- All 4 tables exist and accessible
- Streams, PITR, and SSE enabled
- Test user data successfully written
- GSI indexes functional

---

### 5. HubSpot CRM Sync Verification ✅

**Objective:** Verify enrollment/progress milestones sync to HubSpot CRM

**CRM Properties to Check:**
- `hs_contact_id` - HubSpot contact ID
- `first_enrollment_date` - Date of first course enrollment
- `total_enrollments` - Total courses enrolled
- `courses_completed` - Total courses completed
- `last_activity_date` - Last learning activity timestamp

**Verification Steps:**
1. Identify test user contact in HubSpot CRM by email
2. Enroll test user in a course via Playwright
3. Wait for CRM sync (check Lambda logs for sync events)
4. Query HubSpot API to verify properties updated
5. Complete a module and verify completion milestone synced

**HubSpot API Query:**
```bash
# Get contact by email
curl -X POST \
  https://api.hubapi.com/crm/v3/objects/contacts/search \
  -H "Authorization: Bearer $HUBSPOT_PRIVATE_APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filterGroups": [{
      "filters": [{
        "propertyName": "email",
        "operator": "EQ",
        "value": "afewell@gmail.com"
      }]
    }],
    "properties": ["email", "first_enrollment_date", "total_enrollments", "courses_completed"]
  }'
```

**Success Criteria:**
- Contact found in HubSpot CRM
- Enrollment triggers CRM property update
- Completion triggers CRM property update
- Sync latency < 5 minutes (async acceptable)
- Lambda logs show successful CRM sync calls

---

### 6. Rollout Checklist Preparation ✅

**Objective:** Create production deployment checklist with rollback plan

**Checklist Components:**
1. Pre-deployment verification
2. Deployment steps (sequenced)
3. Post-deployment validation
4. Monitoring setup
5. Rollback procedures
6. Communication plan

**Deliverable:** `verification-output/issue-307/rollout-checklist.md`

---

## Test Execution Schedule

1. **Environment Verification** - Validate AWS deployment status
2. **Playwright E2E Suite** - Run all E2E tests
3. **API Smoke Tests** - Validate backend endpoints
4. **CloudWatch Verification** - Check logs and alarms
5. **DynamoDB Verification** - Validate data writes
6. **CRM Sync Verification** - Test HubSpot integration
7. **Documentation** - Prepare rollout artifacts

---

## Success Criteria Summary

- ✅ All Playwright E2E tests pass (100% success rate)
- ✅ All API smoke tests pass (100% success rate)
- ✅ CloudWatch logs show successful requests (no errors)
- ✅ All CloudWatch alarms in OK state
- ✅ DynamoDB tables functional with test data
- ✅ HubSpot CRM sync working for test user
- ✅ Rollout checklist approved by project lead

---

## Risk Assessment

**High Risk Areas:**
- Cognito OAuth flow (external dependency)
- Cookie-based auth (browser compatibility)
- CRM sync async timing (eventual consistency)

**Mitigation:**
- Comprehensive E2E tests covering error paths
- Cookie security validation in Playwright
- CRM sync retry logic with exponential backoff

---

## Timeline

**Estimated Duration:** 4-7 days
- E2E + API tests: 2-3 days
- Observability checks: 1 day
- Rollout prep: 1-2 days
- Contingency: 1 day

**Actual Start:** 2026-01-19

---

## References

- [Phase 6 Frontend Integration](../../docs/issue-306-phase6-frontend-integration.md)
- [Issue #299 - Parent Issue](https://github.com/afewell-hh/hh-learn/issues/299)
- [Cognito Setup](../../docs/cognito-setup-issue-301.md)
- [DynamoDB Schema](../../docs/dynamodb-schema.md)
- [Deployment Guide](../../docs/issue-305-deployment-guide.md)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Maintained By:** HH Learn Development Team
