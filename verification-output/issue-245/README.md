# Issue #245 – Private Action Runner

## Overview
This folder will store evidence for Issue #245: *Implement private action runner for enrollment/progress*. The feature routes all CRM-bound actions through the membership-gated `/learn/action-runner` page to eliminate contact identifiers on public Learn pages.

### Key Changes
- Added `clean-x-hedgehog-templates/learn/action-runner.html` (private template) and `assets/js/action-runner.js`.
- Updated front-end enrollment (`enrollment.js`) and module progress (`progress.js`) flows to redirect through the runner instead of calling `/events/track` directly.
- Introduced `ACTION_RUNNER_URL` constant in `constants.json` and documented the new flow in `docs/auth-and-progress.md`.

## Manual Test Plan
1. **Enrolled pathway/course**
   - Sign in via `/learn/auth-handshake`.
   - Visit a pathway page, click `Enroll in Pathway`.
   - Verify redirect to `/learn/action-runner?action=enroll_pathway…` and automatic return.
   - Confirm toast + UI updated on the originating page and CRM enrollment recorded.
2. **Module progress**
   - From a module page, click `Mark as Started` and `Mark Complete`.
   - Confirm both actions route through the runner and the buttons display success on return.
3. **Anonymous guardrails**
   - Log out and hit `/learn/action-runner` directly with an action query.
   - Runner should display the “Sign-in required” message and link to login handshake.
4. **Redirect validation**
   - Attempt to pass `redirect_url=https://example.com/` – runner must fall back to `/learn`.
5. **Session feedback**
   - Inspect `sessionStorage.hhl_last_action` on return; it should be cleared after the originating page processes the result.

## Evidence Checklist (to capture post-deploy)
- [ ] Screenshots of runner success and error states.
- [ ] Video/GIF of enrollment flow redirecting through runner.
- [ ] Curl output showing `/events/track` payload from CloudWatch logs.
- [ ] Browser console log demonstrating absence of contact IDs on public pages.

## 2025-10-21 Update
- Published the new templates and assets via `npm run publish:template` and `npm run publish:constants` (includes `action-runner.html`, `auth-handshake.html`, and updated enrollment/progress scripts).
- Created the `/learn/auth-handshake` page in HubSpot (page id `197951609258`) by cloning the action runner, retitling it, and scheduling it live. Verified both `/learn/action-runner` and `/learn/auth-handshake` respond with a 307 redirect to the membership login page (see `auth-handshake-headers.txt`).
- Playwright flow remains blocked: membership login returns `membership_error=CSRF_FAILURE`, so the CTA stays “Sign in to start course.” Logs captured in `playwright-2025-10-21.log` and `login-debug.log` for follow-up. The failure aligns with Issue #239 (membership auth gap).

Populate this directory with the artifacts above before closing Issue #245.
