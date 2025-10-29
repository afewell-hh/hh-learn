# Authentication & Progress Persistence (2025-10-28 baseline)

## Overview

Issue #274 finished the migration to **HubSpot-native membership authentication** for every public learning page. This document captures the new baseline and points to the verification evidence that proves the CTA and progress stack are aligned with native membership. Historical JWT documentation lives in the repo archive; keep reading only if you are updating the production experience post-Issue-274.

Key outcomes:
- Hero CTAs render the correct state on first paint using HubL (`request_contact.is_logged_in` and `personalization_token('contact.email','')`).
- `window.hhIdentity` hydrates from server-rendered data attributes—no localStorage bootstrapper or anonymous polling.
- `enrollment.js` only activates CRM enrollment checks for authenticated visitors; anonymous users follow the `/_hcms/mem/login` redirect path.
- The JWT `/auth/login` endpoint exists solely for Playwright helpers and CI fixtures.

## Identity Sources

### 1. HubSpot Membership (production baseline)

```
Anonymous visitor
  ↓ clicks “Sign in to start course”
Redirects to /_hcms/mem/login?redirect_url=<current page>
  ↓ user completes HubSpot login
Page reloads with membership cookies in place
  ↓
HubL renders:
  - request_contact.is_logged_in = true
  - request_contact.hs_object_id, email, firstname, lastname
  - data-auth-context attributes consumed by auth-context.js
```

Implementation touchpoints:
- `clean-x-hedgehog-templates/learn/courses-page.html`
- `clean-x-hedgehog-templates/learn/pathways-page.html`
- `clean-x-hedgehog-templates/learn/macros/left-nav.html`
- `clean-x-hedgehog-templates/assets/js/auth-context.js`
- `clean-x-hedgehog-templates/assets/js/enrollment.js`

These templates emit `data-request-contact`, `data-authenticated`, and `data-email` attributes. `auth-context.js` reads them on load, hydrates `window.hhIdentity`, and resolves the `ready` promise without contacting any additional APIs.

### 2. Automation-only JWT (CI and Playwright helpers)

- Endpoint: `POST /auth/login`
- Purpose: bypass UI login during automated tests (`tests/helpers/auth.ts`)
- Scope: internal automation; **never surface this flow to production users**
- Controls:
  - Documented in `HUBSPOT-AUTH-QUICK-SUMMARY.md` and `docs/hubspot-project-apps-agent-guide.md`
  - Marked with comments in `tests/helpers/auth.ts`
  - JWT_SECRET stored in AWS SSM and GitHub Actions secrets; no new runtime dependencies

## CTA and Enrollment Flow

1. **Server render:** CTA markup is determined entirely in HubL.
   - Anonymous visitors: login anchor generated via `/_hcms/mem/login?redirect_url=...`.
   - Authenticated visitors: primary button rendered with `data-request-contact="true"` and enrollment metadata.
2. **Client hydration:** `enrollment.js` inspects `data-authenticated`.
   - Anonymous: script exits early; CTA stays a login link.
   - Authenticated: script attaches click handler, runs CRM enrollment status check, and updates the text/state accordingly.
3. **Action runner:** Authenticated clicks still route through the existing action-runner template. Issue tracking for the whitelist error observed on 2025-10-28 lives in Issue #276 (follow-up).

See `verification-output/issue-274/` for captured HTML of both anonymous and authenticated renders, plus manual walkthrough notes.

## Progress Persistence

Progress updates continue to use the behavioral event pipeline introduced in v0.3.

- Feature flag: `ENABLE_CRM_PROGRESS`
- Authenticated path:
  1. `enrollment.js` and related scripts emit progress events through `/events/track`.
  2. Lambda validates the request using membership-derived identifiers (`contactId`, `email`) now available from `window.hhIdentity`.
  3. HubSpot Behavioral Events store module/course completion details and roll up to contact properties.
- Anonymous path:
  - Events stay in localStorage (no CRM writes).
  - CTA remains a login link encouraging membership sign-in.

## File Reference

| Area | Files |
|------|-------|
| Templates | `clean-x-hedgehog-templates/learn/courses-page.html`, `.../pathways-page.html`, `.../macros/left-nav.html` |
| Client scripts | `clean-x-hedgehog-templates/assets/js/auth-context.js`, `.../enrollment.js`, `.../action-runner.js` |
| Tests | `tests/helpers/auth.ts`, `tests/e2e/enrollment-cta.spec.ts`, `tests/e2e/enrollment-flow.spec.ts`, `tests/e2e/native-login-flow.spec.ts` |
| Documentation | `docs/adr/001-public-page-authentication.md`, `HUBSPOT-AUTH-QUICK-SUMMARY.md`, `docs/hubspot-project-apps-agent-guide.md` |
| Verification | `verification-output/issue-274/IMPLEMENTATION-NOTES.md` (source of truth) |

## Verification Assets

Link these artifacts when confirming regressions or onboarding contributors:
- `verification-output/issue-274/course-authoring-101-anonymous-2025-10-28.html`
- `verification-output/issue-274/course-authoring-101-authenticated-2025-10-28.html`
- `verification-output/issue-274/IMPLEMENTATION-NOTES.md`
- `verification-output/issue-274/manual-verification-log.txt` (if present)

## Quick CRM Persistence Verification

Use this checklist whenever you need to confirm that explicit enrollment persists to HubSpot contact properties (Issue #276 regression guard).

1. **Sign in with native membership** – Visit a course page (e.g., `/learn/courses/course-authoring-101`) and complete the HubSpot membership login. Confirm `#hhl-enroll-button` renders as a button (not a login link).
2. **Trigger enrollment via action runner** – Click “Start Course”, wait for `/learn/action-runner` to redirect back, and open the browser console. You should see `[hhl-action-runner] Action failed` absent and the success banner momentarily before redirect.
3. **Inspect network response** – In the Network tab, open the `events/track` POST request. The JSON response must include `"status":"persisted"` and `"mode":"authenticated"`. Any other combination should be treated as a failure.
4. **Confirm CRM state** – Reload the course page in a fresh browser profile or query `/events/enrollments/list?email=<address>`; the CTA should immediately render as “✓ Enrolled in Course”. Alternatively, inspect the contact record in HubSpot and verify `hhl_progress_state`, `hhl_progress_summary`, and `hhl_progress_updated_at` updated within the last minute.
5. **CloudWatch log spot-check (optional)** – Run `npx serverless logs -f api --stage <stage> --tail` (or the equivalent AWS CLI command) and look for `Track event (persisted via properties)` entries matching the contact ID. Absence indicates the Lambda is not persisting.

## Troubleshooting Checklist

1. **CTA stuck on “Sign in” for authenticated user** – Inspect page source for `data-request-contact="true"`. If missing, membership login likely failed.
2. **Enrollment button missing** – Verify template publish status (`hs project upload` + publish scripts) and confirm personalization tokens resolve.
3. **Playwright fails to authenticate** – Ensure helpers call `await membershipLogin(page)` before relying on JWT fallback. Double-check environment variables in CI (`JWT_SECRET`, `HUBSPOT_TEST_EMAIL`, `HUBSPOT_TEST_PASSWORD`).
4. **Behavioral events missing** – Confirm `ENABLE_CRM_PROGRESS=true` in the environment and review CloudWatch logs for `/events/track`.

## Change Log

- **2025-10-28 (Issue #275):** Document rewritten to reflect native membership baseline; JWT flow marked automation-only; verification assets linked.
- **2025-10-26 (Issue #242):** Historical JWT-centric version archived in `docs/archive/2025-10/`.
