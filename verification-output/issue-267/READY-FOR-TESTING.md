# Issue #267: Ready for Manual Testing ✅

## Status: Fix is Live in Production

### What Was Done

1. **Fix Implemented** ✅
   - Added `decodeURIComponent()` in auth-handshake.html
   - Handles double-encoded redirect URLs correctly
   - Committed to git (commit f025fe7)

2. **Template Uploaded** ✅
   - Uploaded to: `CLEAN x HEDGEHOG/templates/learn/auth-handshake.html`
   - Command: `hs filemanager upload`

3. **Page Updated** ✅
   - Existing page at `/learn/auth-handshake` already configured
   - Page set to use correct template
   - Page set as Private (requires login)
   - **User clicked "Update"** to publish changes

### The Fix

**Before (lines 71-72 - OLD):**
```javascript
var urlParams = new URLSearchParams(window.location.search);
var redirectUrl = urlParams.get('redirect_url') || '/learn';
```

**After (lines 71-80 - NEW):**
```javascript
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

## Manual Testing Required

### Test 1: Verify the Fix Works

**Steps:**
1. Open browser in **incognito/private mode**
2. Go to: https://hedgehog.cloud/learn/courses/course-authoring-101
3. Click "Sign in to start course" button
4. Complete login with `afewell@gmail.com` / `Ar7far7!`
5. **Watch the redirect flow:**
   - Should see `/_hcms/mem/login?redirect_url=...`
   - Then briefly see `/learn/auth-handshake?redirect_url=...`
   - Then land on `/learn/courses/course-authoring-101`

**Expected Results:**
- ✅ Final URL is clean: `/learn/courses/course-authoring-101`
- ✅ NO encoded characters: Should NOT see `%2F` anywhere
- ✅ CTA updates: Button changes from "Sign in..." to "Start Course" or "✓ Enrolled"
- ✅ Page reloads with identity

**Failure Indicators:**
- ❌ URL contains `%2F`: `/learn%2Fcourses%2Fcourse-authoring-101`
- ❌ CTA still says "Sign in to start course"
- ❌ 404 error page
- ❌ Stuck on handshake page

### Test 2: Check Browser Console

After the redirect completes, open DevTools (F12) → Console tab.

**Expected logs:**
```
[auth-handshake] Identity stored: {hasEmail: true, hasContactId: true}
[auth-handshake] Redirecting to: /learn/courses/course-authoring-101
[hhl-enroll] Auth context: {hasEmail: true, hasContactId: true, ...}
[hhl-enroll] Initialized (CRM) {contentType: 'course', slug: 'course-authoring-101'}
```

**Failure indicators:**
```
[auth-handshake] Redirecting to: /learn%2Fcourses%2Fcourse-authoring-101
```
(Notice the `%2F` - this means fix didn't work)

### Test 3: Verify Different Page Types

Test the fix on multiple page types:

**Course Page:**
- https://hedgehog.cloud/learn/courses/course-authoring-101

**Pathway Page:**
- https://hedgehog.cloud/learn/pathways/course-authoring-expert

**Catalog Page:**
- https://hedgehog.cloud/learn

All should redirect correctly without `%2F` encoding.

## What to Report

### If All Tests Pass ✅

Post on Issue #267:
```
✅ Issue #267 VERIFIED

Tested login redirect from course page:
- Final URL is clean (no %2F encoding)
- CTA updated from "Sign in" to enrolled state
- Browser console shows correct redirect URL
- Identity persisted correctly

Screenshots: [attach screenshots]

Fix is working as expected. Ready to close Issue #267.
```

### If Tests Fail ❌

Post on Issue #267:
```
❌ Issue #267 FAILED

Problem: [describe what went wrong]
- Final URL: [paste actual URL]
- CTA state: [describe button state]
- Console errors: [paste errors]

Screenshots: [attach screenshots]

The fix did not resolve the issue.
```

## Screenshots to Capture

1. **Before login:** Course page showing "Sign in to start course"
2. **Login page:** HubSpot membership login
3. **After login:** Final redirect URL in address bar (showing no %2F)
4. **CTA state:** Button showing enrolled state
5. **Browser console:** Showing redirect logs

Save to: `verification-output/issue-267/manual-test-screenshots/`

## After Verification

### If Fix Works:
1. Update `verification-output/issue-267/RESOLUTION-SUMMARY.md`
2. Add "Verified in production ✅" status
3. Close Issue #267
4. Proceed with Issue #266 (full manual UI testing)

### If Fix Fails:
1. Capture detailed error information
2. Check if template really updated (view page source in browser)
3. Check for caching issues (try `?hs_no_cache=1`)
4. Report findings and reopen investigation

## Related Documentation

- Issue analysis: `verification-output/issue-267/ENCODING-FLOW-ANALYSIS.md`
- Resolution summary: `verification-output/issue-267/RESOLUTION-SUMMARY.md`
- Full manual guide: `verification-output/issue-267/MANUAL-TESTING-GUIDE.md`
- Deployment status: `verification-output/issue-267/DEPLOYMENT-STATUS.md`

## Next Steps After This

Once Issue #267 is verified, proceed to Issue #266:
- Complete 6 manual UI test scenarios
- Use guide: `verification-output/issue-266/README.md`
- This will verify the entire enrollment CTA flow

---

**Status:** ✅ Ready for human tester to verify fix
**Test time:** 5-10 minutes
**Test account:** afewell@gmail.com / Ar7far7!
**Critical test:** Final URL must not contain `%2F`
