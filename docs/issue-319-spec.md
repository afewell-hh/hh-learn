# Issue #319 - Detailed Specification

**Issue**: SSO UX Regressions
**Date**: 2026-02-10
**Author**: Agent C (Lead)
**Status**: Specification Phase
**Architecture Doc**: docs/issue-319-architecture-analysis.md

---

## Overview

This specification defines the exact code changes needed to fix 3 bugs in Issue #319. Each bug has clear acceptance criteria and implementation steps.

---

## Bug #1: Enrollment Without Login (CRITICAL)

### Current Behavior ❌

Anonymous users can enroll in courses/pathways without authenticating because action-runner.js trusts server-side auth flags.

### Expected Behavior ✅

Anonymous users MUST be redirected to Cognito login before enrollment is allowed.

### Root Cause

**File**: `clean-x-hedgehog-templates/assets/js/action-runner.js:281`

Action runner reads auth state from server-side `dataset.isLoggedIn` which is based on HubSpot Membership, not Cognito.

### Implementation

#### Step 1: Add Cognito Script to action-runner.html

**File**: `clean-x-hedgehog-templates/learn/action-runner.html`

**Current Code (Lines 199-200)**:
```html
<script defer src="{{ get_asset_url('/CLEAN x HEDGEHOG/templates/assets/js/login-helper.js') }}"></script>
<script defer src="{{ get_asset_url('/CLEAN x HEDGEHOG/templates/assets/js/action-runner.js') }}"></script>
```

**New Code**:
```html
<!-- Cognito auth must load BEFORE action-runner -->
<script defer src="{{ get_asset_url('/CLEAN x HEDGEHOG/templates/learn/assets/js/cognito-auth-integration.js') }}"></script>
<script defer src="{{ get_asset_url('/CLEAN x HEDGEHOG/templates/assets/js/login-helper.js') }}"></script>

<!-- Action runner depends on window.hhIdentity -->
<script defer src="{{ get_asset_url('/CLEAN x HEDGEHOG/templates/assets/js/action-runner.js') }}"></script>
```

**Rationale**:
- Currently action-runner.html does NOT load cognito-auth-integration.js
- Without it, `window.hhIdentity` will be undefined when action-runner.js runs
- Must load cognito script first to populate identity

#### Step 2: Add hhl-auth-context div to action-runner.html

**File**: `clean-x-hedgehog-templates/learn/action-runner.html`

**Add before line 156** (before closing `</div>` of runner-container):

```html
<!-- Cognito Auth Context -->
<div id="hhl-auth-context"
     data-auth-me-url="{{ constants.AUTH_ME_URL|default('https://api.hedgehog.cloud/auth/me') if constants else 'https://api.hedgehog.cloud/auth/me' }}"
     data-auth-login-url="{{ constants.AUTH_LOGIN_URL|default('https://api.hedgehog.cloud/auth/login') if constants else 'https://api.hedgehog.cloud/auth/login' }}"
     data-auth-logout-url="{{ constants.AUTH_LOGOUT_URL|default('https://api.hedgehog.cloud/auth/logout') if constants else 'https://api.hedgehog.cloud/auth/logout' }}"
     data-constants-url="{{ get_asset_url('/CLEAN x HEDGEHOG/templates/config/constants.json') }}"
     data-enable-crm="true"
     style="display:none">
</div>
```

**Rationale**:
- cognito-auth-integration.js reads config from `#hhl-auth-context` div
- Use constants.AUTH_ME_URL for consistency (not hard-coded)
- Maintains same fallback pattern as login/logout URLs

#### Step 3: Fix login_url Variable in action-runner.html

**File**: `clean-x-hedgehog-templates/learn/action-runner.html`

**Current Code (Line 120)**:
```jinja
{% set login_url = constants.LOGIN_URL|default('/_hcms/mem/login') if constants else '/_hcms/mem/login' %}
```

**New Code**:
```jinja
{% set login_url = constants.AUTH_LOGIN_URL|default('https://api.hedgehog.cloud/auth/login') if constants else 'https://api.hedgehog.cloud/auth/login' %}
```

**Rationale**:
- `LOGIN_URL` points to HubSpot Membership (/_hcms/mem/login)
- `AUTH_LOGIN_URL` points to Cognito OAuth
- Line 163 uses `login_url` in data-login-url attribute

