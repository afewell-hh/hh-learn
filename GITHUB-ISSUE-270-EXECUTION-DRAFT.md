# Issue Draft: Execute Issue #270 – HubSpot Native Authentication

## Summary
Implement Issue #270 to align HH-Learn authentication with HubSpot's native Membership flow. Replace custom JWT-first login UX with the native `/_hcms/mem/login` redirect, hydrate identity via HubL-rendered context, and retire the `/learn/auth-handshake` bridge.

## Background
- `docs/LMS-COMPREHENSIVE-DESIGN.md#1-authentication-architecture`
- `HUBSPOT-AUTH-QUICK-SUMMARY.md`
- `verification-output/issue-270/RESEARCH-FINDINGS.md`

## Scope
- Update CTA and navigation login behavior.
- Inject membership identity via HubL instead of session/local storage hacks.
- Remove `/learn/auth-handshake` template + dependencies.
- Keep JWT auth endpoint solely for automated tests.
- Refresh Playwright/API tests.
- Update documentation and verification guides.

## Acceptance Criteria
- Anonymous CTA click sends users to `/_hcms/mem/login?redirect_url=<origin>` with no email prompt.
- Authenticated users return to enrolling page with CTA in enrolled state via `request_contact.is_logged_in`.
- `window.hhIdentity` resolves identity from HubL data attributes.
- No `/learn/auth-handshake` references remain except historical notes.
- Playwright enrollment flow (and membership smoke tests) pass.
- Docs updated, release notes published.

## Tasks
- [ ] Update `clean-x-hedgehog-templates/assets/js/enrollment.js` to use native login helper.
- [ ] Share login helper across navigation/CTA scripts and ensure consistent redirect.
- [ ] Inject HubL data attributes in base template (`clean-x-hedgehog-templates/partials/*.html`) for identity hydration.
- [ ] Simplify `window.hhIdentity` implementation to consume new data source.
- [ ] Remove handshake references from `clean-x-hedgehog-templates/assets/js/action-runner.js` and `clean-x-hedgehog-templates/learn/action-runner.html`.
- [ ] Remove `clean-x-hedgehog-templates/learn/auth-handshake.html` from codebase, mark as deprecated in docs.
- [ ] Update Playwright specs (`tests/e2e/enrollment-flow.spec.ts`, `tests/e2e/membership-diagnostic.spec.ts`) for new login flow.
- [ ] Adjust API tests as needed while retaining JWT helper for automation.
- [ ] Update docs (`docs/auth-public-login-alternative.md`, `docs/adr/001-public-page-authentication.md`, HubSpot agent guide) with new flow.
- [ ] Refresh verification guides (Issue #266/#267 outputs, release notes).

## Testing Plan
- Automated: `npm run test:e2e -- --grep "enrollment"` and `npm run test:api -- --grep "membership"`.
- Manual: Verify login redirect + CTA state on staging/production, ensure enrollment actions operate end-to-end.

## Deployment
- Deploy via `hs project upload` after tests.
- Depublish `/learn/auth-handshake` in HubSpot CMS.
- Publish release notes and inform QA.

## Risks & Mitigations
- Cached assets referencing handshake → bump asset versions.
- Tests assuming handshake → update specs ahead of rollout.
- Users mid-handshake during deploy → schedule low-traffic window & add temporary redirect rule if needed.
