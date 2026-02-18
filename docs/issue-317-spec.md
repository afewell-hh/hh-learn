# Issue 317 Technical Specification

## Objective
Make authenticated Learn pages reflect Cognito identity reliably, with minimal change:
1) Remove legacy `auth-context.js` from Learn templates.
2) Ensure cookies are shared across `hedgehog.cloud` and `api.hedgehog.cloud`.
3) Ensure CORS allows `hedgehog.cloud` with credentials.

## In scope
- Learn templates under `clean-x-hedgehog-templates/learn/`.
- Cognito auth Lambda cookie attributes.
- API Gateway CORS configuration.
- Playwright UX tests for authenticated CTA.

## Out of scope
- Replacing non-Learn pages.
- HubSpot membership login changes.
- New features.

## Design details

### 1) Remove legacy identity script on Learn pages
Remove `auth-context.js` script tags from Learn templates. Keep Cognito script and enrollment/progress scripts.

Files to update (exact list to confirm during implementation):
- `clean-x-hedgehog-templates/learn/courses-page.html`
- `clean-x-hedgehog-templates/learn/pathways-page.html`
- `clean-x-hedgehog-templates/learn/my-learning.html`
- Any other Learn templates that include `auth-context.js`.

Expected result:
`window.hhIdentity` is owned by Cognito integration only.

### 2) Cookie domain for cross-subdomain
Set cookies with `Domain=.hedgehog.cloud` so that the browser sends them to both
`hedgehog.cloud` and `api.hedgehog.cloud`.

Expected cookie attributes:
- `Domain=.hedgehog.cloud`
- `HttpOnly`
- `Secure`
- `SameSite=None` (required for cross-site requests with credentials)
- `Path=/` for access token
- `Path=/auth` for refresh token

Note: Use `SameSite=None` only if credentials are used across subdomains and HTTPS is enforced.

### 3) CORS allowlist with credentials
For API Gateway:
- Allow origin: `https://hedgehog.cloud` and `https://www.hedgehog.cloud`.
- `allowCredentials: true`.
- Do not use `*` when credentials are enabled.

## Deployment
- Update templates and publish via repo scripts.
- Deploy Lambda/API changes via `npm run deploy:aws` (dev).

## Rollback
- Re-add `auth-context.js` to templates and republish.
- Restore prior cookie/CORS configuration and redeploy.

