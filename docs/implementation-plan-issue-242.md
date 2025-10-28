# Implementation Plan: Public-Page Authentication (Issue #242)

> **Deprecated 2025-10-28:** Superseded by Issues #270/#272/#274. Retain for historical reference only. Do not follow these steps for production updates. See docs/auth-and-progress.md for the current baseline.


**Status**: READY FOR IMPLEMENTATION
**Target**: Unblock Playwright tests and enable authenticated identity on public course pages
**Approach**: JWT Session Token System (ADR 001)
**Estimated Effort**: 2-3 days
**Risk Level**: LOW

---

## Executive Summary

This plan delivers a JWT-based authentication system that works on public HubSpot pages, replacing the broken HubSpot Membership API dependency. The implementation adds ~200 lines of code across 4 files with minimal disruption to existing flows.

**Key Benefits**:
- ✅ Unblocks Issue #233 (CTA state stuck on "Sign in to start")
- ✅ Enables Playwright test `enrollment-flow.spec.ts` to pass
- ✅ Works on public pages (no HubSpot Membership dependency)
- ✅ Backward compatible with existing enrollment/progress tracking
- ✅ Foundation for future email verification

---

## Phase 1: Backend Infrastructure (Day 1, Morning)

### Task 1.1: Add JWT Dependencies

**File**: `package.json`
```bash
npm install jsonwebtoken @types/jsonwebtoken --save
```

**Validation**: `npm list jsonwebtoken` shows installed version

---

### Task 1.2: Create JWT Utilities

**File**: `src/api/lambda/auth.ts` (NEW)

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRY = '24h';

export interface JWTPayload {
  contactId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT token with contact identity
 */
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable not configured');
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    issuer: 'hedgehog-learn',
    audience: 'hedgehog-learn-frontend'
  });
}

/**
 * Verify and decode a JWT token
 * @throws Error if token is invalid, expired, or signature doesn't match
 */
export function verifyToken(token: string): JWTPayload {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable not configured');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'hedgehog-learn',
      audience: 'hedgehog-learn-frontend'
    }) as JWTPayload;

    return decoded;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (err.name === 'JsonWebTokenError') {
      throw new Error('Invalid token signature');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Extract contact identifier from JWT token string
 */
export function extractContactFromToken(authHeader: string | undefined): { email: string; contactId: string } | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const payload = verifyToken(token);
    return {
      email: payload.email,
      contactId: payload.contactId
    };
  } catch (err) {
    console.warn('[JWT] Token verification failed:', err);
    return null;
  }
}
```

**Validation**:
- TypeScript compiles without errors
- `npm run build` succeeds

---

### Task 1.3: Implement `/auth/login` Endpoint

**File**: `src/api/lambda/index.ts`

**Add import**:
```typescript
import { signToken, extractContactFromToken } from './auth';
```

**Add route handler** (insert after line 90):
```typescript
/**
 * POST /auth/login
 * Accepts email, returns JWT token if contact exists in HubSpot CRM
 */
async function login(event: any, origin?: string) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return bad(400, 'Email is required', origin, { code: 'MISSING_EMAIL' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return bad(400, 'Invalid email format', origin, { code: 'INVALID_EMAIL' });
    }

    const hubspot = getHubSpotClient();

    // Search for contact by email
    const searchResponse = await hubspot.crm.contacts.searchApi.doSearch({
      filterGroups: [{
        filters: [{
          propertyName: 'email',
          operator: 'EQ',
          value: email,
        }],
      }],
      properties: ['email', 'firstname', 'lastname'],
      limit: 1,
    });

    if (!searchResponse.results || searchResponse.results.length === 0) {
      return bad(404, 'Contact not found', origin, { code: 'CONTACT_NOT_FOUND' });
    }

    const contact = searchResponse.results[0];
    const contactId = contact.id;

    // Generate JWT token
    const token = signToken({
      contactId,
      email
    });

    return ok({
      token,
      contactId,
      email,
      firstname: contact.properties.firstname || '',
      lastname: contact.properties.lastname || ''
    }, origin);

  } catch (err: any) {
    console.error('[login] Error:', err.message || err);
    return bad(500, 'Authentication failed', origin, { code: 'AUTH_ERROR' });
  }
}
```

**Add route dispatcher** (update dispatch function around line 95):
```typescript
if (path === '/auth/login' && method === 'POST') {
  return login(event, origin);
}
```

**Validation**:
- TypeScript compiles
- Manual test with curl:
```bash
curl -X POST https://YOUR_API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

