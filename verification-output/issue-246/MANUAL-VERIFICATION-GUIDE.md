# Manual Verification Guide - Issue #246
## Public-Page Login Handshake and Enrollment Flow

**Purpose**: Manually verify that the auth handshake and action-runner implementations work correctly for authenticated users on public Learn pages.

**Why Manual?**: HubSpot's membership login form includes CSRF protection that blocks automated testing tools like Playwright. This is a security feature of HubSpot CMS Membership and cannot be bypassed in automated tests.

---

## Prerequisites

- **Browser**: Chrome, Firefox, or Safari (latest version)
- **Test Credentials**: 
  - Email: `afewell@gmail.com`
  - Password: (see `.env` file for `HUBSPOT_TEST_PASSWORD`)
- **Access**: Test user must be member of `test-static-access-group`
- **Environment**: Production site at `hedgehog.cloud`

---

## Verification Steps

### Part 1: Identity Handshake Verification

#### Step 1.1: Start Fresh
1. Open a **new incognito/private window**
2. Navigate to: `https://hedgehog.cloud/learn/courses/course-authoring-101`
3. **Expected**: Page loads, enrollment CTA shows "Sign in to start course"
4. **Screenshot**: Save as `1-anonymous-state.png`

#### Step 1.2: Initiate Login
1. Click the **"Sign in to start course"** button
2. **Expected**: Browser redirects to `/_hcms/mem/login?redirect_url=...`
3. Note: The `redirect_url` parameter should contain `/learn/auth-handshake`
4. **Screenshot**: Save as `2-login-redirect.png`

#### Step 1.3: Complete Login
1. Fill in email: `afewell@gmail.com`
2. Fill in password: (from `.env`)
3. Click **"Sign in"** or **"Log in"** button
4. **Screenshot**: Save as `3-login-form-filled.png` (before submitting)

#### Step 1.4: Observe Handshake
1. After clicking sign-in, watch carefully for a brief flash
2. **Expected**: You should briefly see a page with "Signing you in..." message
3. **This is the handshake page** at `/learn/auth-handshake`
4. Page should automatically redirect back to the course page within 500ms
5. If redirect is too fast to see, check browser's Network tab for:
   - Request to `/learn/auth-handshake?redirect_url=/learn/courses/course-authoring-101`
   - Followed by redirect to `/learn/courses/course-authoring-101`

#### Step 1.5: Verify Identity Population
1. Once back on the course page, **do not click anything yet**
2. Open **DevTools** (F12 or Right-click → Inspect)
3. Go to **Console** tab
4. Run the following commands:

**Command 1**: Check sessionStorage
```javascript
console.log('sessionStorage.hhl_identity:', sessionStorage.getItem('hhl_identity'));
```

**Expected Output**:
```json
{
  "email": "afewell@gmail.com",
  "contactId": "123456789",
  "firstname": "Art",
  "lastname": "Fewell",
  "timestamp": "2025-10-25T..."
}
```

**Command 2**: Check window.hhIdentity API
```javascript
console.log('window.hhIdentity:', window.hhIdentity.get());
```

**Expected Output**:
```javascript
{
  email: "afewell@gmail.com",
  contactId: "123456789",
  firstname: "Art",
  lastname: "Fewell"
}
```

5. **Screenshot**: Save Console output as `4-identity-verification.png`

#### Step 1.6: Verify CTA Update
1. Look at the enrollment CTA button
2. **Expected**: Text should now show **"Start Course"** (not "Sign in to start course")
3. Button should be enabled and styled normally
4. **Screenshot**: Save as `5-authenticated-cta.png`

✅ **Part 1 Complete** if:
- sessionStorage contains identity data
- window.hhIdentity.get() returns identity
- CTA no longer says "Sign in"

---

### Part 2: Enrollment Flow via Action Runner

#### Step 2.1: Initiate Enrollment
1. Click the **"Start Course"** button
2. **Expected**: Browser should redirect to `/learn/action-runner?action=enroll_course&slug=course-authoring-101&redirect_url=...`
3. You should briefly see the action-runner page with:
   - Spinning loader
   - "Processing your request…" or "Enrolling you in the course…"
4. **Screenshot**: If fast enough, save as `6-action-runner-processing.png`

#### Step 2.2: Verify Enrollment Success
1. After action-runner completes, browser redirects back to course page
2. **Expected**: CTA button now shows **"✓ Enrolled"** or similar
3. Button styling should indicate enrolled state
4. **Screenshot**: Save as `7-enrolled-state.png`

#### Step 2.3: Check Network Calls
1. Open DevTools → **Network** tab
2. Filter for `/events/track`
3. **Expected**: You should see POST request(s) to:
   - `https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track`
4. Click on the request → **Payload** tab
5. **Expected Payload**:
```json
{
  "eventName": "learning_course_enrolled",
  "contactIdentifier": {
    "email": "afewell@gmail.com",
    "contactId": "123456789"
  },
  "payload": {
    "course_slug": "course-authoring-101",
    "ts": "2025-10-25T..."
  },
  "enrollment_source": "action_runner"
}
```
6. Check **Response** tab
7. **Expected Response**:
```json
{
  "status": "persisted",
  "mode": "authenticated",
  "backend": "properties"
}
```
8. **Screenshot**: Save Network tab as `8-track-events-call.png`

---

### Part 3: My Learning Dashboard Verification

#### Step 3.1: Navigate to My Learning
1. Click on **"My Learning"** link in navigation (or visit `https://hedgehog.cloud/learn/my-learning`)
2. **Expected**: Page loads and shows enrolled courses

