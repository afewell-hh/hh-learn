# Deployment Guide: v0.3 Auth & Progress

This guide walks through deploying the v0.3 authentication and CRM progress persistence features.

## Prerequisites

- HubSpot Content Hub Professional/Enterprise OR Marketing Hub Enterprise
- AWS account with appropriate permissions
- Node.js 18+ installed
- HubSpot CLI installed (`npm install -g @hubspot/cli`)
- Serverless Framework installed (`npm install -g serverless`)

## Step 1: Enable HubSpot Membership

### 1.1 Enable Membership Feature

1. Navigate to **Settings** → **Website** → **Pages** → **Memberships**
2. Toggle **"Require member registration to access private content"** ON
3. Click **Save**

### 1.2 Create Access Groups (Optional)

If you want to restrict content access:
1. Navigate to **Settings** → **Website** → **Pages** → **Memberships** → **Access groups**
2. Click **Create access group**
3. Name it "Learners" or similar
4. Add contacts or allow self-registration
5. Save

For open learning (no restrictions), skip this step.

### 1.3 Test Login Flow

1. Visit your HubSpot site at `https://yourdomain.com/hs-login`
2. Verify the login page renders correctly
3. Test signing in with a contact email
4. Verify redirect works after login

## Step 2: Choose Progress Backend (MVP: Contact Properties)

**Important**: As of Issue #62, the default backend for progress persistence is **Contact Properties** (`PROGRESS_BACKEND=properties`), which is license-safe and works with all HubSpot tiers.

### Backend Options

| Backend | Environment Variable | License Requirements | Status |
|---------|---------------------|---------------------|--------|
| **Contact Properties** | `PROGRESS_BACKEND=properties` | None (default CRM) | **Default (MVP)** |
| Custom Behavioral Events | `PROGRESS_BACKEND=events` | Custom Behavioral Events addon | Future enhancement |

### Option A: Contact Properties (Recommended - Default)

This is the MVP default and requires no Custom Events. Progress is stored in three contact properties:

- `hhl_progress_state` (TEXT) - JSON storage of progress
- `hhl_progress_updated_at` (DATETIME) - Last update timestamp
- `hhl_progress_summary` (TEXT) - Human-readable summary

**Setup Steps**:

1. Navigate to **Settings** → **Properties** → **Contact Properties**
2. Create a new property group: **"HHL Progress"**
3. Create three properties (see [phase2-contact-properties.md](./phase2-contact-properties.md) for details):

   **Property 1: HHL Progress State**
   - Label: `HHL Progress State`
   - Internal name: `hhl_progress_state`
   - Field type: Multi-line text
   - Group: HHL Progress

   **Property 2: HHL Progress Updated At**
   - Label: `HHL Progress Updated At`
   - Internal name: `hhl_progress_updated_at`
   - Field type: Date picker (with time)
   - Group: HHL Progress

   **Property 3: HHL Progress Summary**
   - Label: `HHL Progress Summary`
   - Internal name: `hhl_progress_summary`
   - Field type: Single-line text
   - Group: HHL Progress

4. Skip to Step 3 (no Custom Events needed)

**Required Scopes**: `crm.objects.contacts.write` (usually already present)

See [docs/phase2-contact-properties.md](./phase2-contact-properties.md) for detailed documentation.

### Option B: Custom Behavioral Events (Future Enhancement)

⚠️ **Note**: This option requires Custom Behavioral Events in your HubSpot license. If you don't have this addon, use Contact Properties instead.

You need to create 3 custom behavioral events for tracking progress.

### Option A: Via HubSpot UI (Recommended for Non-Developers)

1. Navigate to **Reporting** → **Analytics Tools** → **Custom Events**
2. Click **Create custom behavioral event**
3. Select **Send data via API**

#### Event 1: learning_module_started
- **Internal Name**: `learning_module_started`
- **Display Name**: Learning Module Started
- **Primary Object**: Contact
- **Properties**:
  - `module_slug` (String) - The module identifier
  - `pathway_slug` (String) - The pathway identifier (optional)
  - `ts` (Datetime) - Timestamp

#### Event 2: learning_module_completed
- **Internal Name**: `learning_module_completed`
- **Display Name**: Learning Module Completed
- **Primary Object**: Contact
- **Properties**: Same as above

#### Event 3: learning_pathway_enrolled
- **Internal Name**: `learning_pathway_enrolled`
- **Display Name**: Learning Pathway Enrolled
- **Primary Object**: Contact
- **Properties**:
  - `pathway_slug` (String) - The pathway identifier
  - `ts` (Datetime) - Timestamp

### Option B: Via API (For Automation)