### Task 1.4: Update Validation Logic to Accept JWT

**File**: `src/api/lambda/index.ts`

**Update `track` function** (around line 420):
```typescript
async function track(raw: string, origin?: string) {
  // ... existing validation ...

  const input = validation.data as TrackEventInput;
  const enableCrmProgress = process.env.ENABLE_CRM_PROGRESS === 'true';

  // **NEW: Extract contact identifier from JWT if present**
  let contactIdentifier = input.contactIdentifier;

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const jwtContact = extractContactFromToken(authHeader);

  if (jwtContact && !contactIdentifier) {
    // Use JWT identity if no explicit contactIdentifier provided
    contactIdentifier = jwtContact;
  }

  // Override with JWT if both present (JWT takes precedence)
  if (jwtContact) {
    contactIdentifier = jwtContact;
  }

  // Continue with existing logic using contactIdentifier
  if (!enableCrmProgress) {
    console.log('Track event (anonymous)', input.eventName, input.payload);
    return ok({ status: 'logged', mode: 'anonymous' }, origin);
  }

  if (!contactIdentifier?.email && !contactIdentifier?.contactId) {
    console.log('Track event (no identity)', input.eventName);
    return ok({ status: 'logged', mode: 'anonymous' }, origin);
  }

  // ... rest of function unchanged ...
}
```

**Apply same pattern to**:
- `readProgress` (line 337)
- `getAggregatedProgress` (line 217)
- `listEnrollments` (line 121)

**Pattern**:
```typescript
const authHeader = event.headers?.authorization || event.headers?.Authorization;
const jwtContact = extractContactFromToken(authHeader);

let email = validation.data.email;
let contactId = validation.data.contactId;

// Override with JWT if present
if (jwtContact) {
  email = jwtContact.email;
  contactId = jwtContact.contactId;
}
```

**Validation**:
- All endpoints accept JWT from Authorization header
- Backward compatible (still accepts explicit email/contactId in query/body)

---

### Task 1.5: Add JWT_SECRET to Environment

**File**: `serverless.yml` (line 10)

```yaml
environment:
  HUBSPOT_PROJECT_ACCESS_TOKEN: ${ssm:/hhl/hubspot/token}
  HUBSPOT_ACCOUNT_ID: ${ssm:/hhl/hubspot/account-id}
  ENABLE_CRM_PROGRESS: true
  PROGRESS_BACKEND: properties
  JWT_SECRET: ${ssm:/hhl/jwt-secret}  # **NEW**
```

**AWS SSM Parameter Store**:
```bash
# Generate a secure 256-bit random key
openssl rand -base64 32

# Store in SSM Parameter Store
aws ssm put-parameter \
  --name /hhl/jwt-secret \
  --value "YOUR_GENERATED_SECRET_HERE" \
  --type SecureString \
  --description "JWT signing secret for Hedgehog Learn authentication"
```

**Validation**:
- `serverless deploy` succeeds
- Lambda environment shows JWT_SECRET (encrypted)

---

## Phase 2: Frontend Integration (Day 1, Afternoon)

### Task 2.1: Update Auth Context for JWT

**File**: `clean-x-hedgehog-templates/assets/js/auth-context.js`

**Add JWT login method** (insert after line 180):
```javascript
/**
 * Attempt to login with email-only authentication
 * Returns JWT token from Lambda /auth/login endpoint
 */
function attemptJWTLogin(email, constantsUrl) {
  return new Promise(function(resolve, reject) {
    getConstants({ constantsUrl: constantsUrl }, function(constants) {
      if (!constants || !constants.AUTH_LOGIN_URL) {
        reject(new Error('AUTH_LOGIN_URL not configured'));
        return;
      }

      fetch(constants.AUTH_LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ email: email })
      })
      .then(function(response) {
        if (!response.ok) {
          return response.json().then(function(err) {
            throw new Error(err.error || 'Login failed');
          });
        }
        return response.json();
      })
      .then(function(data) {
        // Store JWT token
        try {
          localStorage.setItem('hhl_auth_token', data.token);
          localStorage.setItem('hhl_auth_token_expires', Date.now() + (24 * 60 * 60 * 1000));
        } catch (e) {
          console.warn('[auth-context] Failed to store JWT token:', e);
        }

        // Return identity
        resolve({
          email: data.email || email,
          contactId: String(data.contactId || ''),
          firstname: data.firstname || '',
          lastname: data.lastname || ''
        });
      })
      .catch(function(err) {
        reject(err);
      });
    });
  });
}

/**
 * Check if stored JWT token is valid and not expired
 */
function checkStoredToken() {
  try {
    var token = localStorage.getItem('hhl_auth_token');
    var expires = localStorage.getItem('hhl_auth_token_expires');

    if (!token || !expires) {
      return null;
    }

    // Check expiry (with 15-minute buffer for refresh)
    var expiryTime = parseInt(expires, 10);
    var bufferMs = 15 * 60 * 1000; // 15 minutes

    if (Date.now() >= (expiryTime - bufferMs)) {
      // Token expired or about to expire
      localStorage.removeItem('hhl_auth_token');
      localStorage.removeItem('hhl_auth_token_expires');
      return null;
    }

    return token;
  } catch (e) {
    return null;
  }
}
```

