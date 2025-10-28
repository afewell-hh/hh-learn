# JWT Authentication Implementation Analysis Report

> **Deprecated 2025-10-28:** Issues #270/#272/#274 replaced the JWT flow with HubSpot-native membership for production. Treat this document as historical context for automation helpers only. See docs/auth-and-progress.md and verification-output/issue-274/.


## Executive Summary

This report provides a comprehensive analysis of the JWT authentication implementation delivered in PR #252/#254 and compares it with the legacy HubSpot membership flow. The new JWT-based public page authentication enables users to authenticate on public course pages where the HubSpot Membership API returns 404.

---

## 1. NEW JWT AUTHENTICATION FLOW OVERVIEW

### Architecture Decision (ADR 001)
**Status**: ACCEPTED & IMPLEMENTED (PR #252, PR #254)
**Date Implemented**: 2025-10-26
**Related Issues**: #242, #251, #253, #255

### Key Problem Solved
The HubSpot Membership API (`/_hcms/api/membership/v1/profile`) returns **404 on public pages**, preventing authentication identity resolution. JWT provides an alternative that works on both public and private pages.

### Flow Diagram
```
Public Page (anonymous visitor)
    ↓
User clicks "Sign In" or calls window.hhIdentity.login()
    ↓
POST /auth/login { email }
    ↓
Lambda validates email exists in HubSpot CRM
    ↓
Returns signed JWT: { contactId, email, iat, exp, iss, aud }
    ↓
Client stores JWT in localStorage
    ↓
All subsequent API calls include: Authorization: Bearer <jwt>
    ↓
Lambda validates JWT signature, extracts contactId
    ↓
Progress/enrollment endpoints work with authenticated identity
```

---

## 2. FILE PATHS FOR KEY JWT IMPLEMENTATION

### Backend Implementation Files
1. **`/home/ubuntu/afewell-hh/hh-learn/src/api/lambda/auth.ts`** (NEW - 76 lines)
   - JWT utilities: `signToken()`, `verifyToken()`, `extractContactFromToken()`
   - Uses: `jsonwebtoken` npm package
   - Configuration: `JWT_SECRET` environment variable, `JWT_EXPIRY: '24h'`

2. **`/home/ubuntu/afewell-hh/hh-learn/src/api/lambda/index.ts`**
   - `/auth/login` endpoint (lines 92-150)
   - JWT validation integration in all endpoints (lines 205-206, 311-312, 441-442, 548-549)
   - Uses `extractContactFromToken()` to validate Authorization header

3. **`/home/ubuntu/afewell-hh/hh-learn/serverless.yml`** (line 16)
   - Environment: `JWT_SECRET: ${env:JWT_SECRET, ''}`
   - Routes: `/auth/login` (POST), `/events/track` (POST), `/progress/read` (GET), etc.

### Frontend Integration Files
1. **`/home/ubuntu/afewell-hh/hh-learn/clean-x-hedgehog-templates/assets/js/auth-context.js`** (598 lines)
   - **`window.hhIdentity` public API** with methods:
     - `.ready` - Promise that resolves when identity is detected
     - `.get()` - Get identity synchronously
     - `.login(email)` - JWT login method (Issue #251)
     - `.logout()` - Clear JWT token
     - `.isAuthenticated()` - Check if user is authenticated
   - JWT token management:
     - Stores: `localStorage.hhl_auth_token` (token)
     - Stores: `localStorage.hhl_auth_token_expires` (timestamp)
     - Stores: `localStorage.hhl_identity_from_jwt` (identity object)
   - Token validation with 15-minute refresh buffer (lines 227-255)

2. **`/home/ubuntu/afewell-hh/hh-learn/clean-x-hedgehog-templates/assets/js/enrollment.js`** (updated)
   - `buildAuthHeaders()` function (lines 155-166) adds JWT Bearer token to fetch calls
   - Retrieves token from localStorage: `localStorage.getItem('hhl_auth_token')`

3. **`/home/ubuntu/afewell-hh/hh-learn/clean-x-hedgehog-templates/assets/js/progress.js`** (updated)
   - Same `buildAuthHeaders()` implementation (lines 21-32)
   - All API calls include JWT token when available

4. **`/home/ubuntu/afewell-hh/hh-learn/clean-x-hedgehog-templates/config/constants.json`**
   - `LOGIN_URL`: `/_hcms/mem/login` (legacy membership)
   - `AUTH_LOGIN_URL`: `https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/login` (NEW JWT endpoint)

### Configuration Files
- **`/home/ubuntu/afewell-hh/hh-learn/.env.example`** - Environment variable documentation
- **`/home/ubuntu/afewell-hh/hh-learn/docs/auth-and-progress.md`** - Comprehensive authentication guide
- **`/home/ubuntu/afewell-hh/hh-learn/docs/adr/001-public-page-authentication.md`** - Architecture decision record

---

## 3. DIFFERENCES: LEGACY VS NEW AUTHENTICATION

### Legacy HubSpot Membership Flow
```
User visits page
    ↓
Click "Sign In" → Redirect to /_hcms/mem/login
    ↓
HubSpot login page (email/password)
    ↓
Success → Browser sets session cookies (__hstc, hubspotutk, etc.)
    ↓
Redirect to page
    ↓
fetch(/_hcms/api/membership/v1/profile) 
    ↓
Returns { email, contactId, hs_object_id, vid, firstname, lastname }
    ↓
Template variables available: request_contact.is_logged_in, request_contact.email, etc.
```

**BLOCKER**: Membership API returns 404 on **public pages** - cannot get identity for authentication

### New JWT Authentication Flow
```
User visits page
    ↓
Call window.hhIdentity.login('user@example.com')
    ↓
POST /auth/login { email } → Lambda validates in HubSpot CRM
    ↓
Success → Returns { token, contactId, email, firstname, lastname }
    ↓
Client stores in localStorage (hhl_auth_token, hhl_identity_from_jwt)
    ↓
All API calls include Authorization: Bearer <token>
    ↓
Lambda extracts contactId from JWT signature verification
    ↓
Works on public AND private pages
```

**ADVANTAGE**: No HubSpot Membership dependency, works everywhere

### Key Differences Table

| Aspect | Legacy Membership | New JWT |
|--------|-------------------|---------|
| **Public Page Support** | ❌ Returns 404 | ✅ Works everywhere |
| **Authentication Method** | Email/password (HubSpot) | Email-only (MVP) |
| **Token Storage** | Server cookies | localStorage |
| **Token Format** | Session cookie | JWT (signed) |
| **Expiry** | Browser session | 24 hours |
| **Refresh** | Automatic (cookie) | Manual (15-min buffer) |
| **Validation** | HubSpot session | JWT signature |
| **Identity Source** | Membership API | JWT payload |
| **Template Access** | request_contact variable | window.hhIdentity.get() |
| **Logout** | HubSpot /hs-logout | localStorage.removeItem() |
| **API Headers** | Implicit (cookies) | Authorization: Bearer |

---

## 4. FAILING TEST FILES & NEEDED UPDATES

### File: `/home/ubuntu/afewell-hh/hh-learn/tests/e2e/auth.spec.ts`

**Current State**: Tests expect legacy membership flow
- Line 18: `expect(href!).toContain('/_hcms/mem/login');` - expects HubSpot login URL
- Line 30, 35: `/_hcms/mem/login` hardcoded expectations

**What Needs Changing**:
```
WRONG (current):
  expect(href!).toContain('/_hcms/mem/login');
  
CORRECT (for JWT):
  const constants = await page.evaluate(() => fetch('/learn/config/constants.json').then(r => r.json()));
  expect(href!).toContain(constants.LOGIN_URL);
```

**Why**: The tests hardcode legacy HubSpot URLs instead of reading from configuration which now has both:
- `LOGIN_URL: /_hcms/mem/login` (membership)
- `AUTH_LOGIN_URL: <API>/auth/login` (JWT)

### File: `/home/ubuntu/afewell-hh/hh-learn/tests/e2e/enrollment-cta.spec.ts`

**Current State**: Expects HubSpot membership flow
- Line 50-51: `'data-login-url': '/_hcms/mem/login'` - hardcoded membership URL
- Line 81: `LOGIN_URL: '/_hcms/mem/login'` - hardcoded

**What Needs Changing**:
```typescript
WRONG (current):
  const constants = {
    LOGIN_URL: '/_hcms/mem/login'
  };

CORRECT (for JWT):
  // Read from actual constants.json which has both URLs
  const response = await page.request.get('/learn/config/constants.json');
  const constants = await response.json();
  // Or accept both URLs:
  const loginUrl = constants.AUTH_LOGIN_URL || constants.LOGIN_URL;
```

---

## 5. EXAMPLES OF SUCCESSFUL JWT TEST UPDATES

### File: `/home/ubuntu/afewell-hh/hh-learn/tests/api/membership-smoke.spec.ts`

**Correctly Updated for JWT**:
```typescript
// Line 24-25: Read test email from environment
const TEST_EMAIL = process.env.HUBSPOT_TEST_EMAIL || process.env.HUBSPOT_TEST_USERNAME;

// Lines 29-40: Helper function to get JWT token
async function getJWTToken(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email }
  });
  expect(response.ok(), `JWT login should succeed for ${email}`).toBeTruthy();
  const data = await response.json();
  expect(data.token).toBeTruthy();
  return data.token;
}

// Lines 58-76: Test JWT authentication endpoint
test('should authenticate and return valid JWT token', async ({ request }) => {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: TEST_EMAIL }
  });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  
  // Verify response structure
  expect(data.token).toBeTruthy();
  expect(data.email).toBe(TEST_EMAIL);
  expect(data.contactId).toBeTruthy();
  
  // JWT token should have 3 parts (header.payload.signature)
  const tokenParts = data.token.split('.');
  expect(tokenParts.length).toBe(3);
});

// Lines 113-126: Include JWT in API calls
const enrollResponse = await request.post(`${API_BASE_URL}/events/track`, {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`  // JWT Bearer token
  },
  data: { ... }
});
```

### File: `/home/ubuntu/afewell-hh/hh-learn/tests/e2e/enrollment-flow.spec.ts`

**Correctly Updated for JWT**:
```typescript
// Lines 16-41: Helper function to authenticate via JWT
async function authenticateViaJWT(page: Page, email: string): Promise<void> {
  const response = await page.request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email }
  });
  expect(response.ok(), `JWT login should succeed for ${email}`).toBeTruthy();
  
  const data = await response.json();
  
  // Store token in localStorage
  await page.evaluate((token) => {
    localStorage.setItem('hhl_auth_token', token);
    localStorage.setItem('hhl_auth_token_expires', String(Date.now() + (24 * 60 * 60 * 1000)));
  }, data.token);
  
  // Store identity for immediate use
  await page.evaluate((identity) => {
    localStorage.setItem('hhl_identity_from_jwt', JSON.stringify(identity));
  }, {
    email: data.email,
    contactId: data.contactId,
    firstname: data.firstname || '',
    lastname: data.lastname || ''
  });
}