```bash
#!/bin/bash
TOKEN="your-private-app-token"

# Event 1: learning_module_started
curl -X POST https://api.hubapi.com/events/v3/event-definitions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "learning_module_started",
    "label": "Learning Module Started",
    "primaryObject": "CONTACT",
    "propertyDefinitions": [
      {"name": "module_slug", "label": "Module Slug", "type": "string"},
      {"name": "pathway_slug", "label": "Pathway Slug", "type": "string"},
      {"name": "ts", "label": "Timestamp", "type": "datetime"}
    ]
  }'

# Event 2: learning_module_completed
curl -X POST https://api.hubapi.com/events/v3/event-definitions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "learning_module_completed",
    "label": "Learning Module Completed",
    "primaryObject": "CONTACT",
    "propertyDefinitions": [
      {"name": "module_slug", "label": "Module Slug", "type": "string"},
      {"name": "pathway_slug", "label": "Pathway Slug", "type": "string"},
      {"name": "ts", "label": "Timestamp", "type": "datetime"}
    ]
  }'

# Event 3: learning_pathway_enrolled
curl -X POST https://api.hubapi.com/events/v3/event-definitions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type": application/json" \
  -d '{
    "name": "learning_pathway_enrolled",
    "label": "Learning Pathway Enrolled",
    "primaryObject": "CONTACT",
    "propertyDefinitions": [
      {"name": "pathway_slug", "label": "Pathway Slug", "type": "string"},
      {"name": "ts", "label": "Timestamp", "type": "datetime"}
    ]
  }'
```

### 2.1 Verify Event Definitions

```bash
curl -X GET https://api.hubapi.com/events/v3/event-definitions \
  -H "Authorization: Bearer YOUR_TOKEN" | jq
```

You should see all 3 events listed.

## Step 3: Configure HubSpot Private App Scopes

1. Navigate to **Settings** → **Integrations** → **Private Apps**
2. Find your existing app or **Create private app**
3. Add the following scopes:
   - `behavioral_events.event_definitions.read_write`
   - `behavioral_events.send.write`
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write` (optional, for upserting)
4. Click **Save** and copy your token

## Step 4: Configure Environment Variables

### 4.1 Local Development

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# HubSpot
HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-xxxxxxxxxxxx
HUBSPOT_ACCOUNT_ID=12345678
HUBDB_PATHWAYS_TABLE_ID=135381504
HUBDB_COURSES_TABLE_ID=135381505

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# App
APP_STAGE=dev

# Enable CRM Progress
ENABLE_CRM_PROGRESS=true

# Progress Backend (default: properties)
PROGRESS_BACKEND=properties  # 'properties' (default) or 'events' (requires Custom Behavioral Events)
```

### 4.2 Production (AWS Lambda)

Set environment variables in AWS Systems Manager Parameter Store or directly in serverless.yml:

```yaml
provider:
  environment:
    ENABLE_CRM_PROGRESS: ${env:ENABLE_CRM_PROGRESS, 'true'}
    PROGRESS_BACKEND: ${env:PROGRESS_BACKEND, 'properties'}
```

## Step 5: Update HubSpot Template Constants

1. Log in to HubSpot Design Manager
2. Navigate to `CLEAN x HEDGEHOG/templates/config/constants.json`
3. Update the file:

```json
{
  "HUBDB_MODULES_TABLE_ID": "135621904",
  "HUBDB_PATHWAYS_TABLE_ID": "135381504",
  "HUBDB_COURSES_TABLE_ID": "135381505",
  "DEFAULT_SOCIAL_IMAGE_URL": "https://hedgehog.cloud/hubfs/social-share-default.png",
  "TRACK_EVENTS_ENABLED": true,
  "TRACK_EVENTS_URL": "https://your-api-id.execute-api.us-east-1.amazonaws.com/events/track",
  "ENABLE_CRM_PROGRESS": true,
  "LOGIN_URL": "/hs-login",
  "LOGOUT_URL": "/hs-logout"
}
```

4. **Save** and **Publish** the file

## Step 6: Build and Deploy Serverless Function

### 6.1 Install Dependencies

```bash
npm install
```

### 6.2 Build TypeScript

```bash
npm run build
```

### 6.3 Deploy to AWS

```bash
# Deploy to dev stage
npm run deploy

# OR deploy to production
APP_STAGE=production npm run deploy
```

### 6.4 Note the API Gateway URL

After deployment, note the endpoint URL:

```
endpoints:
  POST - https://abc123def.execute-api.us-east-1.amazonaws.com/events/track
  POST - https://abc123def.execute-api.us-east-1.amazonaws.com/quiz/grade
```

Copy the `/events/track` URL - you'll need it for Step 5.

## Step 7: Upload Templates to HubSpot

### 7.1 Upload via HubSpot CLI

```bash
# Upload all Learn templates
hs upload clean-x-hedgehog-templates/learn HubSpot/CLEAN x HEDGEHOG/templates/learn

# OR upload specific files
hs upload clean-x-hedgehog-templates/learn/module-page.html HubSpot/CLEAN x HEDGEHOG/templates/learn/module-page.html
hs upload clean-x-hedgehog-templates/learn/pathways-page.html HubSpot/CLEAN x HEDGEHOG/templates/learn/pathways-page.html
hs upload clean-x-hedgehog-templates/learn/courses-page.html HubSpot/CLEAN x HEDGEHOG/templates/learn/courses-page.html
hs upload clean-x-hedgehog-templates/learn/my-learning.html HubSpot/CLEAN x HEDGEHOG/templates/learn/my-learning.html
```

