# HubSpot Authentication Best Practices Research Report

> **2025-10-28 Update:** Issues #270, #272, #274, and #275 implemented all recommendations here. Native membership with server-rendered CTAs is now production baseline. Use `docs/auth-and-progress.md` plus the artifacts in `verification-output/issue-274/` for current procedures; treat the remainder of this report as historical research context.

**Date:** 2025-10-27
**Context:** Issue #270 - Evaluating JWT vs HubSpot Native Authentication
**Scope:** Research HubSpot's recommended patterns for public pages with authenticated features

---

## Executive Summary

After comprehensive research of HubSpot's official documentation, developer resources, and community discussions, **HubSpot's native Memberships feature IS the "golden path"** for authentication on Content Hub pages. The current JWT implementation, while functional, represents a custom workaround that duplicates functionality HubSpot already provides.

**Key Findings:**
1. HubSpot Memberships work on BOTH public and private pages (contrary to initial assumptions)
2. The `request_contact.is_logged_in` HubL variable is available on all pages
3. JWT authentication for public pages was sunset by HubSpot in February 2025
4. Custom authentication should only be used when HubSpot's native features are insufficient

**Recommendation:** Align with Issue #270's proposal to simplify authentication by using HubSpot's native membership login exclusively.

---

## 1. HubSpot's Native Authentication: Memberships Feature

### What It Is
HubSpot Memberships is a built-in feature of Content Hub Professional and Enterprise that provides:
- Password-based authentication for contacts in your CRM
- Session management via browser cookies
- SSO support (SAML and OpenID Connect)
- Social login (Google, Facebook)
- Passwordless authentication (magic links)
- Automatic logout after configurable inactivity periods

### Availability
- **Content Hub Professional:** Up to 2 access groups
- **Content Hub Enterprise:** Up to 100 access groups
- **Service Hub Professional/Enterprise:** Also available for knowledge bases and customer portals

### Authentication Flow
```
User clicks "Sign In"
    ↓
Redirect to /_hcms/mem/login
    ↓
HubSpot-hosted login page (email/password, social, or passwordless)
    ↓
Session established via secure HTTP-only cookies
    ↓
Redirect back to original page with ?redirect_url parameter
    ↓
HubL variables available: request_contact.is_logged_in, request_contact.email, etc.
```

### Login/Logout URLs
- **Login:** `https://yourdomain.com/_hcms/mem/login`
- **Logout:** `https://yourdomain.com/_hcms/mem/logout`
- **With redirect:** `/_hcms/mem/login?redirect_url=/learn/my-learning`

---

## 2. Public vs Private Pages: Critical Clarification

