# AWS Deployment Verification

**Date:** 2026-01-19
**Environment:** dev (us-west-2)
**Verified By:** Agent A

## Deployment Status: ✅ VERIFIED

### CloudFormation Stack

- **Stack Name:** hedgehog-learn-dev
- **Status:** UPDATE_COMPLETE
- **Created:** 2025-10-13
- **Last Updated:** 2026-01-18

### Lambda Functions

| Function Name | Runtime | Last Modified |
|--------------|---------|---------------|
| hedgehog-learn-dev-api | nodejs20.x | 2026-01-18T20:26:28.000+0000 |

**Status:** ✅ Deployed and up-to-date

### DynamoDB Tables

| Table Name | Purpose |
|-----------|---------|
| hedgehog-learn-users-dev | User profiles and authentication |
| hedgehog-learn-enrollments-dev | Course enrollments |
| hedgehog-learn-progress-dev | Module progress tracking |
| hedgehog-learn-badges-dev | Achievement badges |

**Status:** ✅ All 4 tables deployed

**Features Enabled:**
- DynamoDB Streams (NEW_AND_OLD_IMAGES)
- Point-in-Time Recovery
- Server-Side Encryption (SSE)
- Global Secondary Indexes (Users, Enrollments)

### CloudWatch Logs

| Log Group | Retention |
|-----------|-----------|
| /aws/lambda/hedgehog-learn-dev-api | 30 days |

**Status:** ✅ Configured correctly

### CloudWatch Alarms

| Alarm Name | State | Purpose |
|-----------|-------|---------|
| hedgehog-learn-dev-lambda-errors | OK | Lambda errors > 5/min |
| hedgehog-learn-dev-lambda-throttles | OK | Lambda throttles detected |
| hedgehog-learn-dev-httpapi-5xx | OK | API Gateway 5xx > 5/min |
| hedgehog-learn-dev-httpapi-latency | OK | Avg latency > 1s over 5min |

**Status:** ✅ All alarms in OK state (no issues detected)

### Cognito Configuration

| Parameter | Value |
|-----------|-------|
| User Pool ID | us-west-2_XWB9UclRK |
| Client ID | 2um886mpdk65cbbb6pgsvqkchf |
| Domain | hedgehog-learn.auth.us-west-2.amazoncognito.com |
| Region | us-west-2 |
| Redirect URI | https://hedgehog.cloud/auth/callback |
| Issuer | https://cognito-idp.us-west-2.amazonaws.com/us-west-2_XWB9UclRK |

**Status:** ✅ Configured in environment variables

### API Endpoints (AWS HTTP API)

Based on serverless.yml configuration:

**Auth Endpoints:**
- `GET /auth/login` - Initiates OAuth flow
- `GET /auth/callback` - Handles OAuth callback
- `GET /auth/me` - Returns authenticated user
- `GET /auth/logout` - Logout (redirect)
- `POST /auth/logout` - Logout (API)

**Data Endpoints:**
- `GET /enrollments/list` - User enrollments
- `GET /progress/read` - User progress
- `GET /progress/aggregate` - Aggregated progress
- `POST /events/track` - Track learning events
- `POST /quiz/grade` - Quiz grading

**Status:** ✅ All endpoints configured in Lambda

### CORS Configuration

**Allowed Origins:**
- https://hedgehog.cloud
- https://www.hedgehog.cloud

**Allowed Methods:** GET, POST, OPTIONS

**Allowed Headers:** Content-Type, Authorization, Origin

**Allow Credentials:** true

**Status:** ✅ Configured for production domain

---

## Summary

**Overall Status:** ✅ READY FOR TESTING

All AWS infrastructure components are deployed and healthy:
- Lambda function deployed (last updated 2026-01-18)
- All 4 DynamoDB tables exist with proper configuration
- CloudWatch logs and alarms configured and in OK state
- Cognito OAuth configured
- CORS configured for production domain

**Next Steps:**
1. Run Playwright E2E tests
2. Run API smoke tests
3. Verify DynamoDB data writes
4. Verify HubSpot CRM sync

---

**Verification Completed:** 2026-01-19
