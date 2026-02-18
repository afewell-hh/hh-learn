# Issue #319 - Architecture Analysis

**Issue**: SSO UX Regressions
**Date**: 2026-02-10
**Author**: Agent C (Lead)
**Status**: Architecture Design Phase

---

## Executive Summary

Issue #319 represents 3 distinct bugs that share a common architectural root cause: **the conflict between server-side HubL rendering (HubSpot Membership) and client-side Cognito authentication**.

All bugs can be resolved by consistently using **client-side Cognito as the authoritative authentication source** and removing dependencies on server-side auth state.

**Key Principle**: For Cognito-authenticated users, auth state is determined by JavaScript after page load, not by HubL at template render time.

---

## The Architectural Challenge

### Server-Side vs Client-Side Authentication

**HubSpot CMS (Server-Side)**
- Templates render on the server using HubL
- Auth state checked via `request_contact.is_logged_in`
- Personalization via `personalization_token('contact.email')`
- State is "baked in" at page generation time
- **Only works with HubSpot Membership**, not external OAuth

**Cognito OAuth (Client-Side)**
- Authentication happens in the browser
- JWT tokens stored in httpOnly cookies
- Auth state checked via `/auth/me` API call
- JavaScript updates UI after page loads
- State is dynamic and determined post-render

### The Timing Problem

```
1. User requests page → HubSpot server renders HTML
2. Server checks HubSpot Membership (no Cognito knowledge)
3. Template rendered with "anonymous" state
4. Page loads in browser
5. JavaScript calls /auth/me to check Cognito
6. JavaScript updates UI based on actual auth state
```

**The Gap**: Steps 1-3 use stale/wrong auth state. Steps 5-6 use correct state. This creates UI inconsistencies.

---

## Current Implementation Problems

### Bug #1: action-runner.js Uses Server-Side Fallback

**File**: `clean-x-hedgehog-templates/assets/js/action-runner.js:281`

**Current Code**:
```javascript
var isLoggedIn = contextNode.dataset.isLoggedIn === 'true';
var contactIdentifier = {
  email: contextNode.dataset.email || '',
  contactId: contextNode.dataset.contactId || ''
};
```

**Problem**:
- `dataset.isLoggedIn` comes from server-side HubL template rendering
- Server-side check uses HubSpot Membership, not Cognito
- If user has stale HubSpot session or CRM personalization, `isLoggedIn = true` even when Cognito says anonymous
- Action runner allows enrollment without proper Cognito authentication

**Root Cause**: Trusting server-side auth state for client-side Cognito users.

---

### Bug #2: catalog.html Missing Cognito Integration

**File**: `clean-x-hedgehog-templates/learn/catalog.html`

**Problem**:
- Catalog page does NOT load `cognito-auth-integration.js`
- Other pages (courses-page, pathways-page, module-page) DO load it
- Without the script, left nav auth state never updates
- Server renders both "Sign In" and "Sign Out" sections, but only toggles via JavaScript
- JavaScript never runs → wrong section stays visible

**Root Cause**: Inconsistent script loading across Learn templates.

---

### Bug #3: left-nav.html Uses Old Auth URLs

**File**: `clean-x-hedgehog-templates/learn/macros/left-nav.html:5,52`

**Current Code**:
```jinja
{% set login_url = constants.LOGIN_URL|default('/_hcms/mem/login') if constants else '/_hcms/mem/login' %}
...
<a href="{{ login_url }}?redirect_url={{ request.path_and_query|urlencode }}">
```

**Problems**:
1. Uses `constants.LOGIN_URL` which is for HubSpot Membership (`/_hcms/mem/login`)
2. Should use `constants.AUTH_LOGIN_URL` which points to Cognito (`https://api.hedgehog.cloud/auth/login`)
3. Uses relative `redirect_url` which causes problems when redirecting between domains
4. Should use absolute `redirect_url` like `https://hedgehog.cloud/learn/...`

**Root Cause**: Template still references old HubSpot Membership auth system instead of Cognito.

---

## Architectural Solution

### Core Principle: Client-Side Auth is Authoritative

For Cognito-authenticated systems on HubSpot CMS, follow this pattern:

1. **Server renders anonymous by default**
   - Don't use `request_contact.is_logged_in`
   - Don't use `personalization_token()`
   - Render both authenticated and anonymous UI sections (hidden via CSS)

2. **Client-side JavaScript determines auth state**
   - Load `cognito-auth-integration.js` on EVERY page that needs auth
   - Script calls `/auth/me` to check Cognito session
   - Script populates `window.hhIdentity` with user data
   - Script toggles UI sections via `data-auth-state` attributes

3. **UI updates after page load**
   - Accept that there's a brief flash of anonymous state
   - Use CSS to minimize visible flickering
   - Progressive enhancement: works without JS, better with JS

### Why This Works

**Separation of Concerns**:
- Server: Render structure and content
- Client: Determine and display auth state

**Single Source of Truth**:
- Cognito (via `/auth/me`) is the ONLY auth source
- No fallbacks to server-side state
- No mixing of HubSpot Membership and Cognito

