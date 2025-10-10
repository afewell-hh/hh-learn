# Authentication & Progress Persistence (v0.3)

## Overview

This document describes the authentication and CRM progress persistence system implemented in v0.3. The system enables learners to sign in and have their learning progress automatically saved to HubSpot CRM, syncing across devices.

## Architecture Decision: HubSpot CMS Membership

### Chosen Approach
We use **HubSpot CMS Membership** as the authentication mechanism because:

1. **Native Integration**: Built into HubSpot CMS/Content Hub
2. **Zero OAuth Complexity**: No custom OAuth flows or token management
3. **CRM Integration**: Contacts automatically exist in HubSpot CRM
4. **Template Access**: `request_contact` HubL variable provides identity data
5. **Enterprise Ready**: Available with Content Hub Professional/Enterprise

### Requirements
- Content Hub Professional or Enterprise (OR Marketing Hub Enterprise)
- CMS Membership feature enabled
- Private content/access groups configured

### Alternative Considered
OAuth 2.0 via HubSpot App was considered but rejected due to:
- Additional complexity (token refresh, storage, security)
- Requires custom app configuration
- More maintenance overhead
- Membership provides equivalent functionality with less code

## System Components

### 1. Template-Level Authentication

#### HubL Variables Available
When a user is signed in via HubSpot Membership:

```jinja2
{% if request_contact.is_logged_in %}
  {# User is authenticated #}
  {{ request_contact.email }}  {# Contact email #}
  {{ request_contact.vid }}     {# Contact ID (deprecated, use hs_object_id) #}
  {{ request_contact.hs_object_id }}  {# Contact ID (new) #}
  {{ request_contact.firstname }}
  {{ request_contact.lastname }}
{% endif %}
```

