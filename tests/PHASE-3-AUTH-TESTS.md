# Phase 3: Auth Endpoints Tests (Issue #303)

**Status:** Test Scaffolding Complete - Ready for Implementation (TDD Red Phase)
**Created:** 2026-01-17
**Updated:** 2026-01-17 (Fixed critical test issues)
**Phase:** Phase 3 - Auth Endpoints + PKCE Cookies

## Overview

This document describes the test suite for the Cognito-based External SSO authentication endpoints. These tests follow TDD principles and are written **before** implementation.

## Test Files Created

### 1. E2E Tests: `tests/e2e/cognito-auth-flow.spec.ts`

**Purpose:** End-to-end Playwright tests for the complete auth flow from user perspective.

**Test Coverage:**
- **Login Redirect with PKCE**
  - Redirects to Cognito Hosted UI with correct parameters
  - Generates unique `code_challenge` (S256 method)
  - Includes `state` parameter for CSRF protection
  - Preserves `redirect_url` in state
  - Handles missing `redirect_url` with defaults

- **OAuth Callback and Cookie Setting**
  - Exchanges authorization code for tokens
  - Sets `hhl_access_token` cookie (httpOnly, Secure, SameSite=Strict)
  - Sets `hhl_refresh_token` cookie (scoped to `/auth` path)
  - Validates state parameter (CSRF protection)
  - Handles missing/invalid code parameter
  - Redirects to original page after successful auth

- **Logout Flow**
  - Clears auth cookies on logout
  - Redirects to Cognito logout or site home
  - Handles logout when not authenticated

- **Session Persistence**
  - Maintains session across page reloads
  - Maintains session across navigation
  - Cookies persist correctly

- **Cookie Security Attributes**
  - Access token: httpOnly, Secure, SameSite=Strict, path=/
  - Refresh token: httpOnly, Secure, SameSite=Strict, path=/auth
  - Cookies not accessible via JavaScript

**Total Tests:** 15 test cases (10 active, 5 skipped pending implementation)

---

### 2. API Tests: `tests/api/auth-me.spec.ts`

**Purpose:** API-level tests for the `/auth/me` endpoint that returns user profile.

**Test Coverage:**
- **Successful Profile Retrieval**
  - Returns user profile with valid access token
  - Includes all expected profile fields
  - Returns consistent data on multiple requests

- **Authentication Failures (401)**
  - Missing access token cookie
  - Invalid JWT signature
  - Expired JWT token
  - Malformed JWT
  - Wrong JWT issuer

- **Error Response Format**
  - Consistent error shape
  - Includes WWW-Authenticate header

- **CORS and Security Headers**
  - Proper CORS headers for allowed origins
  - Rejects unapproved origins

- **User Profile Data from DynamoDB**
  - Fetches from DynamoDB users table
  - Handles user not found (404 or auto-create)

- **Performance and Caching**
  - Responds within 500ms (p95 requirement)
  - No caching of sensitive user data

**Total Tests:** 17 test cases

---

### 3. Negative Tests: `tests/api/auth-endpoints-negative.spec.ts`

**Purpose:** Comprehensive negative testing and edge cases for all auth endpoints.

**Test Coverage:**
- **GET /auth/login - Error Cases**
  - Extremely long `redirect_url`
  - Open redirect prevention
  - JavaScript protocol rejection
  - Malformed `redirect_url`
  - Unique `code_challenge` generation

- **GET /auth/callback - Error Cases**
  - Missing `code` parameter
  - Missing `state` parameter
  - Invalid authorization code
  - PKCE code_verifier mismatch
  - Invalid state signature
  - Cognito error parameter handling
  - CSRF prevention (state validation)
  - Cognito token exchange failure
  - SQL injection attempts

- **POST /auth/logout - Error Cases**
  - Logout when not logged in
  - Cookie clearing even if Cognito fails
  - Invalid/expired token handling

- **Rate Limiting**
  - Excessive login requests (429)
  - Retry-After header on rate limit

- **Security Headers**
  - No server information exposure
  - X-Frame-Options for clickjacking prevention
  - X-Content-Type-Options: nosniff

- **Cookie Edge Cases**
  - Oversized cookie values
  - Special characters in cookies

- **Concurrent Requests**
  - Concurrent `/auth/me` requests

- **Edge Cases**
  - No User-Agent header
  - Invalid Content-Type
  - IPv6 requests

**Total Tests:** 30+ test cases

---

## Total Test Coverage

**62+ test cases** (57 active, 5 skipped) covering:
- ✅ Happy path flows (login, callback, logout, profile)
- ✅ Security (PKCE, CSRF, cookies, headers)
- ✅ Error handling (401, 400, 404, 429)
- ✅ Edge cases (malformed input, concurrency)
- ✅ Performance (latency requirements)
- ✅ CORS and cross-origin security

**Note:** 5 tests are temporarily skipped pending test bypass implementation

---

## Running Tests

### All Auth Tests
```bash
npm run test:e2e -- tests/e2e/cognito-auth-flow.spec.ts
npm run test:api -- tests/api/auth-me.spec.ts
npm run test:api -- tests/api/auth-endpoints-negative.spec.ts
```

### Individual Test Suites
```bash
# E2E auth flow
npx playwright test tests/e2e/cognito-auth-flow.spec.ts

# API /auth/me tests
npx playwright test tests/api/auth-me.spec.ts

# Negative tests
npx playwright test tests/api/auth-endpoints-negative.spec.ts
```

---

## Expected Behavior (TDD Red Phase)

**Currently:** All tests should **FAIL** because the endpoints are not implemented yet.

