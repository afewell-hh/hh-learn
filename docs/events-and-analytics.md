# Events & Analytics

This document describes the optional, privacy-friendly event tracking system for the learning platform.

## Overview

The learning platform can emit anonymous progress beacons when learners interact with modules and pathways. These events are sent to the `/events/track` serverless endpoint and can be used to:

- Capture anonymous learning signals before full authentication is implemented
- Validate the end-to-end event pipeline (template → API → logs)
- Prepare for future CRM event integration

**Privacy:** All events are anonymous and contain no personally identifiable information (PII).

## Configuration

Event tracking is controlled by theme constants in `clean-x-hedgehog-templates/config/constants.json`:

```json
{
  "TRACK_EVENTS_ENABLED": false,
  "TRACK_EVENTS_URL": ""
}
```

### Enabling Event Tracking

1. **Set the tracking URL** - Point to your deployed serverless endpoint:
   ```json
   {
     "TRACK_EVENTS_ENABLED": true,
     "TRACK_EVENTS_URL": "https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/events/track"
   }
   ```

2. **Deploy the serverless API** - Ensure the `/events/track` endpoint is deployed:
   ```bash
   npm run build
   serverless deploy
   ```

3. **Verify in DevTools** - Open browser DevTools → Network tab and check for POST requests to `/events/track`

### Disabling Event Tracking

Set `TRACK_EVENTS_ENABLED` to `false` or set `TRACK_EVENTS_URL` to an empty string. When disabled, no network requests will be made.

## Event Types

### 1. `learning_module_started`

Emitted when a learner clicks "Mark as started" on a module page.

**Payload:**
```json
{
  "eventName": "learning_module_started",
  "payload": {
    "module_slug": "getting-started-with-hedgehog",
    "pathway_slug": "network-fundamentals",
    "ts": "2025-10-10T12:34:56.789Z"
  }
}
```

**Fields:**
- `module_slug` (string, required): The URL slug of the module
- `pathway_slug` (string, optional): The URL slug of the pathway if accessed from a pathway context
- `ts` (string, required): ISO 8601 timestamp of the event

### 2. `learning_module_completed`

Emitted when a learner clicks "Mark complete" on a module page.

**Payload:**
```json
{
  "eventName": "learning_module_completed",
  "payload": {
    "module_slug": "getting-started-with-hedgehog",
    "pathway_slug": "network-fundamentals",
    "ts": "2025-10-10T12:45:30.123Z"
  }
}
```

**Fields:** Same as `learning_module_started`

### 3. `learning_pathway_enrolled`

Emitted once per session when a learner views a pathway detail page. Uses `sessionStorage` to prevent duplicate events within the same browser session.

**Payload:**
```json
{
  "eventName": "learning_pathway_enrolled",
  "payload": {
    "pathway_slug": "network-fundamentals",
    "ts": "2025-10-10T12:30:00.000Z"
  }
}
```

**Fields:**
- `pathway_slug` (string, required): The URL slug of the pathway
- `ts` (string, required): ISO 8601 timestamp of the event

## Technical Implementation

### Beacon Transport

Events are sent using the most appropriate transport method available:

1. **`navigator.sendBeacon()`** (preferred): Fire-and-forget beacon API that works even when the page is closing
2. **`fetch()` with `keepalive: true`** (fallback): Standard fetch API for browsers that don't support sendBeacon

Both methods send events asynchronously and don't block the user interface.

### Error Handling

All beacon code is wrapped in try-catch blocks. If an event fails to send:
- The error is silently caught
- No console errors are displayed
- User experience is not affected

This ensures the tracking system degrades gracefully if the API is unavailable.

### Session Deduplication

For `learning_pathway_enrolled` events, `sessionStorage` is used to track if an enrollment beacon has already been sent for a specific pathway during the current browser session:

```javascript
// Session key format: hh-pathway-enrolled-{pathway_slug}
sessionStorage.getItem('hh-pathway-enrolled-network-fundamentals')
```

This prevents duplicate enrollment events when refreshing the page or navigating within the pathway.

## CORS Configuration

The serverless API is configured with CORS to accept requests from:

