# HubSpot Authentication Research - Quick Summary

**Date:** 2025-10-27
**Full Report:** `/home/ubuntu/afewell-hh/hh-learn/HUBSPOT-AUTH-RESEARCH-REPORT.md`

---

## TL;DR - Key Findings

### 1. Is JWT the "Golden Path"?
**NO.** HubSpot's native Memberships feature is the official recommended approach.

### 2. Does HubSpot Memberships Work on Public Pages?
**YES.** The `request_contact.is_logged_in` HubL variable works on ALL pages (public and private).

### 3. Why Did We Implement JWT Then?
**Misunderstanding.** The Membership API endpoint returns 404 on public pages for security, but HubL authentication variables are still available during server-side rendering.

### 4. What Should We Do?
**Implement Issue #270.** Simplify authentication by using HubSpot's native membership login exclusively.

---

## Critical Research Findings

### Finding 1: HubSpot Deprecated JWT SSO (Feb 2025)
- **Date:** February 5, 2025
- **Action:** Sunset JWT-based SSO for private content
- **Replacement:** OpenID Connect (OIDC)
- **Implication:** JWT is NOT HubSpot's preferred authentication pattern

**Source:** https://developers.hubspot.com/changelog/sunset-of-jwt-sso-setup-for-private-content

### Finding 2: request_contact Works on Public Pages
- **Variable:** `request_contact.is_logged_in`
- **Availability:** ALL pages (public AND private)
- **Access:** Server-side HubL rendering (not client-side API)
- **Implication:** Authentication state is available without custom JWT

**Source:** https://developers.hubspot.com/docs/cms/data/memberships

### Finding 3: Commercial LMS Platforms Use Native Auth
- **HubLMS:** Uses HubSpot Membership SSO
- **Learn LMS:** Uses HubSpot registration forms + cookies
- **Pattern:** None use custom JWT authentication

**Implication:** Industry standard is HubSpot native features

### Finding 4: The 404 Issue Doesn't Block Authentication
- **What Returns 404:** `/_hcms/api/membership/v1/profile` (client-side API)
- **Why:** Security policy prevents PII exposure on public pages
- **What Still Works:** HubL variables during server-side rendering
- **Implication:** We don't need the Membership API endpoint

---

## Comparison Matrix

| Feature | Custom JWT | HubSpot Native |
|---------|-----------|----------------|
| Works on public pages | ✅ Yes | ✅ Yes |
| Requires custom code | ❌ Yes | ✅ No |
| Security maintenance | ❌ Your responsibility | ✅ HubSpot manages |
| SSO support | ❌ No | ✅ SAML + OIDC |
| Social login | ❌ No | ✅ Google, Facebook |
| Passwordless auth | ❌ No | ✅ Magic links |
| Two-factor auth | ❌ No | ✅ Yes |
| Password resets | ❌ Manual | ✅ Automatic |
| Session security | localStorage (JS accessible) | HTTP-only cookies |
| CSRF protection | ❌ Manual | ✅ Built-in |
| Aligned with HubSpot | ❌ No | ✅ Yes |

**Winner:** HubSpot Native (10 advantages vs 1 for JWT)

---

## Recommended Changes (Issue #270)

### What to Change
1. **CTA Login Flow**
   - ❌ Remove: Email prompt modal
   - ❌ Remove: `window.hhIdentity.login(email)` call
   - ✅ Add: Direct link to `/_hcms/mem/login?redirect_url=...`

2. **Left-Nav + CTA Logic**
   - ✅ Share login URL builder between components
   - ✅ Use same redirect logic for both

3. **Authentication State**
   - ❌ Remove: Client-side API call to get identity
   - ✅ Add: HubL `{% if request_contact.is_logged_in %}` checks
   - ✅ Add: Pass contact data via data attributes

4. **Auth Handshake**
   - ❌ Deprecate: `/learn/auth-handshake` page
   - ✅ Document: New simplified flow

### What to Keep
- JWT `/auth/login` endpoint **for testing only** (Playwright automation)
- Lambda endpoints for progress tracking (validate via session, not JWT)
- `window.hhIdentity` API (but resolve from HubL data, not localStorage)

### Verification Anchor (Issue #274)
- `verification-output/issue-274/IMPLEMENTATION-NOTES.md`
- `verification-output/issue-274/course-authoring-101-anonymous-2025-10-28.html`
- `verification-output/issue-274/course-authoring-101-authenticated-2025-10-28.html`

---

## Code Examples

