# Issue #267: Redirect Encoding Flow Analysis

## Problem Summary
Login redirect from course pages was failing due to double URL encoding, causing:
1. Users redirected to malformed URLs like `/learn/%2Flearn%2Fcourses/...`
2. CTA buttons showing "Sign in" even after successful authentication
3. Page not reloading with identity data

## Root Cause

### Double Encoding in enrollment.js
```javascript
// Line 65-71 in enrollment.js
function buildLoginRedirect(loginUrl) {
  var base = loginUrl || '/_hcms/mem/login';
  var separator = base.indexOf('?') >= 0 ? '&' : '?';
  // FIRST ENCODING: Current page path
  var handshakeUrl = '/learn/auth-handshake?redirect_url=' + encodeURIComponent(window.location.pathname + window.location.search);
  // SECOND ENCODING: Handshake URL
  return base + separator + 'redirect_url=' + encodeURIComponent(handshakeUrl);
}
```

**Example Flow:**
1. User on: `/learn/courses/example-course`
2. First encoding: `redirect_url=%2Flearn%2Fcourses%2Fexample-course`
3. Handshake URL: `/learn/auth-handshake?redirect_url=%2Flearn%2Fcourses%2Fexample-course`
4. Second encoding: `redirect_url=%2Flearn%2Fauth-handshake%3Fredirect_url%3D%252Flearn%252Fcourses%252Fexample-course`
5. Full login URL: `/_hcms/mem/login?redirect_url=%2Flearn%2Fauth-handshake%3Fredirect_url%3D%252Flearn%252Fcourses%252Fexample-course`

### Missing Decode in auth-handshake.html
```javascript
// Line 72 in auth-handshake.html (BEFORE FIX)
var redirectUrl = urlParams.get('redirect_url') || '/learn';
// URLSearchParams.get() automatically decodes ONCE
// But we need TWO decodes because of double encoding
```

**What was happening:**
- URLSearchParams.get() decodes: `/learn%2Fcourses%2Fexample-course`
- Browser navigates to literal: `/learn%2Fcourses%2Fexample-course` (invalid path)
- 404 or wrong page loaded
- Identity not refreshed
- CTA still shows "Sign in"

## Solution Implemented

### Fix in auth-handshake.html
```javascript
// Lines 71-80 in auth-handshake.html (AFTER FIX)
var urlParams = new URLSearchParams(window.location.search);
var rawRedirectUrl = urlParams.get('redirect_url') || '/learn';

// Decode the redirect URL to handle double-encoding from login flow (Issue #267)
var redirectUrl = rawRedirectUrl;
try {
  redirectUrl = decodeURIComponent(rawRedirectUrl);
} catch (e) {
  console.warn('[auth-handshake] Failed to decode redirect_url, using raw value:', e);
}
```

**Why this works:**
1. URLSearchParams.get() decodes once: `/learn%2Fcourses%2Fexample-course`
2. decodeURIComponent() decodes again: `/learn/courses/example-course`
3. Browser navigates to correct page
4. Page reloads with identity
5. CTA updates to enrolled state

**Fallback safety:**
- Try/catch prevents crashes from malformed URLs
- Falls back to raw value if decode fails
- Default fallback to `/learn` if no redirect_url provided

## Why Not Change enrollment.js?

The double-encoding in enrollment.js is **correct by design**:
1. Login system expects encoded redirect URL
2. Handshake URL contains query params that need encoding
3. Outer encoding protects inner query string

Changing enrollment.js would break the login redirect flow.

## Testing Scenarios

### Scenario 1: Course Page Login
- **Start:** `/learn/courses/kubernetes-basics`
- **Click:** "Sign in to start course"
- **Login URL:** `/_hcms/mem/login?redirect_url=%2Flearn%2Fauth-handshake%3Fredirect_url%3D%252Flearn%252Fcourses%252Fkubernetes-basics`
- **After Login:** Redirected to `/learn/auth-handshake?redirect_url=%2Flearn%2Fcourses%2Fkubernetes-basics`
- **URLSearchParams.get():** `/learn%2Fcourses%2Fkubernetes-basics` (still encoded)
- **decodeURIComponent():** `/learn/courses/kubernetes-basics` (correct!)
- **Final:** User lands on `/learn/courses/kubernetes-basics` with identity

### Scenario 2: Pathway Page Login
- **Start:** `/learn/pathways/cloud-fundamentals?tab=overview`
- **Click:** "Sign in to enroll"
- **Login URL:** `/_hcms/mem/login?redirect_url=%2Flearn%2Fauth-handshake%3Fredirect_url%3D%252Flearn%252Fpathways%252Fcloud-fundamentals%253Ftab%253Doverview`
- **After Fix:** User lands on `/learn/pathways/cloud-fundamentals?tab=overview`

### Scenario 3: Catalog Page Login
- **Start:** `/learn`
- **Click:** Any "Sign in" link
- **After Fix:** User lands back on `/learn`

## Verification Checklist

- [ ] Deploy updated `auth-handshake.html` to HubSpot
- [ ] Test login from course page (`afewell@gmail.com`)
- [ ] Verify redirect to correct course URL (no %2F sequences)
- [ ] Verify CTA changes from "Sign in" to "Start Course"/"Enroll"
- [ ] Test login from pathway page
- [ ] Test login from catalog page
- [ ] Capture screenshots and browser console logs
- [ ] Test with query parameters (e.g., `?tab=overview`)
- [ ] Test with URL fragments (e.g., `#section-2`)

## Related Issues
- Issue #244: Auth handshake implementation
- Issue #226: Course CTA enrollment
- Issue #227: Pathway CTA enrollment
- Issue #230: Public login alternative
- Issue #266: Manual verification blocked by this bug

## Files Modified
- `clean-x-hedgehog-templates/learn/auth-handshake.html` (lines 71-80)

## Files NOT Modified (by design)
- `clean-x-hedgehog-templates/assets/js/enrollment.js` (double encoding is correct)
