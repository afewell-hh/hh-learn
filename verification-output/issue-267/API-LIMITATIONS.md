# Issue #267: API Limitations for Page Publishing

## What We Discovered

### Template Upload: ✅ Successful
The template file was successfully uploaded to HubSpot File Manager:
```bash
hs filemanager upload clean-x-hedgehog-templates/learn/auth-handshake.html \
  "CLEAN x HEDGEHOG/templates/learn/auth-handshake.html"
# Result: [SUCCESS]
```

### Page Creation/Publishing: ❌ API Limitations

#### Why API Approach Didn't Work

1. **Authentication Scope Issues:**
   - `HUBSPOT_PROJECT_ACCESS_TOKEN`: Lacks CMS Pages API scopes
   - `HUBSPOT_PERSONAL_ACCESS_KEY`: Authentication failed
   - `HUBSPOT_DEVELOPER_API_KEY`: Insufficient permissions

2. **Template vs Page:**
   - We uploaded a **template file** (the HTML/HubL source)
   - We need to create a **page instance** that uses this template
   - These are two different things in HubSpot

3. **CMS Pages API v3 Requirements:**
   - Endpoint: `POST /cms/v3/pages/site-pages`
   - Requires: OAuth token with `content` scope
   - Project Access Tokens don't have this scope by default

#### What the API Requires

From HubSpot documentation research:

**To Create a Page:**
```
POST https://api.hubapi.com/cms/v3/pages/site-pages
Authorization: Bearer {token_with_content_scope}
Content-Type: application/json

{
  "name": "Auth Handshake",
  "templatePath": "CLEAN x HEDGEHOG/templates/learn/auth-handshake.html",
  "state": "DRAFT",
  "slug": "auth-handshake",
  "domain": "hedgehog.cloud",
  ...
}
```

**To Publish a Page:**
```
POST https://api.hubapi.com/cms/v3/pages/site-pages/{pageId}/draft/push-live
Authorization: Bearer {token_with_content_scope}
```

## Recommended Solution: HubSpot UI

The most reliable way to create and publish the page is through the HubSpot UI:

### Step 1: Create Page from Template

1. **Go to Content:**
   - Marketing → Website → Website Pages

2. **Create New Page:**
   - Click "Create" → "Website Page"
   - When prompted, select "Use a template"

3. **Select Template:**
   - Navigate to: "CLEAN x HEDGEHOG" → "templates" → "learn"
   - Select: "auth-handshake.html"

4. **Configure Page:**
   - Page name: "Auth Handshake"
   - Page URL: `/learn/auth-handshake`
   - Page settings:
     - ✅ Require member registration
     - ✅ Private page (requires login)

5. **Publish:**
   - Click "Publish" button
   - Page will go live immediately

### Step 2: Verify Page is Live

```bash
curl -s "https://hedgehog.cloud/learn/auth-handshake" | grep "decodeURIComponent"
```

Should find the decoding logic in the page source.

## Alternative: Scope Configuration (Advanced)

If you want to use the API in the future:

1. **Update App Scopes:**
   - Go to: Developer Projects → hedgehog-learn-dev → App settings
   - Add scope: `content` (or `cms.pages.write`)
   - Redeploy app to get new token

2. **Use Updated Token:**
   ```bash
   # After adding scope
   hs project upload
   # New token will have content scope
   ```

3. **Create Page via API:**
   ```bash
   curl -X POST "https://api.hubapi.com/cms/v3/pages/site-pages" \
     -H "Authorization: Bearer ${HUBSPOT_PROJECT_ACCESS_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Auth Handshake",
       "templatePath": "CLEAN x HEDGEHOG/templates/learn/auth-handshake.html",
       "state": "DRAFT"
     }'
   ```

## Current Status

- [x] Template file uploaded to HubSpot
- [ ] Page created from template (requires UI or scope update)
- [ ] Page published to production (requires UI or scope update)

## Recommended Next Step

**Use the HubSpot UI to create and publish the page.** It's the fastest and most reliable method given current token limitations.

Once the page is published, continue with verification testing per `DEPLOYMENT-STATUS.md`.

---

**Decision:** Manual page creation via HubSpot UI is the pragmatic solution.
**Reason:** API requires OAuth scopes not currently available in project tokens.
**Time:** 2-3 minutes in HubSpot UI vs. potentially hours debugging OAuth scopes.