#### Step 4: Update action-runner.js to Use window.hhIdentity.get()

**File**: `clean-x-hedgehog-templates/assets/js/action-runner.js`

**Current Code (Lines 281-285)**:
```javascript
var isLoggedIn = contextNode.dataset.isLoggedIn === 'true';
var contactIdentifier = {
  email: contextNode.dataset.email || '',
  contactId: contextNode.dataset.contactId || ''
};
```

**New Code**:
```javascript
// Wait for Cognito identity to be ready
// DO NOT use server-side dataset.isLoggedIn - it reflects HubSpot Membership, not Cognito
if (!window.hhIdentity || !window.hhIdentity.ready) {
  setStatus({
    icon: '⚠️',
    badge: 'Auth not ready',
    title: 'Authentication system not loaded',
    message: 'Please refresh the page to complete this action.',
    showSpinner: false
  });
  showActions('Refresh page', function(){ window.location.reload(); }, redirectUrl);
  return;
}

// Use window.hhIdentity.ready promise to wait for auth state
window.hhIdentity.ready
  .then(function() {
    var identityData = window.hhIdentity.get() || {};
    var isLoggedIn = window.hhIdentity.isAuthenticated();
    var contactIdentifier = {
      email: identityData.email || '',
      contactId: identityData.contactId || ''
    };

    // Continue with rest of action-runner logic...
    // (Move existing logic inside this .then() block)
  })
  .catch(function(error) {
    // Handle auth initialization failure
    setStatus({
      icon: '⚠️',
      badge: 'Auth failed',
      title: 'Authentication check failed',
      message: 'We could not verify your authentication status.',
      details: 'Please try refreshing the page. If the problem persists, contact support.',
      showSpinner: false
    });
    showActions('Refresh page', function(){ window.location.reload(); }, redirectUrl);

    if (console && console.error) {
      console.error('[action-runner] Auth initialization failed:', error);
    }
  });
```

**Rationale**:
- `window.hhIdentity.get()` returns the identity object (not root-level fields)
- `window.hhIdentity.ready` is a Promise that resolves when auth state is determined
- `.catch()` handles promise rejection gracefully - prevents page hang
- Shows user-friendly error with retry option
- Logs error to console for debugging
- Structure from cognito-auth-integration.js (lines 323-333)

### Acceptance Criteria

- [ ] action-runner.html loads cognito-auth-integration.js script
- [ ] action-runner.html has hhl-auth-context div with proper data attributes
- [ ] action-runner.html uses AUTH_LOGIN_URL instead of LOGIN_URL
- [ ] action-runner.js waits for `window.hhIdentity.ready` promise
- [ ] action-runner.js uses `window.hhIdentity.get()` to read identity
- [ ] action-runner.js uses `window.hhIdentity.isAuthenticated()` to check auth
- [ ] No reference to `contextNode.dataset.isLoggedIn` remains
- [ ] Anonymous users (no Cognito session) see "Sign in required" message
- [ ] Authenticated users (valid Cognito session) can complete enrollment
- [ ] Test: Anonymous user clicking enroll redirects to Cognito login
- [ ] Test: Authenticated user clicking enroll succeeds without redirect

### Risk Assessment

**Risk**: Low
**Justification**: Removing problematic code, using proven pattern from other pages

---

## Bug #2: Left Nav Auth State (MEDIUM)

### Current Behavior ❌

Catalog page left nav shows "Sign In / Register" even for authenticated users. Cannot sign out from catalog page.

### Expected Behavior ✅

Authenticated users see "Sign Out" link. Anonymous users see "Sign In / Register" links. Consistent with courses/pathways/modules pages.

### Root Cause

**File**: `clean-x-hedgehog-templates/learn/catalog.html`

Catalog page does NOT load `cognito-auth-integration.js`, so the script that toggles auth state never runs.

### Implementation

#### Step 1: Add Auth Context Variables to catalog.html

**File**: `clean-x-hedgehog-templates/learn/catalog.html`

**Add after line 7 (in `{% block head %}` section)**:

