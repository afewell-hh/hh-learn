# DynamoDB Schema Documentation

**Issue:** #302 - Phase 2: DynamoDB Schema + IAM
**Status:** Implemented
**Last updated:** 2025-01-17

## Overview

This document describes the DynamoDB tables used for External SSO + Progress Store (Issue #299). All tables use on-demand billing (PAY_PER_REQUEST) for MVP launch, with Point-in-Time Recovery and encryption enabled.

## Table Naming Convention

Tables follow the naming pattern: `hedgehog-learn-{table-name}-{stage}`

- **Production:** `hedgehog-learn-{table-name}-prod`
- **Staging:** `hedgehog-learn-{table-name}-dev`

## Environment Variables

The following environment variables are automatically configured in Lambda functions via `serverless.yml`:

```
DYNAMODB_USERS_TABLE=hedgehog-learn-users-{stage}
DYNAMODB_ENROLLMENTS_TABLE=hedgehog-learn-enrollments-{stage}
DYNAMODB_PROGRESS_TABLE=hedgehog-learn-progress-{stage}
DYNAMODB_BADGES_TABLE=hedgehog-learn-badges-{stage}
```

## Tables

### 1. Users Table

**Purpose:** Store user profile data from Cognito authentication.

**Primary Key:**
- PK (Hash): `USER#<cognitoSub>`
- SK (Range): `PROFILE`

**Global Secondary Index (GSI1):**
- GSI1PK (Hash): `EMAIL#<email>`
- GSI1SK (Range): `PROFILE`
- Purpose: Email-based user lookup

**Attributes:**
- `userId` (String): Cognito sub (unique identifier)
- `email` (String): User email address
- `displayName` (String, optional): User display name
- `givenName` (String, optional): User given name
- `familyName` (String, optional): User family name
- `createdAt` (String): ISO 8601 timestamp
- `updatedAt` (String): ISO 8601 timestamp
- `lastLoginAt` (String, optional): ISO 8601 timestamp
- `hubspotContactId` (String, optional): HubSpot CRM contact ID
- `preferences` (Object, optional): User preferences

**Access Patterns:**
1. Get user by Cognito sub: `GetItem(PK=USER#<sub>, SK=PROFILE)`
2. Get user by email: `Query(GSI1, GSI1PK=EMAIL#<email>)`

**Stream:** Enabled (NEW_AND_OLD_IMAGES) for audit/sync purposes

---

### 2. Enrollments Table

**Purpose:** Track user enrollments in courses.

**Primary Key:**
- PK (Hash): `USER#<userId>`
- SK (Range): `ENROLLMENT#<courseSlug>`

**Global Secondary Index (GSI1):**
- GSI1PK (Hash): `COURSE#<courseSlug>`
- GSI1SK (Range): `USER#<userId>`
- Purpose: Course-based enrollment lookup (list all users enrolled in a course)

**Attributes:**
- `userId` (String): Cognito sub (references users table)
- `courseSlug` (String): Course slug identifier
- `enrolledAt` (String): ISO 8601 timestamp
- `status` (String): `active` | `completed` | `withdrawn`
- `completedAt` (String, optional): ISO 8601 timestamp
- `updatedAt` (String): ISO 8601 timestamp
- `metadata` (Object, optional): Additional enrollment metadata

**Access Patterns:**
1. Get user's enrollments: `Query(PK=USER#<userId>)`
2. Get specific enrollment: `GetItem(PK=USER#<userId>, SK=ENROLLMENT#<courseSlug>)`
3. Get all users enrolled in a course: `Query(GSI1, GSI1PK=COURSE#<courseSlug>)`

**Stream:** Enabled (NEW_AND_OLD_IMAGES) for HubSpot CRM sync

---

### 3. Progress Table

**Purpose:** Track module completion progress within courses.

**Primary Key:**
- PK (Hash): `USER#<userId>#COURSE#<courseSlug>`
- SK (Range): `MODULE#<moduleId>`

**Attributes:**
- `userId` (String): Cognito sub (references users table)
- `courseSlug` (String): Course slug identifier
- `moduleId` (String): Module identifier
- `completed` (Boolean): Completion status
- `completedAt` (String): ISO 8601 timestamp (when module was completed)
- `quizScore` (Number, optional): Quiz score
- `quizAttempts` (Number, optional): Number of quiz attempts
- `timeSpent` (Number, optional): Time spent in seconds
- `updatedAt` (String): ISO 8601 timestamp

**Access Patterns:**
1. Get user's progress for a course: `Query(PK=USER#<userId>#COURSE#<courseSlug>)`
2. Get specific module progress: `GetItem(PK=USER#<userId>#COURSE#<courseSlug>, SK=MODULE#<moduleId>)`

**Stream:** Enabled (NEW_AND_OLD_IMAGES) for analytics/aggregation

**Note:** Course-level progress is derived by aggregating module completion counts.

---

### 4. Badges Table

**Purpose:** Track badges earned by users.

**Primary Key:**
- PK (Hash): `USER#<userId>`
- SK (Range): `BADGE#<badgeId>#<issuedAt>`

**Attributes:**
- `userId` (String): Cognito sub (references users table)
- `badgeId` (String): Badge type identifier
- `issuedAt` (String): ISO 8601 timestamp
- `metadata` (Object): Badge metadata
  - `courseSlug` (String, optional): Course slug if badge is course-specific
  - `pathwaySlug` (String, optional): Pathway slug if badge is pathway-specific
  - `title` (String): Badge title
  - `description` (String, optional): Badge description
  - `imageUrl` (String, optional): Badge image URL
  - `criteria` (String): Criteria met for badge issuance

**Access Patterns:**
1. Get user's badges: `Query(PK=USER#<userId>)`
2. Get specific badge: `GetItem(PK=USER#<userId>, SK=BADGE#<badgeId>#<issuedAt>)`

**Stream:** Enabled (NEW_AND_OLD_IMAGES) for notifications/analytics

---

## IAM Permissions

Lambda functions have the following permissions on all tables:

- `dynamodb:GetItem`
- `dynamodb:PutItem`
- `dynamodb:UpdateItem`
- `dynamodb:DeleteItem`
- `dynamodb:Query`
- `dynamodb:Scan`

Permissions include access to table indexes (GSI1).

---

## Table Features

All tables include:

1. **Billing Mode:** PAY_PER_REQUEST (on-demand scaling)
2. **Point-in-Time Recovery:** Enabled (for data protection)
3. **Encryption:** Server-side encryption with AWS managed KMS keys
4. **Streams:** Enabled with NEW_AND_OLD_IMAGES view type
5. **Tags:**
   - `Project: hedgehog-learn`
   - `Environment: {stage}`
   - `ManagedBy: serverless-framework`
   - `Component: external-sso`

---

## Deployment

Tables are managed via Serverless Framework CloudFormation. To deploy:

```bash
# Deploy to dev stage
npm run deploy:aws

# Deploy to production (requires APP_STAGE=prod)
APP_STAGE=prod npm run deploy:aws
```

Table definitions are located in: `infrastructure/dynamodb/`

---

## Related Documentation

- [Issue #299 Specification](specs/issue-299-external-sso-spec.md)
- [Issue #299 Implementation Plan](implementation-plan-issue-299.md)
- [Issue #299 Test Plan](test-plan-issue-299.md)

---

## Future Enhancements

- Consider Global Tables for multi-region deployment
- Add TTL for soft-deleted records (GDPR compliance)
- Implement DynamoDB Streams consumers for real-time processing
- Add CloudWatch alarms for throttling and read/write capacity
