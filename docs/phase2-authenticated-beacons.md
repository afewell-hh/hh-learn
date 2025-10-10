# Phase 2: Authenticated Beacons with CRM Persistence (Issue #59)

## Overview

Phase 2 enables authenticated beacon tracking with CRM persistence. When users sign in via HubSpot CMS Membership, their learning progress events are persisted to HubSpot as Custom Behavioral Events, enabling cross-device sync and analytics.

## Prerequisites

### 1. HubSpot CMS Membership

**Required Tier**: Content Hub Professional or Enterprise (OR Marketing Hub Enterprise)

**Enable Membership**:
1. Log into HubSpot account (21430285)
2. Navigate to **Settings** → **Website** → **Pages** → **Memberships**
3. Enable **Require member registration**
4. Create Access Groups if needed (e.g., "Learners")
5. Test: Visit `https://hedgehog.cloud/hs-login` - should show login page

**Verify in Template**:
- `request_contact.is_logged_in` HubL variable available
- `request_contact.email` and `request_contact.hs_object_id` accessible

### 2. Custom Behavioral Event Definitions

**Required Tier**: Enterprise (for Custom Behavioral Events)

**Create 3 Event Definitions via HubSpot UI**:

Navigate to: **Reporting** → **Analytics Tools** → **Custom Events** → **Create custom behavioral event**

#### Event 1: learning_module_started
- **Internal Name**: `learning_module_started`
- **Display Name**: "Learning Module Started"
- **Object Association**: Contact
- **Properties**:
  - `module_slug` (String, required)
  - `pathway_slug` (String, optional)
  - `ts` (DateTime, required)

#### Event 2: learning_module_completed
- **Internal Name**: `learning_module_completed`
- **Display Name**: "Learning Module Completed"
- **Object Association**: Contact
- **Properties**:
  - `module_slug` (String, required)
  - `pathway_slug` (String, optional)
  - `ts` (DateTime, required)

#### Event 3: learning_pathway_enrolled
- **Internal Name**: `learning_pathway_enrolled`
- **Display Name**: "Learning Pathway Enrolled"
- **Object Association**: Contact
- **Properties**:
  - `pathway_slug` (String, required)
  - `ts` (DateTime, required)

**Note**: Save the internal names exactly as shown - they must match the `eventName` values in beacon payloads.

### 3. HubSpot Private App Scopes

Verify your Private App token has these scopes:
- `behavioral_events.event_definitions.read_write` (if creating events via API)
- `behavioral_events.send.write` (required for sending event completions)
- `crm.objects.contacts.read` (for contact lookups)

**Check via API**:
```bash
curl -X GET "https://api.hubapi.com/oauth/v1/access-tokens/${HUBSPOT_PRIVATE_APP_TOKEN}" \
  -H "Authorization: Bearer ${HUBSPOT_PRIVATE_APP_TOKEN}"
```

## Configuration Changes

### Step 1: Update constants.json

**Change `ENABLE_CRM_PROGRESS` from `false` to `true`**:

#### Option A: Manual Update via Script (Recommended)

Create a helper script to update constants:

```bash
# Read current constants from HubSpot
hs api --method GET \
  "/cms/v3/source-code/draft/content/CLEAN%20x%20HEDGEHOG%2Ftemplates%2Fconfig%2Fconstants.json" \
  > current-constants.json

# Extract content, update ENABLE_CRM_PROGRESS, upload
cat current-constants.json | jq -r '.content' | \
  jq '.ENABLE_CRM_PROGRESS = true' > updated-constants.json

# Create update payload
jq -n --arg content "$(cat updated-constants.json | jq -c .)" \
  '{content: $content}' > constants-update-payload.json

# Upload via Source Code API v3
curl -X PUT \
  "https://api.hubapi.com/cms/v3/source-code/draft/content/CLEAN%20x%20HEDGEHOG%2Ftemplates%2Fconfig%2Fconstants.json" \
  -H "Authorization: Bearer ${HUBSPOT_PRIVATE_APP_TOKEN}" \
  -H "Content-Type: application/json" \
  --data @constants-update-payload.json
```

#### Option B: Use npm Script (If Available)

```bash
# Update local file first
vim clean-x-hedgehog-templates/config/constants.json
# Change: "ENABLE_CRM_PROGRESS": false → true

# Re-upload
npm run upload:templates
```

