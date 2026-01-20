# Backend Production Deployment - Quick Start Guide

**Date:** 2026-01-19
**Deployment:** External SSO Backend (Lambda, DynamoDB, Cognito, CloudWatch)
**Status:** ✅ Validated in dev, ready for production

---

## Pre-Flight Checklist

Before running deployment commands, verify:

- [ ] All Phase 7 verification complete ✅ (See `test-results-summary.md`)
- [ ] Rollout checklist reviewed ✅ (See `rollout-checklist.md`)
- [ ] Rollback procedures understood ✅ (See `rollback-procedures.md`)
- [ ] AWS credentials configured for production account
- [ ] Production environment variables ready
- [ ] Team notified of deployment window
- [ ] Monitoring dashboard prepared

---

## Production Environment Variables

**CRITICAL:** Verify these are set correctly in `.env` or CI/CD:

```bash
# AWS Configuration
export AWS_REGION=us-west-2
export APP_STAGE=prod

# Cognito (Production User Pool)
export COGNITO_USER_POOL_ID=us-west-2_<PROD_POOL_ID>
export COGNITO_CLIENT_ID=<PROD_CLIENT_ID>
export COGNITO_DOMAIN=hedgehog-learn-prod.auth.us-west-2.amazoncognito.com
export COGNITO_REDIRECT_URI=https://hedgehog.cloud/auth/callback
export COGNITO_ISSUER=https://cognito-idp.us-west-2.amazonaws.com/us-west-2_<PROD_POOL_ID>

# DynamoDB (will be auto-created)
export DYNAMODB_USERS_TABLE=hedgehog-learn-prod-users
export DYNAMODB_ENROLLMENTS_TABLE=hedgehog-learn-prod-enrollments
export DYNAMODB_PROGRESS_TABLE=hedgehog-learn-prod-progress
export DYNAMODB_BADGES_TABLE=hedgehog-learn-prod-badges

# HubSpot
export HUBSPOT_PRIVATE_APP_TOKEN=<PROD_TOKEN>
export ENABLE_CRM_PROGRESS=true

# Security
export JWT_SECRET=<SECURE_RANDOM_STRING_MIN_32_CHARS>
```

**Note:** If Cognito production user pool doesn't exist yet, create it first (see Cognito setup guide).

---

## Deployment Commands

### Option 1: Automated Deployment (Recommended)

**If CI/CD is configured:**

```bash
# Trigger production deployment via GitHub Actions or similar
git tag -a v1.0.0-sso-backend -m "External SSO Backend v1.0.0"
git push origin v1.0.0-sso-backend

# GitHub Actions should automatically deploy to production
# Monitor deployment progress in Actions tab
```

### Option 2: Manual Deployment

**If deploying manually from local machine:**

```bash
# 1. Ensure you're on the correct git commit
git checkout main
git pull origin main

# 2. Verify working directory is clean
git status

# 3. Set production environment
export APP_STAGE=prod
export AWS_REGION=us-west-2

# 4. Load production environment variables
source .env.prod  # or set them manually

# 5. Build Lambda package
npm run build

# 6. Deploy to AWS
npm run deploy:aws

# Expected output:
# ✔ Service deployed to stack hedgehog-learn-prod
# ...
# endpoints:
#   <API Gateway URL>
# functions:
#   api: hedgehog-learn-prod-api
```

**Deployment Duration:** 10-15 minutes

---

## Post-Deployment Verification

### 1. Verify CloudFormation Stack

```bash
aws cloudformation describe-stacks \
  --stack-name hedgehog-learn-prod \
  --region us-west-2 \
  --query "Stacks[0].StackStatus"

# Expected: "CREATE_COMPLETE" or "UPDATE_COMPLETE"
```

### 2. Get API Gateway URL

```bash
aws cloudformation describe-stacks \
  --stack-name hedgehog-learn-prod \
  --region us-west-2 \
  --query "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue" \
  --output text

# Save this URL - you'll need it for testing
```

### 3. Test API Endpoints

```bash
# Replace <API_URL> with the URL from step 2

# Test /auth/me (should return 401 without auth)
curl -i <API_URL>/auth/me

# Expected:
# HTTP/2 401
# {"error":"Unauthorized: Missing access token"}

# Test /auth/login (should redirect to Cognito)
curl -i <API_URL>/auth/login

# Expected:
# HTTP/2 302
# location: https://hedgehog-learn-prod.auth.us-west-2.amazoncognito.com/oauth2/authorize?...
```

### 4. Verify DynamoDB Tables

```bash
aws dynamodb list-tables --region us-west-2 | grep hedgehog-learn-prod

# Expected output:
# hedgehog-learn-prod-badges
# hedgehog-learn-prod-enrollments
# hedgehog-learn-prod-progress
# hedgehog-learn-prod-users
```

### 5. Check CloudWatch Alarms

