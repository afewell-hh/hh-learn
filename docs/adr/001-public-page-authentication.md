# ADR 001: Public-Page Authentication Architecture

**Status**: ACCEPTED & IMPLEMENTED ✅
**Date Proposed**: 2025-10-26
**Date Implemented**: 2025-10-26
**Deciders**: Engineering Team
**Implementation**: Issues #270, #272, #274 (server-rendered membership); historical PRs #252, #254, #259, #261 retained for automation helpers
**Related Issues**: #233, #234, #235, #237, #239, #242, #251, #253, #255, #270, #272, #274, #275

## Context and Problem Statement

Hedgehog Learn requires authenticated identity on **public course pages** to enable:
- CTA state management (show "Enroll" vs "Sign in to start")
- Enrollment tracking with CRM persistence
- Progress beacons that include contact identifiers
- Personalized "My Learning" dashboard

**Current State**: HubSpot Membership API (`/_hcms/api/membership/v1/profile`) returns 404 on public pages, making identity resolution impossible even after successful login.

**Evidence**:
- Issue #233 verification (2025-10-21): Playwright test shows CTA stuck on "Sign in to start course" after authentication
- Issue #237 instrumentation: Confirmed membership API returns 404 on public pages consistently
- Issues #234/#235: Bootstrapper and enrollment UI implemented correctly but blocked by authentication gap

## Decision Drivers

1. **User Experience**: Minimize authentication friction on public pages
2. **Security**: Protect HubSpot Project Access Token, prevent PII exposure
3. **HubSpot Constraints**: Work within Project Apps 2025.2 platform limitations
4. **Existing Infrastructure**: Leverage AWS Lambda, serverless framework, current CORS setup
5. **Development Velocity**: Unblock Playwright tests and Issue #233 quickly
6. **Maintainability**: Align with existing patterns (action-runner, auth-context.js)

## Considered Options

### Option A: JWT Session Token System (Historical Baseline – **DEPRECATED** 2025-10-28)

**Architecture**:
```
Public Page (anonymous visitor)
  ↓
User clicks "Sign In"
  ↓
POST /auth/login { email }
  ↓
Lambda validates email exists in HubSpot CRM
  ↓
Returns signed JWT (24h expiry): { contactId, email, iat, exp }
  ↓
Client stores JWT in localStorage
  ↓
All subsequent API calls include: Authorization: Bearer <jwt>
  ↓
Lambda validates JWT signature, extracts contactId
  ↓
Progress/enrollment endpoints work with authenticated identity
```

**Implementation Details**:

**New Lambda Endpoints**:
- `POST /auth/login` - Accepts email, returns JWT
- `POST /auth/refresh` - Accepts valid JWT, returns new JWT with extended expiry
- `POST /auth/logout` - Client-side token removal (optional server-side blacklist)

**JWT Payload**:
```json
{
  "contactId": "12345",
  "email": "user@example.com",
  "iat": 1698345600,
  "exp": 1698432000
}
```

**Security**:
- JWT signed with `JWT_SECRET` environment variable (256-bit random key)
- Signature verification on every request
- Short expiry (24 hours) with refresh token support
- No password required (email-only verification for MVP)

**Frontend Changes**:
- Update `auth-context.js` to check localStorage for JWT before attempting membership API
- Add token refresh logic (15 minutes before expiry)
- Update all Lambda calls to include `Authorization: Bearer` header

> **2025-10-28 Update:** Issue #270/#272/#274 replaced this option with native membership rendering for all user-facing flows. Keep the implementation notes here for regression analysis and automated test helpers only.

**Pros (at the time)**:
- ✅ Worked on public pages (no HubSpot Membership dependency)
- ✅ Standard JWT ecosystem tooling
- ✅ Minimal backend changes (~200 lines of code)
- ✅ No email delivery required (email-only verification)
- ✅ Compatible with existing CORS setup (`Authorization` header already allowed)
- ✅ Could add refresh tokens later without breaking changes

