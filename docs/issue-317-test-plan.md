# Issue 317 Test Plan

## Goal
Verify authenticated UX state updates correctly on Learn pages after removing legacy identity script and fixing cookie/CORS behavior.

## Preconditions
- Cognito OAuth flow is functional.
- Auth cookies set with `Domain=.hedgehog.cloud`.
- API Gateway CORS allowlist includes `https://hedgehog.cloud`.
- Learn templates publish updated script tags.

## Manual verification
1) Anonymous user
   - Open `https://hedgehog.cloud/learn/courses/<slug>`.
   - Expect CTA shows “Sign in” and no enrollment button.
2) Authenticated user
   - Login via Cognito.
   - Return to same course page.
   - Expect CTA changes to enrollment button and no sign-in link.

## Automated tests (Playwright)
1) Auth setup
   - Run `tests/e2e/auth.setup.ts` to generate storage state.
2) Authenticated CTA
   - `tests/e2e/cognito-frontend-ux.spec.ts` should find `#hhl-enroll-button`
     and verify text does not contain “Sign in”.
3) Anonymous browsing
   - Existing anonymous tests continue to pass.

## Acceptance criteria
- `/auth/me` returns 200 for authenticated browser sessions.
- `window.hhIdentity.get()` contains email for authenticated sessions.
- Enrollment CTA updates to “Enroll/Start” state.
- E2E tests pass for authenticated and anonymous flows.

