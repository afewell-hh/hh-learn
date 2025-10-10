# Project App OAuth Integration (Issue #60)

## Overview

This guide documents the migration from Private App tokens to HubSpot Project App with OAuth scopes, enabling proper scope management and eliminating legacy authentication methods.

## Changes Made

### 1. Updated app-hsmeta.json

**File**: `src/app/app-hsmeta.json`

**Added Required Scopes**:
- `analytics.behavioral_events.send` - Send custom behavioral events to HubSpot CRM

**Existing Scopes** (retained):
- `oauth` - OAuth authentication
- `crm.objects.contacts.read` - Read contacts
- `crm.objects.contacts.write` - Write contacts
- `hubdb` - Access HubDB tables
- `content` - Access CMS content (templates, pages, source code)

### 2. Project Deployment

**Build #16** deployed successfully with new scopes.

**Command**:
```bash
hs project upload --account hh
```

**Result**:
- Build succeeded
- Auto-deployed to account 21430285
- Project URL: https://app.hubspot.com/developer-projects/21430285/project/hedgehog-learn-dev

### 3. Installation Update Required

**Manual Step** (One-time):
1. Open project in HubSpot: `hs project open --account hh`
2. Navigate to **Settings** → **Installation**
3. Click **Update Installation** or **Re-authenticate**
4. Accept new scope: `analytics.behavioral_events.send`
5. Confirm installation

**Alternative - Via UI**:
1. Go to https://app.hubspot.com/developer-projects/21430285/project/hedgehog-learn-dev
2. Click **Settings** tab
3. Click **Installation** section
4. Click **Update** button
5. Review and accept new scopes

## OAuth Integration Options

### Option A: Access Token from Project Context (Recommended for CI/CD)

**For serverless functions that need to call HubSpot APIs**:

The project app generates access tokens that can be retrieved and used programmatically.