### Before (Historical JWT – retired 2025-10-28)
```javascript
// Deprecated pattern (do not reintroduce):
// - Prompts for email
// - Calls the JWT /auth/login endpoint
// - Stores token in localStorage
// This flow was removed in Issues #270/#272/#274.
```

### After (HubSpot Native - Recommended)
```hubl
{# HubL Template #}
{% if request_contact.is_logged_in %}
  <button onclick="enrollInCourse()">Start Course</button>
{% else %}
  <a href="/_hcms/mem/login?redirect_url={{ request.path }}">
    Sign in to start course
  </a>
{% endif %}
```

```javascript
// Shared helper
function buildLoginUrl(redirectPath = null) {
  const path = redirectPath || window.location.pathname;
  return `/_hcms/mem/login?redirect_url=${encodeURIComponent(path)}`;
}
```

---

## When Custom Auth IS Justified

### Valid Use Cases
1. **External Identity Provider** - Corporate SSO beyond SAML/OIDC
2. **Mobile App** - Native apps needing API tokens
3. **Headless CMS** - UI on different domain/platform
4. **Test Automation** - Programmatic auth for CI/CD (internal only)

### This Project's Reality
- ❌ Not headless (hosted on HubSpot CMS)
- ❌ Not external IdP (contacts in HubSpot CRM)
- ❌ Not mobile app (web-based learning platform)
- ✅ Testing automation (keep JWT for this only)

**Verdict:** Custom JWT not justified for production authentication

---

## Migration Plan

### Phase 1: User-Facing Flows (✅ Issues #270/#272)
1. Update CTA components to use HubSpot login (completed).
2. Add HubL authentication checks to templates (completed).
3. Deprecate auth-handshake page (completed).
4. Update tests for new flow (completed).

### Phase 2: Backend Alignment (✅ Issue #274)
1. Ensure `enrollment.js` hydrates only authenticated CTAs (completed).
2. Publish updated templates and capture verification artifacts (see `verification-output/issue-274/`).
3. Retain JWT `/auth/login` exclusively for automation helpers (documented).

### Phase 3: Documentation Cleanup (✅ Issue #275)
1. Remove JWT-first guidance from docs/README/ADR (completed).
2. Archive or annotate historical JWT references (completed).
3. Link verification assets for future regression checks (completed).

---

## Official HubSpot Resources

### Must-Read Documentation
1. **Memberships Overview**
   https://developers.hubspot.com/docs/cms/data/memberships

2. **JWT SSO Sunset**
   https://developers.hubspot.com/changelog/sunset-of-jwt-sso-setup-for-private-content

3. **Membership Settings**
   https://knowledge.hubspot.com/website-pages/manage-private-content-settings

### Reference Implementations
4. **HubLMS** (commercial LMS on HubSpot)
   https://hublms.com/

5. **Learn LMS** (alternative implementation)
   https://www.instrumental.net/apps/learn-lms-for-hubspot

---

## Questions & Answers

### Q: But the Membership API returns 404 on public pages?
**A:** True, but irrelevant. HubL variables (`request_contact.is_logged_in`) work on public pages via server-side rendering. You don't need the API endpoint.

### Q: Won't this break existing functionality?
**A:** No. You're replacing one authentication method (JWT) with another (HubSpot native). The endpoints and features remain the same.

### Q: What about our tests?
**A:** Keep JWT `/auth/login` for Playwright automation. User-facing flows use HubSpot login.

### Q: Is JWT more secure?
**A:** No. HubSpot's HTTP-only cookies are MORE secure than localStorage tokens. Plus HubSpot handles CSRF, rate limiting, and security updates.

### Q: Will this take a long time to implement?
**A:** No. Issue #270's changes are straightforward:
- Update login links (remove modal, use direct URL)
- Add HubL checks to templates
- Share login URL builder
Most work is **removing** custom code, not adding new code.

---

## Bottom Line

**The "golden path" is HubSpot's native Memberships feature.**

Custom JWT authentication was built to solve a problem that doesn't actually exist. The Membership API 404 on public pages is a red herring - authentication state is available via HubL variables.

**Action:** Keep Issues #270/#272/#274/#275 as the baseline; any future auth change must preserve server-rendered membership and cite the Issue #274 verification artifacts.

**Benefit:** Simpler code, better security, less maintenance, future-proof—and fully supported by HubSpot’s managed session cookies.

---

**For full details, see:** `/home/ubuntu/afewell-hh/hh-learn/HUBSPOT-AUTH-RESEARCH-REPORT.md`
