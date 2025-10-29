# Issue #276: Fix Enrollment Persistence to CRM Across Browsers

## Problem Summary

Enrollment events triggered from the server-rendered CTA do not persist across browsers. When users click "Start Course" or "Enroll in Pathway", the optimistic UI updates locally, but the enrollment event is never written to HubSpot CRM contact properties (`hhl_progress_state`, etc.).

## Root Cause

The `/learn/action-runner` page referenced by `enrollment.js` **does not exist** in HubSpot.

**Evidence**:
- File not found in local repository
- `hs filemanager fetch` returns 404
- `curl https://hedgehog.cloud/learn/action-runner` returns 404 error page
- `enrollment.js:351` redirects to this non-existent page

**Impact**:
1. User clicks "Start Course" → `enrollment.js` redirects to `/learn/action-runner?action=enroll_course&slug=...`
2. Browser hits 404 page
3. Enrollment event never POSTed to `/events/track`
4. CRM contact properties never updated
5. User's enrollment only exists in localStorage (lost across browsers/devices)

## Solution Implemented

### 1. Created `action-runner.html` Template

**File**: `clean-x-hedgehog-templates/learn/action-runner.html`

**Purpose**: Server-rendered page that:
- Receives URL params (action, slug, redirect_url, etc.)
- Builds appropriate event payload for `/events/track`
- POSTs to Lambda API with JWT authentication
- Saves result to sessionStorage for user feedback
- Redirects back to original page

**Supported Actions**:
- `enroll_pathway` → `learning_pathway_enrolled` event
- `enroll_course` → `learning_course_enrolled` event
- `mark_module_started` → `learning_module_started` event
- `mark_module_completed` → `learning_module_completed` event

**Key Features**:
- JWT authentication support (reads from localStorage)
- Debug mode compatible (`HHL_DEBUG=true`)
- User-friendly loading spinner UI
- Error handling with automatic redirect
- Session storage for success/error feedback

### 2. Deployment Status

**Template Created**: ✓ `/home/ubuntu/afewell-hh/hh-learn/clean-x-hedgehog-templates/learn/action-runner.html`