// Line 98: Call JWT login
await authenticateViaJWT(page, testEmail);

// Lines 110-113: Verify token was stored
const storedToken = await page.evaluate(() => localStorage.getItem('hhl_auth_token'));
expect(storedToken, 'JWT token should be stored in localStorage').toBeTruthy();

// Lines 115-125: Verify identity resolves from JWT
const windowIdentity = await page.evaluate(() => {
  return (window as any).hhIdentity?.get() || null;
});
expect(windowIdentity, 'Identity should be resolved from JWT').toBeTruthy();
expect((windowIdentity as any).email).toBe(testEmail);
expect((windowIdentity as any).contactId).toBeTruthy();
```

---

## 6. ENVIRONMENT VARIABLES & CONFIGURATION REQUIREMENTS

### Required for JWT Authentication

#### Backend (Lambda / AWS)
```bash
# CRITICAL - Must be set for JWT to work
JWT_SECRET=<256-bit random key>  # Generate with: openssl rand -base64 32

# Already existing
HUBSPOT_PROJECT_ACCESS_TOKEN=<your-token>
HUBSPOT_ACCOUNT_ID=<your-account-id>
```

#### Frontend (HubSpot Template)
```json
{
  "AUTH_LOGIN_URL": "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/login",
  "LOGIN_URL": "/_hcms/mem/login",  // Fallback for legacy flows
  "TRACK_EVENTS_URL": "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track",
  "ENABLE_CRM_PROGRESS": true
}
```

#### Testing (CI/CD)
```bash
HUBSPOT_TEST_USERNAME=<valid-crm-contact-email>  # Email that exists in HubSpot CRM
JWT_SECRET=<same-as-lambda>  # Must match backend
API_BASE_URL=https://hvoog2lnha.execute-api.us-west-2.amazonaws.com  # Lambda API Gateway
```

### Storage Locations

**AWS SSM Parameter Store**:
```bash
/hhl/jwt-secret (SecureString) → Used by Lambda
/hhl/hubspot/token (SecureString) → HubSpot API token
```

**GitHub Actions Secrets**:
```bash
JWT_SECRET → Configured in repository secrets
HUBSPOT_TEST_USERNAME → Configured in repository secrets
```

**Client-Side (localStorage)**:
```javascript
// After JWT login
localStorage.hhl_auth_token          // "eyJhbGc..."
localStorage.hhl_auth_token_expires   // "1698432000"
localStorage.hhl_identity_from_jwt    // "{\"email\": \"...\", \"contactId\": \"...\"}"
```

---

## 7. JWT TOKEN STRUCTURE & VALIDATION

### JWT Payload (Inside Token)
```json
{
  "contactId": "12345",
  "email": "user@example.com",
  "iat": 1698345600,              // Issued at
  "exp": 1698432000,              // Expires (24 hours later)
  "iss": "hedgehog-learn",        // Issuer
  "aud": "hedgehog-learn-frontend" // Audience
}
```

### Token Validation Flow (Backend)
```typescript
// In src/api/lambda/auth.ts
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'hedgehog-learn',
      audience: 'hedgehog-learn-frontend'
    }) as JWTPayload;
    return decoded;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (err.name === 'JsonWebTokenError') {
      throw new Error('Invalid token signature');
    }
  }
}
```

### Token Extraction (All Endpoints)
```typescript
// In src/api/lambda/index.ts (lines 205-206, etc.)
const authHeader = event.headers?.authorization || event.headers?.Authorization;
const jwtContact = extractContactFromToken(authHeader);
// Returns: { email: string, contactId: string } | null
```

---

## 8. API ENDPOINTS WITH JWT SUPPORT

### POST /auth/login (NEW)
**Purpose**: Authenticate user and get JWT token

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "contactId": "12345",
  "email": "user@example.com",
  "firstname": "John",
  "lastname": "Doe"
}
```