**HubSpot provides access tokens via**:
1. **Environment variables** (when running in HubSpot's serverless environment)
2. **CLI context** (when running `hs` commands)
3. **Installation API** (for external services like AWS Lambda)

### Option B: Private App Token (Temporary Fallback)

Keep existing Private App token as fallback until full migration is complete.

**Environment Variable Priority**:
```javascript
const token = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN
  || process.env.HUBSPOT_PRIVATE_APP_TOKEN;
```

## Lambda Integration Strategy

### Approach 1: Manual Token Management (Current - Interim Solution)

1. After updating installation, generate a new access token from Project App settings
2. Store token as `HUBSPOT_PROJECT_ACCESS_TOKEN` in AWS Lambda environment variables
3. Update Lambda code to use project token

**Pros**:
- Simple to implement
- Works immediately

**Cons**:
- Manual token rotation required
- Token expiration management needed

### Approach 2: Automated Token Refresh (Future Enhancement)

1. Store refresh token in AWS Secrets Manager
2. Lambda function refreshes access token on each invocation if expired
3. No manual intervention required

**Pros**:
- Automatic token management
- Better security (short-lived tokens)

**Cons**:
- More complex implementation
- Additional AWS services required

### Approach 3: HubSpot Serverless Functions (Alternative)

Move Lambda logic to HubSpot serverless functions within the project.

**Pros**:
- Native OAuth integration
- Automatic token management
- No external services needed

**Cons**:
- Different deployment model
- HubSpot execution environment constraints

## Implementation Steps (Current Sprint)

### Step 1: Update Installation (Manual - One Time)
- [ ] Open project: `hs project open --account hh`
- [ ] Accept new scope: `analytics.behavioral_events.send`
- [ ] Verify installation successful

### Step 2: Extract Project Access Token
```bash
# Method 1: Via HubSpot UI
# 1. Go to https://app.hubspot.com/developer-projects/21430285/project/hedgehog-learn-dev
# 2. Settings → Installation → View Access Token
# 3. Copy token value

# Method 2: Via API (if available)
hs project info --account hh --json | jq '.accessToken'
```

### Step 3: Update Lambda Environment Variables
```bash
# Add new environment variable (keep old one as fallback)
export HUBSPOT_PROJECT_ACCESS_TOKEN="<token-from-step-2>"

# Update serverless.yml
# provider:
#   environment:
#     HUBSPOT_PROJECT_ACCESS_TOKEN: ${env:HUBSPOT_PROJECT_ACCESS_TOKEN, ''}
#     HUBSPOT_PRIVATE_APP_TOKEN: ${env:HUBSPOT_PRIVATE_APP_TOKEN} # fallback

# Redeploy
npm run deploy:aws
```

### Step 4: Update Lambda Code
```typescript
// src/shared/hubspot.ts
export function getHubSpotClient() {
  // Prefer project access token, fall back to private app token
  const token = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN ||
                process.env.HUBSPOT_PRIVATE_APP_TOKEN;

  if (!token) {
    throw new Error('No HubSpot access token available (PROJECT or PRIVATE_APP)');
  }

  return new HubSpot.Client({ accessToken: token });
}
```

### Step 5: Test Phase 2 Authenticated Beacons
```bash
# Test with contactIdentifier
curl -X POST "https://axo396gm7l.execute-api.us-west-2.amazonaws.com/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_started",
    "contactIdentifier": {"email": "test@example.com"},
    "payload": {"module_slug": "test", "ts": "2025-10-10T21:00:00Z"}
  }'

# Expected: {"status":"persisted","mode":"authenticated"}
```

### Step 6: Verify Events in HubSpot CRM
1. Go to **Reporting** → **Analytics Tools** → **Custom Events**
2. Find event completions for test contact
3. Verify properties: `module_slug`, `pathway_slug`, `ts`

## Provisioning Scripts Update

### Current State
Scripts use `HUBSPOT_PRIVATE_APP_TOKEN` directly:
- `scripts/hubspot/upload-templates.ts`
- `scripts/hubspot/provision-pages.ts`
- `scripts/hubspot/publish-pages.ts`

### Migration Strategy
**Option A**: Update scripts to use project token (same as Lambda)
```typescript
const token = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN ||
              process.env.HUBSPOT_PRIVATE_APP_TOKEN;
```

**Option B**: Use `hs api` CLI commands (as suggested in Issue #60)
- Delegate API calls to HubSpot CLI
- CLI uses authenticated context automatically
- No token management needed in scripts

## Testing Checklist

### Pre-Deployment
- [x] app-hsmeta.json updated with required scopes
- [x] Project built successfully (Build #16)
- [x] Project deployed successfully (Deploy #15)
- [ ] Installation updated with new scopes

### Post-Deployment
- [ ] Extract project access token
- [ ] Update Lambda environment variables
- [ ] Update Lambda code to use project token
- [ ] Redeploy Lambda
- [ ] Test authenticated beacon (with contactIdentifier)
- [ ] Verify response: `{"status":"persisted","mode":"authenticated"}`
- [ ] Verify events in HubSpot Custom Events UI
- [ ] Test anonymous beacon (without contactIdentifier) - regression test
- [ ] Verify response: `{"status":"logged","mode":"anonymous"}`

### Provisioning Scripts (Optional for this PR)
- [ ] Update scripts to prefer project token
- [ ] Test template upload with project token
- [ ] Test page provisioning with project token
- [ ] Document CLI fallback option

## Rollback Plan

If issues arise:

1. **Lambda**:
   - Revert to `HUBSPOT_PRIVATE_APP_TOKEN` only
   - Remove `HUBSPOT_PROJECT_ACCESS_TOKEN` from environment
   - Redeploy Lambda

2. **Project App**:
   - Revert `src/app/app-hsmeta.json` to previous version
   - Re-upload project: `hs project upload --account hh`
   - Installation will roll back to previous scopes

3. **Private App Scope** (if emergency):
   - Add `behavioral_events.send.write` scope temporarily
   - Complete Phase 2 testing
   - Remove scope after migration complete

## Success Criteria

Issue #60 complete when:

- [x] app-hsmeta.json includes `analytics.behavioral_events.send` scope
- [x] Project app deployed with new scopes (Build #16)
- [ ] Installation updated to accept new scopes
- [ ] Lambda uses project access token (with Private App fallback)
- [ ] Phase 2 authenticated beacons work (`"mode":"authenticated"`)
- [ ] Events persist to HubSpot CRM
- [ ] PR opened and merged referencing #60 and #59

## References

- **Issue #60**: https://github.com/afewell-hh/hh-learn/issues/60
- **Issue #59**: https://github.com/afewell-hh/hh-learn/issues/59
- **HubSpot Projects Docs**: https://developers.hubspot.com/docs/platform/build-and-deploy-using-hubspot-projects
- **HubSpot Scopes**: https://developers.hubspot.com/scopes
- **Behavioral Events API**: https://developers.hubspot.com/docs/guides/api/analytics-and-events/custom-events

---

**Implementation Date**: 2025-10-10
**Project**: hedgehog-learn-dev
**Account**: 21430285 (hh)