**Update initIdentity function** (around line 210):
```javascript
function initIdentity() {
  if (identityPromise) {
    return identityPromise;
  }

  // **NEW: Priority 0: Check JWT token from localStorage**
  var token = checkStoredToken();
  if (token) {
    // Token is valid, verify it's working by checking localStorage identity
    try {
      var storedIdentity = localStorage.getItem('hhl_identity_from_jwt');
      if (storedIdentity) {
        var parsed = JSON.parse(storedIdentity);
        if (parsed && (parsed.email || parsed.contactId)) {
          identityPromise = Promise.resolve(parsed);
          return identityPromise.then(setupIdentity);
        }
      }
    } catch (e) {
      // Fall through to sessionStorage check
    }
  }

  // Priority 1: Check sessionStorage (from handshake)
  try {
    var stored = sessionStorage.getItem('hhl_identity');
    // ... existing logic ...
  } catch (e) {}

  // Priority 2: Check window.hhServerIdentity
  if (window.hhServerIdentity && (window.hhServerIdentity.email || window.hhServerIdentity.contactId)) {
    identityPromise = Promise.resolve({...window.hhServerIdentity});
  } else {
    // Priority 3: Fallback to membership profile API
    identityPromise = fetchMembershipProfile();
  }

  // ... rest unchanged ...
}
```

**Add public login method**:
```javascript
// Expose login function globally
window.hhIdentity = window.hhIdentity || {};
window.hhIdentity.login = function(email) {
  var authDiv = document.getElementById('hhl-auth-context');
  var constantsUrl = authDiv ? authDiv.getAttribute('data-constants-url') : '';

  return attemptJWTLogin(email, constantsUrl)
    .then(function(identity) {
      // Store identity for immediate use
      try {
        localStorage.setItem('hhl_identity_from_jwt', JSON.stringify(identity));
      } catch (e) {}

      // Update cached identity
      identityCache = identity;
      identityResolved = true;
      updateAuthContextDom(identity);
      emitIdentityEvent(identity);

      return identity;
    });
};
```

**Validation**:
- Browser console: `window.hhIdentity.login('test@example.com')` returns promise
- localStorage shows `hhl_auth_token` and `hhl_identity_from_jwt`

---

### Task 2.2: Update Constants Configuration

**File**: `clean-x-hedgehog-templates/config/constants.json`

```json
{
  "TRACK_EVENTS_URL": "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track",
  "AUTH_LOGIN_URL": "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/login",
  "ENABLE_CRM_PROGRESS": true,
  "LOGIN_URL": "/_hcms/mem/login",
  "LOGOUT_URL": "/_hcms/mem/logout",
  "ACTION_RUNNER_URL": "/learn/action-runner"
}
```

**Validation**:
- Deploy to HubSpot: `hs project upload`
- Verify constants.json accessible from public page

---

### Task 2.3: Update Enrollment UI to Use JWT

**File**: `clean-x-hedgehog-templates/assets/js/enrollment.js`