**Cons (blocking adoption for production)**:
- ❌ Email-only verification allowed impersonation
- ❌ Required JWT_SECRET lifecycle management
- ❌ Tokens could not be revoked without additional infrastructure
- ❌ Logout required client-side cooperation
- ❌ Duplicated functionality already offered by HubSpot Membership cookies

**Risk Level**: LOW
**Effort**: 2-3 days (implementation + testing)

---

### Option B: Magic Link Email Verification

**Architecture**:
```
Public Page
  ↓
User enters email
  ↓
POST /auth/request-code { email }
  ↓
Lambda generates one-time code, stores in DynamoDB (TTL: 10min)
  ↓
Email sent via AWS SES with verification link
  ↓
User clicks link: /auth/verify?code=ABC123
  ↓
Lambda validates code, returns JWT
  ↓
Client stores JWT, proceeds as in Option A
```

**Pros**:
- ✅ Email verification ensures user controls the email account
- ✅ Secure, standard authentication pattern
- ✅ No password management complexity
- ✅ Can reuse JWT infrastructure from Option A

**Cons**:
- ❌ Requires AWS SES configuration (additional infrastructure)
- ❌ DynamoDB table for code storage (state management)
- ❌ Email delivery friction (user must check inbox)
- ❌ More complex user flow
- ❌ Higher implementation effort

**Risk Level**: MEDIUM
**Effort**: 5-7 days (SES setup + DynamoDB + Lambda + frontend)

---

### Option C: HubSpot Project App OAuth

**Architecture**:
```
Public Page
  ↓
User clicks "Sign In with HubSpot"
  ↓
Redirect to HubSpot OAuth:
  https://app.hubspot.com/oauth/authorize?client_id=...&scope=...&redirect_uri=...
  ↓
User approves in HubSpot
  ↓
HubSpot redirects to: /auth/callback?code=ABC123
  ↓
Lambda exchanges code for HubSpot OAuth access token
  ↓
Lambda uses token to fetch contact info from HubSpot CRM
  ↓
Lambda issues internal JWT (as in Option A)
  ↓
Client stores JWT
```

**Pros**:
- ✅ Official HubSpot OAuth integration
- ✅ Leverages existing HubSpot Project App infrastructure
- ✅ HubSpot handles user authentication/authorization
- ✅ Can request specific scopes
- ✅ Supports token refresh via OAuth refresh tokens

**Cons**:
- ❌ **CRITICAL BLOCKER**: HubSpot Project Apps 2025.2 OAuth availability unconfirmed
- ❌ Requires OAuth configuration in HubSpot portal
- ❌ More complex redirect flow
- ❌ OAuth consent screen may confuse users
- ❌ Higher implementation effort

**Risk Level**: HIGH (unconfirmed HubSpot OAuth support)
**Effort**: 7-10 days (research + OAuth config + implementation)

---

### Option D: Native Membership Identity Injection (Current Approach – **ADOPTED 2025-10-28**)

