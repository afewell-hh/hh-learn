# Phase 0E: QA Parity Matrix — Issue #375

**Verification date:** 2026-04-09
**Verifier:** Claude Sonnet 4.6 (automated checks) + manual code review

---

## 1. Page Set — Existence and Publish State

All 7 shadow pages confirmed PUBLISHED via HubSpot CMS Pages API:

| Page | Slug | HubSpot ID | State | Template |
|---|---|---|---|---|
| Get Started | `learn-shadow` | 210727657869 | PUBLISHED ✓ | `learn-shadow/get-started.html` |
| Modules | `learn-shadow/modules` | 210723427736 | PUBLISHED ✓ | `learn-shadow/module-page.html` |
| Courses | `learn-shadow/courses` | 210727657871 | PUBLISHED ✓ | `learn-shadow/courses-page.html` |
| Pathways | `learn-shadow/pathways` | 210723427738 | PUBLISHED ✓ | `learn-shadow/pathways-page.html` |
| My Learning | `learn-shadow/my-learning` | 210723427741 | PUBLISHED ✓ | `learn-shadow/my-learning.html` |
| Register | `learn-shadow/register` | 210727657873 | PUBLISHED ✓ | `learn-shadow/register.html` |
| Action Runner | `learn-shadow/action-runner` | 210727657875 | PUBLISHED ✓ | `learn-shadow/action-runner.html` |

All 7 pages return **HTTP 200** from live curl (unauthenticated).

---

## 2. Anti-Indexing Controls

| Check | Result |
|---|---|
| `<meta name="robots" content="noindex, nofollow">` in all 9 shadow templates | ✓ Present in every template |
| `noindex` present in live rendered HTML (`/learn-shadow`, `/learn-shadow/modules`, `/learn-shadow/courses`) | ✓ 1 occurrence per page |
| Shadow pages absent from `hedgehog.cloud/sitemap.xml` | ✓ 0 matches |
| Canonical tag on shadow pages points to shadow URL, not production | ✓ `href="https://hedgehog.cloud/learn-shadow/modules"` |
| robots.txt `Disallow: /learn-shadow` | ✗ Not yet added — **operator step** required (HubSpot UI only) |

---

## 3. Template and Asset Isolation

| Check | Result |
|---|---|
| All shadow templates use `assets/shadow/css/` CSS paths | ✓ (all 7 CMS-provisioned templates) |
| All shadow templates use `learn-shadow/macros/` macro imports | ✓ (catalog, courses-page, module-page, my-learning, pathways-page) |
| No bare `/learn/` links in shadow template files | ✓ (grep found 0 matches) |
| Production templates (`learn/*.html`) not modified | ✓ (API confirmed production pages still use `learn/` template paths) |
| Shadow assets loaded from `hub_generated` paths distinct from production | ✓ (separate template asset IDs in live HTML) |
| Production CSS/JS asset paths not referenced in shadow page live HTML | ✓ (0 matches) |

---

## 4. Backend Isolation / Write Safety

### Constants block (all 5 shadow templates with auth context):

| Template | ENABLE_CRM_PROGRESS | TRACK_EVENTS_ENABLED | TRACK_EVENTS_URL | ACTION_RUNNER_URL |
|---|---|---|---|---|
| action-runner.html | `false` ✓ | `false` ✓ | `''` ✓ | `/learn-shadow/action-runner` ✓ |
| courses-page.html | `false` ✓ | `false` ✓ | `''` ✓ | `/learn-shadow/action-runner` ✓ |
| module-page.html | `false` ✓ | `false` ✓ | `''` ✓ | `/learn-shadow/action-runner` ✓ |
| my-learning.html | `false` ✓ | `false` ✓ | `''` ✓ | `/learn-shadow/action-runner` ✓ |
| pathways-page.html | `false` ✓ | `false` ✓ | `''` ✓ | `/learn-shadow/action-runner` ✓ |

### Data attributes in live rendered HTML:

| Page | data-enable-crm | data-track-events-url |
|---|---|---|
| `/learn-shadow/modules` | `"false"` ✓ | `""` (empty) ✓ |
| `/learn-shadow/courses` | `"false"` ✓ | `""` (empty) ✓ |
| `/learn-shadow/my-learning` | `"false"` ✓ | `""` (empty) ✓ |

Attributes are rendered from HubL constants (not hardcoded) — verified in template source.

### Shadow JS fallback paths:

| File | Action-runner fallback | Notes |
|---|---|---|
| `enrollment.js` | `/learn-shadow/action-runner` ✓ (3 sites) | |
| `progress.js` | `/learn-shadow/action-runner` ✓ (3 sites) | `.catch()` hard fallback also sets `TRACK_EVENTS_ENABLED: false`, `TRACK_EVENTS_URL: ''` |
| `course-breadcrumbs.js` | N/A | Breadcrumb link → `/learn-shadow/courses/<slug>` ✓ |
| `my-learning.js` | N/A | Module links → `/learn-shadow/modules/<slug>` ✓ |

### Production data attributes (unchanged):

| Page | data-enable-crm | data-track-events-url |
|---|---|---|
| `/learn/modules` | `"true"` ✓ | `"https://api.hedgehog.cloud/events/track"` ✓ |
| `/learn/courses` | `"true"` ✓ | `"https://api.hedgehog.cloud/events/track"` ✓ |

---

## 5. Registration / Auth / CRM Isolation

### Registration form:

| Check | Result |
|---|---|
| Shadow `register.html` formId | `SHADOW_FORM_ID_PLACEHOLDER` ✓ (not production form ID) |
| Production `register.html` formId | `b2fd98ff-2055-41b2-85a0-0f497e798087` (unchanged) ✓ |
| Shadow form embed active | ✗ **Blocked by design** — `SHADOW_FORM_ID_PLACEHOLDER` prevents render until operator completes form clone |

### Auth endpoints:

Shadow pages share production auth (`api.hedgehog.cloud/auth/*`) — this is correct and by design. Auth is read-only identity verification against the shared Cognito user pool. No writes occur at auth endpoints.

### CRM environment marker:

`hhl_environment` contact property: **not yet provisioned** — blocked by `crm.schemas.contacts.write` scope not granted to available tokens. Operator step required. Until provisioned, shadow contacts cannot be filtered from production contacts in HubSpot UI, but shadow form submissions cannot occur anyway (placeholder blocks the form).

---

## 6. Operator Naming Clarity

| Check | Result |
|---|---|
| Shadow pages prefixed "Learn Shadow — " in HubSpot | ✓ (all 7 pages) |
| Shadow templates in `learn-shadow/` path in Design Manager | ✓ |
| Shadow assets in `assets/shadow/` path in Design Manager | ✓ |
| `docs/shadow-environment.md` accurately describes architecture | ✓ |
| `docs/shadow-operational-assets.md` documents form/CRM conventions | ✓ |

---

## 7. Production Safety Summary

| Risk | Status |
|---|---|
| Shadow events tracked to DynamoDB/CRM | Blocked — `TRACK_EVENTS_URL: ''` at template + JS level |
| Shadow pages indexed by search engines | Blocked — noindex meta in all templates, confirmed live |
| Shadow pages in sitemap | Confirmed absent |
| Shadow form submissions mixing with production CRM | Blocked — `SHADOW_FORM_ID_PLACEHOLDER` prevents form render |
| Shadow pages linked from production site | Not linked (no nav references, nofollow in meta) |
| Production templates modified | Not modified (API confirmed) |
| Production JS modified | Not modified (production `enrollment.js` still uses `/learn/action-runner`) |

---

## Residual Risks and Open Items

### Risk 1 — robots.txt disallow rule not yet added (LOW)
`hedgehog.cloud/robots.txt` does not have `Disallow: /learn-shadow`. The noindex meta tag is the primary protection and is confirmed working. The robots.txt disallow is defense layer 2. Pages are safe without it but it should be added before any extended shadow testing period.
**Action:** Operator adds `Disallow: /learn-shadow` in HubSpot portal settings.

### Risk 2 — Shadow registration form not yet cloned (MEDIUM, BLOCKED BY DESIGN)
`register.html` intentionally uses `SHADOW_FORM_ID_PLACEHOLDER`. No shadow registrations are possible until the operator clones the production form, adds `hhl_environment = shadow` hidden field, and updates the template. This is a known open item with documented steps in `docs/shadow-operational-assets.md`.
**Impact:** Shadow registration flows cannot be tested until this is done.
**Action:** Operator follows form clone procedure in `docs/shadow-operational-assets.md`.

### Risk 3 — `hhl_environment` CRM property not yet provisioned (MEDIUM, SCOPE-BLOCKED)
The `hhl_environment` contact property cannot be created with current API token scopes (`crm.schemas.contacts.write` not granted). Once provisioned, it enables filtering shadow contacts from production data.
**Impact:** If registration were active, shadow contacts would not be distinguishable from production contacts in HubSpot UI. Not actively harmful since registration is blocked (#2 above).
**Action:** Operator grants scope and runs `npm run provision:shadow-crm-properties`, or creates property manually.

### Risk 4 — Shadow module detail pages not dynamically provisioned (LOW, KNOWN)
Individual module pages at `/learn-shadow/modules/<slug>` require HubDB dynamic page binding on the shadow listing page. Links in my-learning.js now use the correct path structure, but the dynamic routing is not provisioned for shadow. Module detail pages will 404.
**Impact:** Module-level navigation within shadow env is incomplete. Not a write-safety issue.
**Action:** Future issue (Phase 0C+ scope per `docs/shadow-environment.md`).

### Risk 5 — Shadow assets served by HubSpot CDN via bundle IDs (INFORMATIONAL)
Shadow CSS/JS is served via HubSpot's `hub_generated/template_assets/` bundling. The bundle IDs change when templates are republished. This is expected HubSpot behavior and does not affect isolation.

---

## Go/No-Go Recommendation

### **GO** — with conditions documented above

The `/learn-shadow/*` environment is safe for feature development work with the following qualifications:

**Safe to use now:**
- Browsing shadow pages (modules catalog, courses, pathways, my-learning) for UI/template development
- Testing auth flows (login/logout) — shared Cognito user pool is by design
- Testing progress display (localStorage-only fallback in shadow)
- Developing and verifying new template features without risk of production data mutation

**Not yet usable (blocked by open operator steps):**
- Registration flow testing — requires operator to clone form and update register.html
- CRM-level contact tagging — requires operator to provision `hhl_environment` property

**Production safety is not at risk in either case.** The placeholder form ID prevents accidental production CRM writes, and the property scope gap doesn't affect any currently active flow.

### Conditions for full operational readiness:
1. Operator: Add `Disallow: /learn-shadow` to robots.txt (HubSpot portal settings)
2. Operator: Clone registration form → add `hhl_environment = shadow` hidden field → update `register.html` → commit
3. Operator: Grant `crm.schemas.contacts.write` scope and run `npm run provision:shadow-crm-properties` (or create manually)

These are operator steps, not code gaps. All code is correct and deployed.