**Update fetchEnrollmentFromCRM** (around line 60):
```javascript
function fetchEnrollmentFromCRM(constants, auth, contentType, slug) {
  var apiBase = constants.TRACK_EVENTS_URL.replace('/events/track', '');
  var endpoint = apiBase + '/enrollments/list';

  // **NEW: Include JWT token if available**
  var headers = { 'Content-Type': 'application/json' };
  var token = localStorage.getItem('hhl_auth_token');
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  // Build query params (backward compatible)
  var params = [];
  if (auth.email) params.push('email=' + encodeURIComponent(auth.email));
  if (auth.contactId) params.push('contactId=' + encodeURIComponent(auth.contactId));

  var url = endpoint + (params.length ? '?' + params.join('&') : '');

  return fetch(url, {
    method: 'GET',
    headers: headers,
    credentials: 'omit'
  })
  .then(function(response) {
    if (!response.ok) throw new Error('Enrollments fetch failed');
    return response.json();
  })
  .then(function(data) {
    if (data.mode !== 'authenticated') return null;
    // ... existing logic ...
  });
}
```

**Apply same pattern to**:
- `progress.js` - Add Authorization header to all fetch calls
- `courses.js` - Add Authorization header
- `pathways.js` - Add Authorization header

**Validation**:
- Network tab shows `Authorization: Bearer eyJ...` header on API calls
- Enrollments fetch succeeds with 200 status

---

## Phase 3: Testing & Validation (Day 2)

### Task 3.1: Update Playwright Test

**File**: `tests/e2e/enrollment-flow.spec.ts`

