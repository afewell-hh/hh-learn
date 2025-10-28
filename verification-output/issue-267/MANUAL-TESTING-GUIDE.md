# Issue #267: Manual Testing Guide

## Prerequisites

1. **Deploy Updated Files to HubSpot**
   - File: `clean-x-hedgehog-templates/learn/auth-handshake.html`
   - Upload via HubSpot Design Manager or CLI
   - Publish the changes

2. **Test Account**
   - Email: `afewell@gmail.com` (from issue description)
   - Or use any valid HubSpot CRM contact email

3. **Browser Setup**
   - Open browser in incognito/private mode (clean session)
   - Open DevTools Console (F12)
   - Open Network tab to monitor redirects

## Test Scenario 1: Course Page Login

### Steps

1. **Navigate to a course page** (not logged in)
   ```
   https://hedgehog.cloud/learn/courses/[any-course-slug]
   ```
   Example: `https://hedgehog.cloud/learn/courses/kubernetes-basics`

2. **Verify CTA shows "Sign in to start course"**
   - Button should be blue with white text
   - Should not show "✓ Enrolled" state

3. **Click the "Sign in to start course" button**
   - Browser should redirect to HubSpot membership login page
   - URL should look like: `/_hcms/mem/login?redirect_url=...`

4. **Check the redirect_url parameter in browser address bar**
   ```
   Expected pattern: /_hcms/mem/login?redirect_url=%2Flearn%2Fauth-handshake%3Fredirect_url%3D%252Flearn%252Fcourses%252F[course-slug]
   ```
   - Note the double encoding: `%252F` = encoded `/`

5. **Complete the login**
   - Enter test account email: `afewell@gmail.com`
   - Complete authentication flow

6. **Verify redirect to auth-handshake page**
   - URL should briefly show: `/learn/auth-handshake?redirect_url=%2Flearn%2Fcourses%2F[course-slug]`
   - Should see "Signing you in..." spinner

7. **CRITICAL: Verify final redirect**
   - Browser should land back on: `/learn/courses/[course-slug]`
   - **NOT** `/learn/%2Flearn%2Fcourses%2F[course-slug]` (encoded path)
   - Check browser address bar for `%2F` sequences

8. **Verify CTA updates**
   - Button should now show "Start Course" or "✓ Enrolled in Course"
   - Button should be green with dark green text (enrolled state)
   - Should NOT still show "Sign in to start course"

9. **Check browser console for logs**
   ```javascript
   [auth-handshake] Identity stored: {hasEmail: true, hasContactId: true}
   [auth-handshake] Redirecting to: /learn/courses/[course-slug]
   [hhl-enroll] Initialized (CRM) {contentType: 'course', slug: '[course-slug]'}
   ```

### Expected Results

✓ Redirects to correct course URL without `%2F` encoding
✓ Page reloads with identity
✓ CTA changes from "Sign in" to enrolled state
✓ No JavaScript errors in console
✓ User remains on the same course page

### Failure Indicators

✗ URL contains `%2Flearn%2F` or `%252F` sequences
✗ 404 error page
✗ CTA still shows "Sign in to start course"
✗ Identity not populated in console logs

---

## Test Scenario 2: Pathway Page Login

### Steps

1. **Navigate to a pathway page** (not logged in)
   ```
   https://hedgehog.cloud/learn/pathways/[pathway-slug]?tab=overview
   ```

2. **Click "Sign in to enroll" button**

3. **Complete login**

4. **Verify redirect**
   - Should land on: `/learn/pathways/[pathway-slug]?tab=overview`
   - Query parameter `?tab=overview` should be preserved
   - No encoded sequences

5. **Verify CTA updates**
   - Should show "Enroll in Pathway" or "✓ Enrolled in Pathway"

---

## Test Scenario 3: Login from Catalog Page

### Steps

1. **Navigate to catalog page**
   ```
   https://hedgehog.cloud/learn
   ```

2. **Click any "Sign in" link**

3. **Complete login**

