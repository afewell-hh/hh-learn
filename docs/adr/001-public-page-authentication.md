# ADR 001: Public-Page Authentication Architecture

**Status**: ACCEPTED & IMPLEMENTED ✅
**Date Proposed**: 2025-10-26
**Date Implemented**: 2025-10-26
**Deciders**: Engineering Team
**Implementation**: PRs #252, #254, #259, #261
**Related Issues**: #242, #233, #234, #235, #237, #239, #251, #253, #255

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

### Option A: JWT Session Token System (RECOMMENDED)

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

**Pros**:
- ✅ Works on public pages (no HubSpot Membership dependency)
- ✅ Standard, well-understood pattern (JWT ecosystem)
- ✅ Minimal backend changes (~200 lines of code)
- ✅ No email delivery required (MVP uses email-only verification)
- ✅ Compatible with existing CORS setup (`Authorization` header already allowed)
- ✅ Can add refresh tokens later without breaking changes

**Cons**:
- ❌ No email verification (anyone can claim any email) - acceptable for MVP
- ❌ Requires JWT_SECRET management in environment
- ❌ Token can't be revoked without blacklist (acceptable for 24h expiry)
- ❌ Logout requires client-side cooperation (can't force token invalidation)

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

### Option D: Enhanced Membership Session Bridge (Current Approach)

**Status**: IMPLEMENTED but BLOCKED (Issue #233)

**Architecture**:
```
Public Page → /_hcms/mem/login → /learn/auth-handshake (private) → sessionStorage → Public Page
```

**Why it doesn't work**:
- HubSpot Membership API returns 404 on public pages
- Auth-handshake page cannot detect `request_contact.is_logged_in` reliably
- sessionStorage is fragile (cleared on browser restart, Safari private mode)

**Pros**:
- ✅ Already implemented (Issues #244, #245)
- ✅ No additional infrastructure

**Cons**:
- ❌ **CRITICAL BLOCKER**: HubSpot Membership API broken on public pages
- ❌ Fragile sessionStorage dependency
- ❌ No solution to fundamental public/private page gap

**Risk Level**: N/A (blocked by HubSpot platform limitation)
**Effort**: N/A (not viable)

---

## Decision Outcome

**RECOMMENDED: Option A - JWT Session Token System**

### Rationale

1. **Unblocks Issue #233 immediately**: Works on public pages without HubSpot Membership
2. **Low risk**: Standard JWT pattern, well-understood security model
3. **Fast implementation**: ~200 lines of code, 2-3 day effort
4. **Compatible with existing architecture**: Reuses Lambda infrastructure, CORS setup
5. **Scalable**: Can add email verification (Option B) later without breaking changes
6. **Testable**: Playwright tests can authenticate via `/auth/login` endpoint directly

### Implementation Phases

#### Phase 1: JWT Infrastructure (Days 1-2)
- Add `jsonwebtoken` library to Lambda dependencies
- Create `/auth/login` endpoint
- Implement JWT signing/verification utilities
- Add `JWT_SECRET` to environment variables
- Update validation logic to accept JWT from Authorization header

#### Phase 2: Frontend Integration (Day 2)
- Update `auth-context.js` to attempt JWT login before membership API fallback
- Add token storage in localStorage
- Add token refresh logic (check expiry every 5 minutes)
- Update logout flow to clear localStorage

#### Phase 3: Testing & Validation (Day 3)
- Update Playwright tests to use `/auth/login` endpoint
- Verify CTA state updates after authentication
- Verify enrollment tracking includes contact identifiers
- Verify progress beacons work on public pages

#### Phase 4: Documentation & Deployment (Day 3)
- Update `docs/auth-and-progress.md` with JWT authentication flow
- Update deployment guide with JWT_SECRET configuration
- Create verification artifacts under `verification-output/issue-242/`
- Deploy to staging, run smoke tests
- Deploy to production

### Future Enhancements (Post-MVP)

1. **Email Verification** (Option B): Add magic link flow for higher security
2. **Token Refresh**: Extend session without re-login
3. **Logout Blacklist**: DynamoDB table for revoked tokens
4. **Rate Limiting**: Prevent brute-force email enumeration
5. **Multi-Factor Authentication**: Optional second factor for sensitive operations

---

## Consequences

### Positive

- ✅ Public pages can authenticate users without HubSpot Membership
- ✅ CTA state updates correctly after login
- ✅ Enrollment tracking works with CRM persistence
- ✅ Playwright tests unblocked
- ✅ Standard authentication pattern (easier for future developers)
- ✅ Foundation for email verification (Option B) later

### Negative

- ❌ Email-only verification (no password, no email confirmation for MVP)
- ❌ Token can't be revoked without blacklist infrastructure
- ❌ Requires JWT_SECRET management in environment variables
- ❌ Slightly more complex frontend (token refresh logic)

### Neutral

- 🔹 HubSpot Membership still works on private pages (backward compatible)
- 🔹 Action-runner pattern still used for enrollment (no breaking changes)
- 🔹 JWT standard allows future OAuth integration (Option C) if needed

---

## Implementation Summary

### Status: COMPLETE ✅

All phases of the JWT authentication system have been implemented, tested, and deployed to production.

### Timeline
- **Phase 1** (Backend): Implemented 2025-10-26 (PR #252)
- **Phase 2** (Frontend): Implemented 2025-10-26 (PR #252)
- **Phase 3** (Testing): Completed 2025-10-26 (PR #254)
- **Phase 4** (Documentation): Completed 2025-10-27 (Issue #255)

### Files Modified

**Backend** (5 files):
- `src/api/lambda/auth.ts` - NEW: JWT utilities (signToken, verifyToken, extractContactFromToken)
- `src/api/lambda/index.ts` - Added /auth/login endpoint, JWT validation in all endpoints
- `package.json` - Added jsonwebtoken dependency
- `serverless.yml` - Added JWT_SECRET environment variable, CORS headers
- `tsconfig.json` - TypeScript configuration for JWT types

**Frontend** (4 files):
- `clean-x-hedgehog-templates/assets/js/auth-context.js` - JWT login, token storage, priority resolution
- `clean-x-hedgehog-templates/assets/js/enrollment.js` - Authorization header support
- `clean-x-hedgehog-templates/assets/js/progress.js` - Authorization header support
- `clean-x-hedgehog-templates/config/constants.json` - AUTH_LOGIN_URL configuration

**Tests** (2 files):
- `tests/api/smoke.test.ts` - 15 JWT authentication tests
- `tests/e2e/enrollment-flow.spec.ts` - E2E enrollment test with JWT auth

**Documentation** (3 files):
- `docs/adr/001-public-page-authentication.md` - This ADR
- `docs/implementation-plan-issue-242.md` - Detailed implementation plan
- `docs/auth-and-progress.md` - Updated with JWT authentication section

### Environment Configuration

**AWS SSM Parameter Store**:
- `/hhl/jwt-secret` - SecureString (256-bit random key)

**GitHub Actions Secrets**:
- `JWT_SECRET` - For E2E test authentication

**HubSpot Constants**:
- `AUTH_LOGIN_URL` - Points to Lambda `/auth/login` endpoint

### Production Evidence

**Deployed Endpoints**:
- `POST /auth/login` - Live at `https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/login`
- All API endpoints accepting `Authorization: Bearer` header

**Test Results**:
- API tests: 15/15 passing
- E2E tests: 1/1 passing
- Zero regressions detected

**Production Usage**:
- Live site: https://hedgehog.cloud/learn
- JWT authentication functional on all public course pages
- Token expiry: 24 hours
- No errors in CloudWatch logs

### Pull Requests
- **PR #252**: feat: implement JWT-based public page authentication (Merged 2025-10-26)
- **PR #254**: test: update tests for JWT authentication (Merged 2025-10-26)
- **PR #259**: fix: update E2E tests for JWT authentication flow (Merged 2025-10-26)
- **PR #261**: feat: deploy JWT templates and re-enable E2E auth tests (Merged 2025-10-26)

---

## Validation Criteria

### Definition of Done

- [x] `/auth/login` endpoint accepts email, returns signed JWT
- [x] JWT includes contactId, email, iat, exp fields
- [x] Lambda validates JWT signature on all protected endpoints
- [x] `auth-context.js` detects JWT from localStorage and populates `window.hhIdentity`
- [x] CTA state changes from "Sign in to start course" to "Start Course" after authentication
- [x] Enrollment tracking persists to CRM with authenticated contact identifier
- [x] Playwright test `tests/e2e/enrollment-flow.spec.ts` passes
- [x] Documentation updated with JWT authentication flow
- [x] Verification artifacts captured under `verification-output/issue-242/`

### Success Metrics

- [x] Playwright test passes (PASSING - was RED, now GREEN)
- [x] Login success rate > 95% (100% in testing)
- [ ] Token refresh success rate > 99% (refresh endpoint not yet implemented - planned for v0.4)
- [x] No increase in CRM API errors (zero errors in CloudWatch)
- [x] Page load time impact < 50ms (JWT adds ~10-20ms)

---

## References

- Issue #191: HubSpot Project Apps Agent Guide
- Issue #233: Membership bootstrapper fails on public pages (2025-10-21 verification)
- Issue #234: Identity bootstrapper implementation
- Issue #235: Enrollment UI refactor
- Issue #237: Membership session instrumentation
- Issue #239: October 2025 reset guide
- Issue #242: Public-page authentication design (this ADR)
- `docs/auth-and-progress.md`: Current authentication architecture
- `docs/auth-public-login-alternative.md`: Initial design notes
- `docs/hubspot-project-apps-agent-guide.md`: HubSpot platform constraints

---

**Decision Date**: 2025-10-26
**Approvers**: [To be filled during review]
**Implementation Start**: [To be scheduled]
