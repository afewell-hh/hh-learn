# ADR: Authentication & Identity Integration (HubSpot ↔ External App)

**Date:** 2025-10-05
**Status:** Proposed
**Decision:** Needed

## Context

With hybrid architecture (HubSpot CMS + External Frontend), we need seamless identity/authentication:
- Track anonymous users across both platforms
- Associate learning progress with HubSpot contacts
- Enable optional user login for personalized features
- Maintain consistent user experience

## Research Findings

### HubSpot Identity Mechanisms

**1. Cookie Tracking (hutk - HubSpot User Token)**
- Automatic tracking cookie set by HubSpot
- Contains opaque GUID for visitor identity
- Associates anonymous activity with contact record
- Can be read by external apps (same domain or via API)
- Works without login

**2. HubSpot Memberships + SSO**
- Requires Content Hub Professional+ OR Marketing Hub Professional+
- Supports SAML 2.0 IdP (Okta, Azure AD, etc.)
- ⚠️ JWT support sunset February 2025 for new apps
- Enables private content access
- Per-subdomain configuration

**3. HubSpot Forms Identity**
- Email submission identifies visitor
- Associates cookie activity with contact
- Can pass email to external systems

## Integration Options

### Option A: Cookie-Based Identity (MVP - Recommended) ✅

**Flow:**
```
1. User visits HubSpot CMS page (/learn/module/xyz)
2. HubSpot tracking code sets hutk cookie
3. User clicks "Start Lab" → redirects to external app (app.hedgehog.cloud)
4. External app reads hutk cookie OR receives it as URL param
5. User interacts with quiz → calls Lambda
6. Lambda receives hutk + email (if provided)
7. Lambda calls HubSpot API to:
   - Find contact by hutk or email
   - Create contact if new
   - Record behavioral events
   - Update custom objects (progress)
```

**Implementation:**
```javascript
// HubSpot CMS page
const hutk = document.cookie.match(/hubspotutk=([^;]+)/)?.[1];
window.location.href = `https://app.hedgehog.cloud/lab/intro-k8s?hutk=${hutk}`;

// External frontend
const params = new URLSearchParams(window.location.search);
const hutk = params.get('hutk') || getCookie('hubspotutk');

// Lambda receives hutk
await fetch('/api/quiz/grade', {
  body: JSON.stringify({ hutk, answers, email })
});

// Lambda → HubSpot
const contact = await hubspot.crm.contacts.basicApi.getByEmail(email);
// Or use hutk to find contact via search API
```

**Pros:**
- ✅ No login required for public content
- ✅ Simple implementation
- ✅ Works immediately
- ✅ Tracks anonymous → identified journey
- ✅ No additional services needed

**Cons:**
- ⚠️ Cookie-based (privacy considerations)
- ⚠️ Not true authentication (can't trust user identity)
- ⚠️ Limited to same root domain or cross-domain with URL params

**Best for:**
- Public learning content
- Anonymous progress tracking
- Lead generation/nurture

---

### Option B: External IdP + SSO (Future Enhancement) 🔐

**Flow:**
```
1. User visits HubSpot CMS page
2. Clicks "Login" → redirects to IdP (Auth0, Okta, etc.)
3. IdP authenticates user
4. User redirected back with JWT
5. JWT works for both:
   - HubSpot private content (if SSO configured)
   - External app (validates JWT)
6. External app extracts email from JWT
7. Lambda uses email to identify contact
```

**Requirements:**
- External IdP (Auth0, Okta, Azure AD, etc.)
- HubSpot Content Hub Professional+ (for SSO to private content)
- JWT validation in external app
- SAML configuration if using HubSpot SSO

**Pros:**
- ✅ True authentication
- ✅ Secure user identity
- ✅ Can gate premium content
- ✅ Professional user experience

**Cons:**
- ❌ Additional costs (IdP service)
- ❌ More complex setup
- ❌ Requires higher HubSpot tier for SSO to CMS
- ⚠️ HubSpot JWT SSO sunset for new apps (SAML only)

**Best for:**
- Paid/premium content
- Enterprise customers
- Compliance requirements

---

### Option C: Email-Based Simple Auth (Hybrid) 🎯

**Flow:**
```
1. User visits HubSpot CMS page
2. Fills out simple form (email + optional name)
3. HubSpot creates/updates contact
4. Redirect to external app with signed token
5. External app validates token, stores session
6. Lambda uses email for all operations
```

**Implementation:**
```javascript
// HubSpot page - form submission
onSubmit(email) {
  // Create JWT with email
  const token = signJWT({ email, exp: 24h }, SECRET);
  window.location.href = `https://app.hedgehog.cloud?token=${token}`;
}

