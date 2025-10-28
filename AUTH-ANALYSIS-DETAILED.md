# HH-Learn Authentication Implementation Analysis

> **Deprecated 2025-10-28:** Superseded by the native membership baseline (Issues #270/#272/#274). Retain for historical context only; see docs/auth-and-progress.md for the current architecture.


## Executive Summary

The hh-learn codebase implements a **dual-mode authentication system** with significant complexity issues:

1. **Legacy HubSpot Membership** - Server-side session cookies (works only on private pages, returns 404 on public pages)
2. **New JWT Tokens** - Email-based client-side authentication (works on public and private pages)
3. **Multiple handshake mechanisms** - Auth redirects, session storage, localStorage tokens, and personalization tokens all competing for identity authority

This creates **confusion, redundancy, and multiple pain points** that need addressing.

---

## Problem Statement

### Issue #270 Context
The system has multiple overlapping authentication flows causing:
- **Email prompt duplication**: JWT login asks for email, then HubSpot membership also asks for password
- **Broken redirect chains**: `/learn/%2Flearn/...` double-encoding issues
- **CTA vs Left-Nav inconsistency**: Different components handle login differently
- **Session confusion**: Multiple identity sources (JWT token, session cookies, personalization tokens, sessionStorage)

---

## Current Authentication Flows

### Flow 1: Legacy HubSpot Membership (Server-Side)
**Where it's used**: Private pages, left-nav sign-in links

```
User clicks "Sign In" (left-nav)
    ↓
Redirects to: /_hcms/mem/login?redirect_url=/learn/auth-handshake?redirect_url=/original/page
    ↓
HubSpot login page (email + password)
    ↓
Session cookies set: __hstc, hubspotutk, request_contact.is_logged_in
    ↓
Redirects to: /learn/auth-handshake?redirect_url=/original/page
    ↓
auth-handshake.html (private page) executes:
  - Detects request_contact.is_logged_in == true
  - Stores identity in sessionStorage: hhl_identity
  - Redirects back to original page
    ↓
auth-context.js runs on original page:
  - Checks sessionStorage for hhl_identity
  - Updates identity cache
```

**Code locations**:
- Entry point: `/clean-x-hedgehog-templates/learn/macros/left-nav.html` (lines 41-44)
- Redirect builder: `/clean-x-hedgehog-templates/assets/js/enrollment.js` (lines 69-75, buildLoginRedirect)
- Handshake: `/clean-x-hedgehog-templates/learn/auth-handshake.html` (lines 82-103)
- Resolution: `/clean-x-hedgehog-templates/assets/js/auth-context.js` (lines 378-423, Priority 1)

**Issues**:
- Double redirect chain adds latency
- Only works on private pages (Membership API returns 404 on public pages)
- Requires HubSpot login UX with password entry
- sessionStorage can be cleared by browser

---

### Flow 2: JWT Authentication (Client-Side)
**Where it's used**: Public pages, enrollment CTA buttons

```
User clicks enrollment button (public page)
    ↓
enrollment.js calls handleJWTLogin():
  - Prompts for email via JavaScript prompt()
    ↓
User enters email
    ↓
POST /auth/login { email }
    ↓
Lambda endpoint validates email in HubSpot CRM
    ↓
Returns JWT token if contact exists
    ↓
Client stores in localStorage:
  - hhl_auth_token
  - hhl_auth_token_expires
  - hhl_identity_from_jwt
    ↓
window.hhIdentity.ready resolves with identity
    ↓
enrollment.js re-initializes with authenticated state
```

**Code locations**:
- Frontend entry: `/clean-x-hedgehog-templates/assets/js/enrollment.js` (lines 81-137, handleJWTLogin)
- Backend: `/src/api/lambda/auth.ts` (lines 95-150, login endpoint)
- Resolution: `/clean-x-hedgehog-templates/assets/js/auth-context.js` (lines 342-376, Priority 0)
- Token building: Multiple files call `buildAuthHeaders()` to add `Authorization: Bearer <token>`

**Issues**:
- Simple email-only prompt (no password validation)
- User sees password-less login which may be confusing
- localStorage can be cleared by user
- Requires email entry for every new device/browser

---

### Flow 3: Server-Side Identity Bootstrap (Hybrid)
**Where it's used**: Private pages with embedded identity

```
HubSpot template renders identity in data attributes:
    ↓
hhl-auth-context div contains:
  - data-email (from request_contact or personalization_token)
  - data-contact-id
  - data-enable-crm="true"
    ↓
auth-context.js reads window.hhServerIdentity
    ↓
(Or falls back to Membership API fetch)
```

**Code locations**:
- Data attributes set in: `/clean-x-hedgehog-templates/learn/module-page.html` (grep result shows template pattern)
- Resolution: `/clean-x-hedgehog-templates/assets/js/auth-context.js` (lines 425-439, Priority 2)

**Issues**:
- Only available on private pages
- Depends on HubSpot template rendering (not portable to public pages)
- Mixes server-rendered data with client logic

---

## Authentication Touchpoints in Codebase

### Frontend Files That Check Authentication

| File | Authentication Method | Lines | Purpose |
|------|----------------------|-------|---------|
| `auth-context.js` | Multi-source (JWT, sessionStorage, server, Membership API) | 336-469 | Identity resolution orchestrator |
| `enrollment.js` | window.hhIdentity, buildAuthHeaders() | 15-57, 234-245 | Enrollment UI, CRM progress check |
| `pathways.js` | window.hhIdentity, buildAuthHeaders() | 45-56, 15-26 | Progress display |
| `courses.js` | window.hhIdentity, buildAuthHeaders() | 45-56, 15-26 | Progress display |
| `progress.js` | window.hhIdentity, buildAuthHeaders() | 64-81, 21-32 | Module progress buttons |
| `action-runner.js` | Server-side (data attributes) | 237-241, 260-273 | Enrollment/progress actions |
| `left-nav.html` | request_contact.is_logged_in | 39-44, 50-53 | Sign in/out links |

### Backend Files

| File | Authentication Method | Lines | Purpose |
|------|----------------------|-------|---------|
| `auth.ts` | JWT token signing/verification | 1-76 | Token utilities |
| `index.ts` | JWT extraction from headers | 25, 92-150, 205-206, 311-312, etc. | /auth/login endpoint, JWT validation in all endpoints |

### Configuration Files

| File | Purpose |
|------|---------|
| `constants.json` | LOGIN_URL, AUTH_LOGIN_URL, TRACK_EVENTS_URL endpoints |
| `serverless.yml` | JWT_SECRET environment variable |

---

## Data Flow and Storage

### localStorage (Client-Side JWT)
```javascript
hhl_auth_token              // JWT token string
hhl_auth_token_expires      // Expiry timestamp (milliseconds)
hhl_identity_from_jwt       // JSON: {email, contactId, firstname, lastname}
```

### sessionStorage (Handshake Bridge)
```javascript
hhl_identity                // JSON: {email, contactId, firstname, lastname, timestamp}
hhl_last_action            // Result from action-runner.js
hhl-module-state-*         // Module completion state
hhl-enrollment-*-*         // Enrollment state per pathway/course
```

### Server-Side Data Attributes (HubSpot)
```html
<div id="hhl-auth-context"
     data-email="{email or personalization_token}"
     data-contact-id="{contact_id}"
     data-enable-crm="true"
     data-constants-url="{constants.json URL}"
     data-login-url="{LOGIN_URL}"
/>
```

### Cookies (HubSpot Session)
```
__hstc              // HubSpot tracking cookie
hubspotutk          // HubSpot user token
request_contact.*   // Server-side membership session
```

---

## Identified Pain Points

### 1. Multiple Identity Sources (4 separate mechanisms)

**Problem**: Code must check 4 different sources in priority order:
1. JWT in localStorage (Priority 0 in auth-context.js:342)
2. sessionStorage from handshake (Priority 1 in auth-context.js:378)
3. window.hhServerIdentity (Priority 2 in auth-context.js:425)
4. Membership API fetch (Priority 3 fallback)

**Complexity**: Lines 336-469 of auth-context.js implement 4 competing resolution mechanisms

**Impact**: 
- 134 lines of conditional logic
- Each path has different expiry/TTL rules
- Testing must cover all paths
- Bugs in one path don't surface until others fail

---

### 2. Dual Login Flows Create User Confusion

**JWT Flow** (Enrollment CTA):
```
User clicks "Sign in to enroll"
    ↓
JavaScript prompt asks for email
    ↓
Calls window.hhIdentity.login('user@example.com')
    ↓
Success: localStorage populated, UI updates
```

**HubSpot Flow** (Left-Nav):
```
User clicks "Sign In" in left navigation
    ↓
Redirects to HubSpot login page
    ↓
Email + password form
    ↓
Success: Session cookies set, redirects back
```

**Issue**: Users see two different login UX patterns for same system
- "Sign in to enroll" (email only, prompt dialog)
- "Sign In" in nav (full HubSpot login, separate page)
- Leads to confusion: "Which email should I use?" "Why no password?"

---

### 3. Broken Redirect Chain (Issue #270 symptom)

**Pattern in code**:
```javascript
// enrollment.js line 73
var handshakeUrl = '/learn/auth-handshake?redirect_url=' + encodeURIComponent(window.location.pathname);
// action-runner.js line 37-41
var target = handshakeUrl ? handshakeUrl + '?redirect_url=' + encodeURIComponent(redirectUrl) : redirectUrl;
```

**Result**:
- First redirect encodes: `?redirect_url=/learn/%2Flearn/...`
- Second redirect double-encodes the path
- Leads to `/learn/%2Flearn/...` which 404s

**Root cause**: `encodeURIComponent()` called on already-encoded URL multiple times

---

### 4. Missing JWT Support in Key Components

**action-runner.js** (lines 137-172):
- Takes `contactIdentifier.email` and `contactIdentifier.contactId` from data attributes
- Does NOT check Authorization header for JWT
- Falls back to HubSpot login if data attributes empty
- **Result**: Authenticated users via JWT must do second login

**left-nav.html** (lines 39-54):
- Uses `request_contact.is_logged_in` (server-side only)
- Does NOT check `window.hhIdentity.isAuthenticated()`
- Shows "Sign In" even after JWT login on public pages
- **Result**: Inconsistent UI state

---

### 5. Session Management Inconsistency

| Auth Method | Storage | Expiry | Scope | Validation |
|-------------|---------|--------|-------|-----------|
| JWT | localStorage | 24 hours | Client-side | Signature checked by Lambda |
| Membership | Cookies | Browser session | Cross-site | HubSpot session |
| Handshake | sessionStorage | 6 hours | Browser tab | None |
| Server Identity | Data attributes | Page load | Single page | None |

**Issues**:
- Different expiry times cause re-login prompts at different times
- No cache invalidation mechanism
- No logout coordination between systems
- Token refresh logic only in auth-context.js (15-minute buffer, line 238)

---

### 6. CRM Progress Sync Complexity

**Current pattern** (enrollment.js lines 247-278):
```javascript
function fetchEnrollmentFromCRM(constants, auth, contentType, slug) {
  // Check if auth exists
  if (!auth.enableCrm || (!auth.email && !auth.contactId)) return null;
  // Call API with buildAuthHeaders()
  fetch(url, { headers: buildAuthHeaders() })
  // Process response
}
```

**Repetition**: Same pattern duplicated in:
- enrollment.js (247-278)
- pathways.js (75-110)
- courses.js (77-112)
- progress.js (199-276)

**Total**: 4 copies of similar CRM sync logic with subtle differences

---

### 7. No Unified Authentication State Management

**Current approach**: Each component implements its own auth checks

```javascript
// enrollment.js
var identity = window.hhIdentity ? window.hhIdentity.get() : null;

// pathways.js
var identity = (window.hhIdentity && typeof window.hhIdentity.get === 'function') ? window.hhIdentity.get() : null;

// courses.js
var identity = (window.hhIdentity && typeof window.hhIdentity.get === 'function') ? window.hhIdentity.get() : null;
```

**Issues**:
- Defensive checks repeated 3+ times
- No centralized error handling
- Each component retries on failure
- Makes refactoring error-prone

---

## Complexity Metrics

### Code Organization
- **Authentication files**: 7 frontend + 2 backend + 1 template = 10 files
- **Authentication logic lines**: ~2,500+ lines total
- **Files with buildAuthHeaders()**: 5 files (enrollment, pathways, courses, progress, left-nav)
- **Duplicate sync logic**: 4 files with CRM fetch patterns

### Decision Complexity
- **Priority order in auth-context.js**: 4 levels deep (line 336-469)
- **Conditional branches**: 12+ major if/else paths
- **Redirect chains**: 3-4 hops for Membership flow
- **Error scenarios**: 15+ error cases handled differently

### Testing Complexity
- **Authentication flows**: 4 independent paths
- **Page types**: Public/Private (affects available auth methods)
- **Device/browser combinations**: localStorage, cookies, sessionStorage can be cleared
- **Token states**: Valid, Expired, Missing, Invalid, Refreshing

---

## Recommendations for Simplification

### Phase 1: Consolidate Authentication (Short-term)

**1. Add JWT support to action-runner.js**
- Check `Authorization: Bearer` header in addition to data attributes
- Eliminates need for second login after JWT auth

**2. Add JWT awareness to left-nav.html**
- Check `window.hhIdentity.isAuthenticated()` in addition to `request_contact.is_logged_in`
- Shows correct UI state on public pages after JWT login

**3. Fix redirect double-encoding**
- Create utility function `buildRedirectUrl(base, target)` 
- Encode only once at the final step
- Test with URL: `/learn/auth-handshake?redirect_url=/some/page`

**Implementation**: 3 files modified, ~50 lines of code

**Effort**: 2-3 hours

---

### Phase 2: Unify CRM Sync Pattern (Medium-term)

**Current**: 4 files duplicate sync logic

**Consolidate into shared module**:
```javascript
// window.hhCrmSync API
window.hhCrmSync = {
  fetchEnrollments(slug, type),    // Returns enrollments list
  fetchProgress(slug, type),       // Returns progress
  trackEvent(eventName, payload)   // Sends tracking
}
```

**Replace in all files**:
- enrollment.js: fetchEnrollmentFromCRM → window.hhCrmSync.fetchEnrollments
- pathways.js: fetchCRMProgress → window.hhCrmSync.fetchProgress
- courses.js: fetchCRMProgress → window.hhCrmSync.fetchProgress
- progress.js: buildRunnerUrl → window.hhCrmSync.trackEvent

**Benefit**: Single source of truth for CRM operations

**Effort**: 4 hours

---

### Phase 3: Migrate to JWT-Primary (Long-term)

**Goal**: Remove legacy Membership dependency for public pages

**Path**:
1. Make JWT the default for public pages (already true)
2. Deprecate left-nav Membership redirect (in favor of JWT prompt)
3. Remove sessionStorage handshake mechanism (once JWT stable)
4. Remove Membership API fallback (once CRM always available)

**Timeline**: Phased over 2-3 sprints

---

## Authentication Checklist

### Current State Check
- [x] JWT login works on public pages
- [x] Membership login works on private pages
- [x] Token refresh implemented (15-min buffer)
- [x] Progress sync with CRM
- [ ] JWT visible in left-nav state
- [ ] action-runner handles JWT
- [ ] Redirect URL encoding fixed

### Quality Metrics
- [ ] Single source of truth for identity
- [ ] No code duplication in sync patterns
- [ ] All auth flows tested end-to-end
- [ ] Consistent token expiry across flows
- [ ] Unified error handling

---

## Files Summary by Responsibility

### Identity Resolution
- **auth-context.js**: Multi-source identity detection (complex, needs refactor)

### JWT Implementation
- **auth.ts**: Token signing/verification (clean)
- **index.ts**: /auth/login endpoint (clean)

### Frontend Usage
- **enrollment.js**: Enrollment buttons + CRM sync (moderate complexity)
- **pathways.js**: Progress display (moderate complexity)
- **courses.js**: Progress display (moderate complexity)
- **progress.js**: Module buttons (moderate complexity)
- **action-runner.js**: Enrollment actions (missing JWT support)
- **left-nav.html**: Navigation (missing JWT state)

### Configuration
- **constants.json**: Endpoint URLs (clean)

---

## Conclusion

The authentication system works but suffers from:

1. **Complexity from dual modes**: JWT and Membership running in parallel
2. **Multiple identity sources**: 4 different storage mechanisms compete
3. **Code duplication**: CRM sync logic repeated 4 times
4. **Incomplete JWT integration**: action-runner and left-nav don't know about JWT
5. **UX confusion**: Different login flows for same system

**Quick wins** (would reduce complexity):
1. Add JWT support to action-runner.js (30 min)
2. Add JWT awareness to left-nav.html (30 min)
3. Fix URL encoding in redirects (1 hour)
4. Extract CRM sync to shared module (2 hours)

**Total effort for substantial improvement**: ~4 hours

**Priority**: Address JWT support gaps (Phase 1) before tackling deeper refactors.