**Updated constants.json**:
```json
{
  "HUBDB_MODULES_TABLE_ID": "135621904",
  "HUBDB_PATHWAYS_TABLE_ID": "135381504",
  "HUBDB_COURSES_TABLE_ID": "135381433",
  "DEFAULT_SOCIAL_IMAGE_URL": "https://hedgehog.cloud/hubfs/social-share-default.png",
  "TRACK_EVENTS_ENABLED": true,
  "TRACK_EVENTS_URL": "https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track",
  "ENABLE_CRM_PROGRESS": true,
  "LOGIN_URL": "/hs-login",
  "LOGOUT_URL": "/hs-logout"
}
```

### Step 2: Update Serverless Environment Variables

Update the Lambda environment variable:

```bash
# Via serverless.yml (already configured)
# Environment variables defined in serverless.yml:
#   ENABLE_CRM_PROGRESS: ${env:ENABLE_CRM_PROGRESS, 'false'}

# Update local .env
echo "ENABLE_CRM_PROGRESS=true" >> .env

# Redeploy Lambda
npm run deploy:aws
```

**Verify Deployment**:
```bash
# Check Lambda environment variables
aws lambda get-function-configuration \
  --function-name hedgehog-learn-dev-api \
  --query 'Environment.Variables'
```

## Testing Phase 2

### Test 1: Sign In Flow

1. Visit: `https://hedgehog.cloud/hs-login?redirect_url=https://hedgehog.cloud/learn`
2. Sign in with HubSpot Membership credentials
3. Should redirect back to `/learn`
4. Verify header shows: "Hi, [FirstName]!"

### Test 2: Authenticated Beacon - Module Started

1. While signed in, visit a module detail page:
   - Example: `https://hedgehog.cloud/learn/intro-to-hedgehog`
2. Open DevTools → Network tab
3. Click "Mark as Started" button
4. **Expected Network Request**:

```http
POST https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track
Content-Type: application/json

Request Payload:
{
  "eventName": "learning_module_started",
  "contactIdentifier": {
    "email": "user@example.com",
    "contactId": "12345"
  },
  "payload": {
    "module_slug": "intro-to-hedgehog",
    "pathway_slug": "getting-started",
    "ts": "2025-10-10T20:30:00.000Z"
  }
}

Response: 200 OK
{
  "status": "persisted",
  "mode": "authenticated"
}
```

**Key Verification Points**:
- ✅ Request includes `contactIdentifier` with `email` and/or `contactId`
- ✅ Response shows `"mode": "authenticated"`
- ✅ Response shows `"status": "persisted"` (not "logged")

### Test 3: Authenticated Beacon - Module Completed

1. On same module page, click "Mark as Complete"
2. **Expected**: Same as Test 2, but `eventName: "learning_module_completed"`

### Test 4: Authenticated Beacon - Pathway Enrolled

1. Visit a pathway detail page:
   - Example: `https://hedgehog.cloud/learn/pathways/getting-started`
2. Page load should automatically emit `learning_pathway_enrolled` (session-gated)
3. **Expected**: Network request with `eventName: "learning_pathway_enrolled"`

### Test 5: Verify Events in HubSpot CRM

1. Log into HubSpot account (21430285)
2. Navigate to **Reporting** → **Analytics Tools** → **Custom Events**
3. Click **View event completions**
4. Filter by:
   - Event: `learning_module_started`, `learning_module_completed`, or `learning_pathway_enrolled`
   - Contact: Your test contact email
5. **Expected**: See event completions with correct properties:
   - `module_slug`: "intro-to-hedgehog"
   - `pathway_slug`: "getting-started" (if applicable)
   - `ts`: Timestamp of event

**Alternative - Contact Timeline**:
1. Go to **Contacts** → Find test contact
2. View **Activity** timeline
3. **Expected**: Learning events appear in chronological order

### Test 6: Anonymous Mode Still Works

1. Sign out: Visit `https://hedgehog.cloud/hs-logout`
2. Visit a module page (not signed in)
3. Click "Mark as Started"
4. **Expected**:
   - Network request has NO `contactIdentifier`
   - Response: `{"status":"logged","mode":"anonymous"}`
   - Progress stored in localStorage only
   - No events in HubSpot CRM

## Verification Checklist

### Configuration
- [ ] `ENABLE_CRM_PROGRESS=true` in constants.json (HubSpot)
- [ ] `ENABLE_CRM_PROGRESS=true` in Lambda environment variables
- [ ] Lambda redeployed successfully
- [ ] All 3 Custom Event Definitions exist in HubSpot

### Authentication
- [ ] CMS Membership enabled
- [ ] `/hs-login` page accessible
- [ ] Sign in works and redirects correctly
- [ ] Header shows "Hi, [FirstName]!" when signed in
- [ ] My Learning page shows "✓ Progress synced across devices"

