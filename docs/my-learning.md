# My Learning Dashboard

> **Updated:** 2026-04-09 (Issue #383 — UX redesign)  
> **Prior baseline documented in:** `verification-output/issue-386/my-learning-data-flow-audit.md`  
> This document reflects the current implementation. Earlier versions describing localStorage-only, pre-auth architecture are no longer accurate.

## Overview

The My Learning dashboard (`/learn/my-learning`) is a learner-facing page that shows a registered user's full learning journey — enrolled pathways and courses, module progress, and a resume CTA — backed by CRM data for authenticated users and localStorage for anonymous fallback.

**Shadow environment:** `/learn-shadow/my-learning` mirrors the same template and JS but always uses localStorage-only (CRM calls are disabled via `data-enable-crm="false"`).

---

## Data Sources (Priority Order)

| Source | Role | When used |
|--------|------|-----------|
| HubSpot CRM (`hhl_progress_state`) | All authenticated progress + enrollment state | User authenticated via Cognito |
| HubDB (Modules, Courses, Pathways tables) | Display metadata only (names, descriptions, time estimates, module/course ordering) | Always (for any data to display) |
| `localStorage` (`hh-module-*`) | Anonymous fallback; CRM failure fallback | Anonymous sessions; shadow env; CRM call failure |

**Critical constraint:** `window.hhIdentity.ready` must resolve before CRM-backed loads are initiated. The JS always awaits this Promise before checking auth state.

---

## Authentication

Production auth is **Cognito OAuth via httpOnly cookies** — not HubSpot native membership. Flow:

```
Page load
  → cognito-auth-integration.js (loaded synchronously)
  → GET https://api.hedgehog.cloud/auth/me (sends httpOnly cookies)
  → Lambda verifies Cognito JWT, looks up DynamoDB
  → Returns { userId, email, displayName, hubspotContactId }
  → window.hhIdentity hydrated; window.hhIdentity.ready resolves
  → my-learning.js proceeds with auth check
```

Anonymous: `/auth/me` returns 401 → `window.hhIdentity.get()` returns `{ authenticated: false }`.

The JS gate:
```js
if (auth.enableCrm && (auth.email || auth.contactId)) {
  // CRM path — fetch /progress/read + /enrollments/list
} else {
  // localStorage fallback — show auth-prompt banner
}
```

`auth.enableCrm` reads `data-enable-crm` from `#hhl-auth-context`. Production: always `"true"`. Shadow: always `"false"`.

---

## UX Sections (Issue #383 Redesign)

### 1. Progress Summary Bar

Three stats rendered immediately by JS after data loads:
- **In Progress** — count of modules started but not completed (from CRM or localStorage)
- **Completed** — count of fully completed modules
- **Enrolled** — count of enrolled pathways + courses (authenticated only; 0 for anonymous)

Auth-aware status message (right side of bar):
- Authenticated: green `✓ Progress synced across devices` (`.synced-indicator`)
- Anonymous: yellow `ℹ️ Progress is saved locally...` with Sign In link (`#auth-prompt`)

### 2. Resume Panel (authenticated only)

Displayed when `last_viewed` is present in the `/progress/read` response.

- Shows type badge (Module / Course), display title (fetched async from HubDB), relative time
- Prominent "Continue →" CTA button
- **Limitation:** only one `last_viewed` entry per user (CRM schema constraint). A multi-context resume would require schema changes.
- In shadow: panel is not shown (CRM not called)

### 3. My Enrollments (authenticated only)

**Pathway cards:**
- Title, enrolled date
- Course progress: "X of Y courses complete" with progress bar
  - Total course count from HubDB `course_slugs_json` (authoritative); falls back to CRM keys
  - Completed count from CRM `courses[courseSlug].completed`
- Status badge: Not Started / In Progress / Completed
- CTA: links to first incomplete course (ordered by HubDB `course_slugs_json`)
- Not shown in shadow (CRM not called)

**Course cards:**
- Title, enrolled date
- Module progress: "X of Y modules complete" + time remaining (sum of `estimated_minutes` for non-completed modules)
- Status badge: Not Started / In Progress / Completed
- Collapsible module list with per-module status icons (✓ / ◐ / ○)
- CTA: "Continue to Next Module" → first incomplete module; "Review Course" when complete
- Not shown in shadow (CRM not called)

### 4. In Progress / Completed Modules

Flat module cards with:
- Progress badge (In Progress / Completed)
- Course context badge (e.g., "Network Like Hyperscaler Foundations") — derived from CRM progress state, no extra API call
- Module title, time estimate, description excerpt
- "Continue Learning" / "Review Module" CTA

These sections use HubDB module metadata for display. Progress state comes from CRM (hierarchical model) or localStorage (fallback).

### 5. Empty State

Shown only when there are **no** in-progress or completed modules **and** no enrollments:
- "Start Your Learning Journey" with "Explore Pathways" CTA
- If anonymous (localStorage path), the auth-prompt banner above already shows sign-in

If enrolled courses/pathways are showing but module progress is empty, the empty state is suppressed (the enrollment cards provide CTAs to start).

---

## Data Fetching Sequence (authenticated path)

```
waitForIdentityReady()
  → getAuth() — reads enableCrm, email, contactId
  → if authenticated:
      parallel:
        GET /progress/read?contactId=…
        GET /enrollments/list?contactId=…
      → showResume(last_viewed)      — renders resume panel; async HubDB title lookup
      → renderEnrolledContent(…)     — fetches HubDB pathways (course counts) + courses
                                        (module slugs) + all modules in one batch
      → renderFromSets(setsFromCrm(progress))  — fetches HubDB for module display metadata
  → if anonymous:
      renderFromSets(getAllProgress())  — reads localStorage, fetches HubDB for display
```

---

## Progress State Schema (`hhl_progress_state`)

Two structural variants in the CRM property:

**Hierarchical (current NLH pathway):**
```json
{
  "<pathway-slug>": {
    "enrolled": true,
    "started": true,
    "completed": false,
    "courses": {
      "<course-slug>": {
        "completed": false,
        "modules": {
          "<module-slug>": { "started": true, "completed": true }
        }
      }
    }
  },
  "courses": {
    "<standalone-course-slug>": {
      "enrolled": true,
      "modules": { "<module-slug>": { "started": true, "completed": false } }
    }
  }
}
```

**Flat/legacy (backward-compat):**
```json
{
  "<pathway-slug>": {
    "enrolled": true,
    "modules": { "<module-slug>": { "started": true, "completed": false } }
  }
}
```

The JS `setsFromCrm()` handles both. Lambda reads and writes both.

---

## localStorage Schema (fallback only)

Key pattern: `hh-module-<slug>`  
Value: `{ "started": boolean, "completed": boolean }`

**Note:** `hh-pathway-progress-{slug}` keys are **not read** by `my-learning.js`. They exist in the codebase for other tracking but are not consumed here.

---

## Files

| File | Role |
|------|------|
| `clean-x-hedgehog-templates/learn/my-learning.html` | Production page template |
| `clean-x-hedgehog-templates/learn-shadow/my-learning.html` | Shadow page template |
| `clean-x-hedgehog-templates/assets/js/my-learning.js` | Production dashboard JS |
| `clean-x-hedgehog-templates/assets/shadow/js/my-learning.js` | Shadow dashboard JS |
| `clean-x-hedgehog-templates/learn/assets/js/cognito-auth-integration.js` | Cognito OAuth auth integration |
| `clean-x-hedgehog-templates/assets/js/login-helper.js` | Login UI helpers |

---

## Production vs Shadow

| Aspect | Production | Shadow |
|--------|------------|--------|
| URL | `/learn/my-learning` | `/learn-shadow/my-learning` |
| `data-enable-crm` | `"true"` | `"false"` |
| CRM calls | Yes (`/progress/read`, `/enrollments/list`) | Never |
| Progress source | CRM (fallback: localStorage) | localStorage only |
| Resume panel | Shown if CRM has `last_viewed` | Never shown |
| Enrollments section | Shown if CRM has enrollments | Never shown |
| Module links | `/learn/<slug>` | `/learn-shadow/modules/<slug>` |
| Search indexing | Default | `noindex, nofollow` |

**Shadow cannot validate CRM enrollment or progress flows.** It always renders the localStorage-only (anonymous) path, regardless of auth state.

---

## HubDB Tables Used

| Table | ID | Used for |
|-------|----|---------|
| Modules | `135621904` | Module display metadata (name, description, time, path) |
| Courses | `135381433` | `module_slugs_json` — ordered module list per course |
| Pathways | `135381504` | `course_slugs_json` — ordered course list per pathway |

---

## Provisioning

The `/learn/my-learning` page is created/updated via:

```bash
npm run provision:pages
```

---

## Testing Checklist

### Shadow-verifiable (localStorage path)
- [ ] Page loads without JS errors
- [ ] Loading spinner shown initially
- [ ] Empty state shows when localStorage has no progress
- [ ] Module cards render with course context badge when progress exists
- [ ] Progress summary stats correct
- [ ] Auth-prompt banner shown (anonymous path)
- [ ] Responsive design on mobile/tablet

### Production-only (requires authenticated CRM user)
- [ ] `window.hhIdentity.ready` awaited before CRM calls
- [ ] Resume panel shows with real module/course title
- [ ] Pathway enrollment card shows course count from HubDB + completed count from CRM
- [ ] Course enrollment card shows time remaining for incomplete modules
- [ ] Status badges (Not Started / In Progress / Completed) correct
- [ ] Synced indicator shown (not auth-prompt) for authenticated users
- [ ] Empty state suppressed when enrollments showing
- [ ] CRM fallback to localStorage when `/progress/read` fails

---

## Related Documentation

- `verification-output/issue-386/my-learning-data-flow-audit.md` — full data flow audit (source of truth for architecture)
- `docs/auth-and-progress.md` — auth flow overview (note: older sections reference HubSpot membership, which was replaced by Cognito; see issue #386 constraints)
- `verification-output/issue-383/` — #383 redesign verification artifacts
