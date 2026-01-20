# Rollback Procedures: External SSO + Progress Store

**Feature:** Issue #299 - External SSO + Progress Store
**Date Prepared:** 2026-01-19
**RTO (Recovery Time Objective):** < 15 minutes
**RPO (Recovery Point Objective):** 0 (no data loss with DynamoDB PITR)
**Prepared By:** Agent A (Project Lead)

---

## Overview

This document provides step-by-step rollback procedures for the External SSO + Progress Store deployment. The rollback strategy depends on which phase of the deployment is affected.

### Deployment Phases

1. **Phase A:** Backend Infrastructure (Lambda, DynamoDB, Cognito)
2. **Phase B:** Frontend Integration (HubSpot CMS + API proxy)

### Rollback Scenarios

- **Scenario 1:** Rollback Frontend Only (keep backend)
- **Scenario 2:** Rollback Both Frontend and Backend
- **Scenario 3:** Emergency Rollback (critical production issue)
- **Scenario 4:** Data Recovery (DynamoDB PITR)

---

## Prerequisites

### Required Access

- [x] AWS Console access (with CloudFormation, Lambda, DynamoDB permissions)
- [x] AWS CLI configured with production credentials
- [x] HubSpot CMS access (for frontend rollback)
- [x] GitHub repository access (for code rollback)
- [x] Serverless Framework CLI installed

### Required Information

- **Previous CloudFormation Stack Version:** (record before deployment)
- **Previous Lambda Function Version:** (record before deployment)
- **Previous Git Commit Hash:** (tag before deployment)
- **Backup URLs:** (if API proxy is changed)

---

## Scenario 1: Rollback Frontend Only

**When to Use:** Frontend CMS integration causing issues, but backend API is healthy

**Impact:** Users will lose access to login/enrollment features, but public content remains accessible

**RTO:** 5-10 minutes

### Steps

#### 1.1 Revert HubSpot CMS Templates

```bash
# Navigate to project directory
cd /home/ubuntu/afewell-hh/hh-learn

# Get previous template version
git log --oneline clean-x-hedgehog-templates/ | head -5

# Checkout previous version
git checkout <PREVIOUS_COMMIT_HASH> -- clean-x-hedgehog-templates/
```

#### 1.2 Remove Cognito Auth Script from CMS

**Option A: Via HubSpot CLI**

```bash
# Delete the auth integration script
hs delete /learn/assets/js/cognito-auth-integration.js

# Or replace with stub/noop version
hs upload clean-x-hedgehog-templates/assets/js/auth-stub.js \
  /learn/assets/js/cognito-auth-integration.js
```

**Option B: Via HubSpot UI**

1. Log into HubSpot CMS
2. Navigate to Design Tools → Files
3. Find `/learn/assets/js/cognito-auth-integration.js`
4. Delete or replace with previous version

#### 1.3 Revert constants.json

```bash
# Restore previous constants.json (without auth URLs)
git checkout <PREVIOUS_COMMIT_HASH> -- clean-x-hedgehog-templates/config/constants.json

# Upload to HubSpot
npm run provision:constants
```

#### 1.4 Revert Template Updates

```bash
# Remove auth script tag from templates
# Edit affected templates to remove:
# <script src="/learn/assets/js/cognito-auth-integration.js"></script>

# Publish updated templates
npm run publish:template
```

#### 1.5 Verify Frontend Rollback

- [ ] Visit course page: https://hedgehog.cloud/learn/courses/course-authoring-101
- [ ] Confirm no JavaScript errors in browser console
- [ ] Verify enrollment CTA shows previous behavior (or hidden)
- [ ] Check no broken API calls in Network tab

**Expected State After Frontend Rollback:**
- ✅ Public course content accessible
- ✅ No JavaScript errors
- ⚠️ Login/enrollment features unavailable
- ✅ Backend API still running (not affecting users)

---

## Scenario 2: Rollback Backend Infrastructure

**When to Use:** Backend API causing errors, DynamoDB issues, or Lambda failures

**Impact:** Complete loss of auth functionality, but can preserve user data

**RTO:** 10-15 minutes

### 2.1 Determine Rollback Scope

**Option A: Rollback Lambda Function Only** (fastest, if only code issue)

**Option B: Rollback Entire CloudFormation Stack** (slower, if infrastructure issue)

### Option A: Rollback Lambda Function Only

#### 2.1.A Update Lambda to Previous Version

