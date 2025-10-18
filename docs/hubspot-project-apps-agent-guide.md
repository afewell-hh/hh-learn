---
title: HubSpot Project Apps Platform - AI Agent Training Guide
owner: hh-learn project lead
status: reference
last-reviewed: 2025-10-18
---

# HubSpot Project Apps Platform - AI Agent Training Guide

> **Critical:** This guide exists because AI training data is outdated regarding HubSpot's platform changes. Most documentation and training data reference **legacy Private Apps**, but this application uses **HubSpot Project Apps (platform version 2025.2)** with fundamentally different authentication patterns.

## Executive Summary for AI Agents

**If you're an AI agent working with this codebase, READ THIS FIRST:**

1. **This app uses HubSpot Project Apps (2025.2)**, NOT legacy Private Apps
2. **Authentication is via Static Bearer Tokens**, NOT OAuth 2.0 flows (despite confusing "OAuth" terminology in some HubSpot docs)
3. **The app is WORKING IN PRODUCTION** at https://hedgehog.cloud/learn
4. **Your training data is likely WRONG** about HubSpot authentication patterns
5. **When in doubt, search current docs** or reference working code in this repo

---

## Part 1: Platform Overview

### What Are HubSpot Project Apps?

**HubSpot Project Apps** are the current platform (introduced in 2024-2025) for building server-side apps that integrate with HubSpot CRM and CMS.

**Key Characteristics:**
- Platform version: `2025.2` (defined in `hsproject.json`)
- Distribution model: `private` (internal use only)
- Auth type: `static` (static bearer tokens)
- Project-based deployment (via `hs project upload`)
- Scope-based permissions (declared in `app-hsmeta.json`)

### How Project Apps Differ from Private Apps (Legacy)

| Feature | **Project Apps (Current)** | **Private Apps (Legacy)** |
|---------|----------------------------|---------------------------|
| **Platform Version** | 2025.1, 2025.2 | N/A (deprecated) |
| **Token Type** | Project Access Token (`pat-na1-...`) | Private App Token |
| **Token Format** | 44 characters, starts with `pat-` | Variable length |
| **Scope Management** | Declared in `app-hsmeta.json` | Configured in HubSpot UI |
| **Deployment** | `hs project upload` | N/A (UI-based creation) |
| **Auth Flow** | Static bearer token (no flow) | Static API key |
| **Terminology** | "OAuth" in docs (misleading) | "API Key" |
| **Current Status** | ✅ Active, recommended | ⚠️ Legacy, migration required |

**Important:** Despite HubSpot documentation using "OAuth" terminology, **Project Apps do NOT implement OAuth 2.0 flows**. There are no authorization codes, refresh tokens, or redirect URIs. Tokens are static, long-lived bearer tokens similar to API keys.

---

## Part 2: Authentication Patterns

### Token Types in This Application

This application uses **three possible token types** with the following precedence:

```typescript
// From src/shared/hubspot.ts:5-8
const token =
  process.env.HUBSPOT_PROJECT_ACCESS_TOKEN ||  // 1. Preferred (Project Apps)
  process.env.HUBSPOT_API_TOKEN ||             // 2. Alternative (generic)
  process.env.HUBSPOT_PRIVATE_APP_TOKEN;       // 3. Fallback (legacy)
```

#### 1. HUBSPOT_PROJECT_ACCESS_TOKEN (Preferred)

**Format:** `pat-na1-{40-character-string}` (44 chars total)

**How to obtain:**
1. Deploy project: `hs project upload`
2. Open project in HubSpot: `hs project open`
3. Navigate to Settings → Installation → View Access Token
4. Copy token value

**Usage:**
```bash
# Raw HTTP
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts?limit=10"

# HubSpot Node.js Client
const client = new Client({ accessToken: process.env.HUBSPOT_PROJECT_ACCESS_TOKEN });
```

