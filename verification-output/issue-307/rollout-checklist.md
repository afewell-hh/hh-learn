# Production Rollout Checklist: External SSO + Progress Store

**Feature:** Issue #299 - External SSO + Progress Store (Cognito + DynamoDB)
**Date Prepared:** 2026-01-19
**Deployment Type:** Phased rollout with backend-first approach
**Prepared By:** Agent A (Project Lead)

---

## Overview

This checklist guides the production rollout of the External SSO + Progress Store feature. The rollout is divided into two phases:

1. **Phase A: Backend Infrastructure** (AWS Lambda, DynamoDB, Cognito)
2. **Phase B: Frontend Integration** (HubSpot CMS deployment + API proxy)

---

## Pre-Deployment Prerequisites

### Backend Verification ✅

- [x] Lambda function deployed to AWS
- [x] DynamoDB tables created (users, enrollments, progress, badges)
- [x] Cognito user pool and app client configured
- [x] CloudWatch alarms configured and in OK state
- [x] API Gateway endpoints tested with curl
- [x] OAuth flow verified (PKCE parameters generated)
- [x] Environment variables configured in `.env` and GitHub Secrets

### Frontend Prerequisites ⚠️ PENDING

- [ ] `cognito-auth-integration.js` uploaded to HubSpot CMS
- [ ] Templates updated to load Cognito auth script
- [ ] `constants.json` updated with auth endpoint URLs
- [ ] API proxy configured (hedgehog.cloud → API Gateway)
- [ ] CORS configured for hedgehog.cloud origin
- [ ] Full E2E test suite passing
- [ ] CRM sync verified with test user

### Documentation & Communication

- [x] Rollout plan documented (this checklist)
- [x] Rollback procedures documented (`rollback-procedures.md`)
- [x] Test results summary created
- [ ] Stakeholders notified of deployment schedule
- [ ] Support team briefed on new auth flow
- [ ] Monitoring dashboard URL shared with team

---

## Phase A: Backend Infrastructure Deployment

### 1. Pre-Deployment Checks

**Time Estimate:** 30 minutes

- [ ] Review CloudFormation stack changes
  ```bash
  aws cloudformation describe-stack-drift-detection-status \
    --stack-name hedgehog-learn-dev \
    --region us-west-2
  ```

- [ ] Verify no drift in infrastructure
  ```bash
  aws cloudformation detect-stack-drift \
    --stack-name hedgehog-learn-dev \
    --region us-west-2
  ```

- [ ] Check AWS service health (us-west-2)
  - Lambda: https://health.aws.amazon.com/health/status
  - DynamoDB: https://health.aws.amazon.com/health/status
  - Cognito: https://health.aws.amazon.com/health/status

- [ ] Backup existing production data (if applicable)
  ```bash
  # Point-in-time recovery is enabled, but verify PITR status
  aws dynamodb describe-continuous-backups \
    --table-name hedgehog-learn-prod-users \
    --region us-west-2
  ```

- [ ] Tag production deployment
  ```bash
  git tag -a v1.0.0-external-sso -m "External SSO + Progress Store v1.0.0"
  git push origin v1.0.0-external-sso
  ```

### 2. Backend Deployment

**Time Estimate:** 15-20 minutes

- [ ] Switch to production environment
  ```bash
  export APP_STAGE=prod
  export AWS_REGION=us-west-2
  ```

- [ ] Build Lambda package
  ```bash
  npm run build
  ```

- [ ] Deploy via Serverless Framework
  ```bash
  npm run deploy:aws
  ```

- [ ] Verify deployment success
  ```bash
  aws cloudformation describe-stacks \
    --stack-name hedgehog-learn-prod \
    --region us-west-2 \
    --query "Stacks[0].StackStatus"
  ```

- [ ] Expected output: `UPDATE_COMPLETE` or `CREATE_COMPLETE`

### 3. Post-Deployment Backend Verification

**Time Estimate:** 20 minutes

- [ ] Get API Gateway URL
  ```bash
  aws cloudformation describe-stacks \
    --stack-name hedgehog-learn-prod \
    --region us-west-2 \
    --query "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue" \
    --output text
  ```

- [ ] Test `/auth/login` endpoint
  ```bash
  curl -i <API_GATEWAY_URL>/auth/login
  # Expected: 302 redirect to Cognito
  ```

- [ ] Test `/auth/me` endpoint (unauthenticated)
  ```bash
  curl -i <API_GATEWAY_URL>/auth/me
  # Expected: 401 with error JSON
  ```

