# Issue #274 – Server-Rendered Enrollment CTA Plan

## Research Summary
- Left navigation macro (`clean-x-hedgehog-templates/learn/macros/left-nav.html`) already branches on `request_contact.is_logged_in` to render auth links server-side; CTA should follow the same pattern.
- Course and pathway detail templates currently render a single enrollment button (`#hhl-enroll-button`) that JavaScript rewrites after `window.hhIdentity` resolves, so anonymous visitors never see the correct state.
- `enrollment.js` waits on `window.hhIdentity.ready` to hydrate the CTA and drives the login redirect itself; it also owns CRM enrollment lookups and optimistic UI for the action runner.
- ADR 001 documents the shift to native HubSpot membership (Issue #272) and expects UI components to rely on HubL membership tokens instead of the deprecated identity handshake.

## Server Rendering Approach
1. For anonymous visitors (`not request_contact.is_logged_in`), render a primary CTA link that points to `{{ login_url }}?redirect_url={{ request.path_and_query|urlencode }}` with copy "Sign in to start course" / "Sign in to enroll" and show the helper paragraph up front.
2. For authenticated visitors, render a `<button>` with the existing ID/text plus data attributes that describe the content type (`data-content-type`) and slug (`data-content-slug`). Include an optional helper container for status messages.
3. Preserve structural markup so existing CSS continues to apply and assistive tech sees an actionable element immediately on load.
4. Mirror the same logic in both course and pathway detail templates so they stay in sync.

## Client Script Updates (`enrollment.js`)
- Read a boolean `data-authenticated` flag from `#hhl-auth-context` (set via HubL) instead of probing `window.hhIdentity` for initial CTA state.
- Skip the identity `ready` gate when attaching handlers; the CTA should already be correct. The script still uses CRM fetches when the user is authenticated to detect enrolled state.
- When encountering an anonymous state, do not rewrite the DOM—leave the server-rendered login link intact and bail early.
- Guard CRM lookups and click binding behind the authenticated state, reusing the existing logic for optimistic updates and action-runner redirects.
- Ensure helper text visibility is toggled only when needed (e.g., hide once authenticated, show error states as required).

## Documentation & Tests
- Append an addendum to `docs/adr/001-public-page-authentication.md` noting that CTAs now respect membership state server-side.
- Add/adjust Playwright coverage so a course detail page assertion checks the pre-JS text for logged-out users and the authenticated CTA for logged-in scenarios.
- Capture verification artifacts (screenshots/logs) under `verification-output/issue-274/` after testing.

## Open Questions / Assumptions
- CRM enrollment status is still read via the existing `/enrollments/list` endpoint; HubL does not surface enrollment state directly, so the "✓ Enrolled" state will still be toggled client-side after JS runs.
- Helper copy remains unchanged unless accessibility review requests otherwise.
