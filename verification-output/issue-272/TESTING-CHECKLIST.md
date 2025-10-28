# Issue #272 - Testing Checklist

**Date:** 2025-10-27
**Issue:** Execute Issue #270 – HubSpot Native Authentication
**Status:** Ready for Testing

---

## Environment Setup

Your `.env` file already contains the necessary credentials:
- `HUBSPOT_TEST_EMAIL`
- `HUBSPOT_TEST_USERNAME`
- `HUBSPOT_TEST_PASSWORD`

Use these whenever Playwright or manual login needs to exercise HubSpot's native membership form.

---

## Prerequisites

### First-Time Setup
```bash
# Install dependencies and Playwright browsers
npm install && npx playwright install
```

---

## Manual Testing

### Test 1: Anonymous User Login Flow

**Steps:**
1. Open browser in incognito/private mode
2. Navigate to a course page (e.g., `/learn/courses/course-authoring-101`)
3. Verify CTA button shows "Sign in to start course"
4. Click the "Sign in to start course" button
5. **Expected:** Redirect to `/_hcms/mem/login?redirect_url=<current-page>`
6. Log in using credentials from `.env`:
   - Email: `HUBSPOT_TEST_EMAIL`
   - Password: `HUBSPOT_TEST_PASSWORD`
7. **Expected:** Redirect back to the original course page
8. **Expected:** CTA button now shows "Start Course" or "✓ Enrolled in Course"

**Success Criteria:**
- ✅ No email prompt modal appears
- ✅ Redirect to HubSpot native login page
- ✅ Return to original page after login
- ✅ CTA reflects authenticated state
- ✅ No console errors

---

### Test 2: Left Navigation Authentication

**Steps:**
1. Open browser in incognito/private mode
2. Navigate to `/learn`
3. Verify left nav shows "Sign In" link
4. Click "Sign In" in left navigation
5. **Expected:** Redirect to `/_hcms/mem/login?redirect_url=/learn`
6. Log in using credentials from `.env`
7. **Expected:** Return to `/learn`
8. **Expected:** Left nav shows "Hi, [firstname]!" and "Sign Out" link

**Success Criteria:**
- ✅ Anonymous state shows "Sign In"
- ✅ Authenticated state shows personalized greeting
- ✅ "Sign Out" link appears when logged in
- ✅ No console errors

---

### Test 3: Identity Hydration

**Steps:**
1. Log in via any method (left nav or CTA)
2. Open browser console
3. Run: `window.hhIdentity.get()`
4. **Expected Output:**
   ```javascript
   {
     email: "test@example.com",
     contactId: "12345",
     firstname: "Test",
     lastname: "User"
   }
   ```
5. Verify no console errors
6. Check browser DevTools → Elements → Find `#hhl-auth-context`
7. **Expected:** Data attributes populated:
   ```html
   <div id="hhl-auth-context"
        data-email="test@example.com"
        data-contact-id="12345"
        data-firstname="Test"
        data-lastname="User"
        ...>
   ```

**Success Criteria:**
- ✅ `window.hhIdentity.get()` returns valid identity object
- ✅ All fields populated (email, contactId, firstname, lastname)
- ✅ Data attributes on `#hhl-auth-context` div match
- ✅ No console errors or warnings

---

### Test 4: Enrollment Flow

**Steps:**
1. Log in to a course page
2. If already enrolled, use a different course
3. Click "Start Course" button
4. **Expected:** Enrollment completes
5. **Expected:** CTA updates to "✓ Enrolled in Course"
6. Navigate to `/learn/my-learning`
7. **Expected:** Enrolled course appears in the list

**Success Criteria:**
- ✅ Enrollment completes without errors
- ✅ CTA updates to enrolled state
- ✅ Course appears in My Learning page
- ✅ No console errors

---

### Test 5: Logout Flow