### Authenticated Beacons
- [ ] Signed-in beacons include `contactIdentifier`
- [ ] Response shows `"mode": "authenticated"`
- [ ] Response shows `"status": "persisted"`
- [ ] All 3 event types work (started, completed, enrolled)

### HubSpot CRM Persistence
- [ ] Events appear in Custom Events UI
- [ ] Events associated with correct contact
- [ ] Event properties populated correctly (`module_slug`, `pathway_slug`, `ts`)
- [ ] Events appear on Contact timeline

### Anonymous Mode (Regression Test)
- [ ] Signed-out users still get `"mode": "anonymous"`
- [ ] No `contactIdentifier` in anonymous requests
- [ ] Anonymous beacons don't create CRM events

## Artifacts to Capture

### 1. Network Screenshots
Capture for each event type (module_started, module_completed, pathway_enrolled):
- `phase2-network-module-started-request.png` - Request payload showing `contactIdentifier`
- `phase2-network-module-started-response.png` - Response showing `"mode": "authenticated"`
- `phase2-network-module-completed-request.png`
- `phase2-network-module-completed-response.png`
- `phase2-network-pathway-enrolled-request.png`
- `phase2-network-pathway-enrolled-response.png`

**IMPORTANT**: Mask PII (email, contact IDs) before posting publicly

### 2. HubSpot Custom Events Screenshots
- `phase2-hubspot-events-list.png` - Custom Events page showing completions
- `phase2-hubspot-event-details.png` - Event completion details with properties
- `phase2-hubspot-contact-timeline.png` - Contact timeline showing learning events

### 3. Configuration Evidence
- `phase2-constants.json` - Snippet showing `ENABLE_CRM_PROGRESS: true`
- `phase2-lambda-env-vars.txt` - Lambda environment variables (mask token)

### 4. Test Metadata
Document in a text file:
- Page URLs used during testing
- Test contact email (masked)
- Timestamp window of tests
- Browser/environment used

## Troubleshooting

### Events Not Appearing in HubSpot

**Check 1: Event Definitions Exist**
```bash
curl -X GET "https://api.hubapi.com/events/v3/event-definitions" \
  -H "Authorization: Bearer ${HUBSPOT_PRIVATE_APP_TOKEN}"
```
Verify `learning_module_started`, `learning_module_completed`, and `learning_pathway_enrolled` exist.

**Check 2: Contact Exists**
Verify the contact (by email) exists in HubSpot CRM. Events won't persist if contact doesn't exist.

**Check 3: Lambda Logs**
```bash
aws logs tail /aws/lambda/hedgehog-learn-dev-api --follow --format short
```
Look for:
- "Track event (persisted)" (success)
- "Failed to persist event to CRM" (failure)

**Check 4: API Token Scopes**
Verify token has `behavioral_events.send.write` scope.

### Response Shows "mode": "anonymous" When Signed In

**Possible Causes**:
1. `ENABLE_CRM_PROGRESS=false` in Lambda (not redeployed)
2. `ENABLE_CRM_PROGRESS=false` in constants.json (template not re-uploaded)
3. Browser cache - clear and reload
4. Contact not properly identified in HubL template

**Debug**:
- Check Network tab - is `contactIdentifier` in request payload?
- If yes: Lambda environment variable issue
- If no: Template not passing contact data

### Response Shows "mode": "fallback"

This means the Lambda tried to persist to HubSpot but failed. Check:
1. API token valid and has correct scopes
2. Event definitions exist in HubSpot
3. Contact exists in CRM
4. Lambda logs for specific error message

## Acceptance Criteria

Phase 2 is complete when:

- [x] `ENABLE_CRM_PROGRESS=true` deployed to HubSpot and Lambda
- [ ] Custom Event Definitions created in HubSpot (all 3)
- [ ] Signed-in users see authenticated UI ("Hi, FirstName", sync badge)
- [ ] Authenticated beacons include `contactIdentifier`
- [ ] Beacon responses show `"mode": "authenticated"` and `"status": "persisted"`
- [ ] Events appear in HubSpot Custom Events UI
- [ ] Events associated with correct contact with correct properties
- [ ] Anonymous mode still works when signed out (regression test)
- [ ] All artifacts captured and posted to Issue #59

## Next Steps

After Phase 2 sign-off:

1. **Close Issue #59** - Phase 1 & 2 complete
2. **Proceed to Issue #60** - Migrate to Project App scopes
   - Define `app/app-hsmeta.json` with required scopes
   - Deploy project app
   - Update installation scopes
   - Refactor scripts to use OAuth access tokens
   - Remove Private App token dependency

---

**Phase 2 Implementation Date**: 2025-10-10
**Issue**: #59 - Staging Validation: v0.3 Auth & Progress
