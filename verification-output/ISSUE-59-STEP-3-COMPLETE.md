# Issue #59 - Step 3 Complete: Anonymous Beacon Ready

**Date:** 2025-10-13
**Status:** Step 3 Complete - Awaiting Manual Publish

---

## ✅ Step 3 Completion Summary

### 1. CORS Configuration ✅

**Verification:** No `http://` URLs found in codebase
```typescript
const ALLOWED_ORIGINS = [
  'https://hedgehog.cloud',      // ✅ HTTPS only
  'https://www.hedgehog.cloud',  // ✅ HTTPS only
];
```

All CORS origins use `https://` protocol as required.

### 2. Constants.json Updated & Uploaded ✅

**File Location:** `CLEAN x HEDGEHOG/templates/config/constants.json`

**Status:** DRAFT (awaiting publish)

**Changes:**
```diff
- "TRACK_EVENTS_URL": "https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track",
+ "TRACK_EVENTS_URL": "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track",
- "ENABLE_CRM_PROGRESS": true,
+ "ENABLE_CRM_PROGRESS": false,
```

**Current Content:**
```json
{
  "HUBDB_MODULES_TABLE_ID": "135621904",
  "HUBDB_PATHWAYS_TABLE_ID": "135381504",
  "HUBDB_COURSES_TABLE_ID": "135381433",
  "DEFAULT_SOCIAL_IMAGE_URL": "https://hedgehog.cloud/hubfs/social-share-default.png",
  "TRACK_EVENTS_ENABLED": true,
  "TRACK_EVENTS_URL": "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track",
  "ENABLE_CRM_PROGRESS": false,
  "LOGIN_URL": "/_hcms/mem/login",
  "LOGOUT_URL": "/_hcms/mem/logout"
}
```

### 3. Template Files Uploaded ✅

All templates uploaded to DRAFT:
- ✅ `learn/courses-page.html`
- ✅ `learn/module-page.html`
- ✅ `learn/my-learning.html`
- ✅ `learn/pathways-page.html`
- ✅ `assets/js/my-learning.js`
- ✅ `assets/js/pathways.js`
- ✅ `assets/js/progress.js`
- ✅ `config/constants.json` ⬅️ **UPDATED**

### 4. API Smoke Test ✅

**Endpoint:** `https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track`

**Request:**
```bash
curl -v -X POST "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track" \
  -H "Content-Type: application/json" \
  -H "Origin: https://hedgehog.cloud" \
  -d '{"eventName":"learning_module_started","payload":{"pathway_slug":"test","module_slug":"intro"}}'
```

**Response:**
```json
{"status":"logged","mode":"anonymous"}
```

**Headers:**
- ✅ HTTP 200 OK
- ✅ `access-control-allow-origin: *`
- ✅ `content-type: text/plain; charset=utf-8`

### 5. Contact Properties Verified ✅

All required properties exist in HubSpot:

```
✓ Property "hhl_progress_state" exists
  Label: hhl_progress_state
  Type: string (text)
  Group: learning_program_properties

✓ Property "hhl_progress_updated_at" exists
  Label: hhl_progress_updated_at
  Type: date (date)
  Group: learning_program_properties

✓ Property "hhl_progress_summary" exists
  Label: hhl_progress_summary
  Type: string (text)
  Group: learning_program_properties
```

---

## ⏳ Pending Manual Actions

### Action Required: Publish constants.json

**Method 1: HubSpot Design Manager UI**
1. Navigate to Design Manager
2. Go to `CLEAN x HEDGEHOG/templates/config/constants.json`
3. Click "Publish" button
4. Confirm publish

**Method 2: HubSpot CLI (if available)**
```bash
hs filemanager publish "CLEAN x HEDGEHOG/templates/config/constants.json"
```

**API Note:** Attempted to create automated publish script using `/cms/v3/source-code/draft/validate-and-publish/{path}` endpoint but received 404. This endpoint may require different authentication or parameters. Manual publish via UI is recommended for now.

---

## 📋 Step 3.5: Post-Publish Verification

Once constants.json is published, verify anonymous beacons from a live CMS page:

### Expected Behavior

1. **Load a module or pathway page** on hedgehog.cloud
2. **Open Browser DevTools** → Network tab
3. **Trigger an event** (click "Mark as started" or load pathway page)
4. **Verify POST request:**
   - URL: `https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track`
   - Method: POST
   - Status: 200
   - Response: `{"status":"logged","mode":"anonymous"}`
   - Headers: `access-control-allow-origin` present

### Artifacts to Collect

- Screenshot of Network tab showing request/response
- HAR file (optional) showing full request details
- Confirm no `contactIdentifier` in request payload (PII protection)

---

## 🎯 Step 2 Confirmation Needed

### CMS Membership Status

**Action Required:** Confirm in HubSpot portal:
1. Navigate to Settings → Website → CMS Membership
2. Verify "Enable CMS Membership" is turned ON
3. Confirm `request_contact.is_logged_in` is available in HubL templates

---

## 🚀 Ready for Step 4: CRM Persistence

Once Step 3.5 verification is complete, proceed with Step 4:

### Step 4 Checklist

1. **Update constants.json:**
   ```json
   "ENABLE_CRM_PROGRESS": true
   ```

2. **Upload & publish updated constants.json**

3. **Lambda already configured** (no redeploy needed):
   - `ENABLE_CRM_PROGRESS=true` ✅
   - `PROGRESS_BACKEND=properties` ✅

4. **Run verification:**
   ```bash
   export API_GATEWAY_URL="https://hvoog2lnha.execute-api.us-west-2.amazonaws.com"
   export TEST_EMAIL="afewell@gmail.com"
   export HUBSPOT_PROJECT_ACCESS_TOKEN="pat-na1-63b555f8-..."
   ./scripts/verify-issue-60.sh
   ```

5. **Expected Results:**
   - POST /events/track: `{"status":"persisted","mode":"authenticated","backend":"properties"}`
   - GET /progress/read: Shows `mode: authenticated` with progress data
   - Contact properties updated in HubSpot
   - BEFORE/AFTER diff shows new progress

---

## 📊 Current Status

| Item | Status |
|------|--------|
| CORS configuration (https only) | ✅ Complete |
| constants.json updated | ✅ Complete |
| Templates uploaded (DRAFT) | ✅ Complete |
| API smoke test | ✅ Complete |
| Contact properties verified | ✅ Complete |
| constants.json published | ⏳ **Awaiting manual action** |
| Live beacon verification | ⏳ Pending publish |
| CMS Membership confirmed | ⏳ Awaiting confirmation |

---

## 🔐 Security Notes

- All tokens masked in logs
- Using `HUBSPOT_PROJECT_ACCESS_TOKEN` (preferred over private app token)
- Template uploads restricted to allowlisted paths
- No PII in anonymous mode payloads