```bash
# List recent Lambda versions
aws lambda list-versions-by-function \
  --function-name hedgehog-learn-prod-api \
  --region us-west-2 \
  --max-items 10

# Identify previous working version (e.g., version 27)
PREVIOUS_VERSION=27

# Update alias to point to previous version
aws lambda update-alias \
  --function-name hedgehog-learn-prod-api \
  --name PROD \
  --function-version $PREVIOUS_VERSION \
  --region us-west-2
```

#### 2.1.B Verify Lambda Rollback

```bash
# Test rolled-back endpoint
curl -i https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/me

# Expected: 401 (or previous expected behavior)
# Should NOT return 5xx errors
```

### Option B: Rollback Entire CloudFormation Stack

#### 2.2.A Identify Previous Stack Version

```bash
# List CloudFormation stack events
aws cloudformation describe-stack-events \
  --stack-name hedgehog-learn-prod \
  --region us-west-2 \
  --max-items 50 \
  --query "StackEvents[?ResourceStatus=='UPDATE_COMPLETE'].{Time:Timestamp,Status:ResourceStatus}" \
  --output table

# Record the timestamp of the last known good deployment
```

#### 2.2.B Rollback Stack via Git + Serverless

```bash
# Get previous git commit hash (from before deployment)
git log --oneline | head -10

# Checkout previous version
git checkout <PREVIOUS_COMMIT_HASH>

# Ensure environment variables are set
export APP_STAGE=prod
export AWS_REGION=us-west-2

# Rebuild with previous code
npm run build

# Deploy previous version
npm run deploy:aws
```

#### 2.2.C Monitor Rollback Deployment

```bash
# Watch CloudFormation stack update
aws cloudformation describe-stacks \
  --stack-name hedgehog-learn-prod \
  --region us-west-2 \
  --query "Stacks[0].StackStatus" \
  --output text

# Wait for UPDATE_COMPLETE (usually 5-10 minutes)

# If stack rollback fails, use AWS Console to:
# 1. Go to CloudFormation console
# 2. Select hedgehog-learn-prod stack
# 3. Click "Stack actions" → "Rollback"
```

#### 2.2.D Verify Backend Rollback

```bash
# Test all critical endpoints
curl -i https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/login
curl -i https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/me
curl -i https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/callback

# Check CloudWatch alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix hedgehog-learn-prod \
  --region us-west-2 \
  --query "MetricAlarms[?StateValue=='ALARM'].AlarmName"

# All alarms should be OK (empty array)
```

---

## Scenario 3: Emergency Rollback (Critical Production Issue)

**When to Use:** Immediate user impact, service outage, or data integrity issues

**RTO:** 5 minutes

**Priority:** Stop the bleeding first, investigate later

### 3.1 Immediate Actions (First 5 Minutes)

#### Step 1: Disable Frontend Integration (fastest)

```bash
# Quick: Remove auth script from HubSpot CMS
hs delete /learn/assets/js/cognito-auth-integration.js

# Or replace with noop function
echo "window.hhIdentity = { ready: Promise.resolve({ authenticated: false }) };" > /tmp/stub.js
hs upload /tmp/stub.js /learn/assets/js/cognito-auth-integration.js
```

**Impact:** Disables login/enrollment, but preserves public content access

#### Step 2: Verify Users Can Access Public Content

- [ ] Visit: https://hedgehog.cloud/learn
- [ ] Confirm catalog page loads
- [ ] Confirm course pages load (without enrollment CTAs)

### 3.2 Rollback Backend (Next 10 Minutes)

```bash
# Option 1: Disable API Gateway (if Lambda is failing)
aws lambda update-function-configuration \
  --function-name hedgehog-learn-prod-api \
  --environment "Variables={DISABLE_AUTH=true}" \
  --region us-west-2

# Option 2: Rollback Lambda to previous version (see Scenario 2)
```

### 3.3 Communication

**Immediately:**
1. Post incident status to #hedgehog-learn-alerts Slack channel
2. Update status page (if applicable): "Investigating authentication issues"
3. Notify stakeholders via email

**Sample Incident Message:**

```
INCIDENT: Authentication feature experiencing issues
START TIME: <TIMESTAMP>
IMPACT: Users unable to log in or enroll in courses. Public content still accessible.
STATUS: Engineering team rolling back changes. ETA: 15 minutes.
UPDATES: Will post updates every 10 minutes.
```

### 3.4 Post-Incident Review

