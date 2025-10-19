# Progress Payload Schema Reference (Issue #214)

This document provides a complete reference for all validated JSON schemas in the Lambda progress tracking API.

## Table of Contents
1. [Track Event Schema](#track-event-schema)
2. [Quiz Grade Schema](#quiz-grade-schema)
3. [Progress Read Query Schema](#progress-read-query-schema)
4. [Progress Aggregate Query Schema](#progress-aggregate-query-schema)
5. [Enrollments List Query Schema](#enrollments-list-query-schema)
6. [Validation Limits](#validation-limits)
7. [Error Codes](#error-codes)

## Track Event Schema

### Endpoint
`POST /events/track`

### Schema Definition

```typescript
{
  eventName: 'learning_module_started'
           | 'learning_module_completed'
           | 'learning_pathway_enrolled'
           | 'learning_course_enrolled'
           | 'learning_page_viewed',
  contactIdentifier?: {
    email?: string,      // Valid email format, max 255 chars
    contactId?: string   // Max 50 chars
  },
  payload?: {
    [key: string]: any   // Event-specific fields (see below)
  },
  enrollment_source?: string,  // Max 1000 chars
  pathway_slug?: string,       // Max 200 chars
  course_slug?: string         // Max 200 chars
}
```

### Event-Specific Requirements

#### `learning_module_started`
**Required:**
- `module_slug` (in `payload` or top-level, max 200 chars)

**Optional:**
- `pathway_slug` (max 200 chars)
- `course_slug` (max 200 chars)
- `ts` (ISO datetime string)

**Example:**
```json
{
  "eventName": "learning_module_started",
  "contactIdentifier": {
    "email": "learner@example.com"
  },
  "payload": {
    "module_slug": "intro-to-hedgehog",
    "pathway_slug": "getting-started",
    "ts": "2025-10-19T10:30:00Z"
  }
}
```

#### `learning_module_completed`
**Required:**
- `module_slug` (in `payload` or top-level, max 200 chars)

**Optional:**
- `pathway_slug` (max 200 chars)
- `course_slug` (max 200 chars)
- `ts` (ISO datetime string)

**Example:**
```json
{
  "eventName": "learning_module_completed",
  "contactIdentifier": {
    "contactId": "12345"
  },
  "payload": {
    "module_slug": "advanced-networking",
    "course_slug": "network-fundamentals"
  }
}
```

#### `learning_pathway_enrolled`
**Required:**
- `pathway_slug` (max 200 chars, can be in `payload` or top-level)

**Optional:**
- `enrollment_source` (max 1000 chars)
- `ts` (ISO datetime string)

**Example:**
```json
{
  "eventName": "learning_pathway_enrolled",
  "pathway_slug": "network-like-hyperscaler",
  "enrollment_source": "pathway_page",
  "contactIdentifier": {
    "email": "learner@example.com"
  }
}
```

#### `learning_course_enrolled`
**Required:**
- `course_slug` (max 200 chars, can be in `payload` or top-level)

**Optional:**
- `enrollment_source` (max 1000 chars)
- `ts` (ISO datetime string)

**Example:**
```json
{
  "eventName": "learning_course_enrolled",
  "course_slug": "kubernetes-basics",
  "enrollment_source": "catalog",
  "contactIdentifier": {
    "email": "learner@example.com"
  }
}
```

#### `learning_page_viewed`
**Required (in `payload`):**
- `content_type` (string, max 1000 chars)
- `slug` (string, max 200 chars)

**Optional:**
- `pathway_slug` (max 200 chars)
- `course_slug` (max 200 chars)
- `ts` (ISO datetime string)

**Example:**
```json
{
  "eventName": "learning_page_viewed",
  "contactIdentifier": {
    "email": "visitor@example.com"
  },
  "payload": {
    "content_type": "pathway",
    "slug": "network-like-hyperscaler",
    "ts": "2025-10-19T10:30:00Z"
  }
}
```

---

## Quiz Grade Schema

### Endpoint
`POST /quiz/grade`

### Schema Definition

```typescript
{
  module_slug: string,    // Required, min 1 char, max 200 chars
  answers: Array<{
    id: string,           // Required, min 1 char, max 1000 chars
    value: any            // Any type allowed
  }>                      // Max 100 answers
}
```

### Example

```json
{
  "module_slug": "intro-quiz",
  "answers": [
    { "id": "q1", "value": "Paris" },
    { "id": "q2", "value": 42 },
    { "id": "q3", "value": true }
  ]
}
```

### Validation Rules
- `module_slug` cannot be empty string
- `answers` array is required
- Each answer must have `id` field
- Maximum 100 answers per request
- Answer `value` can be any JSON type

---

## Progress Read Query Schema

### Endpoint
`GET /progress/read`

### Query Parameters

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| `email` | string | No | Valid email format, max 255 chars |
| `contactId` | string | No | Max 50 chars |

### Example

```
GET /progress/read?email=learner@example.com
GET /progress/read?contactId=12345
GET /progress/read  # Anonymous mode
```

### Notes
- Both parameters are optional
- Returns anonymous mode if neither provided
- If both provided, both will be used for lookup

---

## Progress Aggregate Query Schema

### Endpoint
`GET /progress/aggregate`

### Query Parameters

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| `type` | string | **Yes** | Must be `"pathway"` or `"course"` |
| `slug` | string | **Yes** | Non-empty, max 200 chars |
| `email` | string | No | Valid email format, max 255 chars |
| `contactId` | string | No | Max 50 chars |

### Example

```
GET /progress/aggregate?type=pathway&slug=getting-started&email=learner@example.com
GET /progress/aggregate?type=course&slug=kubernetes-basics&contactId=12345
```

### Validation Errors

**Missing `type`:**
```json
{
  "error": "Invalid query parameters",
  "code": "SCHEMA_VALIDATION_FAILED",
  "details": ["type: Required"]
}
```

**Invalid `type`:**
```json
{
  "error": "Invalid query parameters",
  "code": "SCHEMA_VALIDATION_FAILED",
  "details": ["type: Invalid enum value. Expected 'pathway' | 'course'"]
}
```

---

## Enrollments List Query Schema

### Endpoint
`GET /enrollments/list`

### Query Parameters

| Parameter | Type | Required | Validation |
|-----------|------|----------|------------|
| `email` | string | Yes* | Valid email format, max 255 chars |
| `contactId` | string | Yes* | Max 50 chars |

*At least one of `email` or `contactId` is required

### Example

```
GET /enrollments/list?email=learner@example.com
GET /enrollments/list?contactId=12345
```

### Validation Errors

**Neither parameter provided:**
```json
{
  "error": "Invalid query parameters",
  "code": "SCHEMA_VALIDATION_FAILED",
  "details": ["Either email or contactId is required"]
}
```

---

## Validation Limits

### Size Limits
| Limit | Value | Applies To |
|-------|-------|------------|
| Max payload size | 10,000 bytes (10KB) | All POST requests |
| Max email length | 255 characters | All email fields |
| Max contactId length | 50 characters | All contactId fields |
| Max slug length | 200 characters | All slug fields |
| Max string length | 1,000 characters | Generic string fields |
| Max quiz answers | 100 items | Quiz grade requests |
| Max payload properties | 50 properties | Payload object (soft limit) |

### Field Constraints
- **Email**: Must match RFC 5322 email format
- **Slugs**: Case-insensitive, kebab-case recommended
- **Datetime**: ISO 8601 format (e.g., `2025-10-19T10:30:00Z`)
- **Event Names**: Exactly one of 5 predefined values
- **Content Type**: Must be `"pathway"` or `"course"` for aggregate queries

---

## Error Codes

### ValidationErrorCode Enum

```typescript
enum ValidationErrorCode {
  PAYLOAD_TOO_LARGE        // Request exceeds 10KB
  INVALID_JSON             // Malformed JSON syntax
  SCHEMA_VALIDATION_FAILED // Schema constraint violation
  MISSING_REQUIRED_FIELD   // Required field not present
  INVALID_FIELD_TYPE       // Field has wrong data type
  INVALID_FIELD_VALUE      // Field value violates constraint
  INVALID_EVENT_TYPE       // Unknown event name
}
```

### Error Response Format

All validation errors return HTTP 400 with this structure:

```typescript
{
  error: string,              // Human-readable message
  code: ValidationErrorCode,  // Machine-readable code
  details?: string[]          // Array of specific field errors
}
```

### Example Error Responses

**Oversized Payload:**
```json
{
  "error": "Request payload exceeds maximum size of 10KB",
  "code": "PAYLOAD_TOO_LARGE"
}
```

**Invalid JSON:**
```json
{
  "error": "Request body is not valid JSON",
  "code": "INVALID_JSON",
  "details": ["Unexpected token } in JSON at position 42"]
}
```

**Schema Validation Failed:**
```json
{
  "error": "Invalid track event payload",
  "code": "SCHEMA_VALIDATION_FAILED",
  "details": [
    "payload.module_slug: Required",
    "contactIdentifier.email: Invalid email"
  ]
}
```

### Structured Log Format

Validation failures are logged with this structure:

```json
{
  "timestamp": "2025-10-19T10:30:00Z",
  "level": "warn",
  "event": "validation_failure",
  "endpoint": "/events/track",
  "error_code": "SCHEMA_VALIDATION_FAILED",
  "error_message": "Invalid track event payload",
  "details": ["payload.module_slug: Required"],
  "context": {"event_name": "learning_module_started"},
  "payload_preview": "{\"eventName\":\"learning_module_started\"..."
}
```

---

## Testing

### Unit Tests
Run validation unit tests:
```bash
npm run build
node dist/tests/tests/run-validation-tests.js
```

### Integration Tests
Test live endpoints:
```bash
chmod +x tests/test-validation-endpoints.sh
./tests/test-validation-endpoints.sh
```

### Manual Testing with curl

**Valid request:**
```bash
curl -X POST https://api.example.com/events/track \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_started",
    "contactIdentifier": {"email": "test@example.com"},
    "payload": {"module_slug": "intro", "pathway_slug": "start"}
  }'
```

**Invalid request (missing module_slug):**
```bash
curl -X POST https://api.example.com/events/track \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_started",
    "contactIdentifier": {"email": "test@example.com"},
    "payload": {}
  }'
# Expected: 400 with SCHEMA_VALIDATION_FAILED
```

**Oversized payload:**
```bash
curl -X POST https://api.example.com/events/track \
  -H "Content-Type: application/json" \
  -d '{"eventName":"learning_module_started","payload":{"data":"'$(python3 -c "print('x' * 11000)")'"}}'
# Expected: 400 with PAYLOAD_TOO_LARGE
```

---

## References

- **Implementation**: `src/shared/validation.ts`
- **Lambda Handlers**: `src/api/lambda/index.ts`
- **Documentation**: `docs/auth-and-progress.md`
- **Unit Tests**: `tests/run-validation-tests.ts`
- **Integration Tests**: `tests/test-validation-endpoints.sh`
- **Issue**: #214
