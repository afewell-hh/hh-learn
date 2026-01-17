# Cognito Setup Documentation - Issue #301

**Status:** In Progress
**Created:** 2026-01-17
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
- Supported Identity Providers: COGNITO (email/password)
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

## Pending Steps

### 4. Google OAuth App Setup

To enable Google login, you need to:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client ID"
5. Configure the OAuth consent screen if not already done
6. Select "Web application" as the application type
7. Add the following to "Authorized redirect URIs":
   ```
   https://hedgehog-learn.auth.us-west-2.amazoncognito.com/oauth2/idpresponse
   ```
8. Click "Create" and save the Client ID and Client Secret

**Required Information:**
- Google OAuth Client ID
- Google OAuth Client Secret

### 5. GitHub OAuth App Setup

To enable GitHub login, you need to:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - Application name: `Hedgehog Learn`
   - Homepage URL: `https://hedgehog.cloud`
   - Authorization callback URL:
     ```
     https://hedgehog-learn.auth.us-west-2.amazoncognito.com/oauth2/idpresponse
     ```
4. Click "Register application"
5. Generate a new client secret
6. Save the Client ID and Client Secret

**Required Information:**
- GitHub OAuth Client ID
- GitHub OAuth Client Secret

## Next Steps

Once you have the Google and GitHub OAuth credentials:

1. Add Google as an identity provider in Cognito:
   ```bash
   aws cognito-idp create-identity-provider \
     --user-pool-id us-west-2_XWB9UclRK \
     --provider-name Google \
     --provider-type Google \
     --provider-details client_id="YOUR_GOOGLE_CLIENT_ID",client_secret="YOUR_GOOGLE_CLIENT_SECRET",authorize_scopes="openid email profile"
   ```

2. Add GitHub as an identity provider in Cognito:
   ```bash
   aws cognito-idp create-identity-provider \
     --user-pool-id us-west-2_XWB9UclRK \
     --provider-name GitHub \
     --provider-type GitHub \
     --provider-details client_id="YOUR_GITHUB_CLIENT_ID",client_secret="YOUR_GITHUB_CLIENT_SECRET",authorize_scopes="openid user:email read:user"
   ```

3. Update the app client to support the new identity providers:
   ```bash
   aws cognito-idp update-user-pool-client \
     --user-pool-id us-west-2_XWB9UclRK \
     --client-id 2um886mpdk65cbbb6pgsvqkchf \
     --supported-identity-providers COGNITO Google GitHub
   ```

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

## Testing Checklist

- [ ] Email/password registration works
- [ ] Email verification works
- [ ] Email/password login works
- [ ] Google login works
- [ ] GitHub login works
- [ ] Callback redirects to `https://hedgehog.cloud/auth/callback` with code
- [ ] Logout works and clears session

## References

- Issue: #301
- Spec: `docs/specs/issue-299-external-sso-spec.md`
- Test plan: `docs/test-plan-issue-299.md`
- Implementation plan: `docs/implementation-plan-issue-299.md`