- [ ] Verify CloudWatch alarms created
  ```bash
  aws cloudwatch describe-alarms \
    --alarm-name-prefix hedgehog-learn-prod \
    --region us-west-2 \
    --query "MetricAlarms[*].{Name:AlarmName,State:StateValue}"
  ```

- [ ] All alarms should be in `OK` state

- [ ] Verify DynamoDB tables exist
  ```bash
  aws dynamodb list-tables --region us-west-2 \
    | grep hedgehog-learn-prod
  ```

- [ ] Expected tables:
  - `hedgehog-learn-prod-users`
  - `hedgehog-learn-prod-enrollments`
  - `hedgehog-learn-prod-progress`
  - `hedgehog-learn-prod-badges`

- [ ] Verify CloudWatch Logs retention
  ```bash
  aws logs describe-log-groups \
    --log-group-name-prefix /aws/lambda/hedgehog-learn-prod \
    --region us-west-2 \
    --query "logGroups[*].{Name:logGroupName,Retention:retentionInDays}"
  ```

- [ ] Expected: 30 days retention

**Backend Phase A Complete:** ✅

**Decision Point:**
- If all checks pass → Proceed to Phase B (Frontend Integration)
- If any checks fail → Execute rollback (see `rollback-procedures.md`)

---

## Phase B: Frontend Integration Deployment

### 4. API Proxy Configuration

**Time Estimate:** 45-60 minutes

**Option A: CloudFront Distribution**

- [ ] Create CloudFront distribution
  - Origin: API Gateway endpoint
  - Alternate domain: api.hedgehog.cloud
  - SSL certificate: *.hedgehog.cloud (ACM)
  - Cache policy: Disabled for auth endpoints

- [ ] Configure origin request policy
  - Forward all headers: Yes
  - Forward cookies: Yes (required for auth)
  - Forward query strings: Yes

- [ ] Update DNS (Route 53)
  ```
  api.hedgehog.cloud CNAME → CloudFront distribution domain
  ```

- [ ] Verify DNS propagation
  ```bash
  dig api.hedgehog.cloud
  ```

**Option B: HubSpot Proxy (if available)**

- [ ] Configure HubSpot proxy rules
  - Rule: `/auth/*` → API Gateway URL
  - Forward cookies: Yes
  - HTTPS only: Yes

- [ ] Test proxy with curl
  ```bash
  curl -i https://hedgehog.cloud/auth/login
  # Expected: 302 redirect to Cognito
  ```

### 5. HubSpot CMS Deployment

**Time Estimate:** 30-45 minutes

- [ ] Upload `cognito-auth-integration.js` to CMS
  ```bash
  hs upload clean-x-hedgehog-templates/assets/js/cognito-auth-integration.js \
    /learn/assets/js/cognito-auth-integration.js
  ```

- [ ] Update `constants.json` with auth URLs
  ```json
  {
    "AUTH_ME_URL": "https://hedgehog.cloud/auth/me",
    "AUTH_LOGIN_URL": "https://hedgehog.cloud/auth/login",
    "AUTH_LOGOUT_URL": "https://hedgehog.cloud/auth/logout",
    "AUTH_CALLBACK_URL": "https://hedgehog.cloud/auth/callback"
  }
  ```

- [ ] Upload updated constants.json
  ```bash
  npm run provision:constants
  ```

- [ ] Update templates to load Cognito auth script
  - Add `<script src="/learn/assets/js/cognito-auth-integration.js"></script>`
  - Verify script loads before enrollment/progress scripts

- [ ] Publish template changes
  ```bash
  npm run publish:template
  ```

### 6. Post-Deployment Frontend Verification

**Time Estimate:** 30-45 minutes

#### Manual Testing

- [ ] Open course page as anonymous user
  - URL: https://hedgehog.cloud/learn/courses/course-authoring-101
  - Expected: "Sign in to enroll" CTA visible

- [ ] Click "Sign in" CTA
  - Expected: Redirect to Cognito Hosted UI
  - URL should be: `hedgehog-learn.auth.us-west-2.amazoncognito.com`

- [ ] Complete login (use test account)
  - Email: `${HUBSPOT_TEST_EMAIL}`
  - Password: `${HUBSPOT_TEST_PASSWORD}`

- [ ] Verify callback redirect
  - Expected: Redirect back to course page
  - CTA should change to "Enroll" or "Enrolled"

- [ ] Check browser cookies (DevTools)
  - `hhl_access_token` should exist
  - Attributes: httpOnly, Secure, SameSite=Strict

- [ ] Verify `/auth/me` API call (Network tab)
  - Request to `https://hedgehog.cloud/auth/me`
  - Status: 200 OK
  - Response: JSON with `userId`, `email`, `displayName`