**Scopes:** Defined in `src/app/app-hsmeta.json` under `config.auth.requiredScopes`

#### 2. HUBSPOT_API_TOKEN (Alternative)

**Format:** Variable (generic HubSpot API token)

**Usage:** Same as PROJECT_ACCESS_TOKEN (standard bearer token)

#### 3. HUBSPOT_PRIVATE_APP_TOKEN (Legacy Fallback)

**Format:** Variable (legacy Private App token)

**Status:** Maintained for backward compatibility during migration

**Note:** New development should use `HUBSPOT_PROJECT_ACCESS_TOKEN`

### Application Configuration

**Project:** `hedgehog-learn-dev`
- **Account ID:** 21430285
- **Platform Version:** 2025.2
- **Distribution:** private
- **Auth Type:** static
- **App ID:** 21306067

**Source Files:**
- `hsproject.json` - Project metadata
- `src/app/app-hsmeta.json` - App configuration and scopes

---

## Part 3: Required Scopes

From `src/app/app-hsmeta.json`:

```json
{
  "config": {
    "auth": {
      "type": "static",
      "requiredScopes": [
        "crm.objects.contacts.read",
        "crm.objects.contacts.write",
        "crm.schemas.contacts.write",
        "hubdb",
        "content",
        "analytics.behavioral_events.send",
        "behavioral_events.event_definitions.read_write"
      ]
    }
  }
}
```

### Scope Purpose Map

| Scope | Purpose in This App |
|-------|---------------------|
| `crm.objects.contacts.read` | Read user progress from CRM contacts |
| `crm.objects.contacts.write` | Update contact properties with progress data |
| `crm.schemas.contacts.write` | Manage custom contact property definitions |
| `hubdb` | Read/write learning content (modules, courses, pathways) |
| `content` | Access CMS pages and templates |
| `analytics.behavioral_events.send` | Send learning events to HubSpot analytics |
| `behavioral_events.event_definitions.read_write` | Define custom event schemas |

### Custom Contact Properties

Progress tracking uses these custom properties on Contact objects:

```typescript
// From verification artifacts
{
  "hhl_progress_state": "JSON string with detailed progress data",
  "hhl_progress_updated_at": "2025-10-17",
  "hhl_progress_summary": "15/20 modules completed, 3/5 pathways enrolled"
}
```

**Property Details:**
- `hhl_progress_state` (text) - JSON-serialized progress object
- `hhl_progress_updated_at` (date) - Last update timestamp
- `hhl_progress_summary` (text) - Human-readable summary

---

## Part 4: Working with HubSpot APIs

### ✅ CORRECT Patterns

#### Using the HubSpot Node.js Client

```javascript
// This is the CORRECT approach
import { Client } from '@hubspot/api-client';

const client = new Client({
  accessToken: process.env.HUBSPOT_PROJECT_ACCESS_TOKEN
});

// Read contacts
const contact = await client.crm.contacts.basicApi.getById('12345', [
  'email',
  'hhl_progress_state',
  'hhl_progress_updated_at'
]);

// Update contact properties
await client.crm.contacts.basicApi.update('12345', {
  properties: {
    hhl_progress_state: JSON.stringify(progressData),
    hhl_progress_updated_at: new Date().toISOString().split('T')[0]
  }
});
```

#### Using Raw HTTP (curl)

```bash
# This works perfectly with Project Access Tokens
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/12345?properties=email,hhl_progress_state"

# Update contact
curl -X PATCH \
  -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"hhl_progress_state":"..."}}' \
  "https://api.hubapi.com/crm/v3/objects/contacts/12345"
```

### ❌ COMMON MISTAKES

#### Mistake 1: Assuming Token is Expired