```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix hedgehog-learn-prod \
  --region us-west-2 \
  --query "MetricAlarms[*].{Name:AlarmName,State:StateValue}"

# All alarms should show State: "OK"
```

### 6. Verify Lambda Function

```bash
aws lambda get-function \
  --function-name hedgehog-learn-prod-api \
  --region us-west-2 \
  --query "Configuration.{Runtime:Runtime,Handler:Handler,Timeout:Timeout,MemorySize:MemorySize}"

# Verify configuration matches expectations
```

---

## Monitoring Setup

### CloudWatch Dashboard

**Access:** AWS Console → CloudWatch → Dashboards → `hedgehog-learn-prod`

**Key Metrics to Watch (First 24 Hours):**
- Lambda Invocations
- Lambda Errors
- Lambda Duration (p50, p95, p99)
- API Gateway 4xx/5xx rates
- DynamoDB Read/Write Capacity

### CloudWatch Logs

```bash
# Tail Lambda logs in real-time
aws logs tail /aws/lambda/hedgehog-learn-prod-api \
  --follow \
  --region us-west-2

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/hedgehog-learn-prod-api \
  --filter-pattern "ERROR" \
  --region us-west-2 \
  --max-items 50
```

### Alarm Notifications

Verify alarm SNS subscriptions:

```bash
aws sns list-subscriptions \
  --region us-west-2 \
  --query "Subscriptions[?contains(TopicArn, 'hedgehog-learn')]"
```

**Expected:** Email or Slack subscriptions for engineering team

---

## Success Criteria

After deployment, all of these should be true:

- ✅ CloudFormation stack status: `UPDATE_COMPLETE` or `CREATE_COMPLETE`
- ✅ Lambda function deployed and responding
- ✅ `/auth/me` returns 401 (expected without auth)
- ✅ `/auth/login` redirects to Cognito
- ✅ All 4 DynamoDB tables exist
- ✅ All CloudWatch alarms in `OK` state
- ✅ No ERROR level logs in CloudWatch
- ✅ Monitoring dashboard populated with data

---

## If Something Goes Wrong

### Immediate Actions

1. **Check CloudWatch Alarms:**
   ```bash
   aws cloudwatch describe-alarms \
     --alarm-name-prefix hedgehog-learn-prod \
     --state-value ALARM \
     --region us-west-2
   ```

2. **Check Recent Errors:**
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/hedgehog-learn-prod-api \
     --filter-pattern "ERROR" \
     --region us-west-2 \
     --start-time $(date -u -d '10 minutes ago' +%s)000
   ```

3. **Rollback if Critical:**
   - See `rollback-procedures.md` for detailed steps
   - For Lambda-only issues: Rollback to previous version (5 min)
   - For infrastructure issues: Rollback entire stack (10-15 min)

### Emergency Contacts

- **Project Lead:** Agent A
- **Backend Engineer:** (TBD)
- **DevOps:** (TBD)
- **AWS Support:** (Enterprise Support Number)

---

## Post-Deployment Tasks

### Within 1 Hour

- [ ] Update issue #307 with deployment results
- [ ] Post deployment announcement in team channel
- [ ] Share API Gateway URL with frontend team (for #316)
- [ ] Update documentation with production endpoints

### Within 24 Hours

- [ ] Review CloudWatch metrics and logs
- [ ] Analyze DynamoDB read/write patterns
- [ ] Check for any error patterns
- [ ] Adjust alarm thresholds if needed

### Within 1 Week

- [ ] Conduct deployment retrospective
- [ ] Update runbooks with learnings
- [ ] Optimize DynamoDB access patterns based on usage data
- [ ] Plan Phase 6.4 completion sprint (#316)

---

## Important Notes

### Backend is Deployed but Not User-Facing Yet

**Remember:** This is a backend-only deployment. Users won't see any changes yet because:
- Frontend integration not complete (tracked in #316)
- API not accessible from `hedgehog.cloud` domain (requires proxy)
- No enrollment CTAs deployed to HubSpot CMS

**This is expected and safe.** The backend will be ready when the frontend work completes.

### What This Deployment Includes

✅ **Included:**
- Lambda API endpoints (`/auth/*`)
- DynamoDB tables (users, enrollments, progress, badges)
- Cognito user pool and OAuth configuration
- CloudWatch monitoring (logs, alarms)

❌ **Not Included (tracked in #316):**
- Frontend JavaScript on HubSpot CMS
- API proxy configuration
- Production domain routing

---

## Next Steps After Successful Deployment

1. ✅ Mark backend deployment as complete in #307
2. ⏭️ Share API Gateway URL with frontend team
3. ⏭️ Monitor CloudWatch alarms for 24 hours
4. ⏭️ Begin work on #316 (Frontend CMS Deployment)
5. ⏭️ Full production launch after #316 complete

---

**Prepared By:** Agent A (Project Lead)
**Date:** 2026-01-19
**Version:** 1.0