- [ ] Test logout
  - Click logout button
  - Expected: Cookies cleared, CTA reverts to "Sign in"

#### Automated E2E Tests

- [ ] Run Playwright E2E suite
  ```bash
  npm run test:e2e -- tests/e2e/cognito-frontend-ux.spec.ts
  ```

- [ ] Expected: All 13 tests pass

- [ ] Run API smoke tests
  ```bash
  npm run test:e2e -- tests/api/auth-me.spec.ts
  ```

- [ ] Expected: All 16 tests pass

### 7. CRM Sync Verification

**Time Estimate:** 15-20 minutes

- [ ] Find test user contact in HubSpot CRM
  ```bash
  curl -X POST https://api.hubapi.com/crm/v3/objects/contacts/search \
    -H "Authorization: Bearer $HUBSPOT_PRIVATE_APP_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "filterGroups": [{
        "filters": [{
          "propertyName": "email",
          "operator": "EQ",
          "value": "'$HUBSPOT_TEST_EMAIL'"
        }]
      }],
      "properties": ["email", "first_enrollment_date", "total_enrollments"]
    }' | jq
  ```

- [ ] Enroll test user in a course via UI

- [ ] Wait 5 minutes for CRM sync

- [ ] Verify CRM properties updated
  - `first_enrollment_date` should be set
  - `total_enrollments` should increment
  - `last_activity_date` should be recent

- [ ] Check Lambda logs for CRM sync events
  ```bash
  aws logs filter-log-events \
    --log-group-name /aws/lambda/hedgehog-learn-prod-api \
    --filter-pattern "CRM sync" \
    --region us-west-2 \
    --max-items 10
  ```

---

## Monitoring & Observability

### 8. Monitoring Setup

**Time Estimate:** 15 minutes

- [ ] Verify CloudWatch dashboard exists
  - Dashboard name: `hedgehog-learn-prod`
  - Widgets: Lambda invocations, errors, duration, DynamoDB metrics

- [ ] Set up alarm notifications (if not already configured)
  ```bash
  aws cloudwatch put-metric-alarm \
    --alarm-name hedgehog-learn-prod-lambda-errors \
    --alarm-actions arn:aws:sns:us-west-2:ACCOUNT_ID:alerts \
    --region us-west-2
  ```

- [ ] Subscribe to alarm SNS topic
  - Email: engineering@hedgehog.cloud
  - Slack: #hedgehog-learn-alerts (via SNS → Lambda → Slack)

- [ ] Test alarm (trigger intentional error)
  ```bash
  # Call /auth/me with intentionally invalid cookie
  curl -i https://hedgehog.cloud/auth/me \
    -H "Cookie: hhl_access_token=INVALID_TOKEN"

  # Check if error is logged (should not trigger alarm unless > threshold)
  ```

### 9. Post-Deployment Monitoring (First 24 Hours)

- [ ] Monitor CloudWatch metrics every 2 hours
  - Lambda invocations
  - Lambda errors
  - API Gateway 4xx/5xx rates
  - DynamoDB read/write capacity

- [ ] Check error logs
  ```bash
  aws logs tail /aws/lambda/hedgehog-learn-prod-api \
    --follow \
    --filter-pattern "ERROR" \
    --region us-west-2
  ```

- [ ] Monitor user feedback channels
  - Support email
  - Community forum
  - Social media mentions

---

## Rollback Decision Points

### Automatic Rollback Triggers

Execute rollback immediately if:

1. **Critical Alarm:** Any CloudWatch alarm in ALARM state for > 5 minutes
2. **Lambda Errors:** Error rate > 10% for 10 minutes
3. **API Gateway 5xx:** 5xx error rate > 5% for 5 minutes
4. **Auth Flow Broken:** Users unable to log in (> 5 support tickets in 30 minutes)

### Manual Rollback Triggers

Consider rollback if:

1. **CRM Sync Failing:** > 20% of enrollments not syncing to CRM
2. **Performance Degradation:** /auth/me latency > 2s (p95) for 15 minutes
3. **Cookie Issues:** Users reporting session persistence problems
4. **Data Integrity:** Enrollment or progress data inconsistencies

**Rollback Procedure:** See `rollback-procedures.md`

---

## Post-Deployment Tasks

### Immediate (Within 1 Hour)

