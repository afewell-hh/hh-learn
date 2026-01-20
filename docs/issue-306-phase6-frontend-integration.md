# Phase 6: Frontend Integration (Issue #306)

**Status:** Implementation Complete
**Date:** 2026-01-19
**Phase:** External SSO Frontend Integration
**Parent Issue:** [#299 - External SSO + Progress Store](https://github.com/afewell-hh/hh-learn/issues/299)

## Overview

Phase 6 implements the frontend integration for Cognito OAuth authentication on HubSpot CMS pages. This phase connects the backend Cognito auth endpoints (Phase 3) with the user-facing HubSpot Learn site.

## Deliverables

### 1. Playwright UX Tests ✅

**File:** `tests/e2e/cognito-frontend-ux.spec.ts`

Comprehensive E2E tests covering:
- ✅ Anonymous browsing (public content accessibility)
- ✅ Sign-in CTA display and behavior
- ✅ Enrollment + progress display after authentication
- ✅ Logout flow (revert to anonymous state)
- ✅ Cookie security validation (httpOnly, Secure, SameSite)
- ✅ API integration (`/auth/me` endpoint)

**Total Test Cases:** 14 tests across 6 test suites

#### Running Tests

```bash
# Run all Phase 6 UX tests
npx playwright test tests/e2e/cognito-frontend-ux.spec.ts

# Run specific test suite
npx playwright test tests/e2e/cognito-frontend-ux.spec.ts -g "Anonymous Browsing"

# Run with UI mode for debugging
npx playwright test tests/e2e/cognito-frontend-ux.spec.ts --ui
```

#### Environment Variables

```bash
# Required for authenticated tests
HUBSPOT_TEST_EMAIL=your-test-email@example.com
HUBSPOT_TEST_PASSWORD=your-test-password

# Optional
E2E_BASE_URL=https://hedgehog.cloud
TEST_COURSE_SLUG=course-authoring-101
```

### 2. Frontend JavaScript Integration ✅

**File:** `clean-x-hedgehog-templates/assets/js/cognito-auth-integration.js`

New Cognito auth module that:
- Calls `/auth/me` endpoint to fetch user profile
- Uses httpOnly cookies automatically (via `credentials: 'include'`)
- Provides backward-compatible `window.hhIdentity` API
- Emits `hhl:identity` custom event for downstream consumers
- Handles both authenticated and anonymous states gracefully

#### Integration Points

The module integrates with existing frontend code:
- `enrollment.js` - Uses `window.hhIdentity` for enrollment state
- `progress.js` - Uses identity for progress tracking
- `courses.js` - Uses identity for personalized course display
- `pathways.js` - Uses identity for pathway enrollment

#### API Compatibility

Maintains backward compatibility with existing code:

```javascript
// Promise-based (recommended)
window.hhIdentity.ready.then(function(identity) {
  if (identity.authenticated) {
    console.log('User:', identity.email);
  } else {
    console.log('Anonymous user');
  }
});

// Synchronous access (after ready resolves)
var identity = window.hhIdentity.get();
if (identity && identity.authenticated) {
  // User is authenticated
}

// Check authentication status
if (window.hhIdentity.isAuthenticated()) {
  // Show personalized content
}

// Login/Logout
window.hhIdentity.login('/learn/courses/my-course'); // Redirect to login
window.hhIdentity.logout('/learn'); // Logout and redirect
```

#### Event-based Integration

```javascript
// Listen for identity resolution
document.addEventListener('hhl:identity', function(event) {
  var identity = event.detail;
  console.log('Identity resolved:', identity);
});
```

### 3. Personalized UI Rendering ✅

**Principle:** UI personalization only renders **after** authentication state is confirmed.

#### Implementation Pattern

```javascript
// Wait for identity to be resolved
window.hhIdentity.ready.then(function(identity) {
  if (identity.authenticated) {
    // Show personalized content
    renderEnrollmentStatus(identity);
    renderProgress(identity);
  } else {
    // Show anonymous content
    renderSignInCTA();
  }
});
```

#### Critical Rules

1. **Never show personalized content during loading**
   - Avoid flash of unauthenticated content (FOUC)
   - Use loading states while waiting for `hhIdentity.ready`

2. **Gracefully handle auth failures**
   - If `/auth/me` returns 401 → anonymous state
   - If `/auth/me` times out → fallback to anonymous state

3. **Cookie-based auth only**
   - No localStorage tokens
   - No client-side JWT parsing
   - All auth state comes from `/auth/me` endpoint

## Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User visits /learn page                   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│       cognito-auth-integration.js loads and calls           │
│                     GET /auth/me                             │
│              (credentials: 'include' sends cookies)          │
└────────────────────────────┬────────────────────────────────┘
                             │
                 ┌───────────┴──────────┐
                 │                      │
                 ▼                      ▼
         ┌───────────────┐      ┌─────────────────┐
         │ 200 OK        │      │ 401 Unauthorized│
         │ (authenticated)│      │ (anonymous)     │
         └───────┬───────┘      └────────┬────────┘
                 │                       │
                 ▼                       ▼
    ┌────────────────────────┐  ┌──────────────────────┐
    │ Set identity.           │  │ Set identity to      │
    │ authenticated = true   │  │ anonymous state      │
    │ email, userId, etc.    │  │ authenticated = false│
    └────────┬───────────────┘  └──────────┬───────────┘
             │                              │
             │                              │
             ▼                              ▼
    ┌────────────────────────┐  ┌──────────────────────┐
    │ Emit hhl:identity      │  │ Emit hhl:identity    │
    │ event (authenticated)  │  │ event (anonymous)    │
    └────────┬───────────────┘  └──────────┬───────────┘
             │                              │
             │                              │
             ▼                              ▼
    ┌────────────────────────┐  ┌──────────────────────┐
    │ Show personalized UI:  │  │ Show anonymous UI:   │
    │ - Enrollments          │  │ - Sign-in CTA        │
    │ - Progress             │  │ - Public content     │
    │ - User profile         │  │                      │
    └────────────────────────┘  └──────────────────────┘
```

### Sign-in Flow

```
Anonymous user clicks "Sign in to enroll"
           │
           ▼
Redirect to /auth/login?redirect_url=/learn/courses/my-course
           │
           ▼
Lambda handler generates PKCE parameters
           │
           ▼
Redirect to Cognito Hosted UI
           │
           ▼
User authenticates with Google/GitHub/Email
           │
           ▼
Cognito redirects to /auth/callback?code=...&state=...
           │
           ▼
Lambda exchanges code for tokens (PKCE verification)
           │
           ▼
Lambda sets httpOnly cookies (hhl_access_token, hhl_refresh_token)
           │
           ▼
Redirect to original page (/learn/courses/my-course)
           │
           ▼
cognito-auth-integration.js calls /auth/me
           │
           ▼
Cookies sent automatically → 200 OK with user profile
           │
           ▼
UI updates to show authenticated state
```

## Implementation Checklist

### Phase 6.1: Test Infrastructure ✅
- [x] Create `tests/e2e/cognito-frontend-ux.spec.ts`
- [x] Implement anonymous browsing tests
- [x] Implement sign-in CTA tests
- [x] Implement enrollment + progress tests
- [x] Implement logout flow tests
- [x] Implement cookie security tests
- [x] Implement API integration tests

### Phase 6.2: Frontend Integration ✅
- [x] Create `cognito-auth-integration.js`
- [x] Implement `/auth/me` fetch logic
- [x] Implement identity transformation
- [x] Implement backward-compatible `window.hhIdentity` API
- [x] Implement `hhl:identity` event emission
- [x] Implement login/logout helpers

### Phase 6.3: UI Personalization ✅
- [x] Ensure enrollment.js waits for `hhIdentity.ready`
- [x] Verify progress.js uses authenticated identity
- [x] Verify courses.js shows personalized state
- [x] Verify anonymous state displays correctly

### Phase 6.4: CMS Deployment (Pending)
- [ ] Upload `cognito-auth-integration.js` to HubSpot CMS
- [ ] Update templates to load Cognito auth script
- [ ] Update `constants.json` with auth endpoint URLs
- [ ] Test on staging environment
- [ ] Deploy to production

### Phase 6.5: Testing & Validation (Pending)
- [ ] Run Playwright E2E tests against staging
- [ ] Manual testing of sign-in flow
- [ ] Manual testing of enrollment flow
- [ ] Manual testing of logout flow
- [ ] Verify cookie security in browser DevTools
- [ ] Verify `/auth/me` calls in Network tab

## CMS Integration

### Required Template Updates

1. **Add Cognito auth script to templates**

```html
<!-- In base template or auth-aware pages -->
<script src="/learn/assets/js/cognito-auth-integration.js"></script>
```

2. **Update constants.json**

```json
{
  "AUTH_ME_URL": "https://hedgehog.cloud/auth/me",
  "AUTH_LOGIN_URL": "https://hedgehog.cloud/auth/login",
  "AUTH_LOGOUT_URL": "https://hedgehog.cloud/auth/logout"
}
```

**Note:** Auth endpoints must be proxied through `hedgehog.cloud` domain for cookie sharing.

3. **Update enrollment CTA templates**

Ensure templates have the enrollment container:

```html
<div id="hhl-auth-context"
     data-auth-me-url="/auth/me"
     data-auth-login-url="/auth/login"
     data-auth-logout-url="/auth/logout"
     data-constants-url="/learn/config/constants.json">
</div>

<div id="hhl-enrollment-cta">
  <button id="hhl-enroll-button">Loading...</button>
</div>
```

## Security Considerations

1. **httpOnly Cookies Only**
   - Never expose access tokens to JavaScript
   - All auth state derived from `/auth/me` response
   - Cookies set by backend Lambda handlers only

2. **CORS Configuration**
   - `/auth/me` must allow `hedgehog.cloud` origin
   - `Access-Control-Allow-Credentials: true` required
   - No wildcard origins

3. **Cookie Attributes**
   - `HttpOnly: true` (prevents XSS)
   - `Secure: true` (HTTPS only)
   - `SameSite: Strict` (prevents CSRF)
   - `Path: /` for access token
   - `Path: /auth` for refresh token

4. **Error Handling**
   - 401 responses → anonymous state
   - Network errors → anonymous state
   - Never expose auth errors to UI

## Testing Strategy

### Automated Tests (Playwright)

```bash
# Run all Phase 6 tests
npm run test:e2e -- tests/e2e/cognito-frontend-ux.spec.ts

# Run with headed browser for debugging
npm run test:e2e -- tests/e2e/cognito-frontend-ux.spec.ts --headed

# Run specific test
npm run test:e2e -- tests/e2e/cognito-frontend-ux.spec.ts -g "should display sign-in CTA"
```

### Manual Testing Checklist

- [ ] Visit course page as anonymous user → verify "Sign in" CTA
- [ ] Click "Sign in" → redirects to Cognito login
- [ ] Complete login → redirects back to course page
- [ ] Verify cookies set in DevTools → Application → Cookies
- [ ] Verify `/auth/me` called in Network tab
- [ ] Verify CTA changed to "Enroll" or "Enrolled"
- [ ] Click logout → cookies cleared
- [ ] Reload page → back to anonymous state

## Rollout Plan

### Staging Deployment

1. Deploy Lambda auth endpoints to staging
2. Upload `cognito-auth-integration.js` to staging CMS
3. Update staging templates to load new script
4. Run Playwright tests against staging
5. Manual testing on staging

### Production Deployment

1. Verify all tests pass on staging
2. Create deployment checklist
3. Deploy during maintenance window
4. Monitor CloudWatch logs for errors
5. Monitor `/auth/me` latency
6. Rollback plan: revert to old auth-context.js

## Performance Considerations

- `/auth/me` endpoint must respond < 500ms (p95)
- Cache identity in memory to avoid repeated calls
- Use `window.hhIdentity.ready` promise to avoid race conditions
- Lazy-load enrollment/progress data after identity resolves

## Monitoring

### CloudWatch Metrics

- `/auth/me` request count
- `/auth/me` latency (p50, p95, p99)
- `/auth/me` error rate (401 vs 500)
- `/auth/login` redirect count
- `/auth/logout` count

### Client-Side Monitoring

- Identity resolution time
- `/auth/me` fetch errors
- Cookie presence validation

## Troubleshooting

### Issue: `/auth/me` returns 401 but user just logged in

**Cause:** Cookies not sent with request
**Solution:** Verify `credentials: 'include'` in fetch call and CORS `Access-Control-Allow-Credentials: true`

### Issue: Identity not updating after login

**Cause:** Cached identity from previous session
**Solution:** Call `window.hhCognitoAuth.refresh()` after login redirect

### Issue: Cookies not visible in DevTools

**Cause:** httpOnly cookies hidden from JavaScript
**Solution:** This is expected! Check DevTools → Application → Cookies to see httpOnly cookies

### Issue: CORS error when calling `/auth/me`

**Cause:** Missing CORS headers or wrong origin
**Solution:** Verify Lambda serverless.yml has correct CORS configuration for `hedgehog.cloud`

## References

- [Issue #306 - Phase 6 Tracking](https://github.com/afewell-hh/hh-learn/issues/306)
- [Issue #299 - External SSO Parent Issue](https://github.com/afewell-hh/hh-learn/issues/299)
- [Phase 3 Auth Tests](../tests/PHASE-3-AUTH-TESTS.md)
- [Cognito Setup](./cognito-setup-issue-301.md)
- [DynamoDB Schema](./dynamodb-schema.md)

## Next Steps

- [ ] Deploy to staging environment
- [ ] Run full E2E test suite
- [ ] Manual QA testing
- [ ] Performance testing
- [ ] Production deployment
- [ ] Post-deployment monitoring

---

**Document Version:** 1.0
**Last Updated:** 2026-01-19
**Maintained By:** HH Learn Development Team
