# Issue #318 Test Specification

## Overview
Create Playwright tests to verify Cognito-authenticated UX on Learn pages works correctly and that the legacy auth-context.js bug does not regress.

## Background
- Issue #317 resolved architecture for Cognito OAuth integration
- Root cause: Legacy `auth-context.js` was overwriting `window.hhIdentity` after Cognito resolved
- Fix: Remove legacy `auth-context.js` from Learn templates, keep only `cognito-auth-integration.js`

## Test Requirements

### 1. Anonymous User Tests
**Test**: `should verify /auth/me returns 401 for anonymous users`
- Clear all cookies and storage
- Navigate to course page
- Verify /auth/me endpoint is called and returns 401
- Verify sign-in CTA is displayed (`#hhl-enroll-login`)

**Test**: `should display sign-in CTA for anonymous users`
- Clear all cookies and storage
- Navigate to course page
- Verify CTA button shows "Sign in" text
- Verify enrollment button is NOT visible

### 2. Authenticated User Tests
**Test**: `should verify window.hhIdentity includes email for authenticated users`
- Use storage state (authenticated session)
- Navigate to course page
- Wait for window.hhIdentity to resolve
- Verify `window.hhIdentity.get()` returns object with email property
- Verify `window.hhIdentity.isAuthenticated()` returns true

**Test**: `should display enrollment CTA (not sign-in) for authenticated users`
- Use storage state (authenticated session)
- Navigate to course page
- Verify CTA button does NOT contain "Sign in" text
- Verify enrollment button (`#hhl-enroll-button`) is visible

**Test**: `should call /auth/me with cookies for authenticated users`
- Use storage state (authenticated session)
- Track API requests to /auth/me
- Navigate to course page
- Verify /auth/me was called with credentials
- Verify response status is 200 (not 401)

### 3. Regression Guard Tests
**Test**: `should NOT load legacy auth-context.js script`
- Navigate to course page
- Get all loaded scripts from the page
- Verify NO script URL contains 'auth-context.js'
- This prevents regression of the bug from #317

**Test**: `should load cognito-auth-integration.js script`
- Navigate to course page
- Get all loaded scripts from the page
- Verify at least one script URL contains 'cognito-auth-integration.js'
- Verify window.hhCognitoAuth object exists and is initialized

**Test**: `should verify window.hhIdentity is not overwritten after Cognito resolves`
- Use storage state (authenticated session)
- Navigate to course page
- Wait for Cognito to resolve (window.hhIdentity.ready)
- Wait an additional 2 seconds (to allow any legacy scripts to run)
- Re-check window.hhIdentity.get() still has email
- This ensures legacy scripts didn't overwrite the Cognito identity

## Files Modified
- `tests/e2e/cognito-frontend-ux.spec.ts` - Add new tests per above spec
- `tests/e2e/auth.setup.ts` - Already functional, no changes needed
- `playwright.config.ts` - Already configured, no changes needed

## Success Criteria
- All tests pass locally with valid credentials in `.env`
- Anonymous tests verify 401 and sign-in CTA
- Authenticated tests verify email in identity and enrollment CTA
- Regression tests verify only Cognito script loads, not legacy script
- Tests fail if auth-context.js is present or if Cognito identity is corrupted
