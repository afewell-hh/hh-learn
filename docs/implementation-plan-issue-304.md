# Implementation Plan: Phase 4 - Protected API Endpoints (Issue #304)

## Overview
Implement authenticated DynamoDB-backed API endpoints for enrollments, progress, and badges using Test-Driven Development (TDD).

## Prerequisites (Completed)
- ✅ Phase 1 (#301): Cognito Setup
- ✅ Phase 2 (#302): DynamoDB Schema + IAM
- ✅ Phase 3 (#303): Auth Endpoints + PKCE Cookies

## Endpoints to Implement

### 1. Enrollment Endpoints
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/api/enrollments` | List user's enrollments | Yes |
| POST | `/api/enrollments` | Create new enrollment | Yes |
| DELETE | `/api/enrollments/:courseSlug` | Remove enrollment | Yes |

### 2. Progress Endpoints
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/api/progress/:courseSlug` | Get progress for specific course | Yes |
| POST | `/api/progress` | Update progress | Yes |

### 3. Badge & Health Endpoints
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| GET | `/api/badges` | List user's badges | Yes |
| GET | `/api/health` | Health check | No |

## Data Models

### Enrollment (DynamoDB)
```typescript
interface Enrollment {
  PK: `USER#${userId}`;
  SK: `ENROLLMENT#${courseSlug}`;
  GSI1PK: `COURSE#${courseSlug}`;
  GSI1SK: `USER#${userId}`;
  userId: string;
  courseSlug: string;
  pathwaySlug?: string;
  enrolledAt: string; // ISO 8601
  enrollmentSource: string; // 'catalog', 'pathway_page', 'course_page', etc.
  status: 'active' | 'completed';
  completedAt?: string;
}
```

### Progress (DynamoDB)
```typescript
interface Progress {
  PK: `USER#${userId}#COURSE#${courseSlug}`;
  SK: `MODULE#${moduleId}`;
  userId: string;
  courseSlug: string;
  moduleId: string;
  started: boolean;
  startedAt?: string;
  completed: boolean;
  completedAt?: string;
}
```

### Badge (DynamoDB)
```typescript
interface Badge {
  PK: `USER#${userId}`;
  SK: `BADGE#${badgeId}#${issuedAt}`;
  userId: string;
  badgeId: string;
  issuedAt: string;
  type: 'module' | 'course' | 'pathway';
  metadata: {
    moduleSlug?: string;
    courseSlug?: string;
    pathwaySlug?: string;
    title: string;
  };
}
```

## API Specifications

### GET /api/enrollments
**Request:**
- Headers: Cookie with `hhl_access_token`
- Query params: None (returns all user enrollments)

**Response (200):**
```json
{
  "enrollments": [
    {
      "courseSlug": "hedgehog-lab-foundations",
      "pathwaySlug": "hedgehog-vlab",
      "enrolledAt": "2025-01-18T10:00:00Z",
      "enrollmentSource": "pathway_page",
      "status": "active"
    }
  ]
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid access token
- `500 Internal Server Error`: DynamoDB failure

### POST /api/enrollments
**Request:**
```json
{
  "courseSlug": "hedgehog-lab-foundations",
  "pathwaySlug": "hedgehog-vlab",
  "enrollmentSource": "catalog"
}
```

**Response (201):**
```json
{
  "enrollment": {
    "courseSlug": "hedgehog-lab-foundations",
    "pathwaySlug": "hedgehog-vlab",
    "enrolledAt": "2025-01-18T10:00:00Z",
    "enrollmentSource": "catalog",
    "status": "active"
  }
}
```

**Errors:**
- `400 Bad Request`: Invalid course slug or missing required fields
- `401 Unauthorized`: Missing or invalid access token
- `409 Conflict`: Already enrolled
- `500 Internal Server Error`: DynamoDB failure

### DELETE /api/enrollments/:courseSlug
**Request:**
- Headers: Cookie with `hhl_access_token`
- Path param: `courseSlug`

**Response (204 No Content):**
- Empty body

**Errors:**
- `401 Unauthorized`: Missing or invalid access token
- `404 Not Found`: Enrollment not found
- `500 Internal Server Error`: DynamoDB failure

### GET /api/progress/:courseSlug
**Request:**
- Headers: Cookie with `hhl_access_token`
- Path param: `courseSlug`

**Response (200):**
```json
{
  "courseSlug": "hedgehog-lab-foundations",
  "modules": {
    "module-1": {
      "started": true,
      "startedAt": "2025-01-18T10:00:00Z",
      "completed": true,
      "completedAt": "2025-01-18T10:30:00Z"
    },
    "module-2": {
      "started": true,
      "startedAt": "2025-01-18T10:35:00Z",
      "completed": false
    }
  }
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid access token
- `404 Not Found`: No progress found for course
- `500 Internal Server Error`: DynamoDB failure

### POST /api/progress
**Request:**
```json
{
  "courseSlug": "hedgehog-lab-foundations",
  "moduleId": "module-1",
  "eventType": "started" | "completed"
}
```

**Response (200):**
```json
{
  "success": true,
  "progress": {
    "moduleId": "module-1",
    "started": true,
    "startedAt": "2025-01-18T10:00:00Z",
    "completed": false
  }
}
```

**Errors:**
- `400 Bad Request`: Invalid course/module slug or eventType
- `401 Unauthorized`: Missing or invalid access token
- `500 Internal Server Error`: DynamoDB failure

### GET /api/badges
**Request:**
- Headers: Cookie with `hhl_access_token`

**Response (200):**
```json
{
  "badges": [
    {
      "badgeId": "course-completion",
      "issuedAt": "2025-01-18T11:00:00Z",
      "type": "course",
      "metadata": {
        "courseSlug": "hedgehog-lab-foundations",
        "title": "Hedgehog Lab Foundations"
      }
    }
  ]
}
```

**Errors:**
- `401 Unauthorized`: Missing or invalid access token
- `500 Internal Server Error`: DynamoDB failure

### GET /api/health
**Request:** None

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-18T10:00:00Z",
  "version": "1.0.0"
}
```

## Authentication Middleware

All protected endpoints (`/api/*` except `/api/health`) require:
1. `hhl_access_token` cookie present
2. Valid JWT signature (verified against Cognito JWKS)
3. Correct issuer, audience, and token_use claims
4. Non-expired token

Extract `userId` from JWT `sub` claim for DynamoDB queries.

## Validation & Rate Limiting

### Input Validation
Use Zod schemas for all request bodies:
- `enrollmentCreateSchema`
- `progressUpdateSchema`

### Rate Limiting (MVP)
- Write endpoints (POST, DELETE): 100 requests/hour per user
- Read endpoints (GET): 1000 requests/hour per user

## Testing Strategy (TDD)

### Test Structure
```
tests/api/
  enrollments.spec.ts      # Enrollment endpoints
  progress.spec.ts         # Progress endpoints
  badges.spec.ts           # Badges endpoint
  health.spec.ts           # Health check endpoint
```

### Test Cases (Per Endpoint)

#### Common Tests (All Protected Endpoints)
- ✅ Returns 401 when access token missing
- ✅ Returns 401 when JWT signature invalid
- ✅ Returns 401 when JWT expired
- ✅ Returns 401 when JWT from wrong issuer
- ✅ Includes proper CORS headers
- ✅ Responds within acceptable latency (<500ms)

#### Enrollment Tests
**GET /api/enrollments**
- Returns empty array for new user
- Returns all user enrollments
- Includes courseSlug, pathwaySlug, enrolledAt, status

**POST /api/enrollments**
- Creates new enrollment successfully
- Returns 400 for invalid courseSlug
- Returns 409 if already enrolled
- Validates all required fields

**DELETE /api/enrollments/:courseSlug**
- Deletes enrollment successfully (204)
- Returns 404 if enrollment doesn't exist
- Validates courseSlug format

#### Progress Tests
**GET /api/progress/:courseSlug**
- Returns empty modules object for new course
- Returns all module progress
- Includes started, startedAt, completed, completedAt

**POST /api/progress**
- Updates module progress (started)
- Updates module progress (completed)
- Returns 400 for invalid eventType
- Validates courseSlug and moduleId

#### Badge Tests
**GET /api/badges**
- Returns empty array for new user
- Returns all user badges
- Includes badgeId, issuedAt, type, metadata

#### Health Tests
**GET /api/health**
- Returns 200 with status, timestamp, version
- Does not require authentication

## Implementation Steps

### Step 1: Create Helper Functions
- `extractUserIdFromCookie(event)` - Extract and verify JWT from cookie
- `validateEnrollmentPayload(body)` - Zod validation
- `validateProgressPayload(body)` - Zod validation

### Step 2: Implement Enrollment Endpoints
1. Write tests in `tests/api/enrollments.spec.ts`
2. Implement `GET /api/enrollments` handler
3. Implement `POST /api/enrollments` handler
4. Implement `DELETE /api/enrollments/:courseSlug` handler
5. Run tests, fix failures

### Step 3: Implement Progress Endpoints
1. Write tests in `tests/api/progress.spec.ts`
2. Implement `GET /api/progress/:courseSlug` handler
3. Implement `POST /api/progress` handler
4. Run tests, fix failures

### Step 4: Implement Badge & Health Endpoints
1. Write tests in `tests/api/badges.spec.ts`
2. Implement `GET /api/badges` handler
3. Write tests in `tests/api/health.spec.ts`
4. Implement `GET /api/health` handler
5. Run tests, fix failures

### Step 5: Add Routes to serverless.yml
Add HTTP API event mappings for all new endpoints

### Step 6: Integration Testing
- Deploy to staging
- Run full test suite
- Verify CloudWatch logs
- Check DynamoDB tables

## Acceptance Criteria

- ✅ All API tests pass
- ✅ Unauthorized requests return 401
- ✅ Valid enrollments/progress persist to DynamoDB
- ✅ All endpoints return expected JSON structures
- ✅ Input validation and rate limits on write endpoints
- ✅ CORS headers correct for all responses
- ✅ CloudWatch alarms configured (via existing serverless.yml)

## Effort Estimate
**Total:** 4-6 days
- Test writing: 1-2 days
- Implementation: 2-3 days
- Review + fixes: 1 day

## References
- Issue #299: External SSO + Progress Store (parent issue)
- Issue #302: DynamoDB Schema (prerequisite)
- Issue #303: Auth Endpoints (prerequisite, auth pattern reference)
- `src/api/lambda/cognito-auth.ts`: Auth middleware pattern
- `tests/api/auth-me.spec.ts`: API test pattern reference
