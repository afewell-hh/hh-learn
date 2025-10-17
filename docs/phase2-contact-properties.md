---
title: Phase 2 – Contact Properties Backend
owner: hh-learn project lead
status: reference
last-reviewed: 2025-10-17
---

# Phase 2: Contact Properties Backend (MVP)

**Status**: Implemented (Issue #62)
**Backend Mode**: `PROGRESS_BACKEND=properties` (default)

## Overview

This document describes the MVP approach for persisting user learning progress in HubSpot using **Contact Properties** instead of Custom Behavioral Events. This approach is license-safe and works with all HubSpot tiers.

## Background

The original Phase 2 design relied on Custom Behavioral Events to track learning progress. However:
- The Hedgehog portal does not include Custom Behavioral Events in its license
- Reinstalling the Projects app to grant additional scopes encountered issues
- Contact Properties provide a simpler, license-compatible alternative

## Architecture

### Contact Properties Schema

Three custom contact properties are used to store progress:

| Property Name | Type | Description |
|--------------|------|-------------|
| `hhl_progress_state` | TEXT | JSON string containing per-pathway/module progress |
| `hhl_progress_updated_at` | DATETIME | Timestamp of last progress update |
| `hhl_progress_summary` | TEXT | Human-readable summary (e.g., "ai-networking: 3/5 modules") |

### Progress State JSON Structure

```json
{
  "pathway-slug": {
    "enrolled": true,
    "enrolled_at": "2025-10-11T12:34:56.789Z",
    "modules": {
      "module-slug-1": {
        "started": true,
        "started_at": "2025-10-11T12:35:00.000Z",
        "completed": true,
        "completed_at": "2025-10-11T12:40:00.000Z"
      },
      "module-slug-2": {
        "started": true,
        "started_at": "2025-10-11T12:41:00.000Z"
      }
    }
  }
}
```

## Configuration

### Environment Variables

Add to `.env`:

```bash
ENABLE_CRM_PROGRESS=true
PROGRESS_BACKEND=properties  # Default; use 'events' for Custom Behavioral Events
```

Add to `serverless.yml`:

```yaml
provider:
  environment:
    ENABLE_CRM_PROGRESS: ${env:ENABLE_CRM_PROGRESS, 'false'}
    PROGRESS_BACKEND: ${env:PROGRESS_BACKEND, 'properties'}
```

### Required HubSpot Scopes

The following scope is required (already present in most configurations):

- `crm.objects.contacts.write` - Update contact properties

## Creating Contact Properties

### Option 1: HubSpot UI

1. Navigate to **Settings** → **Properties** → **Contact Properties**
2. Click **Create property** for each of the following (Group: "Learning Program Properties"):

**Property 1: Progress State**
- Label: `HHL Progress State`
- Internal name: `hhl_progress_state`
- Group: Create new group "Learning Program Properties" (or use existing)
- Field type: Multi-line text
- Description: "JSON storage for Hedgehog Learn progress (managed by API)"

**Property 2: Progress Updated At**
- Label: `HHL Progress Updated At`
- Internal name: `hhl_progress_updated_at`
- Group: Learning Program Properties
- Field type: Date picker (with time)
- Description: "Last update timestamp for learning progress"

**Property 3: Progress Summary**
- Label: `HHL Progress Summary`
- Internal name: `hhl_progress_summary`
- Group: Learning Program Properties
- Field type: Single-line text
- Description: "Human-readable progress summary"

### Option 2: HubSpot CLI (requires setup)

```bash
# Not yet implemented - manual creation recommended for MVP
```

## Lambda Implementation

### Flow Overview

1. **Event received**: Template sends beacon to `/events/track`
2. **Authentication check**: If `ENABLE_CRM_PROGRESS=false` or no contact identifier, return anonymous mode
3. **Backend routing**: Check `PROGRESS_BACKEND` env var
   - `properties` → `persistViaContactProperties()` (default)
   - `events` → `persistViaBehavioralEvents()` (future)
4. **Contact lookup**: Find contact by email or `contactId`
5. **Read current state**: Fetch `hhl_progress_state` property
6. **Merge progress**: Update JSON with new event data
7. **Write back**: Update all three properties atomically
8. **Return success**: `{ status: 'persisted', mode: 'authenticated', backend: 'properties' }`

### Key Functions

#### `persistViaContactProperties(hubspot, input)`

Handles the properties backend:

```typescript
async function persistViaContactProperties(hubspot: any, input: TrackEventInput) {
  // 1. Find contact by email or contactId
  let contactId = input.contactIdentifier?.contactId;

  if (!contactId && input.contactIdentifier?.email) {
    const searchResponse = await hubspot.crm.contacts.searchApi.doSearch({
      filterGroups: [{ filters: [{
        propertyName: 'email',
        operator: 'EQ',
        value: input.contactIdentifier.email
      }] }],
      properties: ['hhl_progress_state'],
      limit: 1,
    });
    contactId = searchResponse.results[0].id;
  }

  // 2. Read current progress
  const contact = await hubspot.crm.contacts.basicApi.getById(contactId, ['hhl_progress_state']);
  let progressState = JSON.parse(contact.properties.hhl_progress_state || '{}');

  // 3. Merge new progress
  const pathwaySlug = input.payload?.pathway_slug || 'unknown';
  const moduleSlug = input.payload?.module_slug;

  if (!progressState[pathwaySlug]) {
    progressState[pathwaySlug] = { modules: {} };
  }

  // Update based on event type
  // ... (see src/api/lambda/index.ts for full implementation)

  // 4. Write back to contact
  await hubspot.crm.contacts.basicApi.update(contactId, {
    properties: {
      hhl_progress_state: JSON.stringify(progressState),
      hhl_progress_updated_at: new Date().toISOString(),
      hhl_progress_summary: generateProgressSummary(progressState),
    },
  });
}
```

#### `generateProgressSummary(progressState)`

Creates human-readable summary:

```typescript
function generateProgressSummary(progressState: any): string {
  const summaries: string[] = [];
  for (const pathway of Object.keys(progressState)) {
    const modules = Object.keys(progressState[pathway].modules || {});
    const completed = modules.filter(m => progressState[pathway].modules[m].completed).length;
    summaries.push(`${pathway}: ${completed}/${modules.length} modules`);
  }
  return summaries.join('; ') || 'In progress';
}
```

## Template Integration

Templates continue to work unchanged. The beacon payload is identical:

```javascript
// From module-page.html
fetch(TRACK_EVENTS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventName: 'learning_module_started',
    contactIdentifier: {
      email: contactEmail,
      contactId: contactId
    },
    payload: {
      module_slug: 'intro-to-ai',
      pathway_slug: 'ai-networking',
      ts: new Date().toISOString()
    }
  })
})
```

The "Synced" indicator logic remains unchanged:

```jinja2
{% if request_contact.is_logged_in and constants.ENABLE_CRM_PROGRESS %}
  <div class="sync-indicator">✓ Progress synced across devices</div>
{% endif %}
```

## Verification Steps

### 1. Check Contact Properties Exist

In HubSpot UI:
- Settings → Properties → Contact Properties
- Search for "Learning Program Properties"
- Verify all three properties are present

### 2. Test Authenticated Flow

1. Sign in to a HubSpot Membership-enabled site
2. Navigate to a learning module detail page
3. Click "Mark as Started"
4. Open HubSpot Contacts
5. Find your contact record
6. Check the "Learning Program Properties" section:
   - `hhl_progress_state` should contain JSON
   - `hhl_progress_updated_at` should show recent timestamp
   - `hhl_progress_summary` should show "pathway-slug: 0/N modules"

### 3. Check Lambda Logs

```bash
# In AWS CloudWatch or serverless logs
serverless logs -f api --tail

# Look for:
# "Track event (persisted via properties) learning_module_started { email: 'user@example.com' }"
```

### 4. Verify Merge Logic

1. Start module A → Check property shows module A started
2. Complete module A → Check property shows module A completed
3. Start module B → Check property shows both modules
4. Verify JSON structure is correct (no duplicates, proper nesting)

## Error Handling

The Lambda gracefully handles errors:

- **Contact not found**: Returns `{ status: 'logged', mode: 'fallback', error: '...' }`
- **Property parse error**: Starts fresh with empty state
- **HubSpot API failure**: Returns fallback mode, logs error
- **Invalid JSON**: Logs warning, overwrites with valid state

User experience is never broken - errors result in client-side fallback.

## Size Considerations

JSON payload size should be monitored:

- **Current approach**: Store all pathway/module progress
- **Limit**: HubSpot text properties support up to 65,536 characters
- **Estimate**: ~100 bytes per module × 50 modules = ~5 KB (well within limit)
- **Future optimization**: If needed, cap history to most recent N modules or implement pagination

## Migration from Custom Events

If switching from `PROGRESS_BACKEND=events` to `properties`:

1. **No data loss**: Events remain in HubSpot, properties are empty
2. **Fresh start**: Users start tracking progress in properties from now
3. **Optional backfill**: Could write a script to read Custom Events and populate properties (out of scope for MVP)

## Future Enhancements

### Server-Side Read for UI Hydration

Currently, progress is write-only from Lambda. Future enhancement:

1. Add `/progress/read` endpoint to Lambda
2. Templates call endpoint on page load when authenticated
3. Render progress indicators server-side or hydrate client-side
4. Requires additional contact property reads (within API limits)

### Pathway Completion Tracking

Track overall pathway completion:

```json
{
  "pathway-slug": {
    "enrolled_at": "...",
    "completed": true,
    "completed_at": "...",
    "modules": { ... }
  }
}
```

Calculate when all modules in a pathway are completed.

### New: Read API (implemented)

Endpoint: `GET /progress/read?email=user@example.com` or `GET /progress/read?contactId=12345`

Response (authenticated):
```
{
  "mode": "authenticated",
  "progress": { /* hhl_progress_state JSON */ },
  "updated_at": "2025-10-11T18:02:00.000Z",
  "summary": "pathway: 1/5 modules"
}
```

Notes:
- CORS allowed from hedgehog.cloud and HubSpot CDN.
- Requires `ENABLE_CRM_PROGRESS=true` and `crm.objects.contacts.read` scope.

### Progress Analytics Dashboard

Create HubSpot custom reports using:
- `hhl_progress_summary` for aggregation
- `hhl_progress_updated_at` for activity trends
- Parse `hhl_progress_state` in calculated properties (requires Operations Hub)

## Troubleshooting

### "Contact not found" errors

- Ensure contact exists in HubSpot CRM
- Verify email matches exactly (case-insensitive in HubSpot)
- Check that `contactId` is the numeric HubSpot contact ID

### Progress not updating

1. Check `ENABLE_CRM_PROGRESS=true` in both:
   - Lambda environment (serverless.yml)
   - HubSpot constants.json
2. Verify `PROGRESS_BACKEND=properties` (or omitted, defaults to `properties`)
3. Check CloudWatch logs for errors
4. Verify contact properties exist with correct internal names

### JSON parse errors

- Lambda will log warning and start fresh
- Manually inspect `hhl_progress_state` in HubSpot UI
- Can manually reset by clearing the property value

### Summary not updating

- Verify `generateProgressSummary()` logic is deployed
- Check that modules object exists in progress state
- Ensure pathway slug is being tracked correctly

## API Reference

### POST `/events/track`

**Request:**

```json
{
  "eventName": "learning_module_started|learning_module_completed|learning_pathway_enrolled",
  "contactIdentifier": {
    "email": "user@example.com",
    "contactId": "12345"
  },
  "payload": {
    "module_slug": "module-slug",
    "pathway_slug": "pathway-slug",
    "ts": "2025-10-11T12:34:56.789Z"
  }
}
```

**Response (success):**

```json
{
  "status": "persisted",
  "mode": "authenticated",
  "backend": "properties"
}
```

**Response (anonymous):**

```json
{
  "status": "logged",
  "mode": "anonymous"
}
```

**Response (fallback):**

```json
{
  "status": "logged",
  "mode": "fallback",
  "error": "Contact not found for email: user@example.com"
}
```

## References

- Issue #62: MVP Pivot: Persist Progress via Contact Properties
- Issue #59: Staging Validation: v0.3 Auth & Progress
- `src/api/lambda/index.ts` - Lambda implementation
- `docs/auth-and-progress.md` - Authentication overview
- `docs/deployment-guide-v0.3.md` - Deployment instructions
