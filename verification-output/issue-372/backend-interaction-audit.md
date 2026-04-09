# Phase 0B: Backend Interaction Audit — Issue #372

## Scope

All stateful frontend → backend interactions across the 8 shadow templates in `clean-x-hedgehog-templates/learn-shadow/`.

---

## Audit Results: Safe to Share

| Endpoint | Method | Templates | Reason |
|---|---|---|---|
| `/auth/login` | GET redirect | all | Cognito redirect — identity shared across environments |
| `/auth/signup` | GET redirect | register | Same Cognito user pool — safe |
| `/auth/callback` | GET | all | OAuth token exchange — read-only for the page |
| `/auth/me` | GET | all | Returns user identity — read-only |
| `/auth/logout` | POST/GET | all | Clears auth cookies — safe |
| `/auth/check-email` | GET | register | Pre-auth lookup — read-only |
| `/progress/read` | GET | module-page, my-learning | Reads CRM contact properties — read-only |
| `/progress/aggregate` | GET | courses-page, pathways-page | Aggregated progress query — read-only |
| `/enrollments/list` | GET | courses-page, my-learning | Lists enrollments — read-only |
| HubDB API | GET | all | Content reads — read-only |

These endpoints are **shared with production**. Auth endpoints authenticate against the same Cognito user pool; `auth/me` is a read-only identity verification call.

---

## Audit Results: Disabled in Shadow

| Endpoint | Method | Why Disabled | Config Key Set |
|---|---|---|---|
| `/events/track` | POST | Writes progress/enrollment state to DynamoDB and CRM. Shadow browsing must not pollute production user data. | `TRACK_EVENTS_ENABLED: false`, `TRACK_EVENTS_URL: ''` |

---

## CRM Progress Display (Disabled)

| Feature | Shadow Behavior |
|---|---|
| CRM-backed progress bars | Disabled — falls back to localStorage |
| My Learning dashboard | Shows localStorage-only data |
| Course/pathway progress counts | Disabled — localStorage only |

Config key: `ENABLE_CRM_PROGRESS: false`

Shadow env testers see a clean slate (local-only progress) rather than their real production progress, preventing confusion between environments.

---

## Must Isolate (Future Phases)

| Endpoint | Notes |
|---|---|
| `/quiz/grade` | Not yet in templates — blocked in shadow by `TRACK_EVENTS_URL: ''`. When implemented, will need a shadow-specific Lambda stage or event tagging |
| HubDB tables | Currently shared (read-only). Phase 0C+: provision shadow HubDB tables for content isolation |
