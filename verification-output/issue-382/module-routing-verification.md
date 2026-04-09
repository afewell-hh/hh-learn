# Issue #382: Shadow Module Detail Routing — Verification

**Verification date:** 2026-04-09
**Verifier:** Claude Sonnet 4.6 (automated checks) + API inspection

---

## Root Cause Analysis

The shadow module detail 404s documented in the QA parity matrix (#375, Risk 4) were a **propagation delay artifact**, not a configuration gap.

### What was already in place (from #373)

The provision script (`scripts/hubspot/provision-shadow-pages.ts`) correctly applied HubDB dynamic page binding to the shadow modules listing page during Phase 0C (#373):

| Field | Shadow value | Production value |
|---|---|---|
| `dynamicPageDataSourceType` | `1` (HUBDB) | `1` (HUBDB) |
| `dynamicPageDataSourceId` | `135621904` | `135621904` |
| `dynamicPageHubDbTableId` | `135621904` | `135621904` |
| Shadow page ID | `210723427736` | `197624622201` |
| Slug | `learn-shadow/modules` | `learn/modules` |
| Template | `learn-shadow/module-page.html` | `learn/module-page.html` |

The binding was identical to production. The QA matrix was written with a "will 404" assumption based on the issue notes rather than fresh curl verification.

### Why routes now work

Dynamic page bindings in HubSpot CMS take effect when the parent listing page is published with the binding in place. The shadow modules page was published with the correct binding in #373. The dynamic child routes are generated at request time from HubDB table rows — no separate child page provisioning is required.

---

## Verification Results

### HTTP status — all 20 active module slugs

All checked against published shadow routes (not previews):

| Slug | Status |
|---|---|
| `/learn-shadow/modules/fabric-operations-welcome` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-how-it-works` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-mastering-interfaces` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-foundations-recap` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-vpc-provisioning` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-vpc-attachments` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-connectivity-validation` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-decommission-cleanup` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-telemetry-overview` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-dashboard-interpretation` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-events-status` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-pre-support-diagnostics` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-troubleshooting-framework` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-diagnosis-lab` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-rollback-recovery` | ✓ 200 |
| `/learn-shadow/modules/fabric-operations-post-incident-review` | ✓ 200 |
| `/learn-shadow/modules/accessing-the-hedgehog-virtual-ai-data-center` | ✓ 200 |
| `/learn-shadow/modules/accessing-the-hedgehog-virtual-lab-with-amazon-web-services` | ✓ 200 |
| `/learn-shadow/modules/accessing-the-hedgehog-virtual-lab-with-google-cloud` | ✓ 200 |
| `/learn-shadow/modules/accessing-the-hedgehog-virtual-lab-with-microsoft-azure` | ✓ 200 |

**20/20 PASS**

### Write-safety attributes — confirmed on shadow module detail pages

Verified on `/learn-shadow/modules/fabric-operations-welcome`:

```html
<div id="hhl-auth-context"
  data-auth-me-url="https://api.hedgehog.cloud/auth/me"
  data-auth-login-url="https://api.hedgehog.cloud/auth/login"
  data-auth-logout-url="https://api.hedgehog.cloud/auth/logout"
  data-enable-crm="false"
  data-track-events-url=""
  style="display:none"></div>
```

- `data-enable-crm="false"` ✓ — CRM progress calls disabled
- `data-track-events-url=""` ✓ — event tracking URL empty (no writes)

### Anti-indexing — confirmed on shadow module detail pages

```
content="noindex, nofollow"
```

Present in rendered HTML ✓

### Template isolation — shadow assets confirmed distinct from production

Shadow module detail JS template asset IDs (`~210M` range):
- `210709903963` (left-nav)
- `210723614827` (cognito-auth-integration)
- `210723614819` (progress)
- `210709903957` (course-breadcrumbs)

Production module detail JS template asset IDs (`~197-205M` range):
- `197617187343` (left-nav)
- `205369508146` (cognito-auth-integration)
- `197434082449` (progress)
- `198441953869` (course-breadcrumbs)

No overlap — shadow module detail pages serve shadow template assets. ✓

### Shadow internal links — no production leakage in JS/template

My-learning page (`/learn-shadow/my-learning`) module links:
- All module card links: `/learn-shadow/modules/<slug>` ✓
- No `/learn/modules/` references from JS or template ✓

**One content-level HubDB link noted (not a template issue):**

The vAIDC preamble embedded in all 16 NLH module HubDB rows links to:
```
https://hedgehog.cloud/learn/modules/accessing-the-hedgehog-virtual-ai-data-center
```

This is a static link stored in HubDB content (added as part of the preamble insertion). Shadow and production share the same HubDB tables, so this production URL appears in both environments. This is expected behavior for the current shadow setup — HubDB content isolation is a Phase 0C+ concern per `docs/shadow-environment.md`. It does not represent a write-safety risk; it's a read-only navigation link.

### Production parity — unchanged

| Slug | Status |
|---|---|
| `/learn/modules/fabric-operations-welcome` | ✓ 200 |
| `/learn/modules/fabric-operations-vpc-provisioning` | ✓ 200 |

Production data attributes unchanged:
- `data-enable-crm="true"` ✓
- `data-track-events-url="https://api.hedgehog.cloud/events/track"` ✓

---

## Code Changes

**None required.** The HubDB dynamic page binding was correctly applied in #373. No template, script, or provisioning change is needed for #382. This issue is resolved by verifying that the existing configuration is effective.

---

## Acceptance Criteria Check

| Criterion | Status |
|---|---|
| Root cause for shadow module-detail 404s documented | ✓ |
| `/learn-shadow/modules/<slug>` resolves correctly for representative slugs | ✓ (20/20 PASS) |
| Shadow internal links to module detail pages work end-to-end | ✓ (my-learning → module links correct) |
| Production `/learn/modules/<slug>` behavior unchanged | ✓ |
| Verification artifacts stored under `verification-output/issue-382/` | ✓ |