**Steps:**
1. While logged in, click "Sign Out" in left nav
2. **Expected:** Redirect to `/_hcms/mem/logout?redirect_url=<current-page>`
3. **Expected:** Return to page in anonymous state
4. Verify left nav shows "Sign In" again
5. Verify CTAs show "Sign in to start course"

**Success Criteria:**
- ✅ Logout redirect works
- ✅ Return to anonymous state
- ✅ UI updates to reflect logged-out state
- ✅ No console errors

---

## Automated Testing

### Test 6: JWT Helper (For Automation Only)

**Purpose:** Verify JWT authentication still works for test automation

```bash
# Run enrollment flow test with JWT helper
npm run test:e2e -- tests/e2e/enrollment-flow.spec.ts
```

**Success Criteria:**
- ✅ JWT helper authenticates successfully
- ✅ `window.hhIdentity.get()` returns identity from JWT
- ✅ Enrollment flow completes
- ✅ Tests pass

**Note:** This test uses the JWT helper which is maintained for test automation only. User-facing flows should use native HubSpot login.

---

### Test 7: Native Login Flow (End-to-End)

**Purpose:** Verify Issue #272 implementation with real HubSpot login flow

```bash
# Run native login flow test
HUBSPOT_TEST_EMAIL=<from-.env> HUBSPOT_TEST_PASSWORD=<from-.env> \
npx playwright test tests/e2e/native-login-flow.spec.ts
```

**Expected Behavior:**
1. Test navigates to course page
2. Clicks "Sign in to start course"
3. Fills HubSpot login form with credentials
4. Completes authentication
5. Returns to course page
6. Verifies CTA updated
7. Completes enrollment

**Success Criteria:**
- ✅ Test navigates through HubSpot login
- ✅ Authentication succeeds
- ✅ Return to original page
- ✅ Enrollment completes
- ✅ All assertions pass

---

### Test 8: Login and Track (Regression Coverage)

**Purpose:** Verify login and progress tracking via membership flow

```bash
# Run login and track test
npx playwright test tests/e2e/login-and-track.spec.ts
```

**Expected Behavior:**
1. Logs in via native membership
2. Posts progress events
3. Verifies progress persists

**Success Criteria:**
- ✅ Login via membership succeeds
- ✅ Progress events tracked
- ✅ Progress persists across sessions
- ✅ All assertions pass

---

### Test 9: Membership Smoke Tests

**Purpose:** Verify API-level membership functionality

```bash
# Run membership smoke tests
npm run test:api -- tests/api/membership-smoke.spec.ts
```

**Success Criteria:**
- ✅ Membership API endpoints respond
- ✅ Authentication validates correctly
- ✅ All assertions pass

---

## Documentation Validation

### Test 10: Verify Documentation

**Steps:**
1. Review `verification-output/issue-272/IMPLEMENTATION-SUMMARY.md`
2. Verify all file changes are documented
3. Review `verification-output/issue-272/GITHUB-COMMENT.md`
4. Check deployment instructions are complete

**Success Criteria:**
- ✅ All changes documented
- ✅ Deployment steps clear
- ✅ Testing checklist complete
- ✅ Rollback plan defined

---

## Evidence Collection

### Screenshots to Capture

For each test, capture screenshots in `verification-output/issue-272/`:

1. **Anonymous State**
   - `1-anonymous-course-page.png` - CTA shows "Sign in to start course"
   - `2-anonymous-left-nav.png` - Left nav shows "Sign In"

2. **HubSpot Login**
   - `3-hubspot-login-page.png` - HubSpot native login form
   - `4-login-redirect-url.png` - URL shows redirect_url parameter

3. **Authenticated State**
   - `5-authenticated-course-page.png` - CTA shows "Start Course"
   - `6-authenticated-left-nav.png` - Left nav shows "Hi, [name]!"
   - `7-identity-console.png` - `window.hhIdentity.get()` output
   - `8-auth-context-div.png` - DevTools showing data attributes