**Status**: IMPLEMENTED ✅ (Issues #270, #272)

**Architecture**:
```
Public Page → /_hcms/mem/login → Public Page (HubL data attributes hydrate window.hhIdentity)
```

**Why it works**:
- HubSpot renders `request_contact` data on any page when membership session cookie present
- HubL data attributes feed `auth-context.js`, avoiding fragile sessionStorage hand-offs
- Eliminates custom JWT flow from production; JWT retained only for automated testing helpers

**Pros**:
- ✅ Fully aligned with HubSpot's native "golden path"
- ✅ No intermediate handshake page (simpler redirect chain)
- ✅ HTTP-only membership cookies managed by HubSpot (built-in CSRF, MFA, SSO)
- ✅ Supports Playwright TDD via native membership helper (`tests/helpers/auth.ts`)

**Cons / Risks**:
- ⚠️ Requires HubSpot membership login availability in automated environments
- ⚠️ Authentication helper must keep pace with HubSpot form markup changes

**Risk Level**: LOW (HubSpot-managed auth surface)
**Effort**: Delivered across Issues #270, #272, #274

---

## Decision Outcome

**RECOMMENDED & ADOPTED: Option D – Native Membership Identity Injection**

### Rationale

1. **HubSpot-managed identity** – `request_contact` HubL variables expose membership state on every render, eliminating the brittle client bootstrapper.
2. **Zero custom token surface** – Removes JWT issuance/storage for production users, reducing security and maintenance overhead.
3. **Consistent UX** – CTA, nav, and downstream scripts derive state from the same HubL flags, preventing split-brain experiences.
4. **Automation still covered** – The JWT `/auth/login` endpoint is retained exclusively for Playwright helpers (`tests/helpers/jwt-auth.ts`) with clear documentation.
5. **Verified in production** – Issue #274 captures anonymous/authenticated HTML snapshots and manual verification showing the CTA renders correctly without client polling.

### Implementation Phases

#### Phase A: Membership-first identity (Issue #270 / #272)
- Remove `/learn/auth-handshake` template and email-prompt modal.
- Hydrate `window.hhIdentity` from HubL data attributes emitted by the page templates.
- Update login helpers to build `/_hcms/mem/login?redirect_url=...` links.

#### Phase B: Server-rendered CTA (Issue #274)
- Branch hero CTA markup on `request_contact.is_logged_in` + `personalization_token('contact.email','')`.
- Update `enrollment.js` to treat anonymous state as terminal (no DOM rewrites) and only hydrate CRM checks for authenticated visitors.
- Publish updated templates and capture verification artifacts under `verification-output/issue-274/`.

#### Phase C: Documentation & Test Cleanup (Issue #275 – this ADR update)
- Rewrite guidance to make native membership the baseline and demote JWT to automation-only tooling.
- Reference Issue #274 verification assets from `docs/auth-and-progress.md`, `docs/README.md`, and this ADR.
- Ensure README, HubSpot agent guide, and quick references point to native login flows.

### Future Enhancements (Post-MVP)

1. **Email Verification** (Option B): Add magic link flow for higher security
2. **Token Refresh**: Extend session without re-login
3. **Logout Blacklist**: DynamoDB table for revoked tokens
4. **Rate Limiting**: Prevent brute-force email enumeration
5. **Multi-Factor Authentication**: Optional second factor for sensitive operations

---

## Consequences

### Positive *(Option A historical notes retained for comparison)*

- ✅ Public pages can authenticate users without HubSpot Membership
- ✅ CTA state updates correctly after login
- ✅ Enrollment tracking works with CRM persistence
- ✅ Playwright tests unblocked
- ✅ Standard authentication pattern (easier for future developers)
- ✅ Foundation for email verification (Option B) later

### Negative *(Option A historical notes retained for comparison)*

- ❌ Email-only verification (no password, no email confirmation for MVP)
- ❌ Token can't be revoked without blacklist infrastructure
- ❌ Requires JWT_SECRET management in environment variables
- ❌ Slightly more complex frontend (token refresh logic)

### Neutral *(Option A historical notes retained for comparison)*

- 🔹 HubSpot Membership still works on private pages (backward compatible)
- 🔹 Action-runner pattern still used for enrollment (no breaking changes)
- 🔹 JWT standard allows future OAuth integration (Option C) if needed

---

## Implementation Summary

### Status: COMPLETE ✅

All user-facing authentication now relies on HubSpot membership state rendered server-side. JWT infrastructure remains operational strictly for automated test setup.

### Timeline
- **Phase A – Membership hydration (Issues #270/#272):** Implemented 2025-10-27
- **Phase B – Server-rendered CTA (Issue #274):** Implemented 2025-10-28
- **Phase C – Documentation cleanup (Issue #275):** Implemented 2025-10-28

### Key Assets

**Templates & Client Scripts**
- `clean-x-hedgehog-templates/learn/courses-page.html` – CTA branches on `request_contact.is_logged_in`.
- `clean-x-hedgehog-templates/learn/pathways-page.html` – Mirrors CTA logic for pathway detail pages.
- `clean-x-hedgehog-templates/learn/macros/left-nav.html` – Shares authenticated flags with hero CTA.
- `clean-x-hedgehog-templates/assets/js/enrollment.js` – Hydrates authenticated CTAs only; anonymous state remains a login link.
- `clean-x-hedgehog-templates/assets/js/auth-context.js` – Loads `window.hhIdentity` from HubL data attributes and exposes membership metadata to other scripts.

**Automation Helpers & Tests**
- `tests/helpers/auth.ts` – Provides membership-aware Playwright login helper and wraps JWT fallback for fixtures.
- `tests/e2e/enrollment-cta.spec.ts` – Verifies CTA text before JavaScript instrumentation and after enrollment.
- `tests/e2e/enrollment-flow.spec.ts` – Confirms enrollment button launches action runner after membership login.

**Documentation**
- `docs/auth-and-progress.md` – Describes membership-first architecture and CRM persistence.
- `docs/hubspot-project-apps-agent-guide.md` – Updated training guidance for agents.
- `docs/README.md` & `README.md` – Point contributors to the new baseline.
- `verification-output/issue-274/IMPLEMENTATION-NOTES.md` – Canonical evidence of the server-rendered CTA change.

### Environment Configuration

- HubSpot membership login is served by HubSpot; no new environment variables required.
- `/auth/login` Lambda endpoint and `JWT_SECRET` remain available for CI automation and Playwright helpers; user-facing flows do not surface JWT tokens.
- `ENABLE_CRM_PROGRESS` continues to gate behavioral event emission.

### Production Evidence

- Anonymous vs authenticated HTML captures in `verification-output/issue-274/` demonstrate CTA rendering without JavaScript hydration.
- Manual verification log confirms “Start Course” CTA transitions after membership login while preserving CRM enrollment state.
- Playwright suite executed on 2025-10-28 shows green runs for `enrollment-cta` and `enrollment-flow` specs.

### Pull Requests / Issues
- **Issue #270:** Transition to membership hydration.
- **Issue #272:** Remove handshake and align login helper.
- **Issue #274:** Server-render hero CTA.
- **Issue #275:** Documentation cleanup (this ADR update).
- Legacy PR references (#252, #254, #259, #261) remain for historical JWT implementation context.

---

## Validation Criteria

### Definition of Done (2025-10-28 baseline)

- [x] Hero CTA renders correct state server-side for anonymous vs authenticated visitors.
- [x] `window.hhIdentity` hydrates entirely from HubL data (no localStorage bootstrapper).
- [x] `enrollment.js` only upgrades authenticated CTAs and continues CRM polling for logged-in contacts.
- [x] README + docs redirect contributors to membership-first flow.
- [x] JWT `/auth/login` endpoint scoped to automated tests and documented as such.
- [x] Verification artifacts from Issue #274 linked in primary documentation.

### Success Metrics

- [x] Playwright CTA regression passes without waiting for SPA hydration.
- [x] Membership login UX roundtrip (“Sign in” → “Start Course”) validated manually.
- [x] No remaining docs instruct users to rely on JWT bootstrapper for live pages.
- [ ] Action runner whitelist follow-up tracked separately (Issue TBD) – still outstanding.

---

## References

- `verification-output/issue-274/IMPLEMENTATION-NOTES.md`
- `verification-output/issue-274/course-authoring-101-anonymous-2025-10-28.html`
- `verification-output/issue-274/course-authoring-101-authenticated-2025-10-28.html`
- `docs/auth-and-progress.md`
- `docs/hubspot-project-apps-agent-guide.md`
- `HUBSPOT-AUTH-QUICK-SUMMARY.md`
- `HUBSPOT-AUTH-RESEARCH-REPORT.md`

---

**Decision Date**: 2025-10-26
**Approvers**: [To be filled during review]
**Implementation Start**: 2025-10-26