```javascript
// ❌ WRONG: Don't immediately conclude token is expired on auth errors
if (error.statusCode === 401) {
  console.log("Token is expired!"); // PROBABLY WRONG
}

// ✅ CORRECT: Check multiple causes
if (error.statusCode === 401) {
  // Could be:
  // 1. Contact doesn't exist in CRM
  // 2. Property name is misspelled
  // 3. Scope is missing from app-hsmeta.json
  // 4. Token is actually invalid (least likely)

  // FIRST, verify the resource exists:
  const contact = await client.crm.contacts.basicApi.getById('12345');
  // THEN check if property exists in schema
  // ONLY THEN consider token issues
}
```

**Reality:** Project Access Tokens are **long-lived static tokens** that don't expire automatically. They only become invalid if:
- Manually revoked in HubSpot UI
- App is uninstalled
- Project is deleted

#### Mistake 2: Expecting OAuth Flows

```javascript
// ❌ WRONG: There is no OAuth flow
const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=...`;
// Project Apps use static tokens, not OAuth

// ✅ CORRECT: Use static token directly
const client = new Client({
  accessToken: process.env.HUBSPOT_PROJECT_ACCESS_TOKEN
});
```

#### Mistake 3: Using Deprecated API Endpoints

```javascript
// ❌ WRONG: Old API versions
GET /contacts/v1/contact/email/test@example.com

// ✅ CORRECT: Use v3 endpoints
GET /crm/v3/objects/contacts/test@example.com?idProperty=email
```

---

## Part 5: External Serverless Integration (AWS Lambda)

### Architecture

This application uses **AWS Lambda** (not HubSpot serverless) for backend functions:

```
┌─────────────────┐
│  HubSpot CMS    │
│  (Front-end)    │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────────────────┐
│  AWS API Gateway + Lambda       │
│  - /events/track                │
│  - /quiz/grade                  │
│  - /progress/read               │
└────────┬────────────────────────┘
         │ HubSpot API calls
         ▼
┌─────────────────┐
│  HubSpot CRM    │
│  (Contact data) │
└─────────────────┘
```

**Key Points:**
1. Lambda functions use `HUBSPOT_PROJECT_ACCESS_TOKEN` to call HubSpot APIs
2. Token is stored in Lambda environment variables (deployed via `serverless.yml`)
3. Same authentication pattern as local development
4. No special HubSpot serverless integration needed

### Lambda Configuration

```yaml
# From serverless.yml
provider:
  environment:
    HUBSPOT_PROJECT_ACCESS_TOKEN: ${env:HUBSPOT_PROJECT_ACCESS_TOKEN, ''}
    HUBSPOT_PRIVATE_APP_TOKEN: ${env:HUBSPOT_PRIVATE_APP_TOKEN}  # Fallback
    HUBSPOT_ACCOUNT_ID: ${env:HUBSPOT_ACCOUNT_ID}
    ENABLE_CRM_PROGRESS: ${env:ENABLE_CRM_PROGRESS, 'false'}
    PROGRESS_BACKEND: ${env:PROGRESS_BACKEND, 'properties'}
```

### Deployment

```bash
# Set environment variables
export HUBSPOT_PROJECT_ACCESS_TOKEN="pat-na1-..."
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-west-2"
export APP_STAGE="dev"
export ENABLE_CRM_PROGRESS="true"

