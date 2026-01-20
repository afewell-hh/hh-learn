# API Proxy Configuration Options for Issue #316

**Date:** 2026-01-19
**Challenge:** Route `https://hedgehog.cloud/auth/*` to API Gateway `https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/*`
**Requirement:** Must support httpOnly cookies (requires same-origin or proper CORS + credentials)

---

## Current Situation

**Frontend:** Hosted on HubSpot CMS at `hedgehog.cloud`
- DNS points to HubSpot IPs: 199.60.103.86, 199.60.103.186
- No Route 53 hosted zone in current AWS account
- DNS likely managed by HubSpot or external registrar

**Backend API:** API Gateway at `https://hvoog2lnha.execute-api.us-west-2.amazonaws.com`
- All endpoints functional and tested
- CORS configured for hedgehog.cloud origin
- Cookies must be httpOnly for security

**Problem:** Cookies won't work across different domains due to browser security (SameSite policy)

---

## Option 1: HubSpot Serverless Functions (RECOMMENDED FOR MVP)

**Approach:** Create proxy functions in HubSpot that forward requests to API Gateway

### Advantages ✅
- No DNS changes required
- No additional AWS infrastructure
- Works within HubSpot ecosystem
- Fast to implement if HubSpot supports it

### Implementation Steps

1. **Check if HubSpot supports serverless functions**
   ```bash
   hs functions list  # Check if functions are available
   ```

2. **Create proxy function for each auth endpoint**
   ```javascript
   // hubspot-functions/auth-me-proxy.js
   exports.main = async (context, sendResponse) => {
     const response = await fetch(
       'https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/me',
       {
         headers: {
           'Cookie': context.headers.cookie || ''
         }
       }
     );

     sendResponse({
       statusCode: response.status,
       headers: response.headers,
       body: await response.text()
     });
   };
   ```

3. **Map HubSpot routes**
   - `/auth/me` → auth-me-proxy function
   - `/auth/login` → auth-login-proxy function
   - `/auth/callback` → auth-callback-proxy function
   - `/auth/logout` → auth-logout-proxy function

### Limitations ⚠️
- Depends on HubSpot serverless function support
- May have cold start latency
- Need to check HubSpot's function capabilities

---

## Option 2: HubSpot Website Settings Proxy Rules

**Approach:** Use HubSpot's content settings to proxy specific paths

### Advantages ✅
- No coding required
- No DNS changes
- Built into HubSpot platform

### Implementation Steps

1. **Go to HubSpot Settings → Website → URL Redirects**

2. **Add redirect rules**
   ```
   /auth/me → https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/me (Proxy)
   /auth/login → https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/login (Proxy)
   /auth/callback → https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/callback (Proxy)
   /auth/logout → https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/logout (Proxy)
   ```

3. **Ensure "Forward Cookies" is enabled**

### Limitations ⚠️
- Depends on HubSpot supporting proxy (not just redirects)
- May not forward all headers correctly
- Need to verify HubSpot supports this

---

## Option 3: API Gateway Custom Domain (Requires DNS Access)

**Approach:** Create custom domain in API Gateway, update DNS

### Advantages ✅
- Professional solution
- Full control over routing
- AWS-native solution
- Best performance

### Implementation Steps

1. **Request ACM certificate for hedgehog.cloud**
   ```bash
   aws acm request-certificate \
     --domain-name hedgehog.cloud \
     --subject-alternative-names "*.hedgehog.cloud" \
     --validation-method DNS \
     --region us-west-2
   ```

2. **Create API Gateway custom domain**
   ```bash
   aws apigatewayv2 create-domain-name \
     --domain-name hedgehog.cloud \
     --domain-name-configurations CertificateArn=<ACM_ARN>
   ```