**HubSpot Project Upload**: ✓ Completed (Build #29, Deploy #28)

**Page Creation**: ⚠️ **MANUAL STEP REQUIRED**

The HTML template was uploaded successfully, but a **CMS page** must be created manually in HubSpot because:
1. Project Access Tokens lack `cms.pages.write` scope
2. Templates are not automatically published as pages
3. Page creation requires HubSpot UI or Private App Token with correct scopes

## Manual Deployment Steps

### Option A: Create Page via HubSpot UI (Recommended)

1. Navigate to **Marketing** > **Website** > **Website Pages**
2. Click **Create** > **Website page**
3. Choose **Drag and drop** or **Code your own**
4. Set page properties:
   - **Name**: Action Runner
   - **Page title**: Processing...
   - **Page URL**: `learn/action-runner`
   - **Content type**: Site Page
5. In the HTML editor, paste contents from `clean-x-hedgehog-templates/learn/action-runner.html`
6. **Publish** the page
7. Test access: `https://hedgehog.cloud/learn/action-runner`

### Option B: Create Page via API (Requires Private App Token)

**Prerequisites**:
- Private App Token with `cms.pages.write` scope
- Token stored in `HUBSPOT_PRIVATE_APP_TOKEN` environment variable

**Command**:
```bash
node scripts/create-action-runner-page.js
```

**Expected Output**:
```
✓ Page created successfully!
  URL: https://hedgehog.cloud/learn/action-runner
  Page ID: <page-id>
  Path: learn/action-runner
```

## Verification Steps

### 1. Verify Page Exists

```bash
curl -s "https://hedgehog.cloud/learn/action-runner" -w "\nHTTP Status: %{http_code}\n" | head -50
```

**Expected**: HTTP 200 with action-runner HTML content (not 404 error page)

### 2. Test Enrollment Flow

**Setup**:
1. Enable debug mode: `localStorage.setItem('HHL_DEBUG', 'true')`
2. Open course page: `https://hedgehog.cloud/learn/courses/network-like-hyperscaler-101`
3. Authenticate via JWT:
   ```javascript
   await window.hhIdentity.login('test@example.com')
   ```

**Test Flow**:
1. Click "Start Course" button
2. Browser should redirect to `/learn/action-runner?action=enroll_course&slug=...&redirect_url=...`
3. Action runner should show "Processing enrollment..." spinner
4. Network tab should show POST to `/events/track` with JWT Authorization header
5. Page should redirect back to course page
6. Button should show "✓ Enrolled in Course" (disabled)
7. Check console: `sessionStorage.getItem('hhl_last_action')` should show `{"status":"success",...}`

### 3. Verify CRM Persistence

**Check Contact Properties**:
```bash
# Replace <email> with test contact
node -e "
const hubspot = require('@hubspot/api-client');
const client = new hubspot.Client({ accessToken: process.env.HUBSPOT_PROJECT_ACCESS_TOKEN });

client.crm.contacts.searchApi.doSearch({
  filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: 'test@example.com' }] }],
  properties: ['hhl_progress_state', 'hhl_progress_updated_at', 'hhl_progress_summary'],
  limit: 1
}).then(res => {
  const contact = res.results[0];
  console.log('Progress State:', JSON.parse(contact.properties.hhl_progress_state || '{}'));
  console.log('Updated At:', contact.properties.hhl_progress_updated_at);
  console.log('Summary:', contact.properties.hhl_progress_summary);
});
"
```

**Expected Output**:
```json
{
  "courses": {
    "network-like-hyperscaler-101": {
      "enrolled": true,
      "enrolled_at": "2025-10-29T...",
      "enrollment_source": "course_page",
      "modules": {}
    }
  }
}
```

### 4. Cross-Browser Verification

1. **Browser A**: Enroll in course (as above)
2. **Browser B**: Sign in with same contact
   ```javascript
   await window.hhIdentity.login('test@example.com')
   ```
3. Open same course page
4. **Expected**: Button shows "✓ Enrolled in Course" immediately (no local state, CRM-backed)

## E2E Test Verification

```bash
npx playwright test tests/e2e/enrollment-flow.spec.ts
```

**Expected**: All enrollment tests should pass with the action-runner page in place.

## Acceptance Criteria

- [x] Root cause identified (missing action-runner page)
- [x] Action-runner.html template created
- [x] Template uploaded to HubSpot project
- [ ] **CMS page created manually** (awaiting manual step)
- [ ] Page accessible at `/learn/action-runner`
- [ ] Enrollment events POST to `/events/track` successfully
- [ ] Contact properties updated (`hhl_progress_state`, etc.)
- [ ] Cross-browser persistence verified
- [ ] E2E tests pass

## Files Changed

### New Files
- `clean-x-hedgehog-templates/learn/action-runner.html` (359 lines)
- `scripts/create-action-runner-page.js` (helper script)
- `verification-output/issue-276/IMPLEMENTATION-SUMMARY.md` (this file)

### Modified Files
None (existing code already references `/learn/action-runner`)

## References

- **Issue**: #276
- **Related Issues**: #245 (enrollment refactor), #242 (JWT auth)
- **Documentation**: `docs/auth-and-progress.md` (section on action-runner)
- **Enrollment Flow**: `clean-x-hedgehog-templates/assets/js/enrollment.js:350-351`
- **Lambda Handler**: `src/api/lambda/index.ts` (`persistViaContactProperties`)

## Next Steps

1. **Manual Page Creation**: Follow "Manual Deployment Steps" above
2. **Verification**: Run verification steps to confirm enrollment persistence
3. **E2E Tests**: Run Playwright tests to validate end-to-end flow
4. **Documentation**: Update `docs/auth-and-progress.md` with action-runner details
5. **Issue Closure**: Close #276 with link to this summary

## Troubleshooting

### Page returns 404

**Symptom**: `curl https://hedgehog.cloud/learn/action-runner` returns 404

**Fix**: Page has not been created yet. Follow "Manual Deployment Steps" above.

### Enrollment still not persisting

**Diagnostics**:
1. Check Network tab: Is POST to `/events/track` being made?
2. Check request payload: Does it have correct `eventName` and contact identifier?
3. Check Lambda logs: Did `/events/track` receive and process the event?
4. Check CRM: Does contact have updated `hhl_progress_state`?

**Common Issues**:
- Missing JWT token: User not authenticated
- Invalid event payload: Check console for validation errors
- Lambda error: Check CloudWatch logs
- CRM write failure: Check HubSpot API limits

### sessionStorage shows error status

**Check `hhl_last_action`**:
```javascript
JSON.parse(sessionStorage.getItem('hhl_last_action'))
```

**Possible errors**:
- `missing_action`: URL missing `action` parameter
- `missing_slug`: URL missing `slug` parameter
- Network error: `/events/track` endpoint unreachable
- Validation error: Event payload invalid

## Timeline

- **2025-10-29**: Issue researched, root cause identified
- **2025-10-29**: Action-runner template created and uploaded
- **Pending**: Manual page creation in HubSpot UI
