# JWT Authentication - Quick Reference

> **Deprecated 2025-10-28:** Issues #270/#272/#274 replaced this JWT flow with HubSpot-native membership for all user-facing pages. Retain this file only for automation context (Playwright helpers). For current guidance see `docs/auth-and-progress.md` and `verification-output/issue-274/`.

## Historical Context (do not use for production UX)
HubSpot Membership API was once believed to block identity on public pages, so a custom JWT flow was prototyped. Issue #274 proved that membership works server-side; the production baseline now depends solely on HubSpot membership. Use the notes below only when maintaining automation helpers.

## Three Key Points

### 1. JWT Login Flow (Historical – automation only)
```
User clicks "Sign In"
  ↓
POST /auth/login { email: "user@example.com" }
  ↓
Lambda validates email in HubSpot CRM → Returns JWT token
  ↓
Frontend stores token in localStorage
  ↓
All API calls: Authorization: Bearer <token>
```

### 2. HubSpot Membership Flow (Production baseline)
```
User clicks "Sign In"
  ↓
Redirect to /_hcms/mem/login?redirect_url=<page>
  ↓
User completes HubSpot login
  ↓
Page reloads with membership cookies
  ↓
HubL renders CTA + auth data (`request_contact.is_logged_in`, personalization tokens)
```

### 3. Frontend API (Automation helper)
```javascript
// Automation helper (see tests/helpers/auth.ts)
await jwtLogin(page, HUBSPOT_TEST_EMAIL);

// Read identity (works after membership or JWT helper)
const identity = window.hhIdentity.get();
console.log(identity.email, identity.contactId);
```

## File Locations (Must Know)

### Backend
- **JWT Logic**: `/src/api/lambda/auth.ts` (76 lines)
- **Login Endpoint**: `/src/api/lambda/index.ts` (lines 92-150)
- **Configuration**: `/serverless.yml` (line 16: JWT_SECRET)

### Frontend
- **Public API**: `/clean-x-hedgehog-templates/assets/js/auth-context.js` (598 lines)
- **API Headers**: `/clean-x-hedgehog-templates/assets/js/enrollment.js` (lines 155-166)
- **Progress Headers**: `/clean-x-hedgehog-templates/assets/js/progress.js` (lines 21-32)

### Constants
- **Config**: `/clean-x-hedgehog-templates/config/constants.json`
  - `LOGIN_URL`: `/_hcms/mem/login` (membership)
  - `AUTH_LOGIN_URL`: API endpoint (JWT)

## Environment Variables

### Must Set
```bash
JWT_SECRET=<256-bit key>          # openssl rand -base64 32 (automation only)
HUBSPOT_TEST_USERNAME=user@...    # Automation smoke tests
```

### Automatic (from configs)
- `HUBSPOT_PROJECT_ACCESS_TOKEN`
- `HUBSPOT_ACCOUNT_ID`

## Storage Keys (localStorage)

After JWT login, these keys are set:
```javascript
localStorage.hhl_auth_token         // "eyJhbGc..."
localStorage.hhl_auth_token_expires // Timestamp of expiry (24h)
localStorage.hhl_identity_from_jwt  // { email, contactId, firstname, lastname }
```

## API Endpoint: POST /auth/login

**Request**:
```bash
curl -X POST https://api.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Success (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "contactId": "12345",
  "email": "user@example.com",
  "firstname": "John",
  "lastname": "Doe"
}
```

**Error (400)**: Invalid email
```json
{ "error": "Invalid email format", "code": "INVALID_EMAIL" }
```

**Error (404)**: Email not in HubSpot
```json
{ "error": "Contact not found", "code": "CONTACT_NOT_FOUND" }
```

## JWT Token Structure

**Inside the token** (after decoding):
```json
{
  "contactId": "12345",
  "email": "user@example.com",
  "iat": 1698345600,              // Issued at
  "exp": 1698432000,              // Expires (24 hours later)
  "iss": "hedgehog-learn",        // Issuer
  "aud": "hedgehog-learn-frontend" // Audience
}
```

## API Calls with JWT

### Always Include Header
```javascript
const headers = { 
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`  // Add this!
};

fetch('/api/endpoint', { 
  method: 'POST',
  headers: headers,
  body: JSON.stringify({...})
});
```

### Functions Already Do This
- ✅ `enrollment.js` - `buildAuthHeaders()`
- ✅ `progress.js` - `buildAuthHeaders()`
- ✅ All working tests use this pattern

## Failing Tests

### `auth.spec.ts` (Lines 18, 30, 35)
**Problem**: Hardcodes `/_hcms/mem/login` 
**Fix**: Accept either URL format or read from constants

### `enrollment-cta.spec.ts` (Lines 50-51, 81)
**Problem**: Hardcodes `LOGIN_URL: '/_hcms/mem/login'`
**Fix**: Read from actual constants.json

### Successfully Updated Tests (Reference)
- ✅ `tests/api/membership-smoke.spec.ts` - Shows correct JWT usage
- ✅ `tests/e2e/enrollment-flow.spec.ts` - Shows full flow

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Contact not found" (404) | Verify email exists in HubSpot CRM |
| "Invalid token signature" | Check JWT_SECRET matches between client & server |
| Token not stored | Check localStorage not disabled in browser |
| Identity not resolving | Reload page after login, check console for errors |
| API calls failing with 401 | Ensure Authorization header format: `Bearer <token>` |

## Key Files to Review

1. **For JWT logic**: `/docs/adr/001-public-page-authentication.md`
2. **For full guide**: `/docs/auth-and-progress.md`
3. **For examples**: `/tests/api/membership-smoke.spec.ts`
4. **For frontend**: `/clean-x-hedgehog-templates/assets/js/auth-context.js`

## One-Minute Summary

**JWT fixes public page auth** that was broken because HubSpot Membership API returns 404 on public pages. Users can now:
1. Login via email (no password needed in MVP)
2. Get a JWT token that works everywhere
3. Use `window.hhIdentity.login()` and `window.hhIdentity.get()`
4. All API calls automatically include token in Authorization header
5. Membership API still works on private pages (backward compatible)

---

**For detailed information**: See `JWT-AUTH-ANALYSIS.md`
