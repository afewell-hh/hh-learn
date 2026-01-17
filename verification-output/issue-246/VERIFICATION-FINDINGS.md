# Issue #246 Verification Findings

## Date
2025-10-25

## Summary
Testing the public-page login handshake and enrollment flow to verify that Issues #244 and #245 implementations work end-to-end.

## Test Environment
- Course URL: `https://hedgehog.cloud/learn/courses/course-authoring-101`
- Handshake URL: `https://hedgehog.cloud/learn/auth-handshake`
- Action Runner URL: `https://hedgehog.cloud/learn/action-runner`
- Test User: `afewell@gmail.com`

## Components Tested

### 1. Auth Handshake (`/learn/auth-handshake`)
**Purpose**: Private page that captures `request_contact` identity and stores it in `sessionStorage` before redirecting back to the public page.

**Template Location**: `clean-x-hedgehog-templates/learn/auth-handshake.html`

**Expected Flow**:
1. User signs in via `/_hcms/mem/login?redirect_url=/learn/auth-handshake?redirect_url=<original_page>`
2. Handshake page populates `sessionStorage.hhl_identity` with `{ email, contactId, firstname, lastname, timestamp }`
3. Page immediately redirects to original public page
4. Public page reads identity from sessionStorage via `auth-context.js`

### 2. Identity Bootstrapper (`auth-context.js`)
**Purpose**: Provides `window.hhIdentity` API that prioritizes sessionStorage over membership API.

**Script Location**: `clean-x-hedgehog-templates/assets/js/auth-context.js`