**Add helper function**:
```typescript
async function authenticateViaJWT(page: Page, email: string): Promise<void> {
  const apiBase = process.env.API_BASE_URL || 'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com';

  const response = await page.request.post(`${apiBase}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email }
  });

  expect(response.ok()).toBeTruthy();

  const data = await response.json();

  // Store token in localStorage
  await page.evaluate((token) => {
    localStorage.setItem('hhl_auth_token', token);
    localStorage.setItem('hhl_auth_token_expires', String(Date.now() + (24 * 60 * 60 * 1000)));
  }, data.token);

  // Store identity for immediate use
  await page.evaluate((identity) => {
    localStorage.setItem('hhl_identity_from_jwt', JSON.stringify(identity));
  }, {
    email: data.email,
    contactId: data.contactId,
    firstname: data.firstname,
    lastname: data.lastname
  });
}
```

**Update test**:
```typescript
test('should allow user to enroll in course after authentication', async ({ page }) => {
  const testEmail = process.env.HUBSPOT_TEST_USERNAME || 'test@example.com';
  const courseSlug = 'test-course';

  // 1. Visit public course page (anonymous)
  await page.goto(`/learn/courses/${courseSlug}`);

  // 2. Authenticate via JWT
  await authenticateViaJWT(page, testEmail);

  // 3. Reload page to trigger identity resolution
  await page.reload();

  // 4. Wait for identity to resolve
  await page.waitForFunction(() => {
    return window.hhIdentity && window.hhIdentity.get() && window.hhIdentity.get().email;
  });

  // 5. CTA should change to "Start Course" or "Enroll"
  const enrollButton = page.locator('#hhl-enroll-button');
  await expect(enrollButton).toContainText(/Start Course|Enroll/i, { timeout: 10000 });

  // 6. Click enroll button
  await enrollButton.click();

  // 7. Should redirect to action-runner, then back
  await page.waitForURL(/\/learn\/courses\//);

  // 8. Verify enrolled state
  await expect(enrollButton).toContainText(/Enrolled/i);
  await expect(enrollButton).toBeDisabled();
});
```

**Validation**:
```bash
npx playwright test tests/e2e/enrollment-flow.spec.ts
```

**Expected**: Test PASSES (currently RED)

---

### Task 3.2: Manual Testing Checklist

**Public Course Page** (`/learn/courses/test-course`):

- [ ] Page loads without errors
- [ ] CTA shows "Sign in to start course" initially
- [ ] Browser console: `window.hhIdentity.login('test@example.com')` succeeds
- [ ] CTA changes to "Start Course" after login
- [ ] localStorage shows `hhl_auth_token` and `hhl_identity_from_jwt`
- [ ] Network tab shows `Authorization: Bearer` header on API calls
- [ ] Enrollment persists (click "Start Course", redirects to action-runner, returns with "Enrolled")
- [ ] Refresh page maintains authentication (no re-login required)

**Progress Tracking**:

- [ ] Mark module complete
- [ ] Network tab shows `/events/track` with Authorization header
- [ ] Response includes `"mode": "authenticated"`
- [ ] HubSpot CRM contact shows updated `hhl_progress_state`

**My Learning Dashboard** (`/learn/my-learning`):

- [ ] Shows enrolled courses
- [ ] Shows progress bars
- [ ] "Continue" CTAs work

**Logout**:

- [ ] Browser console: `localStorage.removeItem('hhl_auth_token'); location.reload();`
- [ ] CTA reverts to "Sign in to start course"

---

### Task 3.3: Verification Artifacts

**Create directory**: `verification-output/issue-242/`

**Capture**:
1. **Playwright test results**: `playwright-test-results.log`
2. **Screenshots**:
   - Before authentication (CTA: "Sign in to start course")
   - After JWT login (CTA: "Start Course")
   - After enrollment (CTA: "✓ Enrolled")
3. **Network logs**: HAR file showing Authorization header on API calls
4. **HubSpot CRM screenshot**: Contact with updated `hhl_progress_state`
5. **Browser console logs**: Identity resolution flow

**Validation**: All artifacts confirm JWT authentication working on public pages

---

## Phase 4: Documentation & Deployment (Day 3)

### Task 4.1: Update Documentation

**File**: `docs/auth-and-progress.md`

**Add section** (after "Membership Bootstrapper Limitations"):
```markdown
### JWT Authentication (Issue #242)

**Status**: IMPLEMENTED (2025-10-26)

**Purpose**: Enable authenticated identity on public course pages without HubSpot Membership dependency

**Flow**:
1. User visits public page (anonymous)
2. User clicks "Sign In" → calls `/auth/login` with email
3. Lambda validates email exists in HubSpot CRM
4. Lambda returns signed JWT token (24h expiry)
5. Client stores token in localStorage
6. All subsequent API calls include `Authorization: Bearer <jwt>` header
7. Lambda validates JWT signature and extracts contact identifier
8. Progress/enrollment endpoints work with authenticated identity

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
- JWT signed with 256-bit secret (stored in AWS SSM Parameter Store)
- 24-hour expiry (can be refreshed)
- No password required (email-only verification for MVP)
- Token validation on every Lambda request

**Frontend Usage**:
```javascript
// Login
await window.hhIdentity.login('user@example.com');

// Identity automatically available
const identity = window.hhIdentity.get();
console.log(identity.email, identity.contactId);

// Logout
localStorage.removeItem('hhl_auth_token');
localStorage.removeItem('hhl_identity_from_jwt');
location.reload();
```

**Backward Compatibility**:
- HubSpot Membership still works on private pages
- Action-runner pattern unchanged
- Existing enrollment/progress tracking unaffected
```

---

### Task 4.2: Update Deployment Guide

**File**: `docs/deployment-guide-v0.3.md`

**Add to "Environment Variables" section**:
```markdown
#### JWT_SECRET

**Purpose**: Secret key for signing/verifying JWT authentication tokens

**Configuration**:
```bash
# Generate a secure 256-bit random key
openssl rand -base64 32

# Store in AWS SSM Parameter Store
aws ssm put-parameter \
  --name /hhl/jwt-secret \
  --value "YOUR_GENERATED_SECRET_HERE" \
  --type SecureString \
  --description "JWT signing secret for Hedgehog Learn authentication"
```

**Validation**:
```bash
# Verify parameter exists
aws ssm get-parameter --name /hhl/jwt-secret --with-decryption

# Deploy Lambda with JWT support
serverless deploy
```

**Security Notes**:
- Keep JWT_SECRET confidential (never commit to git)
- Rotate secret every 90 days for best practice
- If secret is compromised, all issued tokens become invalid
```

---

### Task 4.3: Deploy to Staging

**Checklist**:
- [ ] JWT_SECRET configured in AWS SSM
- [ ] `serverless deploy --stage staging`
- [ ] Update `constants.json` with staging AUTH_LOGIN_URL
- [ ] `hs project upload` to HubSpot staging account
- [ ] Run Playwright tests against staging
- [ ] Manual smoke test (login, enroll, track progress)

**Validation**: All tests pass on staging

---

### Task 4.4: Deploy to Production

**Checklist**:
- [ ] Staging verification complete
- [ ] Production JWT_SECRET configured
- [ ] `serverless deploy --stage production`
- [ ] Update production `constants.json` with AUTH_LOGIN_URL
- [ ] `hs project upload` to production HubSpot account
- [ ] Run Playwright tests against production
- [ ] Monitor CloudWatch logs for errors

**Validation**: Production deployment successful, no errors

---

## Rollback Plan

### If JWT Authentication Fails

**Symptoms**:
- Playwright tests still failing
- CTA state not updating after login
- Authorization header missing from API calls
- Lambda returning 401/403 errors

**Rollback Steps**:
1. Revert Lambda deployment: `serverless deploy --stage production` (previous version)
2. Revert frontend changes: Restore previous `auth-context.js`, `enrollment.js`
3. Remove JWT_SECRET from environment
4. Update constants.json to remove AUTH_LOGIN_URL

**Fallback**: Continue using HubSpot Membership handshake (Issues #244/#245) until JWT fixed

---

## Success Criteria (Checklist)

### Backend
- [ ] `/auth/login` endpoint accepts email, returns JWT
- [ ] JWT includes contactId, email, iat, exp
- [ ] Lambda validates JWT on `/events/track`, `/progress/read`, `/enrollments/list`, `/progress/aggregate`
- [ ] Backward compatible (still accepts explicit email/contactId)

### Frontend
- [ ] `window.hhIdentity.login(email)` method available
- [ ] JWT stored in localStorage after login
- [ ] All API calls include `Authorization: Bearer` header when token present
- [ ] Identity resolution prioritizes JWT before membership API

### Testing
- [ ] Playwright test `enrollment-flow.spec.ts` PASSES
- [ ] Manual test: CTA updates from "Sign in" to "Start Course" after login
- [ ] Manual test: Enrollment persists to CRM
- [ ] Manual test: Progress tracking includes authenticated identity

### Documentation
- [ ] `docs/auth-and-progress.md` updated with JWT section
- [ ] `docs/deployment-guide-v0.3.md` updated with JWT_SECRET setup
- [ ] ADR 001 created: `docs/adr/001-public-page-authentication.md`
- [ ] Implementation plan created: `docs/implementation-plan-issue-242.md`

### Deployment
- [ ] Staging deployment successful
- [ ] Production deployment successful
- [ ] No increase in Lambda errors
- [ ] No increase in CRM API errors

---

## Post-Implementation Tasks

### Monitoring (Week 1)
- Monitor CloudWatch logs for JWT verification errors
- Track login success/failure rates
- Monitor token expiry patterns (are users refreshing?)

### Iteration (Week 2-4)
- Add email verification (magic link) for higher security
- Implement token refresh endpoint
- Add logout blacklist (DynamoDB)
- Optimize token expiry (adjust from 24h if needed)

### Documentation (Week 2)
- Create verification summary: `verification-output/issue-242/SUMMARY.md`
- Update main README.md with JWT authentication section
- Create video walkthrough (optional)

---

## Risk Mitigation

### Risk: JWT_SECRET Leaked
**Likelihood**: LOW
**Impact**: HIGH (all tokens compromised)
**Mitigation**:
- Store in AWS SSM SecureString (encrypted at rest)
- Never log JWT_SECRET in CloudWatch
- Rotate every 90 days
- If leaked: rotate immediately, all users must re-login

### Risk: Token Expiry Too Short/Long
**Likelihood**: MEDIUM
**Impact**: LOW (UX friction)
**Mitigation**:
- Start with 24h expiry
- Monitor user session patterns
- Implement refresh token later if needed
- Allow configuration via environment variable

### Risk: Backward Compatibility Break
**Likelihood**: LOW
**Impact**: MEDIUM (existing users can't authenticate)
**Mitigation**:
- JWT is additive (fallback to email/contactId still works)
- HubSpot Membership handshake still functional
- Gradual rollout (staging first)

---

## Timeline Summary

| Day | Phase | Tasks | Deliverables |
|-----|-------|-------|--------------|
| 1 AM | Backend | JWT utils, `/auth/login`, validation updates | Working Lambda endpoint |
| 1 PM | Frontend | auth-context.js, enrollment.js, constants.json | JWT login from browser |
| 2 | Testing | Playwright, manual tests, verification artifacts | All tests pass |
| 3 | Deployment | Documentation, staging, production | Production deployment |

**Total**: 3 days

---

## Conclusion

This implementation plan delivers a production-ready JWT authentication system that unblocks Issue #233 and enables public-page authentication. The approach is low-risk, backward-compatible, and sets the foundation for future enhancements (email verification, token refresh, OAuth integration).

**Next Steps**:
1. Review this plan with team
2. Schedule 3-day implementation sprint
3. Execute Phase 1 (Backend Infrastructure)
4. Validate and iterate

---

**Plan Created**: 2025-10-26
**Author**: Claude Code Research Team
**Approvers**: [To be filled]
**Implementation Start**: [To be scheduled]
