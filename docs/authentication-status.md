# Authentication Status (October 2025)

**Last updated:** 2025-10-30

## TL;DR

- HubSpot CMS **does not expose contact PII on public pages**. Attempts to surface membership identity via session storage, JWTs, or other client tricks are unsupported and break unpredictably.
- All authentication-dependent UI in Hedgehog Learn is currently hidden (`ENABLE_AUTH_UI=false`). The public experience is intentionally anonymous until we integrate a compliant solution.
- A future release will adopt **third-party SSO plus an external datastore** to deliver the desired UX. No work on interim hacks is permitted.

## What this means for agents

1. **Do not re-open historical authentication plans.** Documents describing “public-page identity bootstrapper”, JWT overlays, or handshake redirects are preserved only for forensic reference.
2. **Do not ship new auth-related features** (enrollment buttons, progress sync, My Learning dashboards, etc.). They must remain hidden until the SSO redesign is complete.
3. **Focus on unauthenticated UX** and unrelated platform work. If a task depends on authenticated state, flag it as blocked.

## SSO roadmap (high level)

- Adopt external IdP (Okta/Entra/etc.) for membership authentication.
- Serve authenticated pages from private/SSO-gated templates or an external SPA that owns its own datastore.
- Mirror only high-level progress summaries back into HubSpot CRM for marketing use.

### Status: _Planning_

An implementation plan will be published once SSO architecture and datastore selection are finalized.

## Where to send questions

- Project chat ► tag `@project-lead`
- GitHub Discussions ► `#architecture`
- Decision log ► `docs/adr/002-authentication-on-hold.md` (coming soon)

Remember: **if you see instructions that claim we can authenticate users on public pages today, they are outdated.** Always defer to this page.