3. **Map /auth/* paths to API**
   ```bash
   aws apigatewayv2 create-api-mapping \
     --domain-name hedgehog.cloud \
     --api-id hvoog2lnha \
     --stage $default \
     --api-mapping-key auth
   ```

4. **Update DNS** (wherever it's hosted)
   - Add CNAME: `hedgehog.cloud` → `<api-gateway-domain-name>`
   - OR use API Gateway's A record

### Limitations ⚠️
- **Requires DNS access** (currently not in AWS account)
- DNS propagation time (up to 24 hours)
- Requires updating all hedgehog.cloud DNS
- May break existing HubSpot site routing

---

## Option 4: Subdomain Approach with api.hedgehog.cloud

**Approach:** Use a subdomain for the API, update constants.json

### Advantages ✅
- Doesn't interfere with main site
- Simpler DNS setup (just CNAME)
- Clear separation of concerns

### Implementation Steps

1. **Create ACM certificate for api.hedgehog.cloud**
   ```bash
   aws acm request-certificate \
     --domain-name api.hedgehog.cloud \
     --validation-method DNS \
     --region us-west-2
   ```

2. **Create custom domain in API Gateway**
   ```bash
   aws apigatewayv2 create-domain-name \
     --domain-name api.hedgehog.cloud \
     --domain-name-configurations CertificateArn=<ACM_ARN>
   ```

3. **Update constants.json**
   ```json
   {
     "AUTH_ME_URL": "https://api.hedgehog.cloud/auth/me",
     "AUTH_LOGIN_URL": "https://api.hedgehog.cloud/auth/login",
     "AUTH_LOGOUT_URL": "https://api.hedgehog.cloud/auth/logout"
   }
   ```

4. **Add CNAME record** (wherever DNS is hosted)
   ```
   api.hedgehog.cloud CNAME <api-gateway-domain-name>
   ```

5. **Update cookie domain in Lambda**
   ```javascript
   // Set cookie domain to .hedgehog.cloud (works for both hedgehog.cloud and api.hedgehog.cloud)
   res.cookie('hhl_access_token', token, {
     domain: '.hedgehog.cloud',
     ...
   });
   ```

### Limitations ⚠️
- Still requires DNS access for CNAME
- Need to update Lambda code to set cookie domain
- CORS may need adjustment

---

## Option 5: CloudFront Distribution (Most Complex)

**Approach:** Put CloudFront in front of entire hedgehog.cloud site

### Advantages ✅
- Complete control
- Can cache static content
- Professional CDN setup
- Best performance globally

### Implementation Steps

1. **Create CloudFront distribution**
   - Origin 1: HubSpot (for main site)
   - Origin 2: API Gateway (for /auth/*)

2. **Configure behaviors**
   - Path pattern: `/auth/*` → API Gateway origin
   - Path pattern: `/*` → HubSpot origin

3. **Update DNS**
   - Point hedgehog.cloud to CloudFront distribution

### Limitations ⚠️
- Most complex option
- Requires DNS migration
- Need to manage CloudFront cache invalidation
- Potential for breaking existing site

---

## RECOMMENDATION: Hybrid Approach

**For MVP Launch:**

### Step 1: Try HubSpot Proxy Rules (Option 2) FIRST
- Check HubSpot settings for URL redirect/proxy capabilities
- If available, configure proxy rules for /auth/* paths
- **Zero coding, zero DNS changes**

### Step 2: If HubSpot Proxy Not Available, Use Subdomain (Option 4)
- Create `api.hedgehog.cloud` custom domain in API Gateway
- Request DNS access to add CNAME record
- Update constants.json to use `api.hedgehog.cloud`
- Update Lambda to set cookie domain to `.hedgehog.cloud`

### Step 3: Future Migration to Option 3 (Custom Domain)
- Once DNS access is available
- Migrate to full custom domain setup
- Keep subdomain as fallback

---

## Immediate Next Steps

### 1. Check HubSpot Proxy Capabilities

**Action Required:** Log into HubSpot portal and check:

1. Go to **Settings → Website → URL Redirects**
2. Check if "Proxy" option is available (not just "Redirect")
3. Look for any "Serverless Functions" or "Custom Routes" features

**If Proxy Available:**
- Configure proxy rules for `/auth/*` paths
- **This is the fastest path to production!**

### 2. Request DNS Access (If Needed)

**If HubSpot proxy NOT available:**
- Identify who manages hedgehog.cloud DNS
- Request access to add CNAME for `api.hedgehog.cloud`
- Proceed with Option 4 (subdomain approach)

### 3. Update Lambda Code (For Subdomain Approach)

**File:** `src/api/lambda/auth-handlers.ts`

```typescript
// Update cookie settings to work with subdomain
const setCookie = (res, name, value) => {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    domain: '.hedgehog.cloud',  // ← Add this
    maxAge: /* ... */
  });
};
```

---

## Decision Matrix

| Option | DNS Access Required | Code Changes | Time to Deploy | Complexity |
|--------|-------------------|--------------|----------------|------------|
| HubSpot Proxy (Option 2) | ❌ No | ❌ None | 30 min | ⭐ Easy |
| Subdomain (Option 4) | ✅ CNAME only | ⚠️ Minor (cookie domain) | 2-3 hours | ⭐⭐ Medium |
| Custom Domain (Option 3) | ✅ Full DNS | ❌ None | 4-6 hours | ⭐⭐⭐ Complex |
| CloudFront (Option 5) | ✅ Full DNS | ❌ None | 6-8 hours | ⭐⭐⭐⭐ Very Complex |

---

## Testing After Proxy Setup

Once proxy is configured, test:

```bash
# Should return 401 (not 404)
curl -i https://hedgehog.cloud/auth/me

# Should redirect to Cognito
curl -i https://hedgehog.cloud/auth/login

# Verify cookies work
# (requires browser test after full integration)
```

---

## Questions to Answer

1. **Does HubSpot support proxy rules for /auth/* paths?**
   - Check: Settings → Website → URL Redirects
   - Look for: "Proxy" option

2. **Who manages hedgehog.cloud DNS?**
   - HubSpot?
   - External registrar (GoDaddy, Cloudflare, etc.)?
   - Can we get access to add CNAME record?

3. **Is there a test/staging environment?**
   - Can we test subdomain approach first?

---

**Prepared By:** Agent A (Project Lead)
**Date:** 2026-01-19
**Status:** Awaiting decision on proxy approach