```jinja
{# Auth URLs for Cognito integration #}
{% set constants = get_asset_url("/CLEAN x HEDGEHOG/templates/config/constants.json")|request_json %}
{% set auth_me_url = constants.AUTH_ME_URL if constants and constants.AUTH_ME_URL else 'https://api.hedgehog.cloud/auth/me' %}
{% set login_url = constants.AUTH_LOGIN_URL if constants and constants.AUTH_LOGIN_URL else 'https://api.hedgehog.cloud/auth/login' %}
{% set logout_url = constants.AUTH_LOGOUT_URL if constants and constants.AUTH_LOGOUT_URL else 'https://api.hedgehog.cloud/auth/logout' %}
{% set constants_url = get_asset_url('/CLEAN x HEDGEHOG/templates/config/constants.json') %}
```

#### Step 2: Add hhl-auth-context Div Before Closing </body>

**File**: `clean-x-hedgehog-templates/learn/catalog.html`

**Add before line 146 (before `{% endblock body %}`)**:

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

**Rationale**:
- Matches pattern from courses-page.html, pathways-page.html, module-page.html
- `cognito-auth-integration.js` reads data attributes, calls `/auth/me`, toggles UI
- `data-enable-crm="true"` enables CRM sync (consistent with other pages)

### Acceptance Criteria

- [ ] catalog.html loads `cognito-auth-integration.js` script
- [ ] `hhl-auth-context` div present with all required data attributes
- [ ] Authenticated users see "Sign Out" in left nav on catalog page
- [ ] Anonymous users see "Sign In / Register" in left nav on catalog page
- [ ] Auth state toggles without page reload after login/logout
- [ ] Test: After signing in, catalog left nav updates to show "Sign Out"
- [ ] Test: After signing out, catalog left nav updates to show "Sign In"

### Risk Assessment

**Risk**: Low
**Justification**: Adding proven script that works on other pages, no behavior changes

---

## Bug #3: Sign In Link 404 (MEDIUM)

### Current Behavior ❌

Clicking "Sign In" from left nav on list pages may result in 404 or redirect to wrong domain.

### Expected Behavior ✅

"Sign In" links navigate to Cognito OAuth login at `https://api.hedgehog.cloud/auth/login` with absolute redirect URL.

### Root Cause

**File**: `clean-x-hedgehog-templates/learn/macros/left-nav.html`

1. Uses `constants.LOGIN_URL` (HubSpot Membership) instead of `constants.AUTH_LOGIN_URL` (Cognito)
2. Uses relative `redirect_url` instead of absolute URL

### Implementation

#### Step 1: Update Auth URL Variables in left-nav.html

**File**: `clean-x-hedgehog-templates/learn/macros/left-nav.html`

**Current Code (Lines 4-6)**:
```jinja
{# Get constants for auth URLs #}
{% set constants = get_asset_url("/CLEAN x HEDGEHOG/templates/config/constants.json")|request_json %}
{% set login_url = constants.LOGIN_URL|default('/_hcms/mem/login') if constants else '/_hcms/mem/login' %}
{% set logout_url = constants.LOGOUT_URL|default('/_hcms/mem/logout') if constants else '/_hcms/mem/logout' %}
```

**New Code**:
```jinja
{# Get constants for auth URLs (Cognito, not HubSpot Membership) #}
{% set constants = get_asset_url("/CLEAN x HEDGEHOG/templates/config/constants.json")|request_json %}
{% set login_url = constants.AUTH_LOGIN_URL|default('https://api.hedgehog.cloud/auth/login') if constants else 'https://api.hedgehog.cloud/auth/login' %}
{% set logout_url = constants.AUTH_LOGOUT_URL|default('https://api.hedgehog.cloud/auth/logout') if constants else 'https://api.hedgehog.cloud/auth/logout' %}
```

**Changes**:
- `constants.LOGIN_URL` → `constants.AUTH_LOGIN_URL`
- `constants.LOGOUT_URL` → `constants.AUTH_LOGOUT_URL`
- Default URLs point to Cognito endpoints, not HubSpot Membership

#### Step 2: Use Absolute Redirect URLs in Auth Links

**File**: `clean-x-hedgehog-templates/learn/macros/left-nav.html`

**Current Code (Lines 43, 52)**:
```jinja
<a href="{{ logout_url }}?redirect_url={{ request.path_and_query|urlencode }}" ...>
...
<a href="{{ login_url }}?redirect_url={{ request.path_and_query|urlencode }}" ...>
```