### 7.2 Verify in Design Manager

1. Go to **Marketing** → **Files and Templates** → **Design Tools**
2. Navigate to `CLEAN x HEDGEHOG/templates/learn/`
3. Verify all 4 templates are present and up-to-date

## Step 8: Provision Pages

Run the page provisioning script:

```bash
# Dry run first (recommended)
npm run provision:pages -- --dry-run

# If dry run looks good, provision for real
npm run provision:pages -- --allow-create

# To publish immediately
npm run provision:pages -- --allow-create --publish
```

Verify that `/learn/my-learning` page was created.

## Step 9: Test End-to-End

### 9.1 Test Anonymous Mode

1. Open an incognito browser window
2. Visit `https://yourdomain.com/learn`
3. Click on a module
4. Click **"Mark as started"**
5. Open browser DevTools → Network tab
6. Verify beacon sent to `/events/track`
7. Check payload - should NOT have `contactIdentifier`
8. Visit `/learn/my-learning` - should show progress from localStorage

### 9.2 Test Authenticated Mode

1. In the same browser, click **"Sign In"** in the header
2. Sign in with a test contact email
3. Verify you see "Hi, [Name]!" greeting
4. Visit `/learn/my-learning` - should show "✓ Progress synced across devices"
5. Click on a module
6. Click **"Mark as started"**
7. Check Network tab - beacon should now include `contactIdentifier.email`
8. Check HubSpot:
   - Go to **Contacts** → find your test contact
   - Click **Activity** tab
   - Should see "Learning Module Started" event

### 9.3 Test Cross-Device Sync

1. Sign in on Device A
2. Start a module
3. Sign out
4. Sign in on Device B (or different browser) with SAME email
5. Visit `/learn/my-learning`
6. *Note*: For v0.3, you'll still need to manually query events from CRM to show progress
   - This is a future enhancement (v0.4) to fetch progress from CRM on page load

## Step 10: Monitor and Debug

### 10.1 Check Serverless Logs

```bash
# Tail Lambda logs
aws logs tail /aws/lambda/hedgehog-learn-dev-api --follow

# OR via Serverless Framework
serverless logs -f api -t
```

### 10.2 Check for Errors

Look for:
- `Track event (persisted)` - Success
- `Failed to persist event to CRM` - Error sending to HubSpot
- `Track event (no identity)` - User not authenticated

### 10.3 Verify Events in HubSpot

1. Navigate to **Reporting** → **Analytics Tools** → **Custom Events**
2. Click on each event definition
3. Check **Event completions** tab for recent activity

## Troubleshooting

### Issue: Beacons not being sent

**Check:**
1. `TRACK_EVENTS_ENABLED=true` in constants.json
2. `TRACK_EVENTS_URL` is correct API Gateway URL
3. Browser console for CORS errors
4. Network tab shows POST request to /events/track

### Issue: Events sent but not appearing in HubSpot

**Check:**
1. `ENABLE_CRM_PROGRESS=true` in both serverless.yml and constants.json
2. Lambda logs show `Track event (persisted)` not `Track event (logged)`
3. Private app token has `behavioral_events.send.write` scope
4. Contact exists in HubSpot with matching email
5. Event definitions were created successfully

### Issue: User signed in but no contact identifier in beacons

**Check:**
1. `request_contact.is_logged_in` is true (check HubL output)
2. `ENABLE_CRM_PROGRESS=true` in constants.json
3. JavaScript correctly reads `contactEmail` and `contactId` variables
4. Browser console for JavaScript errors

### Issue: Login redirects to wrong page

**Check:**
1. `?redirect_url=` parameter is properly URL-encoded
2. Login URL is `/hs-login` not custom page
3. HubSpot Membership is enabled

## Rollback Procedure

If issues arise, you can disable CRM persistence without taking down the system:

### Quick Disable

1. Update `constants.json` in HubSpot Design Manager:
   ```json
   {
     "ENABLE_CRM_PROGRESS": false
   }
   ```
2. Save and publish
3. System reverts to anonymous localStorage-only mode

### Full Rollback

1. Disable in constants.json (above)
2. Update Lambda environment:
   ```bash
   serverless deploy -f api --update-config
   ```
   With `ENABLE_CRM_PROGRESS=false` in serverless.yml
3. Optionally revert templates to previous version

## Next Steps (Future Enhancements)

- **v0.4**: Server-side progress retrieval (fetch from CRM on page load)
- **v0.5**: Recommendations engine based on progress
- **v0.6**: Achievements and badges
- **v0.7**: Certificate generation

## Related Documentation

- [Authentication & Progress Architecture](./auth-and-progress.md)
- [Events & Analytics](./events-and-analytics.md)
- [My Learning Dashboard](./my-learning.md)
