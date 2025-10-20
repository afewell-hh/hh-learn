# Issue #237: Membership Profile Instrumentation

**Status**: ✅ Implemented
**Date**: 2025-10-20
**Related Issues**: #233 (Membership login regression), #234 (Implement bootstrapper), #235 (Refactor enrollment UI)

## Summary

This issue requested temporary instrumentation to understand HubSpot CMS membership session behavior and validate the authentication bootstrapper. The implementation provides comprehensive debugging tools to diagnose authentication issues.

## What Was Implemented

### 1. Debug Module (`debug.js`)

Created `/clean-x-hedgehog-templates/assets/js/debug.js` with the following features:

- **Centralized Debug Interface** (`window.hhDebug`):
  - `hhDebug.log(module, message, data)` - Consistent debug logging
  - `hhDebug.warn(module, message, data)` - Warning messages
  - `hhDebug.error(module, message, data)` - Error messages

- **Automatic Instrumentation** (runs on page load when `HHL_DEBUG=true`):
  - Auth bootstrapper inspection (`#hhl-auth-context` div)
  - Cookie capture (names only, no values for privacy)
  - Membership profile API probe (`/_hcms/api/membership/v1/profile`)
  - Detailed logging with grouped console output

- **Helper Functions**:
  - `window.enableHhlDebug()` - Enable debug mode
  - `window.disableHhlDebug()` - Disable debug mode
  - `window.hhDebug.runAll()` - Manual trigger all checks

### 2. Template Integration

Updated `/clean-x-hedgehog-templates/layouts/base.html`:
- Added debug.js before `standard_footer_includes`
- Ensures debug module loads early to capture initial state
- Available on all pages using the base layout

### 3. Automated Testing

Created `/tests/e2e/membership-instrumentation.spec.ts` with three test scenarios:

**Test 1: Anonymous Session Capture**
- Captures baseline behavior without authentication
- Expected results:
  - Profile API: 404 (no session)
  - Auth context: empty email/contactId
  - Minimal cookies (tracking only)

**Test 2: Authenticated Session Capture**
- Full login flow with credential verification
- Captures:
  - Pre-login cookie state
  - Login redirect chain
  - Post-login cookie changes
  - Auth context population
  - Profile API response (200 expected)
  - CTA button state changes

**Test 3: Debug Module Verification**
- Tests the debug module itself
- Verifies console output when `HHL_DEBUG=true`
- Captures all debug logs for analysis

### 4. Manual Testing Guide

Created `/scripts/membership/debug-profile.js`:
- Interactive guide for manual browser testing
- Step-by-step instructions for debugging
- Troubleshooting tips
- Expected behavior documentation

## How to Use

### Method 1: Browser Console (Manual)

1. Open any Learn page: `https://hedgehog.cloud/learn/courses/course-authoring-101`

2. Open browser DevTools console

3. Enable debug mode:
   ```javascript
   localStorage.setItem('HHL_DEBUG', 'true')
   location.reload()
   ```

4. You'll see grouped debug output:
   ```
   [hhl:debug] Debug mode ENABLED
   [hhl:bootstrap] Auth Context Loaded
     ├─ email: (empty or populated)
     ├─ contactId: (empty or populated)
     ├─ enableCrm: true/false
     └─ Authenticated: true/false
   [hhl:cookies] Cookie Information
     ├─ Total cookies: X
     └─ HubSpot cookies: [list]
   [hhl:membership] Profile API Response
     ├─ Status: 200/404
     └─ (response details)
   ```

5. Sign in and observe changes

6. Disable debug mode:
   ```javascript
   localStorage.removeItem('HHL_DEBUG')
   ```

### Method 2: Manual Testing Script

```bash
node scripts/membership/debug-profile.js
```

This displays a comprehensive guide with manual testing steps and troubleshooting tips.

### Method 3: Automated Tests (Recommended)

```bash
# Run all instrumentation tests
npx playwright test tests/e2e/membership-instrumentation.spec.ts

# Run with UI to watch the flow
npx playwright test tests/e2e/membership-instrumentation.spec.ts --headed

# Run specific test
npx playwright test tests/e2e/membership-instrumentation.spec.ts -g "authenticated session"
```

**Output Files** (saved to `verification-output/issue-237/`):
- `anonymous-session-capture.json` - Baseline anonymous behavior
- `authenticated-session-capture.json` - Full login flow capture
- `debug-module-output.json` - Debug module verification
- `post-login-page.png` - Screenshot after authentication

## Expected Results

### Anonymous User

**Auth Context:**
```javascript
{
  email: "",
  contactId: "",
  enableCrm: "true",
  constantsUrl: "https://...",
  loginUrl: "/hs-login"
}
```

**Membership Profile API:**
```
Status: 404 Not Found
```

**CTA Button:**
```
"Sign in to start course"
```

### Authenticated User

**Auth Context:**
```javascript
{
  email: "user@example.com",
  contactId: "12345",
  enableCrm: "true",
  constantsUrl: "https://...",
  loginUrl: "/hs-login"
}
```

**Membership Profile API:**
```
Status: 200 OK
Body: {
  email: "user@example.com",
  contactId: "12345",
  is_logged_in: true,
  // ... other fields
}
```

**CTA Button:**
```
"Start Course" or "✓ Enrolled"
```

**Cookies:**
- Multiple `hs*` cookies should be present
- Session cookies should persist across page navigations

## Configuration Requirements

### HubSpot Portal Settings

From the instrumentation, we can validate these requirements:

1. **CMS Membership Enabled**
   - Check: Profile API should return 200 (not 404) when logged in
   - Setting: Settings > Website > Pages > Memberships

2. **Access Groups Configured**
   - Check: User should be able to log in successfully
   - Setting: Settings > Website > Pages > Memberships > Access Groups

