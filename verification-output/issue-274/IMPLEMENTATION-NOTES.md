# Issue #274 – Server-Rendered Enrollment CTA Implementation Notes

_Date: 2025-10-28_

## What Now Works
- The course and pathway hero CTAs render the correct state straight from HubL:
  - Anonymous visitors see the native membership login link.
  - Authenticated visitors immediately see the primary enrollment button, with `data-request-contact="true"`.
- `enrollment.js` waits for `window.hhIdentity.ready` and, when authenticated data is present, upgrades any cached login link and runs CRM enrollment checks. The button transitions through “Checking enrollment…” → “Start Course” (or ✓ enrolled) and persists the enrolled state across refreshes.
- The left navigation and CTA share the same membership detection (`request_contact.is_logged_in` OR `personalization_token('contact.email', '')`), eliminating split-brain server output.

## Key Code Changes
- **Templates**
  - `clean-x-hedgehog-templates/learn/courses-page.html:547-611` and `clean-x-hedgehog-templates/learn/pathways-page.html:608-672`
    - Added `personalization_token('contact.email', '')` fallback, shared `is_logged_in` flag, and `data-request-contact`/`data-build-id` markers.
    - Added authenticated CTA branch that renders the enroll button even when personalization (but not `request_contact`) is available.
  - `clean-x-hedgehog-templates/learn/macros/left-nav.html:1-35`
    - Mirrored the same membership detection so nav + hero stay in sync; added `data-request-contact` for debugging.
- **Client script**
  - `clean-x-hedgehog-templates/assets/js/enrollment.js:11-412`
    - Parses the new `data-authenticated` flag, waits for `hhIdentity.ready`, upgrades login links to buttons when identity resolves, and only runs CRM polling for authenticated visitors.

## Deploy Steps (executed 2025-10-28)
1. `npm run upload:templates`
   - Pushes `clean-x-hedgehog-templates/**` assets to Design Manager (draft).
2. `node dist-cjs/scripts/hubspot/publish-template.js --path "CLEAN x HEDGEHOG/templates/learn/macros/left-nav.html"`
3. `node dist-cjs/scripts/hubspot/publish-template.js --path "CLEAN x HEDGEHOG/templates/learn/courses-page.html"`
4. `node dist-cjs/scripts/hubspot/publish-template.js --path "CLEAN x HEDGEHOG/templates/learn/pathways-page.html"`
5. `node dist-cjs/scripts/hubspot/publish-template.js --path "CLEAN x HEDGEHOG/templates/assets/js/enrollment.js"`

_All commands completed without validation errors (after switching to the `personalization_token('contact.email', '')` syntax) and published the live assets._

## Verification
- Automated regression: `npx playwright test tests/e2e/enrollment-cta.spec.ts` (passes with CRM check still skipped pending JWT mock update).
- Anonymous capture: `verification-output/issue-274/course-authoring-101-anonymous-2025-10-28.html` (CTA shows login link, `data-request-contact="false"`).
- Authenticated capture: `verification-output/issue-274/course-authoring-101-authenticated-2025-10-28.html` (CTA renders button, `data-request-contact="true"`). Captured via:
  ```bash
  HUBSPOT_TEST_USERNAME=afewell@gmail.com \
  HUBSPOT_TEST_PASSWORD='Ar7far7!' \
  node scripts/fetch-authenticated-page.js \
    'https://hedgehog.cloud/learn/courses/course-authoring-101?hsLang=en-us&cacheBust=20251028d' \
    > verification-output/issue-274/course-authoring-101-authenticated-2025-10-28.html
  ```
- Manual UX: confirmed CTA transitions “Checking enrollment…” → “Start Course”, persists the enrolled state after refresh/sign-out/in.

## Outstanding Follow-up
- **Action runner whitelist** – clicking “Start Course” currently hits the guard (`Unsupported action requested`). `clean-x-hedgehog-templates/learn/action-runner.html` and `assets/js/action-runner.js` need to allow `enroll_course`/`enroll_pathway` under the new server-rendered flow (covered in Issue #275).
- **Documentation cleanup** – repository still contains JWT-oriented assumptions and stale issue docs; also tracked in Issue #275.
