# Shadow HH-Learn Environment

This document describes the in-portal shadow environment for HH-Learn feature development. The shadow environment lives at `/learn-shadow/*` inside the production HubSpot portal and is isolated from the live `/learn` experience.

**Status:** Phase 0A + 0B complete (Issues #371, #372). See epic #370 for the full roadmap.

---

## Architecture Overview

```
Production:   hedgehog.cloud/learn/*
              ↓ templates: CLEAN x HEDGEHOG/templates/learn/
              ↓ assets:    CLEAN x HEDGEHOG/templates/assets/{css,js}/
              ↓ backend:   api.hedgehog.cloud (Lambda, DynamoDB, CRM)

Shadow:       hedgehog.cloud/learn-shadow/*
              ↓ templates: CLEAN x HEDGEHOG/templates/learn-shadow/
              ↓ assets:    CLEAN x HEDGEHOG/templates/assets/shadow/{css,js}/
              ↓ backend:   api.hedgehog.cloud (auth only — writes disabled)
```

Shadow pages are published but have `noindex, nofollow` in templates and `metaRobotsNoIndex: true` at the CMS page level. They are not linked from the production site.

---

## Backend Interaction Classification (Phase 0B)

All stateful frontend → backend interactions were audited and classified:

### Safe to Share

| Endpoint | Method | Reason |
|---|---|---|
| `/auth/login` | GET | Redirect to Cognito — identity is shared across environments |
| `/auth/signup` | GET | Same Cognito user pool — safe |
| `/auth/callback` | GET | OAuth token exchange — read-only for the page |
| `/auth/me` | GET | Returns user identity — read-only |
| `/auth/logout` | POST/GET | Clears auth cookies — safe |
| `/auth/check-email` | GET | Pre-auth lookup — read-only |
| `/progress/read` | GET | Reads CRM contact properties — read-only |
| `/progress/aggregate` | GET | Aggregated progress query — read-only |
| `/enrollments/list` | GET | Lists enrollments — read-only |
| HubDB API | GET | Content reads — read-only |

### Disabled in Shadow (Phase 0B)

| Endpoint | Method | Why Disabled | Config Key |
|---|---|---|---|
| `/events/track` | POST | Writes progress/enrollment state to DynamoDB and CRM. Shadow browsing must not pollute production user data. | `TRACK_EVENTS_ENABLED: false`, `TRACK_EVENTS_URL: ''` |

### CRM Progress Display

| Feature | Shadow Behavior | Config Key |
|---|---|---|
| CRM-backed progress bars/counts | **Disabled** — falls back to localStorage | `ENABLE_CRM_PROGRESS: false` |
| My Learning dashboard | Shows localStorage-only data | `ENABLE_CRM_PROGRESS: false` |

This ensures shadow env testers see a clean slate (local-only progress) rather than their real production progress, preventing confusion between environments.

### Must Isolate (Future Phases)

| Endpoint | Status | Notes |
|---|---|---|
| `/quiz/grade` | Not yet in templates — blocked in shadow by `TRACK_EVENTS_URL: ''` | When implemented, will need a shadow-specific Lambda stage or event tagging |
| `/events/track` | Currently disabled | Phase 0C+: consider shadow-tagged events or a separate `stage: shadow` Lambda deployment |
| HubDB tables | Currently shared | Phase 0C+: provision shadow HubDB tables for content isolation |

---

## How Environment-Aware Config Works

Shadow templates use an inline `constants` block in every HubL template. Unlike production templates (which also inline constants), shadow templates set environment-specific values:

```hubl
{% set constants = {
  'ENABLE_CRM_PROGRESS': false,
  'TRACK_EVENTS_ENABLED': false,
  'TRACK_EVENTS_URL': '',
  'AUTH_LOGIN_URL': 'https://api.hedgehog.cloud/auth/login',
  'AUTH_ME_URL': 'https://api.hedgehog.cloud/auth/me',
  ...
} %}
```

The data attributes on the `#hhl-auth-context` element are rendered from these constants:

```html
data-enable-crm="{{ 'true' if constants.ENABLE_CRM_PROGRESS else 'false' }}"
data-track-events-url="{{ constants.TRACK_EVENTS_URL }}"
```

This means the rendered HTML for shadow pages will have:
```html
data-enable-crm="false"
data-track-events-url=""
```

The JavaScript reads these data attributes at runtime:
- `data-enable-crm="false"` → `enrollment.js`, `courses.js`, `pathways.js`, `my-learning.js` skip CRM calls
- `data-track-events-url=""` → `action-runner.js` guards against empty `trackUrl` and skips `fetch()`
- `TRACK_EVENTS_ENABLED: false` → `pageview.js` does not send `sendBeacon()` events

Auth data attributes continue to point to the production auth backend (safe — they are read-only identity operations).

The authoritative shadow constant values are documented in `clean-x-hedgehog-templates/config/shadow-constants.json`. This file is for operator reference only; it is not loaded by HubL at runtime (constants are inlined directly in each template).

---

## Production Isolation Guarantee

Production `/learn` templates and assets are **not modified** by the shadow environment setup. Production pages continue to use:
- Templates at `CLEAN x HEDGEHOG/templates/learn/` (unchanged)
- Assets at `CLEAN x HEDGEHOG/templates/assets/{css,js}/` (unchanged)
- Inline constants with `ENABLE_CRM_PROGRESS: true`, `TRACK_EVENTS_ENABLED: true`, full backend URLs

Shadow pages use:
- Templates at `CLEAN x HEDGEHOG/templates/learn-shadow/` (isolated copies)
- Assets at `CLEAN x HEDGEHOG/templates/assets/shadow/{css,js}/` (isolated copies)
- Inline constants with writes disabled

---

## Operating the Shadow Environment

### Updating shadow template config

Edit the `{% set constants = {...} %}` block in the relevant shadow template under `clean-x-hedgehog-templates/learn-shadow/`. After editing:

```bash
npm run build && node dist/scripts/hubspot/upload-templates.js
npm run build:scripts-cjs && node dist-cjs/scripts/hubspot/publish-template.js \
  --path "CLEAN x HEDGEHOG/templates/learn-shadow/<filename>.html" \
  --local "clean-x-hedgehog-templates/learn-shadow/<filename>.html"
```

### Reprovisioning shadow pages

```bash
npm run provision:shadow-pages [-- --dry-run] [-- --allow-create] [-- --publish]
```

### Enabling event tracking for a controlled shadow test

If a future test requires tracking events in an isolated environment, the correct path is a separate Lambda stage (not re-enabling writes against production). See the Phase 0C+ notes above.

---

## Files

| File | Purpose |
|---|---|
| `clean-x-hedgehog-templates/learn-shadow/**` | Shadow page templates |
| `clean-x-hedgehog-templates/assets/shadow/**` | Shadow CSS/JS assets |
| `clean-x-hedgehog-templates/config/shadow-constants.json` | Authoritative shadow constant values (reference doc, not loaded at runtime) |
| `scripts/hubspot/provision-shadow-pages.ts` | Shadow CMS page provisioning script |