4. **Enrollment**
   - `9-enrollment-complete.png` - CTA shows "✓ Enrolled"
   - `10-my-learning.png` - Course appears in My Learning

5. **Logout**
   - `11-logout-redirect.png` - Logout URL
   - `12-anonymous-after-logout.png` - Back to anonymous state

### JSON Logs to Capture

Create JSON files in `verification-output/issue-272/`:

1. **`identity-test-result.json`**
   ```json
   {
     "timestamp": "2025-10-27T...",
     "testType": "manual",
     "identity": {
       "email": "test@example.com",
       "contactId": "12345",
       "firstname": "Test",
       "lastname": "User"
     },
     "dataAttributes": {
       "data-email": "test@example.com",
       "data-contact-id": "12345",
       "data-firstname": "Test",
       "data-lastname": "User"
     },
     "success": true,
     "errors": []
   }
   ```

2. **`enrollment-test-result.json`**
   ```json
   {
     "timestamp": "2025-10-27T...",
     "testType": "manual",
     "courseSlug": "course-authoring-101",
     "enrollmentStatus": "completed",
     "ctaState": "enrolled",
     "visibleInMyLearning": true,
     "success": true,
     "errors": []
   }
   ```

---

## Deployment Validation

### Test 11: Post-Deployment Smoke Test

**After deploying to staging/production:**

1. Clear browser cache completely
2. Test anonymous → login → enrollment flow
3. Verify no cached assets cause issues
4. Check browser console for errors
5. Test on multiple browsers (Chrome, Firefox, Safari)

**Success Criteria:**
- ✅ Login flow works in all browsers
- ✅ No console errors
- ✅ No cached asset issues
- ✅ Enrollment completes successfully

---

## Issue Resolution Checklist

Before closing Issue #272:

- [ ] All manual tests pass
- [ ] All automated tests pass
- [ ] Screenshots captured and documented
- [ ] JSON logs created
- [ ] No console errors in any test
- [ ] Tested on staging environment
- [ ] Tested on production environment
- [ ] Documentation updated
- [ ] GitHub comment posted to issue
- [ ] Team notified of changes

---

## Known Issues / Limitations

### Expected Behaviors (Not Bugs)

1. **JWT Helper Still Works**
   - JWT authentication remains functional for test automation
   - This is intentional - JWT is for testing only
   - User-facing flows use native HubSpot login

2. **Auth Handshake Page Still Exists**
   - `/learn/auth-handshake` is deprecated but not deleted
   - Kept for backward compatibility
   - Can be safely deleted in future cleanup

3. **Personalization Tokens Removed**
   - `personalization_token()` removed from templates
   - Only `request_contact.is_logged_in` used now
   - This is more reliable and aligns with Issue #272 goals

---

## Troubleshooting

### Issue: "Sign in" button does nothing
**Solution:** Check browser console for errors. Verify `login-helper.js` is loaded.

### Issue: Identity not populated after login
**Solution:** Check `#hhl-auth-context` data attributes. Verify `request_contact.is_logged_in` is true.

### Issue: CTA doesn't update after login
**Solution:** Check if `auth-context.js` is loading identity. Run `window.hhIdentity.get()` in console.

### Issue: Tests failing with JWT helper
**Solution:** Verify JWT endpoint is still accessible. Check localStorage for JWT token.

---

## Contact / Support

For questions or issues:
- Review full documentation: `verification-output/issue-272/IMPLEMENTATION-SUMMARY.md`
- Check GitHub Issue: #272
- Review research findings: `HUBSPOT-AUTH-QUICK-SUMMARY.md`

---

**Testing Status:** ⏳ Ready for Testing

**Next Steps:**
1. Run manual testing checklist
2. Run automated test suite
3. Capture evidence (screenshots + JSON)
4. Deploy to staging
5. Re-test on staging
6. Deploy to production
7. Final verification
8. Close Issue #272
