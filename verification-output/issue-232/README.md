# Issue #232 Verification Summary

## Context
- **Issue:** #232 Enrollment flow still broken after fixes
- **Date:** 2025-10-20
- **Agent:** Codex (GPT-5)
- **Scope:** Publish updated course template + front-end scripts, confirm live assets render new auth context for enrollment CTA.

## Actions Completed
1. Rebuilt TypeScript bundles to ensure scripts compiled (`npm run build`).
2. Published updated HubSpot assets:
   - `CLEAN x HEDGEHOG/templates/learn/courses-page.html`
   - `CLEAN x HEDGEHOG/templates/assets/js/{enrollment,courses,pathways,pageview,my-learning,progress}.js`
   - Publish logs captured under this directory.
3. Forced CMS output to emit `data-enable-crm="true"` so scripts always hydrate CRM state post-login (HubL `request_json` was returning stale `false`).
4. Captured live HTML snapshots before and after the fix; latest (`course-page-anon-final.html`) shows the corrected attribute.
5. Added Playwright test `tests/e2e/enrollment-flow.spec.ts` to reproduce the full login → enroll journey. Current run fails (expected until bug fixed) with artifacts stored below.
6. Archived deployed `template_enrollment.min.js` from HubSpot CDN to confirm `toLowerCase()` normalization shipped.

## Evidence
- `publish-*.log` – CLI publish confirmations for courses, pathways, module, my-learning pages.
- `course-page-anon-*.html` – Anonymous HTML snapshots (before/after). `course-page-anon-final.html` shows `data-enable-crm="true"`.
- `template_enrollment.min.js` – Deployed minified script with lower-casing logic.
- `enrollment-flow-failure.png`, `enrollment-flow-trace.zip` – Playwright artifacts showing the CTA still stuck on "Sign in to start course" after login (test run without valid resolution yet).

## Outstanding Manual Verification
Interactive login is required to finish QA for Issue #232:
1. Sign in with the membership QA credentials noted in the GitHub issue.
2. Revisit `/learn/courses/course-authoring-101?hs_no_cache=1`.
3. Confirm CTA flips to “Start Course” without redirect loop.
4. Click to enroll; capture `/enrollments/list` + `/progress/read` responses.
5. Validate My Learning shows the enrolled course.
6. Store screenshots + API responses in this folder, then close the issue.

## Automated Repro Steps (Playwright)

```
HUBSPOT_TEST_USERNAME="<membership email>" \
HUBSPOT_TEST_PASSWORD="<password>" \
COURSE_URL="https://hedgehog.cloud/learn/courses/course-authoring-101?hs_no_cache=1" \
npx playwright test tests/e2e/enrollment-flow.spec.ts --reporter=list
```

The test currently fails at the post-login assertion, matching the customer-reported behavior. Once the bug is resolved, the expectation (`not.toHaveText(/Sign in to/)`) should pass and the run will succeed, capturing new artifacts.

> These steps need a browser session with membership access, which is outside the CLI-only environment. All deploy/publish prerequisites have been completed in preparation for the manual check.