- `https://hedgehog.cloud` (production domain)
- `https://*.hubspotusercontent-na1.net` (HubSpot preview/staging)
- `https://*.hubspotusercontent00.net` (HubSpot CDN)
- `https://*.hubspotusercontent20.net` (HubSpot CDN)
- `https://*.hubspotusercontent30.net` (HubSpot CDN)
- `https://*.hubspotusercontent40.net` (HubSpot CDN)

**Allowed headers:** `Content-Type`
**Allowed methods:** `POST`, `OPTIONS`

CORS configuration is defined in `serverless.yml` and automatically deployed with the API.

## Verification

### 1. DevTools Verification

With event tracking enabled:

1. Open browser DevTools (F12)
2. Go to the **Network** tab
3. Visit a pathway page or click module progress buttons
4. Look for POST requests to `/events/track`
5. Inspect the request payload to verify event data

**Expected response:** `200 OK` with `{ "status": "queued" }` or similar

### 2. CloudWatch Logs

After deploying the serverless API, events are logged to AWS CloudWatch:

1. Navigate to AWS CloudWatch → Log Groups
2. Find log group: `/aws/lambda/hedgehog-learn-{stage}-api`
3. View recent log streams
4. Search for event payloads in the logs

**Example log entry:**
```
Received event: learning_module_started
Payload: {"module_slug":"getting-started-with-hedgehog","pathway_slug":null,"ts":"2025-10-10T12:34:56.789Z"}
```

### 3. Disabled State Verification

With event tracking disabled (`TRACK_EVENTS_ENABLED: false`):

1. Open browser DevTools → Network tab
2. Interact with modules and pathways
3. Verify **no POST requests** are made to `/events/track`

## Privacy Considerations

### What is Tracked

- Module and pathway slugs (content identifiers)
- Event timestamps
- Event types (started, completed, enrolled)

### What is NOT Tracked

- User names or email addresses
- IP addresses (beyond standard server logs)
- Browser fingerprints or device IDs
- Cookies or persistent identifiers
- Session data beyond event deduplication

### Data Storage

Events are:
1. Sent to the serverless API
2. Logged to CloudWatch (ephemeral logs)
3. Eventually queued for processing (implementation TBD in v0.3)

No long-term user profiles are created from these events in the current implementation.

## Future Roadmap (v0.3)

In the upcoming authentication and progress tracking release (v0.3), these anonymous events will be enhanced to:

- Link events to authenticated user accounts
- Persist progress data to a database
- Generate CRM events for HubSpot
- Provide personalized learning analytics

The current implementation serves as a foundation for these features while maintaining user privacy.

## Troubleshooting

### No events appearing in Network tab

**Check:**
1. Is `TRACK_EVENTS_ENABLED` set to `true`?
2. Is `TRACK_EVENTS_URL` configured with a valid URL?
3. Are you on a pathway or module page?
4. Have you clicked a progress button?

### CORS errors in console

**Check:**
1. Is the serverless API deployed?
2. Is your origin domain listed in `serverless.yml` CORS config?
3. Are you accessing via HTTPS (required for HubSpot pages)?

### Events not appearing in CloudWatch

**Check:**
1. Is the Lambda function deployed and accessible?
2. Does the Lambda have CloudWatch logging permissions?
3. Are you looking at the correct log group for your stage (dev/prod)?
4. Check the Lambda's execution errors in CloudWatch

### Duplicate enrollment events

**Check:**
- Session storage availability (some browsers block in private mode)
- Console errors related to sessionStorage
- If using multiple browser tabs, each tab has a separate session

## API Endpoint Reference

### POST /events/track

Receives anonymous learning events from the frontend.

**Request:**
```json
{
  "eventName": "learning_module_started",
  "payload": {
    "module_slug": "string",
    "pathway_slug": "string | null",
    "ts": "ISO 8601 timestamp"
  }
}
```

**Response:**
- `200 OK`: Event received successfully
  ```json
  { "status": "queued" }
  ```
- `400 Bad Request`: Invalid payload
- `500 Internal Server Error`: Server error

**CORS:** Preflight (OPTIONS) supported for all configured origins