# Deploy
npm run build
npm run deploy:aws
```

**Evidence:** Successfully deployed and verified (see `verification-output/issue-189/`)

---

## Part 6: Common Debugging Patterns

### Problem: 401 Unauthorized

**Check in this order:**

1. **Does the resource exist?**
   ```bash
   # Verify contact exists
   curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
     "https://api.hubapi.com/crm/v3/objects/contacts?limit=1"
   ```

2. **Is the property name correct?**
   ```bash
   # Check contact schema
   curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
     "https://api.hubapi.com/crm/v3/properties/contacts"
   ```

3. **Is the scope in app-hsmeta.json?**
   ```bash
   # Check src/app/app-hsmeta.json
   cat src/app/app-hsmeta.json | jq '.config.auth.requiredScopes'
   ```

4. **Only then:** Check if token is valid
   ```bash
   # Test token validity
   curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
     "https://api.hubapi.com/crm/v3/objects/contacts?limit=1"
   ```

### Problem: Property Not Updating

**Check:**

1. **Feature flag enabled?**
   ```bash
   # Lambda must have ENABLE_CRM_PROGRESS=true
   aws lambda get-function-configuration --function-name hedgehog-learn-dev-api \
     | jq '.Environment.Variables.ENABLE_CRM_PROGRESS'
   ```

2. **Contact exists?**
   ```bash
   # Search by email
   curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
     "https://api.hubapi.com/crm/v3/objects/contacts/test@example.com?idProperty=email"
   ```

3. **Property exists in schema?**
   ```bash
   # Check if hhl_progress_state exists
   curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
     "https://api.hubapi.com/crm/v3/properties/contacts/hhl_progress_state"
   ```

### Problem: "Token Expired" Conclusion

**Before assuming token is expired:**

✅ **DO:**
- Check if the API endpoint is correct (v3, not v1)
- Verify the resource exists (contact, property, etc.)
- Check scope requirements in HubSpot docs
- Review app-hsmeta.json for required scopes
- Test with a simple endpoint (e.g., GET /contacts?limit=1)

❌ **DON'T:**
- Immediately conclude token is expired
- Suggest OAuth refresh flows (they don't exist for Project Apps)
- Recommend generating new tokens without investigating root cause

**Evidence from Issue #189:**
> An agent incorrectly concluded the Project Access Token was expired based on authentication errors that were actually due to querying non-existent contacts. The token was fully functional.

---

## Part 7: When Your Training Data Fails You

### Red Flags (Outdated Information)

If you encounter these in documentation or your training data, **IGNORE IT**:

1. ❌ **"Use API Keys"** - Deprecated, replaced by Project Apps
2. ❌ **"Create a Private App"** - Legacy method, use Project Apps instead
3. ❌ **"OAuth flows with authorization codes"** - Not used in Project Apps static auth
4. ❌ **"Refresh tokens"** - Static tokens don't need refresh
5. ❌ **Platform versions < 2025.1** - Outdated examples
6. ❌ **"Configure scopes in HubSpot UI"** - Scopes are in app-hsmeta.json

### What to Do Instead

**Step 1: Search for current documentation**

```
Query: "HubSpot Project Apps 2025 [your specific feature]"
Focus on: developers.hubspot.com/docs/platform URLs
Look for: platformVersion: "2025.1" or "2025.2" in examples
```

**Step 2: Reference working code in this repo**

```bash
# Find how this codebase uses HubSpot APIs
grep -r "hubspot" src/ --include="*.ts"

# Check token usage
grep -r "HUBSPOT_PROJECT_ACCESS_TOKEN" .
```

**Step 3: Test with HubSpot Node.js client first**

The official `@hubspot/api-client` package handles auth correctly:

```javascript
import { Client } from '@hubspot/api-client';

const client = new Client({
  accessToken: process.env.HUBSPOT_PROJECT_ACCESS_TOKEN
});

// This just works™
const contacts = await client.crm.contacts.basicApi.getPage();
```

**Step 4: Ask the user**

If you're uncertain about current API behavior, **ask the user** rather than relying on outdated training data.

---

## Part 8: Test Contacts and Verification

### Test Environment

**Test Contact (from Issue #189 verification):**
- Email: `emailmaria@hubspot.com`
- Contact ID: 1
- Purpose: End-to-end testing of progress tracking

**Environment Variables for Testing:**
```bash
# From CLAUDE.md
export HUBSPOT_TEST_USERNAME="emailmaria@hubspot.com"  # CRM contact
export HUBSPOT_TEST_PASSWORD="..."  # /learn page authentication
```

**Note:** These are for testing the /learn site authentication, NOT for HubSpot portal login.

### Verification Commands

**Check contact exists:**
```bash
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/emailmaria@hubspot.com?idProperty=email"
```

**Track a learning event:**
```bash
curl -X POST "https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/events/track" \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "learning_module_started",
    "contactIdentifier": {"email": "emailmaria@hubspot.com"},
    "payload": {"module_slug": "test-module"}
  }'