**Error (400)**: Invalid email format
```json
{
  "error": "Invalid email format",
  "code": "INVALID_EMAIL"
}
```

**Error (404)**: Email not in HubSpot CRM
```json
{
  "error": "Contact not found",
  "code": "CONTACT_NOT_FOUND"
}
```

### POST /events/track (UPDATED)
**Now Supports**:
- Authorization header with JWT token
- Extracts contactId from token signature
- Falls back to email parameter if provided

**Request**:
```json
{
  "eventName": "learning_module_started",
  "payload": { "module_slug": "intro" },
  "Authorization": "Bearer eyJhbGc..."  // JWT token (optional)
}
```

**Request (Alternative - Email Parameter)**:
```json
{
  "eventName": "learning_module_started",
  "email": "user@example.com",  // Alternative if no JWT
  "payload": { "module_slug": "intro" }
}
```

### GET /enrollments/list (UPDATED)
**Query Parameters**:
- `email` (optional) - User email
- `contactId` (optional) - HubSpot contact ID

**Headers**:
```
Authorization: Bearer <jwt>  // Optional - token can provide email/contactId
```

**If JWT is valid**: Authentication is successful even if email/contactId not in query

---

## 9. PRIORITY CHANGES FOR FAILING TESTS

### TEST 1: `/home/ubuntu/afewell-hh/hh-learn/tests/e2e/auth.spec.ts`