#### Step 3.2: Verify Enrollment Card
1. Look for a card showing **"Course Authoring 101"**
2. **Expected**: 
   - Course card is visible
   - Shows enrollment date
   - May show progress (0% if just enrolled)
3. **Screenshot**: Save as `9-my-learning-dashboard.png`

✅ **Part 2 & 3 Complete** if:
- Action runner redirect occurred
- Enrollment CTA updated to "Enrolled"
- `/events/track` call succeeded with `mode: "authenticated"`
- My Learning shows the enrolled course

---

### Part 4: Progress Tracking (Optional)

#### Step 4.1: Navigate to a Module
1. From the course page, click on a module (e.g., "Module 1")
2. Scroll through the module content

#### Step 4.2: Mark Progress
1. If there's a "Mark as Complete" button, click it
2. **Expected**: Progress update fires

#### Step 4.3: Verify Progress Call
1. In DevTools Network tab, look for another `/events/track` call
2. **Expected Payload**:
```json
{
  "eventName": "learning_module_completed",
  "contactIdentifier": {
    "email": "afewell@gmail.com",
    "contactId": "123456789"
  },
  "payload": {
    "module_slug": "...",
    "course_slug": "course-authoring-101",
    "ts": "..."
  }
}
```

---

## Troubleshooting

### Issue: sessionStorage is null after login

**Possible Causes**:
1. Handshake page not configured as Private in HubSpot CMS
2. Test user not in correct access group
3. Membership session not established
4. Browser blocking sessionStorage (privacy settings)

**Debug Steps**:
1. Check browser console for `[auth-handshake]` messages
2. Look for warning: "User is not logged in on private page"
3. Verify Network tab shows request to `/learn/auth-handshake`
4. Check if cookies are being set (DevTools → Application → Cookies)

### Issue: window.hhIdentity is undefined

**Possible Causes**:
1. `auth-context.js` script not loaded
2. JavaScript error preventing execution
3. Page cached with old scripts

**Debug Steps**:
1. Check Console for JavaScript errors
2. Verify script tag for `auth-context.js` in page source
3. Hard refresh page (Ctrl+Shift+R)
4. Check Network tab for 404 errors on JS files

### Issue: CTA still says "Sign in" after login

**Possible Causes**:
1. Identity not populated (see above)
2. `enrollment.js` script not running
3. Race condition (scripts executing before identity ready)

**Debug Steps**:
1. First verify sessionStorage and window.hhIdentity (Part 1, Step 1.5)
2. Check console for `[hhl-enroll]` log messages
3. Refresh page and try again

### Issue: Action runner shows error

**Possible Causes**:
1. Not logged in (identity missing)
2. Invalid action parameters
3. Backend endpoint unavailable
4. CORS or network issue

**Debug Steps**:
1. Check action runner page for error message
2. Look at Network tab for failed requests
3. Check browser console for errors
4. Verify `TRACK_EVENTS_URL` in constants.json is correct

### Issue: "/events/track" call fails

**Possible Causes**:
1. Lambda function not deployed
2. CORS misconfiguration
3. Invalid payload
4. Backend environment variables not set

**Debug Steps**:
1. Check response status code (Network tab)
2. Look at response body for error details
3. Verify Lambda logs in AWS CloudWatch
4. Test endpoint directly with curl

---

## Success Criteria

### All Tests Pass ✅

- [ ] sessionStorage.hhl_identity contains user data
- [ ] window.hhIdentity.get() returns user data  
- [ ] CTA updates from "Sign in" to "Start Course"
- [ ] Clicking CTA redirects through action-runner
- [ ] CTA updates to "Enrolled" state
- [ ] `/events/track` call succeeds with `mode: "authenticated"`
- [ ] My Learning dashboard shows enrolled course
- [ ] All screenshots captured
- [ ] Network calls show correct payloads and responses

### Artifacts to Save

1. Screenshots (9 total):
   - `1-anonymous-state.png`
   - `2-login-redirect.png`
   - `3-login-form-filled.png`
   - `4-identity-verification.png`
   - `5-authenticated-cta.png`
   - `6-action-runner-processing.png` (if possible)
   - `7-enrolled-state.png`
   - `8-track-events-call.png`
   - `9-my-learning-dashboard.png`

2. Console Output:
   - Copy/paste sessionStorage and window.hhIdentity output

3. Network HAR File (optional):
   - DevTools → Network → Export HAR

Save all artifacts to: `verification-output/issue-246/manual-verification/`

---

## Reporting Results

After completing manual verification, update Issue #246 with:

1. **Status**: Pass or Fail
2. **Screenshots**: Attach all 9 screenshots
3. **Notes**: Any issues encountered or deviations from expected behavior
4. **Environment**: Browser version, OS, date/time of test
5. **Tester**: Your name/email

**Example Comment**:

```markdown
## Manual Verification Results - Issue #246

**Date**: 2025-10-25
**Tester**: [Your Name]
**Environment**: Chrome 118.0.5993.88, macOS 14.0

### Results: ✅ PASS

All verification steps completed successfully:
- ✅ sessionStorage populated after handshake
- ✅ window.hhIdentity API working
- ✅ CTA updated to authenticated state
- ✅ Action runner enrollment succeeded
- ✅ /events/track called with authenticated mode
- ✅ My Learning shows enrolled course

See attached screenshots for evidence.

**Conclusion**: The handshake and action-runner implementations are working correctly in production.
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-25
**Related Issue**: #246