**Consistency**:
- Same pattern used across all Learn pages
- Predictable behavior for developers and users

---

## Detailed Fix Approach

### Fix #1: Remove Server-Side Fallback from action-runner.js

**Change**:
```javascript
// BEFORE (Line 281-285)
var isLoggedIn = contextNode.dataset.isLoggedIn === 'true';
var contactIdentifier = {
  email: contextNode.dataset.email || '',
  contactId: contextNode.dataset.contactId || ''
};

// AFTER
// Get identity from Cognito integration (window.hhIdentity)
var identityData = window.hhIdentity || {};
var isLoggedIn = !!(identityData.authenticated || identityData.email || identityData.contactId);
var contactIdentifier = {
  email: identityData.email || '',
  contactId: identityData.contactId || ''
};
```

**Why**:
- Uses `window.hhIdentity` set by `cognito-auth-integration.js`
- No fallback to server-side `dataset.isLoggedIn`
- Cognito is the single source of truth

**Dependencies**:
- Requires `cognito-auth-integration.js` to load BEFORE action-runner.js
- Already true: action-runner.html includes cognito script in proper order

---

### Fix #2: Add Cognito Integration to catalog.html

**Change**:
Add before closing `</body>` tag in `catalog.html`:

```html
<!-- Cognito Auth Integration -->
<div id="hhl-auth-context"
     data-auth-me-url="{{ auth_me_url }}"
     data-auth-login-url="{{ login_url }}"
     data-auth-logout-url="{{ logout_url }}"
     data-constants-url="{{ constants_url }}"
     data-enable-crm="true"
     style="display:none">
</div>
<script src="{{ get_asset_url('/CLEAN x HEDGEHOG/templates/learn/assets/js/cognito-auth-integration.js') }}"></script>
```

**Why**:
- Matches pattern used in courses-page.html, pathways-page.html, module-page.html
- Loads cognito script which:
  - Calls `/auth/me` to check Cognito session
  - Populates `window.hhIdentity`
  - Toggles left nav auth state via `data-auth-state` attributes

**Note**: Need to define `auth_me_url`, `login_url`, etc. variables in catalog.html template, or use constants directly.

---

### Fix #3: Update left-nav.html Auth URLs

**Change 1: Use AUTH_LOGIN_URL Instead of LOGIN_URL**
```jinja
# BEFORE (Line 5)
{% set login_url = constants.LOGIN_URL|default('/_hcms/mem/login') if constants else '/_hcms/mem/login' %}

# AFTER
{% set login_url = constants.AUTH_LOGIN_URL|default('https://api.hedgehog.cloud/auth/login') if constants else 'https://api.hedgehog.cloud/auth/login' %}
{% set logout_url = constants.AUTH_LOGOUT_URL|default('https://api.hedgehog.cloud/auth/logout') if constants else 'https://api.hedgehog.cloud/auth/logout' %}
```

**Change 2: Use Absolute Redirect URLs**
```jinja
# BEFORE (Line 52)
<a href="{{ login_url }}?redirect_url={{ request.path_and_query|urlencode }}">

# AFTER
{% set absolute_redirect = 'https://' ~ request.domain ~ request.path_and_query %}
<a href="{{ login_url }}?redirect_url={{ absolute_redirect|urlencode }}">
```

**Why**:
1. `AUTH_LOGIN_URL` points to Cognito OAuth endpoint, not HubSpot Membership
2. Absolute redirect URL prevents cross-domain confusion
3. Lambda `/auth/login` handler needs full URL to redirect back correctly

---

## Trade-offs and Risks

### Trade-offs

**Flash of Anonymous Content (FOAC)**
- Users see anonymous UI briefly before JavaScript updates it
- **Mitigation**: Use CSS to minimize visibility, add loading states
- **Acceptable**: Standard pattern for SPAs and client-side auth

**JavaScript Dependency**
- Auth state requires JavaScript to be enabled
- **Mitigation**: Graceful degradation - anonymous state is safe default
- **Acceptable**: Learn platform assumes JavaScript (already required for progress tracking)

**Additional HTTP Request**
- Each page load calls `/auth/me` API
- **Mitigation**: API is fast, responses are small, already happening on detail pages
- **Acceptable**: Minimal performance impact, necessary for security

### Risks

**Low Risk: Breaking Existing Functionality**
- Changes are targeted and well-understood
- Removing problematic code, not adding complex logic
- Other pages already use this pattern successfully

**Low Risk: Publishing Errors**
- Use repo scripts (`npm run publish:template`)
- Test locally before publishing
- Clear rollback path (revert commits)

**Medium Risk: User Experience During Transition**
- If users have stale browser cache, may see old JavaScript
- **Mitigation**: Test with hard refresh, document cache-busting if needed

---

## Validation Strategy

### Pre-Implementation

1. ✅ Verify current code state (DONE)
2. ✅ Document architecture approach (THIS DOC)
3. ⏳ Create detailed specification
4. ⏳ Create test plan
5. ⏳ Review with stakeholders