3. **Membership Pages Setup**
   - Check: `/hs-login` should redirect to membership login form
   - Check: After login, should redirect back to original page

4. **Personalization Tokens Working**
   - Check: `request_contact.*` variables should populate auth context
   - Check: Templates should render with user data after login

### Environment Variables

Required for automated tests:
```bash
HUBSPOT_TEST_USERNAME=<cms-membership-email>
HUBSPOT_TEST_PASSWORD=<cms-membership-password>
COURSE_URL=https://hedgehog.cloud/learn/courses/course-authoring-101
```

### Template Constants

In `constants.json`:
```json
{
  "ENABLE_CRM_PROGRESS": true,
  "LOGIN_URL": "/hs-login",
  "LOGOUT_URL": "/hs-logout",
  "TRACK_EVENTS_URL": "https://..."
}
```

## Troubleshooting Guide

### Profile API Returns 404

**Symptoms:**
- `/_hcms/api/membership/v1/profile` returns 404 even after login
- Auth context remains empty after login
- No session cookies visible

**Possible Causes:**
1. CMS Membership not enabled on the portal
2. User not assigned to an access group
3. Session cookies not being set during login
4. Cookie domain mismatch

**Debug Steps:**
1. Check HubSpot portal settings: Settings > Memberships
2. Verify user exists in CRM and is in an access group
3. Inspect Network tab during login for `Set-Cookie` headers
4. Check cookie domain matches the site domain
5. Test in incognito mode to rule out cookie conflicts

### Auth Context Empty After Login

**Symptoms:**
- Profile API returns 200
- But `#hhl-auth-context` has empty email/contactId
- CTA still shows "Sign in to start course"

**Possible Causes:**
1. HubL variables not rendering (`request_contact.is_logged_in` is false)
2. Templates not published
3. Cached template content
4. JavaScript error preventing bootstrapper from loading

**Debug Steps:**
1. Add `?hs_no_cache=1` to URL to bypass HubSpot cache
2. Check browser console for JavaScript errors
3. Verify templates are published in Design Manager
4. Inspect page source to see raw HubL output
5. Check `request_contact.is_logged_in` in template debug mode

### Cookies Not Persisting

**Symptoms:**
- Cookies visible immediately after login
- But disappear on navigation or reload
- User gets logged out unexpectedly

**Possible Causes:**
1. Cookie `SameSite` attribute too restrictive
2. Redirects causing cookie loss
3. Cookie `Secure` flag but testing on HTTP
4. Cookie path doesn't match navigation path

**Debug Steps:**
1. Inspect cookie attributes in DevTools > Application > Cookies
2. Check for intermediate redirects that might clear cookies
3. Verify site is accessed via HTTPS
4. Test with `SameSite=None; Secure` for cross-domain scenarios

### CTA Button Not Updating

**Symptoms:**
- User authenticated (profile API 200)
- Auth context populated
- But CTA still says "Sign in"

**Possible Causes:**
1. JavaScript not reading auth context correctly
2. Enrollment check failing
3. Constants not loaded
4. CRM progress disabled

**Debug Steps:**
1. Check console for `[hhl-enroll]` debug messages
2. Verify `ENABLE_CRM_PROGRESS=true` in constants
3. Check for `/enrollments/list` API call
4. Inspect localStorage for enrollment data
5. Verify `getAuth()` function returns populated data

## Next Steps (Issue #234 & #235)

This instrumentation supports the implementation of:

### Issue #234: Implement Membership Identity Bootstrapper
- Create `auth-context.js` module
- Call `/_hcms/api/membership/v1/profile` client-side
- Emit `hhl:identity` custom event
- Provide `window.hhIdentity.ready` promise

### Issue #235: Refactor Enrollment UI
- Update `enrollment.js` to use bootstrapper
- Remove dependency on HubL-injected data attributes
- Await `window.hhIdentity.ready` before CRM calls
- Centralize identity handling

## Findings Summary

Based on initial testing (to be updated after running tests):

1. **Membership Profile API Behavior**: (To be captured)
2. **Cookie Persistence**: (To be captured)
3. **Auth Context Reliability**: (To be captured)
4. **Required HubSpot Configuration**: (To be documented)

Run the automated tests and manual verification to populate these findings.

## References

- Issue #237: https://github.com/[repo]/issues/237
- Issue #233: Membership login regression
- Issue #234: Implement membership identity bootstrapper
- Issue #235: Refactor enrollment UI to consume bootstrapper
- HubSpot CMS Membership Docs: https://developers.hubspot.com/docs/cms/data/memberships
- Membership API (internal): `/_hcms/api/membership/v1/profile`

## Acceptance Criteria

- [x] Debug helper logs membership profile response status + key fields when `HHL_DEBUG=true`
- [x] Captures cookies set during login (names only, no PII)
- [x] Lightweight debug script injected via base.html when debug enabled
- [x] Playwright tests capture cookie jar + membership profile response
- [ ] Document configuration steps in auth-and-progress.md (Next step)
- [ ] Publish findings to Issue #233 as comment (After test execution)
- [x] Instrumentation can be disabled by removing `HHL_DEBUG` from localStorage

## How to Remove Instrumentation

The instrumentation is **opt-in** via localStorage and has minimal overhead when disabled.

**To disable for a user:**
```javascript
localStorage.removeItem('HHL_DEBUG')
```

**To remove completely from codebase** (after issues resolved):
1. Remove `debug.js` include from `base.html`
2. Delete `/clean-x-hedgehog-templates/assets/js/debug.js`
3. Remove test file: `/tests/e2e/membership-instrumentation.spec.ts`
4. Keep script: `/scripts/membership/debug-profile.js` (useful for future debugging)

The debug module is production-safe and only activates when explicitly enabled.