- [ ] Update project documentation with production URLs
- [ ] Mark issue #307 as COMPLETE
- [ ] Close related issues (#301, #302, #303, #304, #305, #306)
- [ ] Post deployment announcement in team channel
- [ ] Update status page (if applicable)

### Within 24 Hours

- [ ] Review CloudWatch metrics and logs
- [ ] Analyze DynamoDB read/write patterns
- [ ] Check for any error patterns
- [ ] Conduct user acceptance testing (UAT) with stakeholders
- [ ] Document any observed issues or improvements

### Within 1 Week

- [ ] Conduct retrospective meeting
- [ ] Update runbooks with any learnings
- [ ] Plan Phase 2 features (if applicable)
- [ ] Optimize DynamoDB access patterns based on usage
- [ ] Review and adjust CloudWatch alarm thresholds

---

## Success Criteria

### Must Have (Go/No-Go)

- ✅ All CloudWatch alarms in OK state
- ✅ Lambda function responding < 1s (p95)
- ✅ OAuth flow completing successfully for test users
- ✅ DynamoDB writes successful for enrollments and progress
- ✅ CRM sync working (at least 90% success rate)
- ✅ No critical errors in CloudWatch logs

### Should Have

- ✅ E2E test suite 100% passing
- ✅ User session persists across page reloads
- ✅ Enrollment CTA updates immediately after auth
- ✅ Progress tracking updates in real-time

### Nice to Have

- API latency < 500ms (p95)
- CRM sync latency < 2 minutes
- Zero support tickets related to auth

---

## Emergency Contacts

### Technical Contacts

- **Project Lead:** Agent A
- **Backend Engineer:** (TBD)
- **Frontend Engineer:** (TBD)
- **DevOps:** (TBD)

### Escalation Path

1. **L1:** Project Lead (Agent A)
2. **L2:** CTO / Engineering Manager
3. **L3:** CEO (for critical production issues)

### Support Channels

- **Slack:** #hedgehog-learn-alerts
- **PagerDuty:** hedgehog-learn service
- **Email:** engineering@hedgehog.cloud
- **Phone:** (Emergency hotline TBD)

---

## Appendix A: Environment Variables

### Production Environment

```bash
AWS_REGION=us-west-2
APP_STAGE=prod

# Cognito
COGNITO_USER_POOL_ID=us-west-2_<PROD_POOL_ID>
COGNITO_CLIENT_ID=<PROD_CLIENT_ID>
COGNITO_DOMAIN=hedgehog-learn-prod.auth.us-west-2.amazoncognito.com
COGNITO_REDIRECT_URI=https://hedgehog.cloud/auth/callback
COGNITO_ISSUER=https://cognito-idp.us-west-2.amazonaws.com/us-west-2_<PROD_POOL_ID>

# DynamoDB
DYNAMODB_USERS_TABLE=hedgehog-learn-prod-users
DYNAMODB_ENROLLMENTS_TABLE=hedgehog-learn-prod-enrollments
DYNAMODB_PROGRESS_TABLE=hedgehog-learn-prod-progress
DYNAMODB_BADGES_TABLE=hedgehog-learn-prod-badges

# HubSpot
HUBSPOT_PRIVATE_APP_TOKEN=<PROD_TOKEN>
ENABLE_CRM_PROGRESS=true

# JWT
JWT_SECRET=<SECURE_RANDOM_STRING>
```

---

## Appendix B: Useful Commands

### Check Deployment Status

```bash
# CloudFormation stack status
aws cloudformation describe-stacks \
  --stack-name hedgehog-learn-prod \
  --region us-west-2

# Lambda function info
aws lambda get-function \
  --function-name hedgehog-learn-prod-api \
  --region us-west-2

# DynamoDB table info
aws dynamodb describe-table \
  --table-name hedgehog-learn-prod-users \
  --region us-west-2
```

### Monitor Logs

```bash
# Tail Lambda logs
aws logs tail /aws/lambda/hedgehog-learn-prod-api \
  --follow \
  --region us-west-2

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/hedgehog-learn-prod-api \
  --filter-pattern "ERROR" \
  --region us-west-2

# Get recent auth/me calls
aws logs filter-log-events \
  --log-group-name /aws/lambda/hedgehog-learn-prod-api \
  --filter-pattern "/auth/me" \
  --region us-west-2 \
  --max-items 50
```

### Test Endpoints

```bash
# Test login redirect
curl -i https://hedgehog.cloud/auth/login

# Test auth/me (should return 401)
curl -i https://hedgehog.cloud/auth/me

# Test with valid cookie (from browser)
curl -i https://hedgehog.cloud/auth/me \
  -H "Cookie: hhl_access_token=<TOKEN_FROM_BROWSER>"
```

---

**Checklist Version:** 1.0
**Last Updated:** 2026-01-19
**Next Review:** After production deployment