### Post-Implementation

1. Unit validation: Check code changes match spec
2. Local testing: Test templates locally if possible
3. Playwright tests: Automated E2E validation
4. Manual testing: Verify each bug fixed in production
5. Regression testing: Ensure no other pages broken

---

## Dependencies and Prerequisites

### Required Before Implementation

1. **constants.json must have AUTH_LOGIN_URL**
   - Verify: `constants.AUTH_LOGIN_URL = "https://api.hedgehog.cloud/auth/login"`
   - Verify: `constants.AUTH_LOGOUT_URL = "https://api.hedgehog.cloud/auth/logout"`

2. **cognito-auth-integration.js must be working**
   - Already verified on courses-page, pathways-page, module-page
   - Sets `window.hhIdentity` correctly

3. **action-runner.html must load cognito script**
   - Already true per previous fixes (Issue #317/318)

### No Architectural Changes Needed

- No database schema changes
- No API endpoint changes
- No new dependencies
- Pure template and JavaScript updates

---

## Success Criteria

After implementation, these must be true:

1. **Bug #1 Fixed**: Anonymous users CANNOT enroll without Cognito login
   - Action runner checks `window.hhIdentity.authenticated`
   - No fallback to server-side state

2. **Bug #2 Fixed**: Left nav shows correct auth state on catalog page
   - Authenticated users see "Sign Out"
   - Anonymous users see "Sign In"
   - Same behavior as courses/pathways/modules pages

3. **Bug #3 Fixed**: Sign In links work without 404
   - Links point to `https://api.hedgehog.cloud/auth/login`
   - Redirect URL is absolute: `https://hedgehog.cloud/...`
   - After OAuth, user returns to correct page

4. **No Regressions**: Other pages still work
   - Courses, pathways, modules detail pages unchanged
   - My Learning page unchanged
   - No broken links or JavaScript errors

---

## Future Improvements (Out of Scope)

These are architectural improvements that would help long-term but are NOT required for Issue #319:

1. **Global auth script loader**
   - Load `cognito-auth-integration.js` site-wide in base template
   - Eliminates need to add to individual pages

2. **Auth state middleware**
   - Centralized auth state management
   - Single function to check/update auth across all pages

3. **Server-side Cognito session validation**
   - Requires HubSpot Enterprise + custom middleware
   - Not feasible on Professional tier

4. **Better loading states**
   - Skeleton UI while checking auth
   - Smoother transitions between anonymous/authenticated

---

## Conclusion

Issue #319 bugs are **easily fixable** with low risk by applying the **client-side auth pattern consistently** across all Learn pages.

**Key Insight**: Don't fight the platform limitations - embrace client-side auth as the standard pattern for Cognito on HubSpot CMS Professional tier.

**Next Steps**:
1. Review this architecture document
2. Create detailed specification with exact code changes
3. Create test plan with Playwright tests
4. Get approval and proceed with TDD implementation

---

**Document Status**: Ready for Review
**Estimated Implementation Time**: 2-3 hours (including testing)
**Risk Level**: Low-Medium

---

## Appendix A: window.hhIdentity API Reference

**Actual structure** from `cognito-auth-integration.js` (lines 317-383):

```javascript
window.hhIdentity = {
  // Private identity object (do not access directly)
  _identity: {
    email: "user@example.com",
    contactId: "12345",
    userId: "cognito-user-id",
    displayName: "John Doe",
    firstname: "John",
    lastname: "Doe",
    authenticated: true|false,
    _cognitoProfile: { /* raw Cognito data */ }
  },

  // Flag indicating identity has been resolved
  _resolved: true|false,

  // Promise that resolves when auth state is determined
  ready: Promise<identity>,

  // Public API methods (use these, not _identity directly)
  get: function() {
    return this._identity;  // Returns identity object
  },

  isAuthenticated: function() {
    return !!(this._identity && this._identity.authenticated);
  },

  isReady: function() {
    return this._resolved;
  },

  login: function(redirectPath) {
    // Redirects to Cognito OAuth login
  },

  logout: function(redirectPath) {
    // Redirects to Cognito OAuth logout
  }
}
```

**Usage Examples**:

```javascript
// Wait for auth to be ready (async approach)
window.hhIdentity.ready.then(function() {
  if (window.hhIdentity.isAuthenticated()) {
    var identity = window.hhIdentity.get();
    console.log('Email:', identity.email);
    console.log('Contact ID:', identity.contactId);
  }
});

// Synchronous check (after ready resolves)
if (window.hhIdentity.isReady() && window.hhIdentity.isAuthenticated()) {
  var identity = window.hhIdentity.get();
  // Use identity data
}
```

**CRITICAL RULES**:
1. Always use `window.hhIdentity.get()` to read identity, NOT `window.hhIdentity._identity`
2. Always wait for `window.hhIdentity.ready` promise before using identity
3. Use `window.hhIdentity.isAuthenticated()` to check auth state
4. Use `window.hhIdentity.isReady()` to check if identity is resolved

---

**Document Version**: 2.0 (Corrected with actual implementation details)