4. **Verify redirect**
   - Should land on: `/learn` (catalog page)
   - No encoded sequences

---

## Test Scenario 4: Complex URLs

### Test with special characters and query params

1. **Test URL:**
   ```
   /learn/courses/example?source=email&campaign=test&utm_medium=social#section-2
   ```

2. **Expected after login:**
   ```
   /learn/courses/example?source=email&campaign=test&utm_medium=social#section-2
   ```
   - All query params preserved
   - Fragment/hash preserved
   - No encoding issues

---

## Debugging Failed Tests

### If redirect URL is wrong (contains %2F):

1. **Check auth-handshake.html deployment**
   ```bash
   # Verify the file has the decodeURIComponent fix
   grep -A5 "decodeURIComponent" clean-x-hedgehog-templates/learn/auth-handshake.html
   ```

2. **Check browser console during redirect**
   - Look for `[auth-handshake] Redirecting to:` log
   - The URL logged should NOT contain `%2F`

3. **Check HubSpot CMS cache**
   - Clear browser cache
   - Try with `?nocache=1` parameter
   - Verify file is published in HubSpot Design Manager

### If CTA doesn't update:

1. **Check identity is stored**
   ```javascript
   // Browser console
   sessionStorage.getItem('hhl_identity')
   ```
   Should return JSON with email and contactId

2. **Check enrollment.js is running**
   ```javascript
   // Browser console
   window.hhInitEnrollment
   ```
   Should be a function

3. **Check for JavaScript errors**
   - Look for errors in console
   - Verify auth-context.js loaded first

### If page doesn't reload:

1. **Check the 500ms timeout in auth-handshake.html**
   - Should redirect after storing identity
   - Look for console errors preventing redirect

2. **Check HubSpot membership session**
   ```javascript
   // Browser console
   fetch('/_hcms/api/membership/v1/profile').then(r => r.json()).then(console.log)
   ```
   Should return contact data, not 404

---

## Capturing Verification Artifacts

### Screenshots to capture:

1. `01-course-page-before-login.png`
   - Course page showing "Sign in to start course" button
   - Browser address bar visible

2. `02-login-redirect-url.png`
   - HubSpot login page
   - Address bar showing full redirect_url parameter

3. `03-auth-handshake-spinner.png`
   - Auth handshake page with spinner
   - Address bar showing handshake URL

4. `04-final-redirect.png`
   - Back on course page after login
   - Address bar showing clean URL (no %2F)
   - CTA showing enrolled state

5. `05-browser-console-logs.png`
   - Console showing auth-handshake logs
   - Identity stored confirmation
   - Redirect URL logged

### Browser console logs to capture:

```bash
# Save console output to file
# Copy all console logs mentioning:
# - [auth-handshake]
# - [hhl-enroll]
# - Identity
# - Redirect
```

### Network tab capture:

1. Filter by `auth-handshake`
2. Capture the redirect response
3. Check `Location` header value
4. Verify it doesn't contain encoded slashes

---

## Success Criteria

All scenarios pass:
- ✓ Course page login works correctly
- ✓ Pathway page login works correctly
- ✓ Catalog page login works correctly
- ✓ Complex URLs with query params work
- ✓ No `%2F` sequences in final URLs
- ✓ CTA updates to enrolled state
- ✓ Identity persisted in sessionStorage
- ✓ No JavaScript errors

---

## Rollback Plan

If the fix causes issues:

1. **Revert auth-handshake.html**
   ```javascript
   // Remove the decodeURIComponent call
   var redirectUrl = urlParams.get('redirect_url') || '/learn';
   ```

2. **Redeploy to HubSpot**

3. **Investigate root cause further**
   - Check if enrollment.js encoding is the real issue
   - Consider alternative fix in enrollment.js instead

---

## Related Documentation

- Issue #267: Fix auth-handshake redirect encoding on course CTA
- Issue #244: Auth handshake implementation
- Issue #266: Manual verification (blocked by this bug)
- `docs/auth-and-progress.md`: Authentication flow documentation