- [ ] Schedule post-mortem meeting (within 24 hours)
- [ ] Document root cause
- [ ] Create action items to prevent recurrence
- [ ] Update rollback procedures with learnings

---

## Scenario 4: Data Recovery (DynamoDB)

**When to Use:** Data corruption, accidental deletion, or integrity issues

**RTO:** 30-60 minutes (depending on data size)

**RPO:** Up to 5 minutes (DynamoDB Point-in-Time Recovery)

### 4.1 Identify Recovery Point

```bash
# Check available recovery points
aws dynamodb describe-continuous-backups \
  --table-name hedgehog-learn-prod-users \
  --region us-west-2

# Point-in-time recovery is available for last 35 days
```

### 4.2 Restore Table to Previous State

**Important:** This creates a NEW table; does NOT overwrite existing table

```bash
# Choose recovery time (e.g., 2026-01-19T04:00:00Z)
RECOVERY_TIME="2026-01-19T04:00:00Z"

# Restore users table
aws dynamodb restore-table-to-point-in-time \
  --source-table-name hedgehog-learn-prod-users \
  --target-table-name hedgehog-learn-prod-users-recovered \
  --restore-date-time $RECOVERY_TIME \
  --region us-west-2

# Repeat for other tables if needed
aws dynamodb restore-table-to-point-in-time \
  --source-table-name hedgehog-learn-prod-enrollments \
  --target-table-name hedgehog-learn-prod-enrollments-recovered \
  --restore-date-time $RECOVERY_TIME \
  --region us-west-2
```

### 4.3 Verify Recovered Data

```bash
# Scan recovered table (limit to 10 items for verification)
aws dynamodb scan \
  --table-name hedgehog-learn-prod-users-recovered \
  --region us-west-2 \
  --max-items 10

# Verify record count matches expectations
aws dynamodb describe-table \
  --table-name hedgehog-learn-prod-users-recovered \
  --region us-west-2 \
  --query "Table.ItemCount"
```

### 4.4 Swap Tables (If Recovery is Confirmed)

**Option A: Update Environment Variables to Use Recovered Table**

```bash
# Update Lambda environment variables
aws lambda update-function-configuration \
  --function-name hedgehog-learn-prod-api \
  --environment "Variables={
    DYNAMODB_USERS_TABLE=hedgehog-learn-prod-users-recovered,
    DYNAMODB_ENROLLMENTS_TABLE=hedgehog-learn-prod-enrollments-recovered,
    ...
  }" \
  --region us-west-2
```

**Option B: Rename Tables (requires downtime)**

```bash
# 1. Delete corrupted table (DANGEROUS - backup first!)
aws dynamodb delete-table \
  --table-name hedgehog-learn-prod-users \
  --region us-west-2

# 2. Wait for deletion to complete

# 3. Rename recovered table via AWS Console or re-deploy with correct name
```

---

## Rollback Decision Tree

```
┌─────────────────────────────────────┐
│     Is the issue in Frontend?      │
│   (CMS, templates, JS errors)      │
└────────────┬────────────────────────┘
             │
             ├─── YES → Scenario 1: Rollback Frontend Only
             │
             └─── NO
                  │
                  ▼
         ┌────────────────────────────┐
         │  Is the issue in Backend?  │
         │  (Lambda, API, DynamoDB)   │
         └────────┬───────────────────┘
                  │
                  ├─── YES → Is it a critical outage?
                  │          │
                  │          ├─── YES → Scenario 3: Emergency Rollback
                  │          │
                  │          └─── NO → Scenario 2: Rollback Backend
                  │
                  └─── NO
                       │
                       ▼
              ┌────────────────────────┐
              │  Is it data corruption?│
              │   (DynamoDB issues)     │
              └────────┬───────────────┘
                       │
                       ├─── YES → Scenario 4: Data Recovery (PITR)
                       │
                       └─── NO → Investigate further before rollback
```

---

## Post-Rollback Verification Checklist

### After Any Rollback

- [ ] All CloudWatch alarms in OK state
- [ ] Public course content accessible
- [ ] No JavaScript errors in browser console
- [ ] No 5xx errors in CloudWatch logs (last 10 minutes)
- [ ] API Gateway health check passing (if applicable)

### After Frontend Rollback

- [ ] Templates loading correctly
- [ ] Previous enrollment flow working (if applicable)
- [ ] No broken CSS or images

### After Backend Rollback