**New Code**:
```jinja
{# Build absolute redirect URL for OAuth flow #}
{% set absolute_redirect = 'https://' ~ request.domain ~ request.path_and_query %}

<a href="{{ logout_url }}?redirect_url={{ absolute_redirect|urlencode }}" ...>
...
<a href="{{ login_url }}?redirect_url={{ absolute_redirect|urlencode }}" ...>
```

**Rationale**:
- Cognito OAuth flow requires absolute redirect URL to return to correct domain
- Prevents confusion between `api.hedgehog.cloud` and `hedgehog.cloud`
- Lambda `/auth/login` handler expects full URL

#### Step 3: Add Auth State Toggle Function to cognito-auth-integration.js

**File**: `clean-x-hedgehog-templates/learn/assets/js/cognito-auth-integration.js`

**CRITICAL**: The current cognito-auth-integration.js does NOT have UI toggle logic for `data-auth-state` attributes. We must add this function.

**Add after line 200** (after `updateAuthContextDom` function):

```javascript
/**
 * Toggle UI elements based on auth state
 * Shows/hides elements with data-auth-state="authenticated|anonymous"
 */
function applyAuthState(identity) {
  var state = identity && identity.authenticated ? 'authenticated' : 'anonymous';
  var nodes = document.querySelectorAll('[data-auth-state]');

  nodes.forEach(function(node) {
    var expectedState = node.getAttribute('data-auth-state');
    if (expectedState === state) {
      node.style.display = '';  // Show matching state
    } else {
      node.style.display = 'none';  // Hide non-matching state
    }
  });

  // Update user greeting if authenticated
  if (state === 'authenticated') {
    var greetingNode = document.getElementById('auth-user-greeting');
    if (greetingNode && identity.firstname) {
      greetingNode.textContent = 'Hi, ' + identity.firstname + '!';
    } else if (greetingNode) {
      greetingNode.textContent = 'Hi there!';
    }
  }

  if (debug) {
    console.log('[cognito-auth] Applied auth state:', state);
  }
}
```

**Then update `initCognitoAuth` function** to call `applyAuthState`:

Find line ~236 (`updateAuthContextDom(identity);`) and add after it:

```javascript
updateAuthContextDom(identity);

// Toggle UI elements based on auth state
applyAuthState(identity);

// Emit event
emitIdentityEvent(identity);
```

**Rationale**:
- Current script updates data attributes but doesn't toggle visibility
- Need explicit function to show/hide nav elements
- Must be called after identity is resolved

#### Step 4: Update Client-Side Auth State Markup in left-nav.html

**File**: `clean-x-hedgehog-templates/learn/macros/left-nav.html`

**Current Code (Lines 40-57)** uses server-side `is_logged_in` check:
```jinja
{% if is_logged_in %}
  <div class="learn-user-greeting">Hi, {{ request_contact.firstname|default('there') }}!</div>
  <a href="{{ logout_url }}">Sign Out</a>
{% else %}
  <a href="/learn/register">Register</a>
  <a href="{{ login_url }}">Sign In</a>
{% endif %}
```

**New Code** uses `data-auth-state` toggles:
```jinja
{# Build absolute redirect URL for OAuth flow #}
{% set absolute_redirect = 'https://' ~ request.domain ~ request.path_and_query %}

{# Server renders both states; client-side JS toggles visibility based on Cognito #}
<div data-auth-state="authenticated" style="display:none;">
  <div class="learn-user-greeting" id="auth-user-greeting" aria-live="polite">Hi there!</div>
  <a href="{{ logout_url }}?redirect_url={{ absolute_redirect|urlencode }}" class="learn-auth-link" aria-label="Sign out of your account">
    <span class="learn-nav-icon" aria-hidden="true">🚪</span>
    <span class="learn-nav-text">Sign Out</span>
  </a>
</div>

<div data-auth-state="anonymous">
  <a href="/learn/register" class="learn-auth-link" aria-label="Create a Hedgehog Learn account">
    <span class="learn-nav-icon" aria-hidden="true">📝</span>
    <span class="learn-nav-text">Register</span>
  </a>
  <a href="{{ login_url }}?redirect_url={{ absolute_redirect|urlencode }}" class="learn-auth-link" aria-label="Sign in to your account">
    <span class="learn-nav-icon" aria-hidden="true">🔐</span>
    <span class="learn-nav-text">Sign In</span>
  </a>
</div>
```

