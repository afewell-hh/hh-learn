# Public-Page Authentication Alternative — Design Outline (Issue #242)

**Last Updated:** 2025-10-27  
**Owner:** Codex (HH Learn project)  
**Related Issues:** #233, #234, #235, #237, #238, #239, #242, #270, #272

> **Update – October 27, 2025:** Issue #272 replaces the JWT/login-handshake prototype with HubSpot's native membership flow (`/_hcms/mem/login`). The material below is preserved for historical context on the deprecated design.

## 1. Problem Statement

Hedgehog Learn course, pathway, and dashboard pages remain **public** by design. We want authenticated learners to opt in to progress sync while anonymous visitors retain full read access.

HubSpot’s CMS membership/private content mechanism only asserts identity on **private** pages. Our merged bootstrapper (`auth-context.js`) calls `/_hcms/api/membership/v1/profile`, which returns `404` on public pages (Issue #233 evidence dated 2025-10-21). Result: CTA buttons remain “Sign in to start course,” progress beacons never include contact identifiers, and My Learning stays empty.

We must ship an alternative identity flow that works on public pages, preserves CRM linkage, and integrates with existing scripts/tests.

## 2. Requirements

### Functional
- Provide a signed identity payload (`email`, `contactId`, optional metadata) consumable by `window.hhIdentity`.
- Keep all learn content publicly accessible; auth flow should be optional and unobtrusive.
- Support sign-in/sign-out controls surfaced in templates (CTA, header, My Learning).
- Trigger `/enrollments/list` and `/events/track` with authenticated mode once identity is present.
- Pass Playwright scenario `tests/e2e/enrollment-flow.spec.ts` using production credentials.

### Non-Functional
- Minimize additional infrastructure; reuse existing AWS Lambda stack if possible.
- Avoid storing long-lived secrets client-side; rely on short-lived signed tokens.
- Respect HubSpot rate limits and scopes already approved (Project App token preferred).
- Provide graceful fallback when identity cannot be established (anonymity-first).
- Keep implementation auditable and documented for Ops/Support.

### Constraints / Inputs
- HubSpot Project App token (`HUBSPOT_PROJECT_ACCESS_TOKEN`) available for server-side calls.
- Private Content remains enabled only for diagnostics; public templates must not depend on it.
- Existing scripts rely on `window.hhIdentity.ready` promise and synchronous `.get()` accessor.
- Timeline: part of Iteration I-2025-10-20 exit criteria (docs/iterations/2025-10-20-plan.md).

## 3. Candidate Approaches

### Option A — HubSpot OAuth Proxy via Serverless
1. Host a lightweight OAuth handshake in our AWS Lambda (existing Serverless deployment).
2. Use HubSpot OAuth (Public or Private App with redirect) to authenticate the learner.
3. After authorization, exchange code for access token server-side; fetch contact info.
4. Issue a signed JWT (or encrypted payload) back to the browser via redirect.
5. Front-end stores token (cookie/localStorage) and exposes identity through bootstrapper.

**Pros**
- Leverages official HubSpot OAuth flows; no custom email/password collection.
- Works on public pages; not tied to private content.
- JWT can include expiry, scopes, signature for tamper detection.

**Cons / Risks**
- Adds new OAuth configuration (redirect URLs, scopes, app review).
- Requires token storage/refresh logic; more moving parts than membership.
- Must ensure logout revokes/clears session appropriately.

### Option B — Signed Identity Issuer Using Project App Token
1. Build an `/identity/request` endpoint in AWS Lambda.
2. Learner submits email (and optional verification code). Backend calls HubSpot Contacts API (Project App token) to validate account and generate a one-time login link or code.
3. Learner confirms via emailed magic link or short code; backend issues signed identity token.
4. Browser redeems token and bootstrapper resolves identity.

**Pros**
- Avoids OAuth screens; can feel like a lightweight magic-link login.
- Keeps data within our domain; flexible shape of identity payload.

**Cons / Risks**
- Requires building secure email delivery (SES) or alternative; more engineering.
- Additional UX work (forms, error states).
- Must handle abuse prevention (rate limiting, replay attacks).

### Option C — HubSpot Private Content Session Bridge (Hybrid)
1. Direct learner briefly through a hidden private page specifically for authentication.
2. Use serverless middleware to copy membership cookies into a signed token usable on public pages.

**Pros**
- Minimal new infrastructure; reuses membership login.

**Cons**
- Still depends on private content being enabled and reliable.
- Cookie copying may violate HubSpot terms or break with future changes.
- Adds brittle redirect gymnastics; rejected unless other options fail.

## 4. Recommended Direction

Proceed with **Option A (OAuth Proxy)** as the leading candidate:
- Aligns with security best practices (short-lived access tokens, revocable).
- HubSpot Projects already supports OAuth scopes we need (`crm.objects.contacts.read`).
- Serverless stack can host the auth handlers alongside existing APIs.
- JWT-based session token keeps the browser integration simple (modify bootstrapper to fetch `/identity/session` endpoint and resolve identity).

Tasks to validate during discovery:
- Confirm HubSpot Projects OAuth availability and scopes.
- Prototype Lambda handler using existing Serverless configuration (Node runtime).
- Outline redirect UX (login CTA -> auth.hhl → HubSpot auth → /learn callback with token).
- Determine token storage (HTTP-only same-site cookie vs localStorage) and rotation period (e.g., 15 minutes + refresh endpoint).

## 5. Implementation Plan (Draft)

1. **Discovery & Spike**
   - Draft ADR summarizing decision (due by 2025-10-23).
   - Create minimal OAuth handshake to fetch contact email/contactId with Project App credentials.
   - Document security considerations (token expiry, logout).

2. **Backend Build**
   - Extend `serverless.yml` with new functions (`identity-authorize`, `identity-callback`, `identity-session`).
   - Implement JWT signing using AWS KMS or environment secret.
   - Store short-lived refresh token (optional) in encrypted cookie.

3. **Frontend Integration**
   - Update `auth-context.js` to:
     - Detect existing session cookie/token.
     - Initiate redirect to `/identity/authorize` if user clicks Sign In CTA.
     - Resolve `window.hhIdentity` once `/identity/session` returns contact info.
   - Adjust CTA/login modals to reflect new flow.

4. **Testing & Verification**
   - Update Playwright tests to follow OAuth redirect sequence.
   - Capture new artifacts under `verification-output/issue-242/`.
   - Manual QA: ensure anonymous experience unchanged, authenticated identity persists.

5. **Documentation & Rollout**
   - Update `docs/auth-and-progress.md`, deployment guide, and onboarding docs.
   - Provide rollback plan (disable OAuth endpoints; revert to anonymous-only mode).

## 6. Open Questions
- Does HubSpot Projects OAuth allow long-lived refresh tokens suitable for our use case? (Need to confirm limits.)
- Should we support third-party identity (e.g., Google) via HubSpot? (Probably out of scope for P0.)
- Where to host state during OAuth handshake (encrypted cookie vs dynamo)? Minimal but needs decision.
- How will logout flow work (clear JWT + optionally call HubSpot revoke endpoint)?

## 7. Immediate Next Steps

1. Capture private vs public membership validation evidence (Issue #233) — scheduled for 2025-10-22.
2. Confirm availability of Project App OAuth credentials and scopes.
3. Draft ADR and update Issue #242 with chosen direction once validated.
4. Coordinate with Ops for any additional secrets (JWT signing key, OAuth client).

---

_This outline will evolve as discovery progresses. Keep Issue #242 as the single source of truth for status updates and link subsequent commits/docs from there._
