# Phase 1 Verification Checklist (Issue #59)

## Deployment Summary

**Date**: 2025-10-10
**Phase**: Phase 1 - Anonymous Beacons
**Configuration**: `ENABLE_CRM_PROGRESS=false`

### Pages Published

✅ All 4 pages published successfully:

| Page | Slug | ID | URL | Status |
|------|------|-----|-----|--------|
| Learn | `learn` | 197177162603 | https://hedgehog.cloud/learn | PUBLISHED |
| Courses | `learn/courses` | 197280289288 | https://hedgehog.cloud/learn/courses | PUBLISHED |
| Pathways | `learn/pathways` | 197280289546 | https://hedgehog.cloud/learn/pathways | PUBLISHED |
| My Learning | `learn/my-learning` | 197399202740 | https://hedgehog.cloud/learn/my-learning | PUBLISHED |

### Configuration Deployed

**constants.json** (uploaded to HubSpot Design Manager):
```json
{
  "HUBDB_MODULES_TABLE_ID": "135621904",
  "HUBDB_PATHWAYS_TABLE_ID": "135381504",
  "HUBDB_COURSES_TABLE_ID": "135381433",
  "DEFAULT_SOCIAL_IMAGE_URL": "https://hedgehog.cloud/hubfs/social-share-default.png",
  "TRACK_EVENTS_ENABLED": true,
  "TRACK_EVENTS_URL": "https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track",
  "ENABLE_CRM_PROGRESS": false,
  "LOGIN_URL": "/hs-login",
  "LOGOUT_URL": "/hs-logout"
}
```

**Serverless API** (AWS Lambda):
- Endpoint: `https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track`
- Environment: `ENABLE_CRM_PROGRESS=false`
- CORS: Configured for `hedgehog.cloud` and HubSpot CDN domains

## Manual Verification Steps

### 1. Page Rendering Verification

**Test each page in browser:**

1. **Learn (Modules List)**: https://hedgehog.cloud/learn
   - [ ] Page loads without errors
   - [ ] Modules list displays from HubDB
   - [ ] Module cards show title, description, status
   - [ ] Click on a module navigates to detail page
   - [ ] Header nav links present (Learn, Courses, Pathways, My Learning)

2. **Learn Detail (Module Page)**: https://hedgehog.cloud/learn/[any-module-slug]
   - [ ] Page loads without errors
   - [ ] Module content displays correctly
   - [ ] "Mark as Started" button appears
   - [ ] "Mark as Complete" button appears
   - [ ] Pathway breadcrumb displays (if module is part of pathway)

3. **Courses List**: https://hedgehog.cloud/learn/courses
   - [ ] Page loads without errors
   - [ ] Courses list displays from HubDB
   - [ ] Course cards show title, description
   - [ ] Click on course navigates to detail page

4. **Pathways List**: https://hedgehog.cloud/learn/pathways
   - [ ] Page loads without errors
   - [ ] Pathways list displays from HubDB
   - [ ] Pathway cards show title, description, module count
   - [ ] Click on pathway navigates to detail page

5. **My Learning Dashboard**: https://hedgehog.cloud/learn/my-learning
   - [ ] Page loads without errors
   - [ ] Shows "Sign In to sync progress" message (user not authenticated)
   - [ ] Progress stored in localStorage only
   - [ ] Displays started/completed modules from localStorage

### 2. Anonymous Beacon Verification

**Test beacon flow on module detail page:**

1. Open https://hedgehog.cloud/learn/[any-module-slug]
2. Open Browser DevTools (F12) → Network tab
3. Filter: XHR or Fetch
4. Click "Mark as Started" button

**Expected Network Request:**
- **URL**: `https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track`
- **Method**: POST
- **Status**: 200 OK
- **Request Headers**:
  ```
  Content-Type: application/json
  Origin: https://hedgehog.cloud
  ```

**Expected Request Payload** (IMPORTANT - No contactIdentifier):
```json
{
  "eventName": "learning_module_started",
  "payload": {
    "module_slug": "intro-to-hedgehog",
    "pathway_slug": "getting-started",
    "ts": "2025-10-10T18:30:00.000Z"
  }
}
```

**Expected Response:**
```json
{
  "status": "logged",
  "mode": "anonymous"
}
```

**Verification Checklist:**
- [ ] Beacon POST request appears in Network tab
- [ ] Request URL matches `TRACK_EVENTS_URL` from constants
- [ ] Response status is 200 OK
- [ ] Response body shows `"mode": "anonymous"`
- [ ] Request payload has NO `contactIdentifier` field
- [ ] No email or contactId in request
- [ ] CORS preflight (OPTIONS) succeeds

### 3. localStorage Verification

**Verify progress stored locally only:**

1. Open Browser DevTools → Application/Storage → Local Storage
2. Select `https://hedgehog.cloud`
3. Look for keys like:
   - `learn_progress` or similar
   - Individual module progress keys

**Expected Behavior:**
- [ ] Progress data stored in localStorage
- [ ] Refresh page - progress persists (from localStorage)
- [ ] Clear localStorage - progress resets (not synced to server)
- [ ] Open in incognito/private window - no progress shown (no server sync)

### 4. HubSpot CRM Verification (Phase 1 - Should be EMPTY)

**Verify NO events in HubSpot CRM:**

