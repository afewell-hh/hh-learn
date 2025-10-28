# JWT Authentication Investigation - Complete Index

> **Deprecated 2025-10-28:** Issues #270/#272/#274 replaced the JWT flow with HubSpot-native membership for production. Treat this document as historical context for automation helpers only. See docs/auth-and-progress.md and verification-output/issue-274/.


## Overview
This investigation provides comprehensive understanding of the JWT authentication implementation (PR #252/#254) and its differences from the legacy HubSpot membership flow, with specific focus on failing test files and their required updates.

## Generated Documents

### 1. JWT-AUTH-ANALYSIS.md (19KB - 585 lines)
**Complete Technical Report**

Sections:
- Section 1: New JWT Authentication Flow Overview (ADR 001)
- Section 2: File Paths for Key JWT Implementation
- Section 3: Differences Table (Legacy vs New Auth)
- Section 4: Failing Test Files & Needed Updates
- Section 5: Examples of Successful JWT Test Updates
- Section 6: Environment Variables & Configuration Requirements
- Section 7: JWT Token Structure & Validation
- Section 8: API Endpoints with JWT Support
- Section 9: Priority Changes for Failing Tests
- Section 10: Migration Strategy
- Section 11: Success Metrics (Post-Fix)

**Use this for:**
- Deep technical understanding
- Code examples and line numbers
- API documentation
- Troubleshooting details
- Complete migration strategy

### 2. JWT-AUTH-QUICK-REFERENCE.md (5.4KB - 199 lines)
**Quick Lookup Guide**

Contains:
- Core problem & solution summary
- Three key authentication flows
- File locations (all critical files)
- Environment variables needed
- localStorage keys
- API endpoint examples
- JWT token structure
- API usage patterns
- Failing tests summary
- Quick troubleshooting table

**Use this for:**
- Quick lookups while coding
- API reference
- Environment setup
- Common issues and fixes
- File location reminders

## Investigation Results Summary

### The Problem
HubSpot Membership API returns **404 on public pages**, preventing authentication. Tests were written expecting legacy membership flow but don't account for new JWT capability.

### The Solution
JWT tokens work on all pages (public + private). Implementation includes:
- Backend: `/auth/login` endpoint + JWT utilities
- Frontend: `window.hhIdentity` public API
- Storage: localStorage for JWT tokens
- All API calls include `Authorization: Bearer <token>` header

### Failing Tests (3 files - Low Complexity)

1. **`tests/e2e/auth.spec.ts`** (Lines 18, 30, 35)
   - Hardcodes `/_hcms/mem/login`
   - Should accept either URL format
   - Fix complexity: Low

2. **`tests/e2e/enrollment-cta.spec.ts`** (Lines 50-51, 81)
   - Hardcodes `LOGIN_URL: '/_hcms/mem/login'`
   - Should read from constants.json
   - Fix complexity: Low

3. **`tests/e2e/auth-redirect.spec.ts`**
   - Same pattern as auth.spec.ts
   - Same fix applies
   - Fix complexity: Low

### Successfully Updated Tests (Reference)
- ✅ `tests/api/membership-smoke.spec.ts` - Shows correct JWT API usage
- ✅ `tests/e2e/enrollment-flow.spec.ts` - Shows complete JWT flow

## Key Implementation Files

### Backend (JWT Implementation)
- `/src/api/lambda/auth.ts` (NEW - 76 lines)
  - `signToken()` - Create JWT
  - `verifyToken()` - Validate JWT signature
  - `extractContactFromToken()` - Extract identity from header

- `/src/api/lambda/index.ts` (Updated)
  - Lines 92-150: `POST /auth/login` endpoint
  - Lines 205-206, 311-312, 441-442, 548-549: JWT validation in all endpoints

- `/serverless.yml` (Line 16)
  - JWT_SECRET environment variable
  - API routes configuration

### Frontend (JWT Integration)
- `/clean-x-hedgehog-templates/assets/js/auth-context.js` (598 lines)
  - `window.hhIdentity` public API
  - Token storage and validation
  - `login(email)` and `logout()` methods

- `/clean-x-hedgehog-templates/assets/js/enrollment.js`
  - `buildAuthHeaders()` (lines 155-166)
  - Adds JWT token to fetch calls

- `/clean-x-hedgehog-templates/assets/js/progress.js`
  - `buildAuthHeaders()` (lines 21-32)
  - Same JWT integration pattern

- `/clean-x-hedgehog-templates/config/constants.json`
  - `LOGIN_URL`: `/_hcms/mem/login` (membership)
  - `AUTH_LOGIN_URL`: JWT endpoint

## Environment Configuration

### Required Variables
```bash
JWT_SECRET=<256-bit random key>        # Must match Lambda
HUBSPOT_TEST_USERNAME=<email@...>      # Valid CRM contact
```

### Automatic Variables
```bash
HUBSPOT_PROJECT_ACCESS_TOKEN           # HubSpot API
HUBSPOT_ACCOUNT_ID                     # HubSpot account
```

### Client Storage (localStorage)
```javascript
hhl_auth_token              // JWT token
hhl_auth_token_expires      // Expiry timestamp (24h)
hhl_identity_from_jwt       // User identity object
```

## API Endpoints

### POST /auth/login (NEW)
Authenticates user via email, returns JWT token
- Request: `{ email: "user@example.com" }`
- Response (200): `{ token, contactId, email, firstname, lastname }`
- Error (400): Invalid email format
- Error (404): Contact not found

### POST /events/track (UPDATED)
Now accepts JWT in Authorization header
- Header: `Authorization: Bearer <token>`
- Works with or without JWT

### GET /enrollments/list (UPDATED)
Now accepts JWT in Authorization header
- Header: `Authorization: Bearer <token>`
- Query params: email, contactId (optional with JWT)

### GET /progress/read (UPDATED)
Same JWT support as above

### GET /progress/aggregate (UPDATED)
Same JWT support as above

## Public API (window.hhIdentity)

```javascript
// Check if identity is ready
await window.hhIdentity.ready;

// Get current identity
const identity = window.hhIdentity.get();
// Returns: { email, contactId, firstname, lastname } or null

// Login with email
await window.hhIdentity.login('user@example.com');
// Stores token in localStorage, updates identity cache

// Logout
window.hhIdentity.logout();
// Clears localStorage, resets cache

// Check if authenticated
if (window.hhIdentity.isAuthenticated()) {
  // User is logged in
}

// Check if ready
if (window.hhIdentity.isReady()) {
  // Identity resolution complete
}
```

## Migration Path

### Current State (Phase 1)
- Membership API works on private pages
- JWT works on public pages
- Tests accept both methods

### Next State (Phase 2)
- All pages use JWT as primary
- Membership becomes fallback
- Tests expect JWT by default

## Testing Strategy

### For JWT Authentication
1. Set required environment variables
2. Call `/auth/login` with test email
3. Store token in localStorage
4. Verify token in Authorization header
5. Check identity resolves from `window.hhIdentity.get()`

### For Backward Compatibility
1. Tests should accept EITHER membership OR JWT
2. Don't hardcode URLs
3. Read from constants.json when possible
4. Support both localStorage tokens AND cookies

## References in Documentation

- **Architecture**: `docs/adr/001-public-page-authentication.md`
- **Implementation**: `docs/auth-and-progress.md`
- **Configuration**: `.env.example`

## Investigation Metadata

- **Date**: 2025-10-26
- **Scope**: Full codebase analysis
- **Level**: Very Thorough
- **PR References**: #252, #254, #242, #251, #253, #255
- **Related Issues**: #233, #234, #235, #237, #239, #244, #245, #246
- **Document Size**: 24KB total (2 reports)
- **Code Examples**: 15+ code snippets included
- **File Coverage**: 25+ implementation files analyzed

## Next Steps

1. Review JWT-AUTH-ANALYSIS.md for complete technical details
2. Use JWT-AUTH-QUICK-REFERENCE.md for quick lookups
3. Update failing test files using the specific line numbers provided
4. Run tests with proper environment variables
5. Verify both authentication flows work correctly

## Quick Links to Key Files

**Reports** (in project root):
- `/home/ubuntu/afewell-hh/hh-learn/JWT-AUTH-ANALYSIS.md`
- `/home/ubuntu/afewell-hh/hh-learn/JWT-AUTH-QUICK-REFERENCE.md`

**Implementation**:
- `/home/ubuntu/afewell-hh/hh-learn/src/api/lambda/auth.ts`
- `/home/ubuntu/afewell-hh/hh-learn/src/api/lambda/index.ts`
- `/home/ubuntu/afewell-hh/hh-learn/clean-x-hedgehog-templates/assets/js/auth-context.js`

**Failing Tests**:
- `/home/ubuntu/afewell-hh/hh-learn/tests/e2e/auth.spec.ts`
- `/home/ubuntu/afewell-hh/hh-learn/tests/e2e/enrollment-cta.spec.ts`
- `/home/ubuntu/afewell-hh/hh-learn/tests/e2e/auth-redirect.spec.ts`

**Reference Tests** (for examples):
- `/home/ubuntu/afewell-hh/hh-learn/tests/api/membership-smoke.spec.ts`
- `/home/ubuntu/afewell-hh/hh-learn/tests/e2e/enrollment-flow.spec.ts`

**Documentation**:
- `/home/ubuntu/afewell-hh/hh-learn/docs/adr/001-public-page-authentication.md`
- `/home/ubuntu/afewell-hh/hh-learn/docs/auth-and-progress.md`

---

**Start with the Quick Reference if you're in a hurry, dive into the Analysis for complete details.**
