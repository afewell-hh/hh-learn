# ADR 002 – Authentication Features On Hold

**Date:** 2025-10-30  
**Status:** Accepted

## Context

Multiple iterations attempted to surface authenticated user data on public HubSpot CMS pages (membership profiles, sessionStorage handshakes, custom JWT flows, etc.). HubSpot never exposes PII on public templates, so each approach failed or regressed again after short-term fixes.

## Decision

- Suspend all work on authentication-dependent UX (enrollment buttons, progress sync, My Learning dashboards, nav sign-in links).
- Hide existing UI behind the `ENABLE_AUTH_UI` flag and ship the site as an anonymous experience.
- Plan the long-term solution around third-party SSO and an external datastore, not HubSpot CMS membership.

## Consequences

- Documents describing interim public-page authentication flows are historical only; they must be prefaced with a deprecation banner.
- New features that rely on authenticated identity are blocked until the SSO architecture is approved.
- Engineering focus should move to unauthenticated improvements and groundwork for SSO (e.g., external APIs/datastore design).

## References

- `docs/authentication-status.md`
- `AUTHENTICATION-ATTEMPTS-TIMELINE.md` (historical record)
- `AUTHENTICATION-CODE-INVENTORY.md` (historical record)
