# OAuth Provider Setup Guide

**Related Issue:** #301
**Created:** 2026-01-17
**Purpose:** Instructions to complete Google and GitHub OAuth app configuration for Cognito

## Prerequisites

You must have completed the base Cognito setup (user pool, app client, and hosted UI domain). See `docs/cognito-setup-issue-301.md` for details.

**Critical Information You'll Need:**
- **Cognito Redirect URI:** `https://hedgehog-learn.auth.us-west-2.amazoncognito.com/oauth2/idpresponse`
- **User Pool ID:** `us-west-2_XWB9UclRK`
- **App Client ID:** `2um886mpdk65cbbb6pgsvqkchf`

## Step 1: Create Google OAuth App

### 1.1 Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Select or create a project (e.g., "Hedgehog Learn")

### 1.2 Configure OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type (unless using Google Workspace)
3. Click **Create**
4. Fill in the required fields:
   - App name: `Hedgehog Learn`
   - User support email: Your email address
   - Developer contact information: Your email address
5. Click **Save and Continue**
6. On the Scopes screen, click **Add or Remove Scopes**
7. Add these scopes:
   - `openid`
   - `email`
   - `profile`
8. Click **Update** then **Save and Continue**
9. Add test users if needed (for development)
10. Click **Save and Continue** and then **Back to Dashboard**

### 1.3 Create OAuth Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Select **Web application** as application type
4. Enter name: `Hedgehog Learn Web Client`
5. Under **Authorized JavaScript origins**, add:
   - `https://hedgehog.cloud`
   - `https://www.hedgehog.cloud`
6. Under **Authorized redirect URIs**, add:
   ```
   https://hedgehog-learn.auth.us-west-2.amazoncognito.com/oauth2/idpresponse
   ```
7. Click **Create**
8. **IMPORTANT:** Copy the Client ID and Client Secret that appear
   - Save these securely - you'll need them for the next step

### 1.4 Add Google Provider to Cognito

Once you have the Google Client ID and Secret, run:

```bash
# Load AWS credentials from .env file or export them manually
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION should already be set

aws cognito-idp create-identity-provider \
  --user-pool-id us-west-2_XWB9UclRK \
  --provider-name Google \
  --provider-type Google \
  --provider-details client_id="YOUR_GOOGLE_CLIENT_ID",client_secret="YOUR_GOOGLE_CLIENT_SECRET",authorize_scopes="openid email profile" \
  --attribute-mapping email=email,name=name,username=sub
```

## Step 2: Create GitHub OAuth App

### 2.1 Access GitHub Developer Settings

1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Click on **OAuth Apps** in the left sidebar
3. Click **New OAuth App**

### 2.2 Register the Application

Fill in the application details:

- **Application name:** `Hedgehog Learn`
- **Homepage URL:** `https://hedgehog.cloud`
- **Application description:** (Optional) `Learning management system for Hedgehog platform`
- **Authorization callback URL:**
  ```
  https://hedgehog-learn.auth.us-west-2.amazoncognito.com/oauth2/idpresponse
  ```

Click **Register application**

### 2.3 Generate Client Secret

1. After registration, you'll see your **Client ID** - copy this
2. Click **Generate a new client secret**
3. **IMPORTANT:** Copy the client secret immediately - you won't be able to see it again
   - Save both Client ID and Client Secret securely

### 2.4 Add GitHub Provider to Cognito

Once you have the GitHub Client ID and Secret, run:

```bash
# Load AWS credentials from .env file or export them manually
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION should already be set

aws cognito-idp create-identity-provider \
  --user-pool-id us-west-2_XWB9UclRK \
  --provider-name GitHub \
  --provider-type GitHub \
  --provider-details client_id="YOUR_GITHUB_CLIENT_ID",client_secret="YOUR_GITHUB_CLIENT_SECRET",authorize_scopes="openid user:email read:user" \
  --attribute-mapping email=email,name=name,username=sub
```

## Step 3: Update App Client

After adding both providers, update the app client to enable them:

```bash
# Load AWS credentials from .env file or export them manually
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION should already be set

aws cognito-idp update-user-pool-client \
  --user-pool-id us-west-2_XWB9UclRK \
  --client-id 2um886mpdk65cbbb6pgsvqkchf \
  --supported-identity-providers COGNITO Google GitHub
```

## Step 4: Test the Setup

### 4.1 Test Google Login

1. Navigate to:
   ```
   https://hedgehog-learn.auth.us-west-2.amazoncognito.com/login?client_id=2um886mpdk65cbbb6pgsvqkchf&response_type=code&scope=openid+email+profile&redirect_uri=https://hedgehog.cloud/auth/callback
   ```
2. Click the Google login button
3. Authenticate with your Google account
4. Verify you're redirected to `https://hedgehog.cloud/auth/callback` with a `code` parameter

### 4.2 Test GitHub Login

1. Navigate to the same login URL as above
2. Click the GitHub login button
3. Authenticate with your GitHub account
4. Verify you're redirected to `https://hedgehog.cloud/auth/callback` with a `code` parameter

### 4.3 Test Email/Password Login

1. Navigate to the login URL
2. Use the test credentials:
   - Username: `test-user@hedgehog.cloud`
   - Password: `TestPass123!` (you'll be prompted to change it on first login)
3. Verify you're redirected properly

## Step 5: Update Environment Variables (Optional)

If you want to store the OAuth credentials in your environment (not recommended for production), add to `.env`:

```bash
# Google OAuth (DO NOT commit these to git)
GOOGLE_OAUTH_CLIENT_ID=your_google_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth (DO NOT commit these to git)
GITHUB_OAUTH_CLIENT_ID=your_github_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_github_client_secret
```

**Note:** These are already configured in Cognito. These env vars would only be needed if you're storing them for documentation or automated deployment purposes.

## Verification Checklist

- [ ] Google OAuth app created in Google Cloud Console
- [ ] Google provider added to Cognito
- [ ] GitHub OAuth app created
- [ ] GitHub provider added to Cognito
- [ ] App client updated with all providers
- [ ] Google login tested successfully
- [ ] GitHub login tested successfully
- [ ] Email/password login tested successfully
- [ ] All redirects go to correct callback URL

## Troubleshooting

### "Redirect URI mismatch" Error

- Double-check that the redirect URI in Google/GitHub exactly matches:
  ```
  https://hedgehog-learn.auth.us-west-2.amazoncognito.com/oauth2/idpresponse
  ```
- Make sure there are no trailing slashes or spaces

### Provider Not Showing in Login UI

- Verify the provider was added to Cognito:
  ```bash
  aws cognito-idp list-identity-providers --user-pool-id us-west-2_XWB9UclRK
  ```
- Verify the app client was updated:
  ```bash
  aws cognito-idp describe-user-pool-client \
    --user-pool-id us-west-2_XWB9UclRK \
    --client-id 2um886mpdk65cbbb6pgsvqkchf
  ```

### OAuth Consent Screen Issues (Google)

- If you see "This app hasn't been verified," this is normal for development
- Click "Advanced" > "Go to Hedgehog Learn (unsafe)" to proceed
- For production, you'll need to submit for Google verification

## Next Steps

After completing this setup, you can move to Phase 2:
- DynamoDB schema setup
- Lambda auth endpoints implementation
- Frontend integration

See `docs/implementation-plan-issue-299.md` for the full roadmap.