- [ ] Lambda function responding < 1s
- [ ] DynamoDB tables accessible
- [ ] Cognito auth flow working (if preserved)
- [ ] Previous API version responding correctly

### After Data Recovery

- [ ] Recovered table has expected record count
- [ ] Sample records match expected schema
- [ ] No data loss confirmed by stakeholders

---

## Rollback Log Template

**Use this template to document each rollback:**

```markdown
## Rollback Incident Log

**Date:** 2026-XX-XX
**Time Started:** XX:XX UTC
**Triggered By:** [Name]
**Reason:** [Brief description of issue]
**Scenario Used:** [1, 2, 3, or 4]

### Actions Taken

1. [Timestamp] - [Action description]
2. [Timestamp] - [Action description]
3. ...

### Verification

- [ ] CloudWatch alarms OK
- [ ] Public content accessible
- [ ] API responding correctly
- [ ] User feedback channels normal

### Outcome

**Time Completed:** XX:XX UTC
**Total Duration:** XX minutes
**Impact:** [Description of user impact]
**Root Cause:** [To be determined in post-mortem]

### Follow-Up Actions

- [ ] Schedule post-mortem meeting
- [ ] Document root cause
- [ ] Update runbooks
- [ ] Create prevention action items
```

---

## Prevention & Mitigation

### Pre-Deployment Safeguards

1. **Canary Deployments:** Test new Lambda version with 5% traffic first
2. **Blue-Green Deployment:** Maintain two environments, switch DNS
3. **Feature Flags:** Disable new features via environment variable
4. **Comprehensive Testing:** Run full E2E suite before production deploy

### Monitoring & Alerts

1. **Proactive Alarms:** Set thresholds below critical levels
2. **Log Aggregation:** Centralize logs for faster troubleshooting
3. **Synthetic Monitoring:** Automated health checks every 5 minutes
4. **User Monitoring:** Track frontend JavaScript errors (e.g., Sentry)

### Rollback Automation

**Future Improvement:** Create rollback script

```bash
#!/bin/bash
# rollback.sh

COMPONENT=$1  # "frontend", "backend", or "all"

case $COMPONENT in
  frontend)
    echo "Rolling back frontend..."
    hs delete /learn/assets/js/cognito-auth-integration.js
    echo "Frontend rollback complete"
    ;;
  backend)
    echo "Rolling back backend to previous Lambda version..."
    # Add Lambda rollback logic
    ;;
  all)
    echo "Rolling back all components..."
    # Add combined rollback logic
    ;;
  *)
    echo "Usage: ./rollback.sh [frontend|backend|all]"
    exit 1
    ;;
esac
```

---

## Emergency Contacts

### During Rollback

- **Project Lead:** Agent A
- **Backend Engineer:** (TBD)
- **DevOps:** (TBD)
- **AWS Support:** 1-800-XXX-XXXX (Enterprise Support)

### Escalation Path

1. **L1:** Project Lead (try for 10 minutes)
2. **L2:** Engineering Manager (if no resolution)
3. **L3:** CTO (for critical production issues)
4. **L4:** AWS Support (for AWS infrastructure issues)

---

## Appendix A: Common Rollback Commands

### Lambda

```bash
# List Lambda versions
aws lambda list-versions-by-function \
  --function-name hedgehog-learn-prod-api \
  --region us-west-2

# Update alias to previous version
aws lambda update-alias \
  --function-name hedgehog-learn-prod-api \
  --name PROD \
  --function-version <VERSION_NUMBER> \
  --region us-west-2
```

### CloudFormation

```bash
# Rollback stack
aws cloudformation rollback-stack \
  --stack-name hedgehog-learn-prod \
  --region us-west-2

# Cancel in-progress update
aws cloudformation cancel-update-stack \
  --stack-name hedgehog-learn-prod \
  --region us-west-2
```

### DynamoDB

```bash
# Restore table
aws dynamodb restore-table-to-point-in-time \
  --source-table-name <SOURCE_TABLE> \
  --target-table-name <TARGET_TABLE> \
  --restore-date-time <ISO_8601_TIMESTAMP> \
  --region us-west-2
```

---

## Appendix B: Rollback Testing

**Test rollback procedures in staging environment quarterly:**

1. Deploy latest code to staging
2. Simulate failure scenario
3. Execute rollback following this document
4. Verify recovery within RTO
5. Document any gaps or improvements

**Next Rollback Drill:** (Schedule quarterly)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Next Review:** After first production deployment
**Maintained By:** HH Learn DevOps Team