#### Login/Logout URLs
- **Login**: `/hs-login` (HubSpot's built-in membership login page)
- **Logout**: `/hs-logout` (HubSpot's built-in logout endpoint)
- **Return URL**: Append `?redirect_url=<current_page>` to preserve context

Example:
```html
<a href="/hs-login?redirect_url={{ request.url }}">Sign In</a>
```

### 2. Progress Tracking Flow

#### Anonymous Mode (Default)
When `ENABLE_CRM_PROGRESS=false` or user not signed in:
1. Progress stored in browser localStorage only
2. No data sent to servers
3. Progress lost if browser data cleared
4. No cross-device sync

#### Authenticated Mode
When `ENABLE_CRM_PROGRESS=true` AND user signed in:
1. Client-side JavaScript emits beacons with contact identifier
2. Serverless `/events/track` endpoint receives events
3. Events persisted to HubSpot as Custom Behavioral Events
4. Progress synced across all devices for that contact

### 3. Serverless API: `/events/track`

#### Endpoint
```
POST https://<api-gateway-url>/events/track
```

#### Request Payload
```json
{
  "eventName": "learning_module_started" | "learning_module_completed" | "learning_pathway_enrolled",
  "contactIdentifier": {
    "email": "user@example.com",  // OR
    "contactId": "12345"
  },
  "payload": {
    "module_slug": "intro-to-hedgehog",
    "pathway_slug": "getting-started",
    "ts": "2025-01-15T10:30:00Z"
  }
}
```

#### Response
```json
{
  "status": "persisted" | "logged" | "queued",
  "mode": "authenticated" | "anonymous" | "fallback"
}
```

#### Implementation Details
- Environment variable: `ENABLE_CRM_PROGRESS` (default: `false`)
- When disabled: Logs events but doesn't persist to CRM
- When enabled: Calls HubSpot Behavioral Events API
- Graceful degradation: Returns success even if CRM write fails

### 4. HubSpot Behavioral Events API

#### Event Definitions Required
Create these custom event definitions in HubSpot:

1. **learning_module_started**
   - Internal Name: `learning_module_started`
   - Display Name: "Learning Module Started"
   - Object Association: Contact
   - Properties:
     - `module_slug` (string)
     - `pathway_slug` (string, optional)
     - `ts` (datetime)

2. **learning_module_completed**
   - Internal Name: `learning_module_completed`
   - Display Name: "Learning Module Completed"
   - Object Association: Contact
   - Properties:
     - `module_slug` (string)
     - `pathway_slug` (string, optional)
     - `ts` (datetime)

3. **learning_pathway_enrolled**
   - Internal Name: `learning_pathway_enrolled`
   - Display Name: "Learning Pathway Enrolled"
   - Object Association: Contact
   - Properties:
     - `pathway_slug` (string)
     - `ts` (datetime)

#### API Endpoint Used
```
POST https://api.hubspot.com/events/v3/send
```

#### Request Format
```json
{
  "eventName": "learning_module_started",
  "email": "user@example.com",
  "occurredAt": "2025-01-15T10:30:00Z",
  "properties": {
    "module_slug": "intro-to-hedgehog",
    "pathway_slug": "getting-started"
  }
}
```

#### API Limits
- 500 unique event definitions per account
- 30 million event completions per month
- 1,250 requests/second

## Configuration

### Environment Variables

#### Serverless Function (AWS Lambda)
```bash
# Required
HUBSPOT_PRIVATE_APP_TOKEN=<your-token>
HUBSPOT_ACCOUNT_ID=<your-account-id>

# Optional - Enable CRM persistence
ENABLE_CRM_PROGRESS=true  # default: false
```

#### HubSpot Template Constants
File: `clean-x-hedgehog-templates/config/constants.json`

```json
{
  "TRACK_EVENTS_ENABLED": true,
  "TRACK_EVENTS_URL": "https://<api-gateway-url>/events/track",
  "ENABLE_CRM_PROGRESS": true,
  "LOGIN_URL": "/hs-login",
  "LOGOUT_URL": "/hs-logout"
}
```

### Required HubSpot Scopes
Private App Token must have:
- `behavioral_events.event_definitions.read_write`
- `behavioral_events.send.write`
- `crm.objects.contacts.read`
- `crm.objects.contacts.write` (if upserting contacts)

## Template Implementation

### Sign In/Out UI Component

```jinja2
{% set constants = get_asset_url("/CLEAN x HEDGEHOG/templates/config/constants.json")|request_json %}
{% set login_url = constants.LOGIN_URL|default('/hs-login') %}
{% set logout_url = constants.LOGOUT_URL|default('/hs-logout') %}

<div class="auth-controls">
  {% if request_contact.is_logged_in %}
    <span class="user-greeting">Hi, {{ request_contact.firstname|default('there') }}!</span>
    <a href="{{ logout_url }}?redirect_url={{ request.url }}" class="auth-link">Sign Out</a>
  {% else %}
    <a href="{{ login_url }}?redirect_url={{ request.url }}" class="auth-link">Sign In</a>
  {% endif %}
</div>
```

### Synced Progress Indicator

```jinja2
{% if request_contact.is_logged_in and constants.ENABLE_CRM_PROGRESS %}
  <div class="progress-sync-indicator">
    ✓ Progress synced across devices
  </div>
{% endif %}
```

### JavaScript Beacon with Auth

```javascript
{% set constants = get_asset_url("/CLEAN x HEDGEHOG/templates/config/constants.json")|request_json %}
var TRACK_EVENTS_ENABLED = {{ constants.TRACK_EVENTS_ENABLED|tojson if constants else false }};
var TRACK_EVENTS_URL = {{ constants.TRACK_EVENTS_URL|tojson if constants else '""' }};
var ENABLE_CRM_PROGRESS = {{ constants.ENABLE_CRM_PROGRESS|tojson if constants else false }};

// Contact identity (only if signed in)
var contactEmail = {{ request_contact.email|tojson if request_contact.is_logged_in else 'null' }};
var contactId = {{ request_contact.hs_object_id|tojson if request_contact.is_logged_in else 'null' }};

function sendBeacon(eventName, payload) {
  if (!TRACK_EVENTS_ENABLED || !TRACK_EVENTS_URL) return;

  var eventData = {
    eventName: eventName,
    payload: payload
  };

  // Include contact identifier if authenticated and CRM persistence enabled
  if (ENABLE_CRM_PROGRESS && (contactEmail || contactId)) {
    eventData.contactIdentifier = {};
    if (contactEmail) eventData.contactIdentifier.email = contactEmail;
    if (contactId) eventData.contactIdentifier.contactId = contactId;
  }

  try {
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(eventData)], { type: 'application/json' });
      navigator.sendBeacon(TRACK_EVENTS_URL, blob);
    } else {
      fetch(TRACK_EVENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
        keepalive: true
      }).catch(function() {});
    }
  } catch (e) {}
}

// Example usage
sendBeacon('learning_module_started', {
  module_slug: 'intro-to-hedgehog',
  pathway_slug: 'getting-started',
  ts: new Date().toISOString()
});
```

## Setup Instructions

### Step 1: Enable HubSpot Membership

1. Navigate to **Settings** > **Website** > **Pages** > **Memberships**
2. Enable **Require member registration**
3. Create **Access Groups** (e.g., "Learners")
4. Add contacts to access groups OR allow self-registration

### Step 2: Create Custom Event Definitions

**Option A: Via API** (recommended for automation)
```bash
curl -X POST https://api.hubapi.com/events/v3/event-definitions \
  -H "Authorization: Bearer YOUR_TOKEN" \
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
```

Repeat for `learning_module_completed` and `learning_pathway_enrolled`.

**Option B: Via UI** (for non-developers)
1. Navigate to **Reporting** > **Analytics Tools** > **Custom Events**
2. Click **Create custom behavioral event**
3. Select **Create via API**
4. Enter event name and properties
5. Copy the Event ID
6. Use Event ID in beacon calls (or use internal name directly)

### Step 3: Configure Environment Variables

#### For Serverless Deployment
```bash
# .env.production
ENABLE_CRM_PROGRESS=true
HUBSPOT_PRIVATE_APP_TOKEN=<your-token-with-events-scope>
```

#### For HubSpot Templates
Update `constants.json` in Design Manager:
```json
{
  "TRACK_EVENTS_ENABLED": true,
  "TRACK_EVENTS_URL": "https://your-api-gateway.execute-api.us-east-1.amazonaws.com/events/track",
  "ENABLE_CRM_PROGRESS": true
}
```

### Step 4: Deploy Serverless Function

```bash
# Build TypeScript
npm run build

# Deploy to AWS
npm run deploy
```

### Step 5: Test End-to-End

1. **Anonymous Test**:
   - Visit `/learn` without signing in
   - Click "Mark as started" on a module
   - Verify localStorage updated
   - Check browser Network tab - beacon sent with NO `contactIdentifier`

2. **Authenticated Test**:
   - Sign in via `/hs-login`
   - Visit `/learn/my-learning` - should show "Progress synced" indicator
   - Click "Mark as started" on a module
   - Check browser Network tab - beacon sent WITH `contactIdentifier`
   - Verify in HubSpot:
     - Go to contact record
     - Check **Activity** tab for event

## Privacy & Data Handling

### Anonymous Users
- Progress stored in localStorage only
- No personal data transmitted
- Beacons logged server-side but not persisted
- Clearing browser data = losing progress

### Authenticated Users
- Contact email/ID included in beacons
- Events persisted to HubSpot CRM
- Progress synced across devices
- Subject to HubSpot's data retention policies

### GDPR/Privacy Considerations
- Users must explicitly sign in (opt-in)
- Provide clear notice about data collection
- Honor GDPR deletion requests via HubSpot
- localStorage still used as local cache

## Troubleshooting

### Events not appearing in HubSpot
1. **Check event definitions exist**:
   ```bash
   curl -X GET https://api.hubapi.com/events/v3/event-definitions \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Verify API token scopes** include:
   - `behavioral_events.send.write`

3. **Check serverless logs**:
   ```bash
   aws logs tail /aws/lambda/hedgehog-learn-dev-api --follow
   ```

4. **Verify contact exists** in HubSpot CRM with matching email

### User signed in but beacons still anonymous
1. Check `ENABLE_CRM_PROGRESS=true` in both:
   - Serverless environment (`serverless.yml`)
   - Template constants (`constants.json`)

2. Verify `request_contact.is_logged_in` is `true` in template

3. Check browser console for JavaScript errors

### "Progress synced" indicator not showing
1. Verify user is signed in: `request_contact.is_logged_in`
2. Check `ENABLE_CRM_PROGRESS=true` in constants.json
3. Ensure template includes synced indicator component

## Future Enhancements (v0.4+)

- **Server-Side Rendering of Progress**: Fetch progress from CRM events on page load
- **Progress API Endpoint**: `/api/progress/:contactId` to query user's progress
- **Recommendations Engine**: Suggest next modules based on completion patterns
- **Achievements/Badges**: Award badges for milestones
- **Leaderboards**: Gamification features
- **Social Sharing**: Share completed modules on LinkedIn
- **Certificate Generation**: Auto-generate completion certificates

## Related Documentation

- [Events & Analytics](./events-and-analytics.md) - Original beacon tracking implementation
- [My Learning Dashboard](./my-learning.md) - localStorage-based progress UI
- [Architecture](./architecture.md) - Overall system design
- [HubSpot Membership Docs](https://developers.hubspot.com/docs/cms/data/memberships) - Official HubSpot guide
- [Behavioral Events API](https://developers.hubspot.com/docs/guides/api/analytics-and-events/custom-events/custom-event-completions) - HubSpot API reference