```

**Expected response:**
```json
{
  "status": "persisted",
  "mode": "authenticated",
  "backend": "properties"
}
```

**Verify contact updated:**
```bash
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/1?properties=hhl_progress_state,hhl_progress_updated_at"
```

---

## Part 9: Project Structure Reference

### Key Files

```
hh-learn/
├── hsproject.json                    # Project metadata (platformVersion: 2025.2)
├── src/
│   └── app/
│       └── app-hsmeta.json          # App config (auth.type: static, scopes)
├── src/shared/
│   └── hubspot.ts                   # HubSpot client initialization (token precedence)
├── serverless.yml                   # Lambda configuration (environment variables)
├── docs/
│   ├── project-app-oauth-integration.md  # Migration guide (OAuth = static tokens)
│   ├── issue-60-verification-guide.md    # Token verification steps
│   └── auth-and-progress.md         # Auth model summary
└── verification-output/
    ├── issue-189/                   # End-to-end Lambda deployment verification
    └── issue-188/                   # Launch runbook verification artifacts
```

### HubSpot CLI Commands

```bash
# Upload project to HubSpot
hs project upload

# Open project in browser
hs project open

# List project builds
hs project list-builds

# Get project info
hs project info --json
```

---

## Part 10: Production Evidence

### Live Application

**URL:** https://hedgehog.cloud/learn

**Status:** ✅ Fully operational (verified 2025-10-17)

**Infrastructure:**
- API Gateway: `https://hvoog2lnha.execute-api.us-west-2.amazonaws.com`
- Lambda Function: `hedgehog-learn-dev-api`
- HubSpot Account: 21430285
- Project: hedgehog-learn-dev (Build #16)

**Verified Endpoints:**
- ✅ POST `/events/track` - Beacon tracking (anonymous + authenticated)
- ✅ POST `/quiz/grade` - Quiz grading
- ✅ GET `/progress/read` - Progress retrieval

**Performance (from verification-output/issue-188/):**
- `/learn` landing: 588ms
- `/learn/modules`: 344ms
- `/events/track`: 762ms
- `/progress/read`: 135ms

### Verified Use Cases

1. **Anonymous Tracking:**
   ```json
   POST /events/track (no contactIdentifier)
   Response: {"status": "logged", "mode": "anonymous"}
   ```

2. **Authenticated Tracking:**
   ```json
   POST /events/track (with contactIdentifier)
   Response: {"status": "persisted", "mode": "authenticated", "contactId": "1"}
   ```

3. **Contact Property Updates:**
   - Before: `hhl_progress_state: null`
   - After: `hhl_progress_state: "{\"modules\":{...}}"`
   - Verified: 2025-10-17T17:49Z

---

## Part 11: Quick Reference

### Authentication TL;DR

```bash
# ✅ What you need
export HUBSPOT_PROJECT_ACCESS_TOKEN="pat-na1-..."

# ✅ How to use it
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts?limit=10"

# ❌ What you DON'T need
# - OAuth authorization URLs
# - Refresh token flows
# - Client ID/secret pairs
# - Redirect URIs
```

### Key Concepts

| Concept | Value |
|---------|-------|
| **Platform Type** | HubSpot Project Apps |
| **Platform Version** | 2025.2 |
| **Auth Type** | Static bearer tokens |
| **Token Variable** | `HUBSPOT_PROJECT_ACCESS_TOKEN` |
| **Token Format** | `pat-na1-...` (44 chars) |
| **Scopes File** | `src/app/app-hsmeta.json` |
| **API Version** | v3 (use `/crm/v3/...`) |
| **Node.js Client** | `@hubspot/api-client` |

### When to Search Web

**Search for updated docs when:**
- Working with API endpoints not covered in this guide
- Implementing new HubSpot features (workflows, custom objects, etc.)
- Encountering error codes not documented here
- Needing scope requirements for new APIs

**Search query template:**
```
"HubSpot Project Apps 2025" + [your feature]
site:developers.hubspot.com
```

---

## Part 12: Success Patterns

### Pattern 1: Token Verification

```bash
# Step 1: Test basic connectivity
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts?limit=1"

# Step 2: If 401, check token format
echo $HUBSPOT_PROJECT_ACCESS_TOKEN | wc -c  # Should be 44

# Step 3: Verify scopes in app-hsmeta.json
jq '.config.auth.requiredScopes' src/app/app-hsmeta.json
```

### Pattern 2: Contact Property Updates

```bash
# Step 1: Read current state
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/${EMAIL}?idProperty=email&properties=hhl_progress_state" \
  > before.json

# Step 2: Update property
curl -X PATCH \
  -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"properties":{"hhl_progress_state":"..."}}' \
  "https://api.hubapi.com/crm/v3/objects/contacts/${EMAIL}?idProperty=email"

# Step 3: Verify update
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/${EMAIL}?idProperty=email&properties=hhl_progress_state" \
  > after.json

# Step 4: Compare
diff before.json after.json
```

### Pattern 3: Lambda Testing

```bash
# Step 1: Deploy with token
export HUBSPOT_PROJECT_ACCESS_TOKEN="pat-na1-..."
npm run deploy:aws

# Step 2: Test anonymous mode
curl -X POST "https://YOUR-API-GW/events/track" \
  -d '{"eventName":"test","payload":{}}'

# Step 3: Test authenticated mode
curl -X POST "https://YOUR-API-GW/events/track" \
  -d '{"eventName":"test","contactIdentifier":{"email":"test@example.com"},"payload":{}}'

# Step 4: Verify contact updated
curl -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
  "https://api.hubapi.com/crm/v3/objects/contacts/test@example.com?idProperty=email"
```

---

## Conclusion

**Remember:**
1. **Trust working code** over training data
2. **Search current docs** when uncertain
3. **Test incrementally** with known-good endpoints
4. **Ask users** rather than guessing

**This application proves:**
- ✅ Project Apps work with external serverless (AWS Lambda)
- ✅ Static bearer tokens are reliable (no expiration issues)
- ✅ Contact property updates work consistently
- ✅ CRM API v3 is stable and well-documented

**Common pitfall avoided:**
> Don't conclude authentication is broken when the real issue is a missing resource or incorrect property name.

---

## References

**Internal Documentation:**
- `docs/project-app-oauth-integration.md` - Migration guide
- `docs/issue-60-verification-guide.md` - Verification procedures
- `docs/auth-and-progress.md` - Auth model details
- `ISSUE-60-STATUS.md` - Migration completion status

**Code Examples:**
- `src/shared/hubspot.ts:5-8` - Token precedence pattern
- `src/app/app-hsmeta.json` - Scope configuration
- `serverless.yml` - Lambda environment setup

**Verification Artifacts:**
- `verification-output/issue-189/` - Lambda deployment verification
- `verification-output/issue-188/` - Launch runbook verification

**HubSpot Official Docs:**
- Platform: https://developers.hubspot.com/docs/platform
- Project Apps: https://developers.hubspot.com/docs/platform/build-and-deploy-using-hubspot-projects
- CRM API v3: https://developers.hubspot.com/docs/api/crm/understanding-the-crm
- Scopes: https://developers.hubspot.com/scopes

---

**Document Version:** 1.0
**Last Updated:** 2025-10-18
**Verified Against:** Production deployment at hedgehog.cloud/learn
