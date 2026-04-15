# Issue #429 Verification — Certificate UX (shadow-phase-7)

**Date:** 2026-04-15
**Branch:** issue-429-cert-ux
**Deployed stage:** shadow

---

## Part A — `awards_certificate` gate in certificate-issuance.ts

### Changes
- `src/api/lambda/certificate-issuance.ts`: Added HubDB lookup of the module row before issuing any cert. If `awards_certificate` is falsy (0, false, absent), cert issuance is skipped and the function returns early with `{ moduleCertIssued: false, courseCertIssued: false }`.
- Added the same gate for course certs: if the course row's `awards_certificate` field is falsy, course cert is skipped.
- Added `entityTitle` parameter to `issueOneCert()` and stored it in the DynamoDB cert record at issuance time (field: `entityTitle`).
- Updated `certificate-verify.ts` to include `entityTitle` in the response (with fallback to `entitySlug`).

### Verification
- Unit tests in `tests/unit/certificate-issuance.test.ts`: 9 new tests for the gate — all pass.
- Key behaviors tested: `awards_certificate=false` → no cert, `awards_certificate=0` → no cert, `awards_certificate=1` → cert issued, module row not found → no cert, `HUBDB_MODULES_TABLE_ID` not set → no cert, course `awards_certificate=false` → no course cert, `entityTitle` stored in DynamoDB.

---

## Part B — `GET /shadow/certificates` list endpoint

### Changes
- New file: `src/api/lambda/certificates-list.ts`
  - Shadow-only (403 if `APP_STAGE !== shadow`)
  - Auth: `verifyCookieAuth` (Cognito cookie)
  - Queries `certificates-shadow` DynamoDB table by `PK = USER#<userId>` with `begins_with(SK, 'CERT#')`
  - Returns `{ certificates: [...] }` sorted by `issuedAt` descending
  - Each entry: `{ certId, entityType, entitySlug, entityTitle, issuedAt }`
- `src/api/lambda/index.ts`: Imported and routed `GET /certificates` → `handleCertificatesList`
- `serverless.yml`: Added `GET /certificates` httpApi route

### Verification
```bash
curl -s "https://api.hedgehog.cloud/shadow/certificates"
# Response: {"error":"Unauthorized"}  HTTP 401
```
Returns 401 when no auth cookie present — correct shadow-only auth-guarded behavior.

---

## Part C — My Learning "My Certificates" section

### Changes
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-my-learning.js`:
  - Removed `buildCertBadgeHtml()` helper (per-module badge removed from module list items)
  - Removed per-module `certBadge` variable from module item HTML
  - Removed course-level cert badge div from course card render
  - Added `fetchAndRenderCertificates()` function: calls `GET /shadow/certificates`, renders entries with "View Certificate" and "Copy Link" buttons
  - Added `renderCertificatesSection()` function: shows cert cards or placeholder text
  - Called `fetchAndRenderCertificates()` after `renderEnrolledSection()` completes
- `clean-x-hedgehog-templates/learn-shadow/my-learning.html`:
  - Added CSS for `.cert-card`, `.cert-card-icon`, `.cert-card-body`, `.cert-card-title`, `.cert-card-meta`, `.cert-type-badge`, `.cert-date`, `.cert-card-actions`, `.cert-action-btn`, `.cert-action-view`, `.cert-action-copy`, `.certs-empty-note`, `#certificates-grid`
  - Added `<section id="certificates-section">` with `<div id="certificates-grid">` in the HTML body (after enrolled-section, before empty-state)

---

## Part D — Shadow certificate display page

### Changes
- New file: `clean-x-hedgehog-templates/assets/shadow/js/shadow-certificate.js`
  - Reads `id` query param from URL
  - Fetches `GET /shadow/certificate/<certId>` (public)
  - Best-effort: fetches `GET /auth/me` for learner name
  - Renders certificate card in `#certificate-container`
  - Shows heading, learner name, entity name, date, certId, verification URL, Copy Verification Link button
  - On error: shows "Certificate not found or invalid link"
- New file: `clean-x-hedgehog-templates/learn-shadow/certificate.html`
  - HubL page template with `#certificate-container`, shadow mode banner
  - Loads `shadow-certificate.js`
  - Note: the CMS page at `/learn-shadow/certificate` must be created manually by the user using this template

---

## Part E — Module page completion banner → cert link

### Changes
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-completion.js`:
  - `showModuleComplete(certId)` now accepts an optional `certId` parameter
  - When `certId` is present, banner includes a "View Certificate" link to `/learn-shadow/certificate?id=<certId>`
  - `cert_id` is passed from: `data.cert_id` (page-load restore), `result.cert_id` (quiz submit), `result.cert_id` (lab attest)
  - All three call sites updated to pass `result.cert_id || null`

---

## Unit Test Results

```
Test Suites: 9 passed, 9 total
Tests:       181 passed, 181 total  (includes 12 new certificates-list tests, 9 new awards_certificate gate tests)
```

---

## Deployment

Successfully deployed to shadow stage:
```
✔ Service deployed to stack hedgehog-learn-shadow (63s)
GET - https://jcsb8mv5qk.execute-api.us-west-2.amazonaws.com/certificates
```

Custom domain: `https://api.hedgehog.cloud/shadow/certificates`

---

## Manual steps required

1. Create a CMS page in HubSpot using the template `clean-x-hedgehog-templates/learn-shadow/certificate.html` at URL `/learn-shadow/certificate`.
2. Publish the HubSpot templates to make the updated JS assets live.

---

## Files Changed

### Lambda (TypeScript)
- `src/api/lambda/certificates-list.ts` — NEW
- `src/api/lambda/certificate-issuance.ts` — awards_certificate gate, entityTitle
- `src/api/lambda/certificate-verify.ts` — entityTitle in response
- `src/api/lambda/index.ts` — route for /certificates

### Infrastructure
- `serverless.yml` — GET /certificates route

### Frontend
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-certificate.js` — NEW
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-completion.js` — cert link in banner
- `clean-x-hedgehog-templates/assets/shadow/js/shadow-my-learning.js` — My Certificates section
- `clean-x-hedgehog-templates/learn-shadow/my-learning.html` — HTML/CSS for certificates section
- `clean-x-hedgehog-templates/learn-shadow/certificate.html` — NEW stub template

### Tests
- `tests/unit/certificates-list.test.ts` — NEW (12 tests)
- `tests/unit/certificate-issuance.test.ts` — Updated with awards_certificate gate tests (9 new tests)