**Changes Needed**:
1. **Stop hardcoding `/_hcms/mem/login`** - it only works for legacy membership
2. **For public pages**: Should check for JWT login capability instead
3. **Assertion should be**: Login links should work (either URL format acceptable)

**Specific Line Changes**:
```typescript
// BEFORE (line 18):
expect(href!).toContain('/_hcms/mem/login');

// AFTER:
// For public page auth, should support either JWT or membership
// The test should verify redirect works, not specific URL
expect(href).toBeTruthy();
expect(href!).toMatch(/(_hcms\/mem\/login|\/auth\/login)/);
```

### TEST 2: `/home/ubuntu/afewell-hh/hh-learn/tests/e2e/enrollment-cta.spec.ts`

**Changes Needed**:
1. **Line 50**: Don't hardcode `'/_hcms/mem/login'`
2. **Line 81**: Use constants.json values instead of hardcoded
3. **Add JWT login support** alongside HubSpot membership

**Specific Line Changes**:
```typescript
// BEFORE (line 50-51):
await loadPage(page, baseTemplate({
  'data-login-url': '/_hcms/mem/login'
}), origin);

// AFTER:
const constants = await page.request.get('/learn/config/constants.json').then(r => r.json());
await loadPage(page, baseTemplate({
  'data-login-url': constants.LOGIN_URL || '/_hcms/mem/login',
  'data-auth-login-url': constants.AUTH_LOGIN_URL  // Add JWT endpoint
}), origin);
```