**Identity Resolution Priority**:
1. **First**: Check `sessionStorage.hhl_identity` (from handshake - Issue #244)
2. **Second**: Check `window.hhServerIdentity` (server-side bootstrap)
3. **Third**: Fallback to `/_hcms/api/membership/v1/profile` (only works on private pages)

### 3. Action Runner (`/learn/action-runner`)
**Purpose**: Private page that executes enrollment/progress actions using `request_contact` identity.

**Template Location**: `clean-x-hedgehog-templates/learn/action-runner.html`

**Supported Actions**:
- `enroll_pathway` - Posts `learning_pathway_enrolled` event
- `enroll_course` - Posts `learning_course_enrolled` event
- `record_progress` - Posts `learning_module_started/completed` events

## Playwright Test Results

### Test Run #1 (Initial)
**Status**: ❌ Failed
**Issue**: Expected anonymous state but user was already authenticated
**Cause**: Browser had existing session cookies from previous testing
**Solution**: Added `context.clearCookies()` and `sessionStorage.clear()` before test

### Test Run #2 (With Clean State)
**Status**: ❌ Failed
**Issue**: Handshake page was visited but `sessionStorage.hhl_identity` was `null`
**Console Output**:
```
Handshake page detected, waiting for redirect...
sessionStorage.hhl_identity: null
window.hhIdentity.get(): { email: '', contactId: '' }
```

**Findings**:
- Login flow properly redirected to handshake page ✅
- Handshake page was detected in the URL ✅
- Redirect back to course page occurred ✅
- BUT: sessionStorage was not populated ❌

**Possible Root Causes**:
1. **Handshake page not configured as private** in HubSpot CMS
   - If the page is public, `request_contact.is_logged_in` will be false
   - HubL variables won't populate with membership data

2. **Membership session not established** after login
   - Login might be completing but session cookies not being set
   - Cookie domain/path mismatch
   - SameSite cookie restrictions

3. **JavaScript execution timing issue**
   - Script might be redirecting before sessionStorage.setItem() completes
   - The 500ms timeout might not be sufficient in automation

4. **Editor mode detection**
   - If `is_in_editor` or related flags are true, the handshake skips logic

## Code Review Findings

### ✅ Login URL Construction (enrollment.js:65-71)
```javascript
function buildLoginRedirect(loginUrl) {
  var base = loginUrl || '/_hcms/mem/login';
  var separator = base.indexOf('?') >= 0 ? '&' : '?';
  // Redirect to handshake page to capture identity, then back to current page (Issue #244)
  var handshakeUrl = '/learn/auth-handshake?redirect_url=' + encodeURIComponent(window.location.pathname + window.location.search);
  return base + separator + 'redirect_url=' + encodeURIComponent(handshakeUrl);
}
```
**Verdict**: ✅ Correctly builds nested redirect through handshake

### ✅ Identity Priority (auth-context.js:215-282)
```javascript
// Priority 1: Check sessionStorage (from auth handshake page) - Issue #244
var storedIdentity = null;
try {
  var stored = sessionStorage.getItem('hhl_identity');
  if (stored) {
    storedIdentity = JSON.parse(stored);
    // ... TTL check (6 hours) ...
  }
} catch (e) { /* ... */ }

// Priority 2: Check if server-side identity is available (Issue #244)
if (window.hhServerIdentity && (window.hhServerIdentity.email || window.hhServerIdentity.contactId)) {
  identityPromise = Promise.resolve({ ... });
} else {
  // Priority 3: Fallback to membership profile API (works on private pages)
  identityPromise = fetchMembershipProfile();
}
```
**Verdict**: ✅ Proper fallback chain implemented

### ⚠️ Handshake Page Configuration (auth-handshake.html:61-106)
```html
{% set is_editor_mode = is_in_editor or is_in_page_preview or request.query_dict.hs_preview or request.query_dict.hs_builder %}
{% if is_editor_mode %}
  <div style="...">Editor preview detected. Redirect logic is disabled...</div>
{% else %}
  <script>
    {% if request_contact.is_logged_in %}
      var identity = {
        email: "{{ request_contact.email|escapejs }}",
        contactId: "{{ handshake_contact_id|escapejs }}",
        // ...
      };
      sessionStorage.setItem('hhl_identity', JSON.stringify(identity));
    {% else %}
      console.warn('[auth-handshake] User is not logged in on private page - this should not happen');
    {% endif %}

    setTimeout(function() {
      window.location.href = redirectUrl;
    }, 500);
  </script>
{% endif %}
```

**Potential Issues**:
1. **Critical**: If `request_contact.is_logged_in` is false, sessionStorage is never set
2. **Critical**: If page is not configured as private in HubSpot, membership vars won't populate
3. Minor: 500ms delay might cause race conditions in automation

## Next Steps to Debug

### 1. Verify Handshake Page Configuration
**Action**: Check HubSpot CMS to ensure `/learn/auth-handshake` is configured as Private Content
**How to verify**:
- Visit HubSpot CMS → Website Pages → Find "Auth Handshake (Private)"
- Settings → Advanced Options → Content Access → Should be "Private" with access group assigned
- Page URL should be `/learn/auth-handshake`

### 2. Manual Browser Test
**Steps**:
1. Open incognito browser
2. Visit `https://hedgehog.cloud/learn/courses/course-authoring-101`
3. Click "Sign in to start course"
4. Login with test credentials
5. **Observe**: Does URL pass through `/learn/auth-handshake`?
6. **After redirect**, open DevTools Console and run:
   ```javascript
   console.log('sessionStorage:', sessionStorage.getItem('hhl_identity'));
   console.log('window.hhIdentity:', window.hhIdentity.get());
   ```
7. Document results

### 3. Add Diagnostic Logging
**Option A**: Add query param to handshake URL to enable verbose logging
**Option B**: Create a diagnostic version of the handshake page that logs all variables

### 4. Check Membership Configuration
**Verify**:
- Membership feature is enabled on the HubSpot portal
- Test user (`afewell@gmail.com`) is assigned to the correct access group
- Access group has permission to view the handshake page

## Recommendations

### Immediate (Required for Issue #246)
1. ✅ **Verify handshake page is configured as private** in HubSpot CMS
2. ✅ **Manual browser test** to confirm sessionStorage population
3. ✅ **Check membership settings** for test user

### Short-term (Robustness)
1. Add error handling in handshake page for when `request_contact.is_logged_in` is false
2. Add diagnostic logging to handshake page (controlled by query param)
3. Increase timeout or add explicit wait for sessionStorage to be set
4. Add fallback to window.hhServerIdentity if sessionStorage fails

### Long-term (Issue #242)
1. Implement public-page authentication alternative (as noted in `docs/auth-and-progress.md`)
2. Move away from dependency on HubSpot CMS Membership for public pages
3. Consider OAuth proxy or signed token approach

## Related Issues
- Issue #233: Membership login regression on Learn pages
- Issue #244: Align Learn enrollment with nav membership detection (handshake implementation)
- Issue #245: Implement private action runner for enrollment/progress
- Issue #242: Design & implement public-page authentication alternative (future work)

## Files Modified
- `tests/e2e/enrollment-flow.spec.ts` - Updated to test handshake flow with proper cleanup
- (Pending) `docs/auth-and-progress.md` - Will update once flow is verified

## Artifacts Generated
- `verification-output/issue-246/playwright-test-output.log` - Test execution logs
- `verification-output/issue-246/VERIFICATION-FINDINGS.md` - This document
- Screenshots (pending successful test run):
  - `1-anonymous-state.png` or `1-already-authenticated.png`
  - `2-login-form.png`
  - `3-authenticated-state.png`
  - `4-post-enrollment.png`
  - `5-my-learning.png`
- `verification-output/issue-246/test-report.json` - Detailed test results (pending)

## Status
🔴 **BLOCKED** - Waiting for confirmation that handshake page is properly configured as private content in HubSpot CMS

The implementation appears correct in code, but the handshake page may not be deployed or configured correctly in the HubSpot portal.