1. Log into HubSpot account (21430285)
2. Navigate to **Reporting** → **Analytics Tools** → **Custom Events**
3. Check for events:
   - `learning_module_started`
   - `learning_module_completed`
   - `learning_pathway_enrolled`

**Expected Result:**
- [ ] No event completions recorded (or very old ones from previous tests)
- [ ] No new events since Phase 1 deployment
- [ ] Confirms `ENABLE_CRM_PROGRESS=false` is working

**Alternative check - Contact Timeline:**
1. Go to **Contacts** → Select a test contact
2. View **Activity** timeline
3. **Expected**: No learning events on timeline

### 5. Error Handling Verification

**Test error scenarios:**

1. **Network Offline Test**:
   - [ ] Open DevTools → Network tab → Throttle to "Offline"
   - [ ] Click "Mark as Started"
   - [ ] Verify: No console errors, beacon silently fails
   - [ ] Verify: localStorage still updated

2. **CORS Test** (already passing if beacons work):
   - [ ] Beacon requests include `Access-Control-Allow-Origin` header
   - [ ] No CORS errors in console

3. **Invalid Event Name** (optional):
   - [ ] Send beacon with invalid eventName via console
   - [ ] Verify: 400 Bad Request or similar error

## Screenshots to Capture

Please capture and attach the following screenshots to Issue #59:

1. **Page Rendering**:
   - `learn-page.png` - Learn modules list
   - `module-detail.png` - A module detail page
   - `courses-page.png` - Courses list
   - `pathways-page.png` - Pathways list
   - `my-learning-page.png` - My Learning dashboard (not signed in)

2. **Network Tab - Anonymous Beacon**:
   - `network-beacon-request.png` - POST request to /events/track
   - `network-beacon-payload.png` - Request payload (showing NO contactIdentifier)
   - `network-beacon-response.png` - Response showing `"mode": "anonymous"`

3. **localStorage**:
   - `localstorage-progress.png` - localStorage showing progress data

4. **HubSpot CRM - No Events**:
   - `hubspot-custom-events-empty.png` - Custom Events page showing no recent events
   - `hubspot-contact-timeline.png` - Contact timeline with no learning events

## Command Line Verification

Run these commands to verify deployment:

```bash
# 1. Test anonymous beacon
curl -X POST "https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_started",
    "payload": {
      "module_slug": "verification-test",
      "ts": "2025-10-10T18:30:00Z"
    }
  }'

# Expected: {"status":"logged","mode":"anonymous"}

# 2. Test with contactIdentifier (should still be anonymous in Phase 1)
curl -X POST "https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_started",
    "contactIdentifier": {
      "email": "test@example.com"
    },
    "payload": {
      "module_slug": "verification-test",
      "ts": "2025-10-10T18:30:00Z"
    }
  }'

# Expected: {"status":"logged","mode":"anonymous"}
# (ENABLE_CRM_PROGRESS=false so identity is ignored)

# 3. Check AWS Lambda logs
aws logs tail /aws/lambda/hedgehog-learn-dev-api --follow --format short

# Expected: See "Track event (anonymous)" log entries
```

## Sign-Off Criteria

Phase 1 verification is complete when:

- [x] All 4 pages published and accessible
- [ ] All pages render correctly without errors
- [ ] Anonymous beacons POST successfully to /events/track
- [ ] Beacon responses show `"mode": "anonymous"`
- [ ] No `contactIdentifier` in beacon payloads
- [ ] Progress stored in localStorage only
- [ ] No events appear in HubSpot CRM
- [ ] Screenshots captured and posted to Issue #59
- [ ] CLI verification commands executed and output captured

## Next Steps After Sign-Off

Once Phase 1 verification is complete and green-lit:

1. **Phase 2 - Authenticated Beacons** (Issue #59 continuation):
   - Enable HubSpot CMS Membership
   - Create Custom Event Definitions in HubSpot
   - Set `ENABLE_CRM_PROGRESS=true`
   - Update templates with auth UI components
   - Redeploy serverless API with new environment variables
   - Test authenticated beacon flow
   - Verify events persist to HubSpot CRM

2. **Issue #60 - Project App Scopes**:
   - Create `app/app-hsmeta.json` with required scopes
   - Deploy project app: `hs project deploy`
   - Update installation scopes in HubSpot
   - Refactor provisioning scripts to use OAuth access tokens
   - Remove Private App token dependency

## Files Modified/Created

### New Files
- `scripts/hubspot/upload-templates.ts` - Template upload script
- `scripts/hubspot/publish-pages.ts` - Page publishing script
- `docs/cli-provisioning-guide.md` - Complete CLI workflow documentation
- `docs/phase1-verification-checklist.md` - This checklist

### Modified Files
- `package.json` - Added `upload:templates` and `publish:pages` scripts
- `scripts/hubspot/provision-pages.ts` - Fixed template validation (v3 API)
- `clean-x-hedgehog-templates/config/constants.json` - Updated with correct IDs and URLs

### Deployed Artifacts
- 5 template files uploaded to HubSpot Design Manager (PUBLISHED)
- 4 CMS pages published to https://hedgehog.cloud
- Serverless API deployed to AWS Lambda (us-west-2)

---

**Prepared by**: Claude Code
**Date**: 2025-10-10
**Issue**: #59 - Staging Validation: v0.3 Auth & Progress
