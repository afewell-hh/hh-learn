# Cognito Setup Documentation - Issue #301

**Status:** ✅ Complete
**Created:** 2026-01-17
**Completed:** 2026-01-17
**Phase:** Phase 1 - External SSO Setup

## Summary

This document tracks the AWS Cognito user pool setup for Hedgehog Learn authentication with email, Google, and GitHub login support.

## Completed Steps

### 1. User Pool Created ✓

**User Pool ID:** `us-west-2_XWB9UclRK`
**User Pool ARN:** `arn:aws:cognito-idp:us-west-2:972067303195:userpool/us-west-2_XWB9UclRK`
**Region:** `us-west-2`
**Name:** `hedgehog-learn`

Configuration:
- Email verification enabled (auto-verified)
- Username: Email addresses (case-insensitive)
- Password Policy:
  - Minimum length: 8 characters
  - Requires uppercase: Yes
  - Requires lowercase: Yes
  - Requires numbers: Yes
  - Requires symbols: No
- MFA: Disabled
- Account recovery: Email-based

### 2. App Client Created ✓

**Client ID:** `2um886mpdk65cbbb6pgsvqkchf`
**Client Name:** `hedgehog-learn-web`

Configuration:
- Client secret: None (PKCE flow)
- OAuth flows: Authorization code grant
- OAuth scopes: `openid`, `email`, `profile`
- Callback URL: `https://hedgehog.cloud/auth/callback`
- Logout URL: `https://hedgehog.cloud/`
- Supported Identity Providers: COGNITO, Google, GitHub
- Prevent user existence errors: Enabled
- Explicit auth flows:
  - `ALLOW_USER_SRP_AUTH` (Secure Remote Password)
  - `ALLOW_REFRESH_TOKEN_AUTH`

### 3. Hosted UI Domain Created ✓

**Domain:** `hedgehog-learn.auth.us-west-2.amazoncognito.com`

Login URL:
```
https://hedgehog-learn.auth.us-west-2.amazoncognito.com/login?client_id=2um886mpdk65cbbb6pgsvqkchf&response_type=code&scope=openid+email+profile&redirect_uri=https://hedgehog.cloud/auth/callback
```

Logout URL:
```
https://hedgehog-learn.auth.us-west-2.amazoncognito.com/logout?client_id=2um886mpdk65cbbb6pgsvqkchf&logout_uri=https://hedgehog.cloud/
```

### 4. Google OAuth App Created ✓

**Google Cloud Project:** `teched-473722`
**Client ID:** `22685701361-hi94ud33evapaddtmn4429hhfcops6sm.apps.googleusercontent.com`

Configuration:
- Application name: Hedgehog Learn Web Client
- Application type: Web application
- Authorized redirect URI: `https://hedgehog-learn.auth.us-west-2.amazoncognito.com/oauth2/idpresponse`
- OAuth scopes: openid, email, profile
- Consent screen configured

**Identity Provider Added to Cognito:**
- Provider Name: Google
- Provider Type: Google
- Attribute Mapping: email→email, name→name, username→sub

### 5. GitHub OAuth App Created ✓

**Client ID:** `Ov23liQUIhF61UREWADB`

Configuration:
- Application name: Hedgehog Learn
- Homepage URL: `https://hedgehog.cloud`
- Authorization callback URL: `https://hedgehog-learn.auth.us-west-2.amazoncognito.com/oauth2/idpresponse`
- Scopes: openid, user:email, read:user

**Identity Provider Added to Cognito:**
- Provider Name: GitHub
- Provider Type: OIDC
- Attribute Mapping: email→email, name→name, username→sub

### 6. All Providers Enabled ✓

App client updated to support all three identity providers:
- ✅ COGNITO (email/password)
- ✅ Google
- ✅ GitHub

## Environment Variables

Add these to your `.env` file and GitHub Actions secrets:

```bash
# Cognito Configuration
COGNITO_USER_POOL_ID=us-west-2_XWB9UclRK
COGNITO_CLIENT_ID=2um886mpdk65cbbb6pgsvqkchf
COGNITO_DOMAIN=hedgehog-learn.auth.us-west-2.amazoncognito.com
COGNITO_REGION=us-west-2
COGNITO_REDIRECT_URI=https://hedgehog.cloud/auth/callback
COGNITO_ISSUER=https://cognito-idp.us-west-2.amazonaws.com/us-west-2_XWB9UclRK
```

## Testing

### Login URL (All Providers)

Access the Cognito Hosted UI to test all authentication methods:

```
https://hedgehog-learn.auth.us-west-2.amazoncognito.com/login?client_id=2um886mpdk65cbbb6pgsvqkchf&response_type=code&scope=openid+email+profile&redirect_uri=https://hedgehog.cloud/auth/callback
```

This page will display:
- Email/password login form
- "Sign in with Google" button
- "Sign in with GitHub" button

### Testing Checklist

- [ ] Email/password registration works
- [ ] Email verification works
- [ ] Email/password login works
- [ ] Google login works
- [ ] GitHub login works
- [ ] Callback redirects to `https://hedgehog.cloud/auth/callback` with code
- [ ] Logout works and clears session

### Test User

A test user has been created for email/password testing:
- Username: `test-user@hedgehog.cloud`
- Temporary password: stored in secure credentials manager (rotate if shared)

## References

- Issue: #301
- Spec: `docs/specs/issue-299-external-sso-spec.md`
- Test plan: `docs/test-plan-issue-299.md`
- Implementation plan: `docs/implementation-plan-issue-299.md`