**Changes**:
- Remove server-side `{% if is_logged_in %}` conditional
- Render both authenticated and anonymous sections
- Use `data-auth-state="authenticated|anonymous"` attributes
- `applyAuthState()` toggles visibility based on Cognito session
- Default to anonymous (safe default if JS doesn't load)

### Acceptance Criteria

- [ ] cognito-auth-integration.js has `applyAuthState()` function added
- [ ] `applyAuthState()` is called in `initCognitoAuth` after identity resolved
- [ ] Left nav uses `AUTH_LOGIN_URL` and `AUTH_LOGOUT_URL` from constants
- [ ] Auth links use absolute redirect URLs (`https://hedgehog.cloud/...`)
- [ ] Left nav uses `data-auth-state` toggles, not server-side conditionals
- [ ] Clicking "Sign In" navigates to `https://api.hedgehog.cloud/auth/login?redirect_url=https%3A%2F%2Fhedgehog.cloud%2F...`
- [ ] After OAuth, user returns to original page on `hedgehog.cloud`
- [ ] No 404 errors on auth links
- [ ] Test: Anonymous user clicks "Sign In" → Cognito login → returns to correct page
- [ ] Test: Authenticated user clicks "Sign Out" → Cognito logout → returns to correct page
- [ ] Test: Left nav shows correct auth state after page load

### Risk Assessment

**Risk**: Low-Medium
**Justification**: Changes auth link behavior; must test thoroughly. But absolute URLs are safer than relative URLs.

---

## Implementation Order

Execute fixes in this order to minimize risk and dependencies:

1. **Bug #3 Part 1: Add applyAuthState() to cognito-auth-integration.js** (Foundation)
   - Add the UI toggle function
   - Affects all pages that load this script
   - Test on existing pages (courses, pathways) to verify no regression

2. **Bug #3 Part 2: Update left-nav.html** (Low-Medium risk)
   - Update auth URLs to use AUTH_LOGIN_URL/AUTH_LOGOUT_URL
   - Change to data-auth-state markup
   - Use absolute redirect URLs
   - Test sign-in/sign-out links thoroughly
   - Affects all pages using left nav

3. **Bug #2: Add cognito script to catalog.html** (Low risk)
   - Add cognito script to catalog.html
   - Verify left nav toggles work on catalog
   - Should work automatically with Bug #3 changes

4. **Bug #1: Update action-runner** (Highest impact)
   - Add cognito script to action-runner.html
   - Add hhl-auth-context div to action-runner.html
   - Fix LOGIN_URL → AUTH_LOGIN_URL in action-runner.html
   - Update action-runner.js to use window.hhIdentity.ready and .get()
   - Verify enrollment blocked for anonymous users
   - Critical security fix, must test extensively

**Rationale**: Bug #3 Part 1 (adding applyAuthState) must come first because Bug #2 and Bug #3 Part 2 depend on it. Bug #1 can be done last as it's independent.

---

## Testing Strategy

### Unit Testing (Code Review)

- [ ] Verify exact code changes match specification
- [ ] Check for syntax errors in HubL/JavaScript
- [ ] Confirm variable names consistent

### Integration Testing (Local)

- [ ] Test templates render without errors
- [ ] Check JavaScript console for errors
- [ ] Verify `window.hhIdentity` populated correctly

### E2E Testing (Playwright)

See `docs/issue-319-test-plan.md` for detailed test scenarios.

Key tests:
- Anonymous enrollment blocked (Bug #1)
- Catalog left nav toggles (Bug #2)
- Sign-in link works (Bug #3)
- End-to-end auth flow

### Manual Testing (Production)

- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test with cleared cookies (anonymous state)
- [ ] Test with valid Cognito session (authenticated state)
- [ ] Test sign-in → enrollment → sign-out flow

---

## Publishing Checklist

### Files to Publish

**NOTE**: Use `npm run publish:template` for ALL files (templates, macros, and assets). There is no separate `publish:asset` script.

1. **clean-x-hedgehog-templates/assets/js/action-runner.js**
   - Command: `npm run publish:template -- --path "CLEAN x HEDGEHOG/templates/assets/js/action-runner.js" --local clean-x-hedgehog-templates/assets/js/action-runner.js`

2. **clean-x-hedgehog-templates/learn/assets/js/cognito-auth-integration.js**
   - Command: `npm run publish:template -- --path "CLEAN x HEDGEHOG/templates/learn/assets/js/cognito-auth-integration.js" --local clean-x-hedgehog-templates/learn/assets/js/cognito-auth-integration.js`

3. **clean-x-hedgehog-templates/learn/action-runner.html**
   - Command: `npm run publish:template -- --path "CLEAN x HEDGEHOG/templates/learn/action-runner.html" --local clean-x-hedgehog-templates/learn/action-runner.html`

4. **clean-x-hedgehog-templates/learn/catalog.html**
   - Command: `npm run publish:template -- --path "CLEAN x HEDGEHOG/templates/learn/catalog.html" --local clean-x-hedgehog-templates/learn/catalog.html`

5. **clean-x-hedgehog-templates/learn/macros/left-nav.html**
   - Command: `npm run publish:template -- --path "CLEAN x HEDGEHOG/templates/learn/macros/left-nav.html" --local clean-x-hedgehog-templates/learn/macros/left-nav.html`

### Pre-Publishing

- [ ] Run local tests
- [ ] Review code changes in diff
- [ ] Backup current published versions (download from HubSpot)

### Post-Publishing

- [ ] Verify files published successfully (check timestamps)
- [ ] Test each bug fix in production
- [ ] Monitor for errors in browser console
- [ ] Check enrollment metrics for anomalies

---

## Rollback Plan

If issues occur after publishing:

1. **Immediate**: Revert specific file from git history
   ```bash
   git checkout HEAD~1 <file-path>
   npm run publish:asset/template -- ...
   ```

2. **Investigate**: Check browser console for JavaScript errors

3. **Fix Forward**: If minor issue, fix and republish

4. **Full Rollback**: If major issue, revert all 3 files

---

## Success Metrics

After implementation:

- ✅ Zero unauthorized enrollments (Bug #1)
- ✅ Consistent left nav auth state across all pages (Bug #2)
- ✅ Zero 404 errors on sign-in links (Bug #3)
- ✅ All Playwright tests pass
- ✅ No regressions on other pages

---

## Related Issues

- **Issue #317**: Original Cognito SSO implementation
- **Issue #318**: Legacy auth-context.js removal on course detail page
- **Issue #319**: This issue (UX regressions)

---

## Appendix A: Constants.json Requirements

Verify these constants exist:

```json
{
  "AUTH_ME_URL": "https://api.hedgehog.cloud/auth/me",
  "AUTH_LOGIN_URL": "https://api.hedgehog.cloud/auth/login",
  "AUTH_LOGOUT_URL": "https://api.hedgehog.cloud/auth/logout",
  "AUTH_CALLBACK_URL": "https://api.hedgehog.cloud/auth/callback"
}
```

**Old constants (do NOT use)**:
- `LOGIN_URL` (HubSpot Membership)
- `LOGOUT_URL` (HubSpot Membership)

---

## Appendix B: window.hhIdentity Structure

**Actual structure** from `cognito-auth-integration.js`:

```javascript
// Access via window.hhIdentity.get()
{
  email: "user@example.com",
  contactId: "12345",
  userId: "cognito-user-id",
  displayName: "John Doe",
  firstname: "John",          // lowercase!
  lastname: "Doe",            // lowercase!
  authenticated: true|false,
  _cognitoProfile: { /* raw Cognito data */ }
}

// Use these methods, not direct property access
window.hhIdentity.get()              // Returns identity object above
window.hhIdentity.isAuthenticated()  // Returns boolean
window.hhIdentity.isReady()          // Returns boolean
window.hhIdentity.ready              // Promise that resolves with identity
```

**CRITICAL**: Field names are lowercase: `firstname`, `lastname` (not `firstName`, `lastName`)

---

**Document Status**: Ready for Review
**Next Step**: Create test plan (docs/issue-319-test-plan.md)
**Estimated Implementation Time**: 2 hours
**Risk Level**: Low-Medium