// External app
const { email } = verifyJWT(token);
// Set session cookie
// Use email for all Lambda calls
```

**Pros:**
- ✅ Simple but more secure than cookies
- ✅ Can verify email ownership
- ✅ No external IdP needed
- ✅ Works with any HubSpot tier

**Cons:**
- ⚠️ Not true authentication (no password)
- ⚠️ Need to manage JWT signing/validation
- ⚠️ Session management required

**Best for:**
- MVP with identified users
- Gated content without passwords
- Progressive disclosure (anonymous → identified)

---

## Recommendation

### Phase 1 (MVP): Option A (Cookie-Based) + Optional Email Capture

**Public Flow (Anonymous):**
```
HubSpot page → External app (with hutk param) → Lambda (hutk + anonymous events)
```

**Identified Flow (Progressive):**
```
HubSpot page → Email form → External app (with hutk + email) → Lambda (create/update contact)
```

**Implementation:**
1. Add HubSpot tracking code to external app domain
2. Pass hutk via URL param on CMS → App transition
3. Optionally prompt for email in external app
4. Lambda prioritizes email over hutk for contact resolution
5. Track all progress as behavioral events + custom objects

### Phase 2 (If Needed): Upgrade to Option B or C

**Triggers for upgrade:**
- Need to gate premium content
- Compliance/security requirements
- Want persistent login across sessions
- Enterprise customer requirements

**Migration Path:**
- Option A → Option C: Add simple email verification
- Option A/C → Option B: Integrate external IdP

## Security Considerations

### For Cookie-Based (Option A):
- Don't trust hutk for authorization
- Use it only for analytics/tracking
- Always verify contact email for critical operations
- Add rate limiting to prevent abuse

### For Email-Based (Option C):
- Implement email verification (magic link)
- Short JWT expiration (24h)
- Secure JWT signing (HS256 minimum)
- HTTPS only

### For SSO (Option B):
- Proper SAML/JWT validation
- Secure token storage
- Session timeout policies
- Logout flow

## Technical Implementation

### Domains Strategy

**Option 1: Subdomains (Recommended)**
```
learn.hedgehog.cloud       → HubSpot CMS (marketing pages)
app.hedgehog.cloud         → External frontend (labs/quizzes)
api.hedgehog.cloud         → AWS Lambda (API Gateway custom domain)
```
- Cookies can be shared across `*.hedgehog.cloud`
- Clean separation of concerns

**Option 2: Same Domain**
```
hedgehog.cloud/learn       → HubSpot CMS
hedgehog.cloud/app         → External frontend
hedgehog.cloud/api         → AWS Lambda
```
- More complex routing
- Easier cookie sharing

## Action Items

### Phase 1 (MVP):
1. ✅ HubSpot app created (provides API token)
2. ⬜ Set up custom domains (learn/app/api subdomains)
3. ⬜ Add HubSpot tracking code to external app
4. ⬜ Implement hutk passing (URL param)
5. ⬜ Build contact resolution in Lambda (email > hutk)
6. ⬜ Create optional email capture form
7. ⬜ Test cross-domain tracking

### Future (Phase 2):
- Evaluate IdP options (Auth0, Clerk, Supabase Auth)
- Implement email verification (magic links)
- Add session management
- Configure HubSpot SSO (if upgrading tier)

## References
- [HubSpot Cookie Tracking](https://knowledge.hubspot.com/privacy-and-consent/what-cookies-does-hubspot-set-in-a-visitor-s-browser)
- [HubSpot Contact Identity](https://knowledge.hubspot.com/account/how-does-hubspot-track-visitors)
- [HubSpot SSO for Memberships](https://knowledge.hubspot.com/website-pages/set-up-single-sign-on-sso-to-access-private-content)