---

## 10. MIGRATION STRATEGY

### Phase 1: Support Both (CURRENT)
- Membership API works on private pages
- JWT works on public pages
- Tests should accept both methods

### Phase 2: Full JWT Rollout (FUTURE)
- All pages use JWT tokens
- Membership becomes optional fallback
- Tests expect JWT by default

### For Now
**Failing tests need to**:
1. Accept EITHER membership OR JWT authentication
2. Not hardcode specific URLs
3. Read configuration from constants.json
4. Support both localStorage tokens AND cookies

---

## 11. SUCCESS METRICS (Post-Fix)

### Tests Should Pass With:
- ✅ Anonymous state detected correctly
- ✅ Login option available (either JWT or membership)
- ✅ After login: CTA text changes from "Sign in" to action button
- ✅ Enrollment can proceed with authenticated identity
- ✅ Progress tracking includes contact identifier
- ✅ Supports both public AND private pages

### Example Assertion Pattern
```typescript
// Instead of:
expect(url).toContain('/_hcms/mem/login');

// Use:
const isAuthenticated = await page.evaluate(() => {
  const identity = window.hhIdentity?.get();
  return !!(identity && (identity.email || identity.contactId));
});
expect(isAuthenticated).toBeTruthy();
```

---

## SUMMARY TABLE: File Changes Needed

| File | Current Issue | Required Change | Complexity |
|------|---------------|-----------------|-----------|
| `tests/e2e/auth.spec.ts` | Hardcodes `/_hcms/mem/login` | Accept either URL format | Low |
| `tests/e2e/enrollment-cta.spec.ts` | Hardcoded login URL | Read from constants | Low |
| `tests/e2e/auth-redirect.spec.ts` | Same as auth.spec.ts | Same fix | Low |
| Other successful tests | None | ✅ Already working | N/A |

---

## REFERENCES

- **Architecture Decision**: `docs/adr/001-public-page-authentication.md`
- **Auth Implementation**: `docs/auth-and-progress.md`
- **API Implementation**: `src/api/lambda/auth.ts` + `src/api/lambda/index.ts`
- **Frontend Integration**: `clean-x-hedgehog-templates/assets/js/auth-context.js`
- **Test Examples**: `tests/api/membership-smoke.spec.ts`, `tests/e2e/enrollment-flow.spec.ts`
- **Configuration**: `clean-x-hedgehog-templates/config/constants.json`
- **Deployment**: `serverless.yml`