### Initial Misunderstanding
The JWT implementation (PR #252/#254) was based on the belief that HubSpot's Membership API returns 404 on public pages, preventing authentication.

### Research Findings

#### HubL Variables Work on ALL Pages
According to official HubSpot documentation:
- **`request_contact.is_logged_in`** - Available on public AND private pages
- **`request_contact.email`** - Available when user is authenticated
- **`request_contact.list_memberships`** - Returns dict of list IDs the contact belongs to
- These variables work through HubL template rendering, not API calls

#### The 404 Issue Explained
The Membership API endpoint (`/_hcms/api/membership/v1/profile`) has security restrictions:
- **On Public Pages:** Only product and marketing event objects can be retrieved
- **On Private Pages:** Full contact object data available
- **Reason:** Security policy to prevent PII exposure on public pages

**However:** This restriction does NOT prevent authentication itself. It only limits what contact data can be pulled via client-side API calls.

#### The HubSpot-Native Solution
```hubl
{# This works on PUBLIC pages #}
{% if request_contact.is_logged_in %}
  <p>Welcome, {{ request_contact.email }}!</p>
  <button>Start Course</button>
{% else %}
  <a href="/_hcms/mem/login?redirect_url={{ request.path }}">Sign in to start course</a>
{% endif %}
```

The authentication state is available during **server-side template rendering**, not client-side API calls.

---

## 3. JWT Authentication Sunset by HubSpot

### Official Deprecation
**Date:** February 5, 2025
**Announcement:** "Sunset of JWT SSO Setup for Private Content"

**What Changed:**
- JWT-based SSO applications can no longer be created for HubSpot private content
- Existing JWT applications configured before Feb 5, 2025 continue to work
- **Recommended replacement:** OpenID Connect (OIDC) for SSO scenarios

**Source:** https://developers.hubspot.com/changelog/sunset-of-jwt-sso-setup-for-private-content

### Implications for Custom JWT Implementation
The current implementation (/auth/login endpoint with custom JWT tokens) is NOT the same as HubSpot's deprecated JWT SSO feature, but the timing is significant:
- HubSpot is moving AWAY from JWT-based authentication
- They're standardizing on OIDC for external SSO
- This suggests JWT is not HubSpot's preferred authentication pattern

---

## 4. Recommended Patterns for Public Pages with Authentication

### Official HubSpot Guidance

#### Pattern 1: Public Content with Conditional Features (RECOMMENDED)
**Use Case:** Learning platform where content is public but authenticated users get enhanced features

**Implementation:**
```hubl
{# Public page with optional authentication #}
<!DOCTYPE html>
<html>
<head>
  <title>{{ content.name }}</title>
</head>
<body>
  {# Content visible to everyone #}
  <article>
    {{ content.post_body }}
  </article>

  {# Enhanced features for authenticated users #}
  {% if request_contact.is_logged_in %}
    <div class="authenticated-features">
      <button onclick="trackProgress()">Mark as Complete</button>
      <a href="/learn/my-learning">View My Progress</a>
    </div>
  {% else %}
    <a href="/_hcms/mem/login?redirect_url={{ request.path }}" class="cta">
      Sign in to track your progress
    </a>
  {% endif %}
</body>
</html>
```

**Advantages:**
- No custom authentication code required
- HubSpot handles security, session management, password resets
- Works on public pages without restriction
- Supports SSO, social login, passwordless authentication
- Automatic security updates and compliance

#### Pattern 2: Private Content with Access Groups
**Use Case:** Premium content restricted to specific user segments

**Implementation:**
- Mark pages/posts as "Private" in HubSpot CMS
- Assign to Access Groups based on contact lists
- Users automatically prompted to log in when accessing restricted content

**Not recommended for this project** because content should remain publicly accessible.

#### Pattern 3: Serverless Functions for Extended Features
**Use Case:** Custom API endpoints that need to validate authenticated users

**Implementation:**
```javascript
// serverless function at /_hcms/api/custom-endpoint
exports.main = async (context, sendResponse) => {
  // Access authenticated contact data
  const contact = context.contact;

  if (!contact || !contact.isLoggedIn) {
    sendResponse({
      statusCode: 401,
      body: { error: 'Authentication required' }
    });
    return;
  }

  // Use contact.email, contact.vid, etc.
  const userData = {
    email: contact.email,
    contactId: contact.vid
  };

  sendResponse({
    statusCode: 200,
    body: userData
  });
};
```

**Note:** Serverless functions have access to the authenticated contact via `context.contact` when membership session exists.

---

## 5. Learning Management System (LMS) Best Practices

### Commercial LMS Solutions on HubSpot
Research found several LMS platforms built on HubSpot CMS:

#### HubLMS (https://hublms.com/)
- **Authentication:** HubSpot Membership SSO
- **Progress Tracking:** Stored in HubSpot CRM custom properties
- **Implementation:** Uses HubSpot's native features + custom modules
- **Access Control:** Smart Lists restrict content based on quiz scores, completion status

**Key Insight:** They use HubSpot Memberships, not custom JWT

#### Learn LMS by Instrumental Group
- **Authentication:** HubSpot registration form → creates contact → browser cookie
- **Access Management:** HubDB + contact lists (Professional tier workaround)
- **Progress:** Tracked in HubSpot Page Analytics and CRM properties

**Key Insight:** Even on Professional tier (without full Memberships), they use HubSpot forms + cookies

### Common Pattern Across LMS Solutions
1. Use HubSpot's native authentication (Memberships or contact forms)
2. Store progress in CRM custom properties
3. Use HubL to conditionally render content based on authentication
4. Track engagement via HubSpot Analytics
5. Leverage serverless functions for complex business logic

**None use custom JWT authentication for the user-facing login flow**

---

## 6. Gaps and Limitations in HubSpot's Native Features

### Identified Limitations

#### 1. Client-Side API Access to Contact Data on Public Pages
**Limitation:** The Membership API (`/_hcms/api/membership/v1/profile`) returns 404 on public pages

**HubSpot's Reasoning:** Security - prevent PII exposure on public pages

**Workaround:**
- Use HubL variables during server-side rendering
- Create custom serverless functions that access `context.contact`
- Don't rely on client-side API calls to get contact data

**Does this justify JWT?** No - the data is available server-side

#### 2. Real-Time Progress Tracking from Client-Side
**Limitation:** Can't make direct API calls to HubSpot CRM from browser on public pages

**HubSpot's Solution:** Serverless functions as intermediary

**Current Implementation:** Custom Lambda endpoints (already built)

**Does this justify JWT?** Partially - but could use HubSpot session cookies instead of JWT tokens

#### 3. Cross-Domain Authentication
**Limitation:** Membership sessions don't automatically work across different domains/subdomains

**HubSpot's Guidance:** Use SSO (SAML or OIDC) for cross-domain scenarios

**Does this apply?** No - all content is on the same HubSpot-hosted domain

#### 4. Automated Testing Challenges
**Limitation:** Playwright tests need to authenticate programmatically

**Current Solution:** JWT `/auth/login` endpoint for test automation

**Alternative:**
- Use HubSpot's membership login in tests (submit form, follow redirects)
- Keep JWT endpoint for testing only, not user-facing flows

**This is a valid use case for JWT** - but only for testing, not production authentication

---

## 7. When Custom Authentication IS Appropriate

Based on HubSpot documentation and community discussions:

### Valid Scenarios for Custom Auth
1. **External Identity Provider Integration**
   - When you need to integrate with corporate SSO (beyond SAML/OIDC)
   - When HubSpot's SSO features don't support your IdP

2. **Mobile App Authentication**
   - When building native mobile apps that can't use HubSpot's web-based login
   - When you need token-based authentication for API-only access

3. **Headless CMS / API-First Architecture**
   - When HubSpot is purely a data source, not hosting the frontend
   - When the UI is completely decoupled (React SPA on different domain)

4. **Test Automation** (borderline case)
   - When programmatic authentication is needed for CI/CD
   - Can be justified for internal tooling only

### This Project's Scenario
- **Frontend:** Hosted on HubSpot CMS (not headless)
- **Users:** Contacts in HubSpot CRM
- **Content:** HubSpot pages (not external application)
- **SSO Needs:** None (no external identity provider)

**Conclusion:** This project does NOT require custom authentication. HubSpot's native Memberships feature is sufficient and recommended.

---

## 8. Comparison: Current JWT Implementation vs HubSpot Native

| Aspect | Custom JWT (Current) | HubSpot Memberships (Native) |
|--------|----------------------|------------------------------|
| **Works on Public Pages** | ✅ Yes | ✅ Yes (via HubL) |
| **Authentication UI** | Custom modal/form | HubSpot-hosted login page |
| **Session Management** | localStorage + 24hr expiry | HTTP-only cookies + configurable timeout |
| **Password Management** | None (email-only MVP) | Full password features + resets |
| **SSO Support** | ❌ No | ✅ SAML + OIDC |
| **Social Login** | ❌ No | ✅ Google, Facebook |
| **Passwordless** | ❌ No | ✅ Magic links |
| **Security Maintenance** | Your responsibility | HubSpot's responsibility |
| **Compliance** | Your responsibility | HubSpot-managed |
| **Two-Factor Auth** | ❌ No | ✅ Yes |
| **Auto Logout** | Manual implementation | ✅ 20min/40min/60min/24hr options |
| **Implementation Effort** | High (custom code) | Low (configuration) |
| **Aligned with HubSpot** | ❌ Custom approach | ✅ Official pattern |
| **Testing Complexity** | Medium | Medium (same) |
| **User Experience** | Custom flow | Familiar HubSpot login |
| **Token Storage** | localStorage (JS accessible) | HTTP-only cookies (more secure) |
| **CSRF Protection** | Manual implementation | Built-in |
| **Rate Limiting** | Manual implementation | Built-in |

---

## 9. Specific Recommendations

### Recommendation 1: Adopt HubSpot Native Authentication (PRIORITY 1)
**Action:** Implement Issue #270's proposed changes

**Rationale:**
1. Aligns with HubSpot's official "golden path"
2. Reduces custom code and maintenance burden
3. Provides better security (HTTP-only cookies, CSRF protection, automatic updates)
4. Enables future features (SSO, social login, 2FA) without additional development
5. `request_contact.is_logged_in` works on public pages - the original problem doesn't exist

**Steps:**
1. Update CTA login handlers to use `/_hcms/mem/login` with redirect_url
2. Remove email prompt modal and `window.hhIdentity.login()` from user-facing flows
3. Update templates to use HubL `{% if request_contact.is_logged_in %}` checks
4. Keep serverless function endpoints but validate via HubSpot session instead of JWT
5. Deprecate `/auth/login` endpoint for production use

### Recommendation 2: Leverage HubL for Authentication State
**Action:** Replace client-side identity resolution with server-side HubL

**Current Pattern (JWT):**
```javascript
// Client-side - requires API call or localStorage
const identity = window.hhIdentity.get();
if (identity && identity.email) {
  // Show authenticated features
}
```

**Recommended Pattern (HubL):**
```hubl
{# Server-side - available during page render #}
{% if request_contact.is_logged_in %}
  <div data-user-email="{{ request_contact.email }}"
       data-user-id="{{ request_contact.hs_object_id }}">
    {# Authenticated features #}
  </div>
{% else %}
  <a href="/_hcms/mem/login?redirect_url={{ request.path }}">Sign in</a>
{% endif %}
```

**Advantages:**
- No client-side API calls needed
- Data available immediately (no async resolution)
- More secure (server-side only)
- Faster page load (no waiting for identity check)

### Recommendation 3: Use Serverless Functions for Custom API Endpoints
**Action:** Continue using Lambda functions for progress tracking, but validate using HubSpot session

**Pattern:**
```javascript
// In serverless function
exports.main = async (context, sendResponse) => {
  // Access HubSpot membership session
  const contact = context.contact;

  if (!contact || !contact.isLoggedIn) {
    return sendResponse({ statusCode: 401, body: { error: 'Not authenticated' } });
  }

  // Use contact.email, contact.vid for CRM operations
  const contactId = contact.vid;

  // Your custom logic here
  await updateProgress(contactId, moduleId);

  sendResponse({ statusCode: 200, body: { success: true } });
};
```

**Note:** This requires hosting serverless functions on HubSpot's platform, not AWS Lambda

**Alternative (Keep AWS Lambda):**
- Validate HubSpot session cookie in Lambda
- Call HubSpot API to verify session is valid
- Extract contact ID from session
- This is more complex than JWT but aligns with HubSpot patterns

### Recommendation 4: Keep JWT for Testing Only
**Action:** Preserve `/auth/login` endpoint exclusively for Playwright tests

**Rationale:**
- Programmatic authentication is difficult with HubSpot's login forms
- Tests need reliable, fast authentication without browser redirects
- This is an internal tool, not exposed to end users

**Implementation:**
- Add environment check: only enable `/auth/login` in test environments
- Document clearly that this is for testing purposes only
- User-facing flows use HubSpot membership login exclusively

### Recommendation 5: Update Documentation
**Action:** Revise authentication documentation to reflect HubSpot best practices

**Files to Update:**
- `/docs/auth-and-progress.md` - Change primary auth flow to HubSpot Memberships
- `/docs/adr/001-public-page-authentication.md` - Add addendum about reverting to native auth
- `CLAUDE.md` - Add HubSpot authentication guidance
- `README.md` - Update setup instructions for Memberships configuration

---

## 10. Migration Strategy

### Phase 1: Immediate Changes (Issue #270)
**Timeline:** Current iteration

1. **Update CTA Components**
   - Remove email prompt modal
   - Use direct link to `/_hcms/mem/login?redirect_url=...`
   - Share logic between left-nav and CTA buttons

2. **Update Templates**
   - Add HubL authentication checks
   - Pre-render authenticated state server-side
   - Pass contact data to client via data attributes (not API calls)

3. **Deprecate auth-handshake**
   - Mark `/learn/auth-handshake` as deprecated
   - Ensure no active links reference it
   - Keep page for backwards compatibility but log usage

4. **Update Tests**
   - Tests use membership login for user flows
   - Keep JWT helper for programmatic test setup
   - Verify CTA behavior with both anonymous and authenticated states

### Phase 2: Backend Alignment (Future)
**Timeline:** Next iteration

1. **Evaluate Lambda vs HubSpot Serverless Functions**
   - Research hosting custom endpoints on HubSpot platform
   - Compare costs, capabilities, limitations
   - Make decision on migration path

2. **If Keeping Lambda:**
   - Update validation to check HubSpot session cookies
   - Remove JWT token generation for production
   - Keep JWT for testing only (environment-gated)

3. **If Moving to HubSpot Serverless:**
   - Migrate endpoints to HubSpot platform
   - Use `context.contact` for authentication
   - Update frontend to call HubSpot-hosted endpoints

### Phase 3: Cleanup (Future)
**Timeline:** After Phase 2 complete

1. Remove JWT-related code from production builds
2. Archive JWT authentication documentation
3. Update all tests to use HubSpot-native authentication
4. Final verification of all authentication flows

---

## 11. Addressing Initial Concerns

### Concern: "HubSpot Membership API returns 404 on public pages"
**Status:** TRUE but IRRELEVANT

**Explanation:**
- The API endpoint does return 404 for security reasons
- However, `request_contact.is_logged_in` HubL variable works on public pages
- Authentication state is available during server-side rendering
- No client-side API call to Membership API is needed

**Solution:** Use HubL variables, not API endpoints

### Concern: "We need custom authentication for public pages with optional auth"
**Status:** FALSE

**Explanation:**
- HubSpot Memberships work on public pages
- Authentication is optional (not required to view content)
- HubL provides conditional rendering based on auth state
- This is the exact pattern HubSpot recommends

**Solution:** Follow HubSpot's recommended pattern (Pattern 1 from Section 4)

### Concern: "JWT provides better user experience"
**Status:** QUESTIONABLE

**Current JWT Flow:**
1. User clicks "Sign in"
2. Modal asks for email
3. JWT token generated
4. User still needs HubSpot password for other features

**HubSpot Native Flow:**
1. User clicks "Sign in"
2. Redirect to HubSpot login (passwordless/social/password options)
3. Session established
4. Redirect back to course

**Analysis:** HubSpot native is actually simpler (one step vs multiple)

### Concern: "Tests need JWT for automation"
**Status:** VALID but LIMITED

**Explanation:**
- Programmatic authentication in Playwright is easier with API tokens
- HubSpot login requires form submission and redirects

**Solution:** Keep JWT for testing only, not production authentication

---

## 12. Official Documentation Links

### Primary References
1. **HubSpot Memberships Overview**
   - https://developers.hubspot.com/docs/cms/data/memberships
   - Last updated: October 9, 2025

2. **Membership Settings (Knowledge Base)**
   - https://knowledge.hubspot.com/website-pages/manage-private-content-settings
   - Official HubSpot guidance for customers

3. **SSO for Memberships**
   - https://developers.hubspot.com/docs/cms/features/memberships/sso
   - SAML and OIDC integration guide

4. **JWT SSO Sunset Announcement**
   - https://developers.hubspot.com/changelog/sunset-of-jwt-sso-setup-for-private-content
   - February 5, 2025 deprecation notice

5. **Serverless Functions Documentation**
   - https://developers.hubspot.com/docs/cms/data/serverless-functions
   - Official guide for custom API endpoints

### Community Resources
6. **HubLMS - Reference Implementation**
   - https://hublms.com/
   - Commercial LMS built on HubSpot using native authentication

7. **Learn LMS by Instrumental Group**
   - https://www.instrumental.net/apps/learn-lms-for-hubspot
   - Alternative LMS implementation with HubSpot integration

8. **HubSpot Developer Community**
   - https://community.hubspot.com/t5/HubSpot-Developer-Support/ct-p/developers
   - Active forum for authentication questions

### Blog Posts & Case Studies
9. **Essentials for Getting Started with Memberships**
   - https://developers.hubspot.com/blog/essentials-for-getting-started-with-memberships
   - Developer guide from HubSpot

10. **Bookmarking Blog Content with Memberships**
    - https://developers.hubspot.com/blog/bookmarking-blog-content-with-memberships-and-custom-objects
    - Real-world example of memberships + custom features

---

## 13. Conclusion

### The "Golden Path" for HubSpot Content Hub Authentication

**HubSpot's official recommendation for public pages with authenticated features:**

1. **Use native Memberships for authentication**
   - Login via `/_hcms/mem/login`
   - Session managed by HubSpot cookies
   - Authentication state via `request_contact.is_logged_in` HubL variable

2. **Render authentication state server-side**
   - Use HubL conditional logic in templates
   - Pass contact data to client via data attributes
   - Avoid client-side API calls to get contact data on public pages

3. **Use serverless functions for custom features**
   - Access authenticated contact via `context.contact`
   - Implement custom business logic (progress tracking, enrollments)
   - Return only necessary data to client

4. **Store user data in HubSpot CRM**
   - Use custom contact properties for progress, preferences
   - Leverage HubSpot's analytics and reporting
   - Enable marketing automation based on learning activity

### Why JWT Implementation is Not Aligned

1. **Not HubSpot's recommended pattern** - Custom authentication is only needed for external IdP or headless architectures
2. **Duplicates existing functionality** - HubSpot Memberships already provides authentication on public pages
3. **Deprecated technology** - HubSpot sunset JWT SSO in favor of OIDC (Feb 2025)
4. **Increased maintenance burden** - Security, session management, password resets are your responsibility
5. **Missing features** - No SSO, social login, 2FA, passwordless authentication
6. **Less secure** - localStorage tokens are more vulnerable than HTTP-only cookies

### Why Issue #270 is the Right Direction

Issue #270 proposes exactly what HubSpot recommends:
- ✅ Use HubSpot's native membership login
- ✅ Share authentication logic across components
- ✅ Simplify user flow (remove custom email prompt)
- ✅ Rely on `request_contact.is_logged_in` for state management
- ✅ Deprecate custom authentication handshake

### Final Recommendation

**ADOPT HUBSPOT'S NATIVE MEMBERSHIPS PATTERN**

Implement Issue #270's proposed changes immediately. This will:
- Align with HubSpot's official best practices
- Reduce code complexity and maintenance burden
- Improve security through platform-managed authentication
- Enable future enhancements (SSO, social login) without additional development
- Provide a better user experience with familiar HubSpot login flow

The JWT implementation was a well-intentioned solution to a misunderstood problem. The Membership API 404 on public pages does NOT prevent authentication - it only restricts client-side API access to contact data. HubSpot's server-side HubL variables provide authentication state on all pages.

**The "golden path" is to use HubSpot's native features, not build custom authentication.**

---

## Appendix A: Quick Reference - HubSpot Authentication Patterns

### Pattern 1: Public Page with Optional Authentication (YOUR USE CASE)
```hubl
{# Template: course-page.html #}
<!DOCTYPE html>
<html>
<body>
  {# Public content - always visible #}
  <article>{{ content.post_body }}</article>

  {# Authenticated features #}
  {% if request_contact.is_logged_in %}
    <div data-contact-email="{{ request_contact.email }}"
         data-contact-id="{{ request_contact.hs_object_id }}">
      <button onclick="enrollInCourse()">Start Course</button>
      <a href="/learn/my-learning">My Learning Dashboard</a>
    </div>
    <script>
      // Contact data available in data attributes
      const email = document.querySelector('[data-contact-email]').dataset.contactEmail;
      const contactId = document.querySelector('[data-contact-id]').dataset.contactId;

      async function enrollInCourse() {
        // Call your custom API with contact data
        await fetch('/_hcms/api/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            contactId,
            courseSlug: '{{ content.slug }}'
          })
        });
      }
    </script>
  {% else %}
    <a href="/_hcms/mem/login?redirect_url={{ request.path }}" class="cta">
      Sign in to start course
    </a>
  {% endif %}
</body>
</html>
```

### Pattern 2: Serverless Function with Authentication
```javascript
// File: my-api.functions/enroll.js
exports.main = async (context, sendResponse) => {
  // Access authenticated contact from HubSpot session
  const contact = context.contact;

  if (!contact || !contact.isLoggedIn) {
    return sendResponse({
      statusCode: 401,
      body: { error: 'Authentication required' }
    });
  }

  // Extract contact information
  const contactId = contact.vid; // HubSpot contact ID
  const email = contact.email;

  // Parse request body
  const { courseSlug } = JSON.parse(context.body);

  // Your business logic here
  // e.g., call HubSpot API to update contact properties

  sendResponse({
    statusCode: 200,
    body: {
      success: true,
      contactId,
      courseSlug
    }
  });
};
```

### Pattern 3: Authentication Helper (Shared Logic)
```javascript
// File: assets/js/auth-helpers.js
export function buildLoginUrl(redirectPath = null) {
  const path = redirectPath || window.location.pathname;
  const params = new URLSearchParams({ redirect_url: path });
  return `/_hcms/mem/login?${params.toString()}`;
}

export function buildLogoutUrl(redirectPath = '/') {
  const params = new URLSearchParams({ redirect_url: redirectPath });
  return `/_hcms/mem/logout?${params.toString()}`;
}

export function isAuthenticated() {
  // Check HubL-rendered data attribute
  return document.body.hasAttribute('data-authenticated');
}

export function getContactData() {
  if (!isAuthenticated()) return null;

  return {
    email: document.body.dataset.contactEmail,
    contactId: document.body.dataset.contactId,
    firstname: document.body.dataset.contactFirstname,
    lastname: document.body.dataset.contactLastname
  };
}
```

Usage in template:
```hubl
<body {% if request_contact.is_logged_in %}
        data-authenticated="true"
        data-contact-email="{{ request_contact.email }}"
        data-contact-id="{{ request_contact.hs_object_id }}"
        data-contact-firstname="{{ request_contact.firstname }}"
        data-contact-lastname="{{ request_contact.lastname }}"
      {% endif %}>

  <nav>
    {% if request_contact.is_logged_in %}
      <span>Hello, {{ request_contact.firstname }}!</span>
      <a href="{{ buildLogoutUrl() }}">Sign out</a>
    {% else %}
      <a href="{{ buildLoginUrl() }}">Sign in</a>
    {% endif %}
  </nav>
</body>

<script type="module">
  import { getContactData, buildLoginUrl } from './auth-helpers.js';

  const contact = getContactData();
  if (contact) {
    console.log('Authenticated as:', contact.email);
  }
</script>
```

---

**END OF REPORT**
