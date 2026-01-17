---
name: Execute Issue #270 - HubSpot Native Authentication
about: Implement the native Membership login flow and remove custom JWT from production
labels: "project:auth", "priority:P0", "type:feature"
assignees: ''

---

## Summary

Implement Issue #270 to align HH-Learn authentication with HubSpot's native Membership flow. Replace the custom JWT-first login UX with the native `/_hcms/mem/login` redirect, hydrate identity via HubL-rendered context, and retire the `/learn/auth-handshake` bridge.

## Background

- `docs/LMS-COMPREHENSIVE-DESIGN.md#1-authentication-architecture`
- `HUBSPOT-AUTH-QUICK-SUMMARY.md`
- `verification-output/issue-270/RESEARCH-FINDINGS.md`

## Scope

- Update CTA and navigation login behavior.
- Inject membership identity via HubL instead of sessionStorage/localStorage.
- Remove `/learn/auth-handshake` and related code paths.
- Keep JWT auth endpoint for automated tests only.
- Refresh Playwright/API tests to reflect simplified flow.
- Update documentation and verification guides.

## Acceptance Criteria

- Anonymous CTA click redirects to `/_hcms/mem/login?redirect_url=<origin>` without email prompt.
- Authenticated return renders CTA in enrolled state via `request_contact.is_logged_in`.
- `window.hhIdentity` resolves identity from HubL data attributes.
- No references to `/learn/auth-handshake` remain outside of historical docs.
- Playwright enrollment flow passes; membership smoke tests still succeed with JWT helper.
- Updated docs and release notes published.

## Testing

- `npm run test:e2e -- --grep "enrollment"`
- `npm run test:api -- --grep "membership"`
- Manual sanity check on staging + production.

## Deployment / Rollout

- Deploy updated templates/assets (`hs project upload`).
- Depublish `/learn/auth-handshake` inside HubSpot CMS.
- Announce change in release notes.
