# Issue 317 Architecture Analysis

## Goal
Restore deterministic authenticated UI state on Learn pages by removing the legacy identity override and ensuring cross-subdomain cookies and CORS are correct.

## Current runtime flow (summary)
1) CMS page loads on `https://hedgehog.cloud/learn/...`.
2) `cognito-auth-integration.js` initializes Cognito identity and calls `/auth/me`.
3) `auth-context.js` (legacy HubSpot membership) runs later and overwrites `window.hhIdentity` with anonymous data.
4) Enrollment UI reads identity and stays in anonymous state.

## Target runtime flow
1) CMS page loads on `https://hedgehog.cloud/learn/...`.
2) Cognito script initializes `window.hhIdentity` and calls `/auth/me`.
3) Enrollment UI reads the same identity source and updates CTA state.

## Architectural decision
Single authoritative identity source on Learn pages: Cognito-based `window.hhIdentity`. Legacy HubSpot membership bootstrap is removed from Learn templates.

## Impacts
- Frontend: Learn templates stop loading `auth-context.js`.
- Backend: cookies must be visible across `hedgehog.cloud` and `api.hedgehog.cloud`.
- Backend: CORS must allow `https://hedgehog.cloud` with credentials.
- Tests: e2e authenticated UI relies on Cognito identity resolving before CTA updates.

## Risks and mitigations
- Risk: other pages may depend on `auth-context.js`.
  - Mitigation: scope removal to Learn templates only.
- Risk: cookie changes affect auth state.
  - Mitigation: keep HttpOnly + Secure; set Domain to `.hedgehog.cloud` for cross-subdomain.
- Risk: CORS errors with credentials.
  - Mitigation: explicit origin allowlist, no `*` when credentials are true.

## Rollback
- Re-add `auth-context.js` script tags in Learn templates.
- Restore prior cookie/CORS configuration in Lambda + API Gateway.