This is the expected "Red" phase of Test-Driven Development:
1. ✅ **Red:** Write failing tests first (CURRENT STATE)
2. ⏳ **Green:** Implement endpoints to make tests pass
3. ⏳ **Refactor:** Clean up implementation

---

## Test Fixes Applied (2026-01-17)

The following critical issues were identified and fixed before implementation:

### 1. CORS allowCredentials Updated ✅
- **Issue:** `serverless.yml` had `allowCredentials: false` but tests expected `true`
- **Fix:** Updated `serverless.yml` to set `allowCredentials: true`
- **Impact:** Cookies will now be sent with cross-origin requests from hedgehog.cloud

### 2. Playwright Cookie Handling Fixed ✅
- **Issue:** API tests used `request.get()` which doesn't access browser cookies
- **Fix:** Changed all tests to use `page.request.get()` which is bound to browser context
- **Files Updated:** `tests/api/auth-me.spec.ts`, `tests/api/auth-endpoints-negative.spec.ts`

### 3. Cookie Domain Consistency ✅
- **Issue:** E2E tests set cookies for `hedgehog.cloud` but called API Gateway domain
- **Fix:** Updated all cookie domains to match `API_BASE_URL` (API Gateway)
- **Files Updated:** `tests/e2e/cognito-auth-flow.spec.ts`, `tests/api/auth-endpoints-negative.spec.ts`
- **Production Note:** See "Cookie Domain Architecture" section below

### 4. Mock Auth Code Tests Skipped ✅
- **Issue:** Tests using `MOCK_AUTH_CODE` won't work without test bypass
- **Fix:** Marked 5 tests as `.skip()` with TODO comments
- **Tests Skipped:**
  - `should exchange code for tokens and set httpOnly cookies`
  - `should validate state parameter (CSRF protection)`
  - `should redirect to original page after successful auth`
  - `access token cookie should have correct security attributes`
  - `refresh token cookie should be scoped to /auth path`
- **Implementation Note:** Add test bypass flag or use real Cognito auth to enable these tests

---

## Cookie Domain Architecture (Production Consideration)

**Current Test Setup:** Cookies are scoped to API Gateway domain for testing purposes.

**Production Requirement:** For cookies to work between the frontend (hedgehog.cloud) and API,
the auth endpoints must be accessible from the same domain. Two options:

**Option A: Custom Domain for API Gateway**
```
Frontend: https://hedgehog.cloud
API: https://api.hedgehog.cloud (custom domain mapped to API Gateway)
Cookies: domain=.hedgehog.cloud (shared across subdomains)
```

**Option B: Reverse Proxy through HubSpot CMS**
```
Frontend: https://hedgehog.cloud
API Proxy: https://hedgehog.cloud/api/* -> API Gateway
Cookies: domain=hedgehog.cloud (same domain)
```

**Recommendation:** Option B (reverse proxy) is simpler and doesn't require API Gateway custom domain setup.

---

## Implementation Checklist

Once endpoints are implemented, verify:

- [ ] All E2E tests pass
- [ ] All API tests pass
- [ ] All negative tests pass
- [ ] No test timeouts
- [ ] Performance requirements met (p95 < 500ms)
- [ ] Security headers present
- [ ] Cookies set with correct attributes
- [ ] PKCE flow works end-to-end
- [ ] State validation prevents CSRF
- [ ] Rate limiting active

---

## References

- **Spec:** `docs/specs/issue-299-external-sso-spec.md`
- **Implementation Plan:** `docs/implementation-plan-issue-299.md`
- **Test Plan:** `docs/test-plan-issue-299.md`
- **Phase 1 (Cognito Setup):** Issue #301
- **Phase 2 (DynamoDB Schema):** Issue #302
- **Phase 3 (Auth Endpoints):** Issue #303

---

## Implementation Requirements

### Test Bypass for Mock Auth Codes (Optional but Recommended)

To enable the 5 skipped tests, add a test-only bypass in `/auth/callback`:

```typescript
// In /auth/callback handler
if (process.env.ENABLE_TEST_BYPASS === 'true' && code.startsWith('MOCK_')) {
  // Skip Cognito token exchange
  // Return mock tokens for testing
  return {
    accessToken: 'mock_access_token_for_testing',
    refreshToken: 'mock_refresh_token_for_testing',
    idToken: 'mock_id_token_for_testing'
  };
}
```

**Security:** Ensure `ENABLE_TEST_BYPASS` is ONLY set in test environments, never in staging or production.

---

## Notes for Implementers

1. **PKCE Flow:**
   - Generate `code_verifier` (random, 43-128 chars)
   - Create `code_challenge` = base64url(SHA256(code_verifier))
   - Store `code_verifier` in session/state for callback
   - Send `code_challenge` to Cognito in login redirect

2. **State Parameter:**
   - Must be cryptographically random (32+ chars)
   - Should encode `redirect_url` and `code_verifier`
   - Must be validated in callback to prevent CSRF
   - Consider signed JWT state for tamper protection

3. **Cookie Management:**
   - Use `httpOnly` to prevent XSS
   - Use `Secure` for HTTPS-only
   - Use `SameSite=Strict` for CSRF protection
   - Scope refresh token to `/auth` path
   - Set appropriate `Max-Age` or `Expires`

4. **Error Handling:**
   - Return consistent error shapes
   - Include `WWW-Authenticate` header on 401
   - Log errors but don't expose internals
   - Handle Cognito errors gracefully

5. **Security:**
   - Validate all JWT claims (iss, aud, exp)
   - Use Cognito JWKS for signature verification
   - Implement rate limiting (5 req/min for auth)
   - Sanitize `redirect_url` to prevent open redirect
   - Never log tokens or sensitive data
