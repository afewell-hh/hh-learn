# Issue #316 - Phase 6.4 Completion Guide

**Date:** 2026-01-19
**Status:** 95% Complete - Awaiting HubSpot Function Deployment
**Completed By:** Agent C + Agent A

---

## ✅ COMPLETED TASKS

### 1. Frontend Files Uploaded to HubSpot CMS (Agent C)

**Status:** ✅ DONE - All files in DRAFT

| File | Status | Purpose |
|------|--------|---------|
| cognito-auth-integration.js | ✅ DRAFT | Auth integration script |
| courses-page.html | ✅ DRAFT | Updated with auth script |
| pathways-page.html | ✅ DRAFT | Updated with auth script |
| module-page.html | ✅ DRAFT | Updated with auth script |
| my-learning.html | ✅ DRAFT | Updated with auth script |
| constants.json | ✅ DRAFT | Updated with auth endpoints |

**Total Files:** 32 files uploaded successfully

### 2. CORS Configuration Verified (Agent C)

**Status:** ✅ VERIFIED

- ✅ Allows hedgehog.cloud and www.hedgehog.cloud origins
- ✅ allowCredentials: true (required for httpOnly cookies)
- ✅ Correct headers and methods configured

### 3. Backend API Endpoints Verified (Agent C)

**Status:** ✅ VERIFIED

- ✅ `/auth/me` returns 401 when unauthenticated
- ✅ `/auth/login` returns 302 redirect to Cognito with PKCE
- ✅ API Gateway URL confirmed: https://hvoog2lnha.execute-api.us-west-2.amazonaws.com

### 4. HubSpot Serverless Functions Created (Agent A)

**Status:** ✅ CREATED - Ready to deploy

**Functions:**
- `auth-me.functions` - Proxies /auth/me requests
- `auth-login.functions` - Proxies /auth/login requests
- `auth-callback.functions` - Proxies /auth/callback requests
- `auth-logout.functions` - Proxies /auth/logout requests

**Location:** `hubspot-functions/auth-proxy/`

---

## ⏭️ REMAINING TASKS (30-60 Minutes)

### Task 1: Update HubSpot Access Token Scopes (15 min)

**Required:** Current token missing serverless function scopes

**Steps:**
1. Go to HubSpot Settings → Integrations → Private Apps
2. Find "hh [standard]" app (Account ID: 21430285)
3. Add scopes:
   - ✅ `functions`
   - ✅ `cms.functions.read`
   - ✅ `cms.functions.write`
4. Deactivate old token
5. Generate new token
6. Update `.env` file:
   ```bash
   HUBSPOT_PRIVATE_APP_TOKEN="new-token-here"
   ```
7. Re-authenticate hs CLI:
   ```bash
   hs auth
   ```

### Task 2: Deploy HubSpot Serverless Functions (15 min)

**Guide:** `hubspot-functions/auth-proxy/DEPLOYMENT.md`

**Commands:**
```bash
cd /home/ubuntu/afewell-hh/hh-learn

# Upload all auth proxy functions
hs upload hubspot-functions/auth-proxy/auth-me.functions auth-proxy/auth-me.functions
hs upload hubspot-functions/auth-proxy/auth-login.functions auth-proxy/auth-login.functions
hs upload hubspot-functions/auth-proxy/auth-callback.functions auth-proxy/auth-callback.functions
hs upload hubspot-functions/auth-proxy/auth-logout.functions auth-proxy/auth-logout.functions

# Verify deployment
hs functions list
```

### Task 3: Configure HubSpot Routes (10 min)

**Method:** Via HubSpot Portal

1. Go to **Marketing → Files and Templates → Design Tools**
2. Navigate to **Website Pages → Settings**
3. Find **URL Mappings** or **Custom Routes**
4. Add mappings:
   ```
   GET  /auth/me       → auth-proxy/auth-me.functions
   GET  /auth/login    → auth-proxy/auth-login.functions
   GET  /auth/callback → auth-proxy/auth-callback.functions
   GET  /auth/logout   → auth-proxy/auth-logout.functions
   POST /auth/logout   → auth-proxy/auth-logout.functions
   ```

### Task 4: Publish HubSpot Templates (10 min)

**Action:** Publish all DRAFT files

1. Go to **Design Tools → Files**
2. Find draft files:
   - cognito-auth-integration.js
   - All updated templates
   - constants.json
3. Click **"Publish"** for each file

### Task 5: Test API Proxy (5 min)

**Commands:**
```bash
# Should return 401 (not 404)
curl -i https://hedgehog.cloud/auth/me

# Should redirect to Cognito
curl -i https://hedgehog.cloud/auth/login
```

---

## 🧪 TESTING & VALIDATION (30-45 Minutes)

### Test 1: Playwright E2E Tests

**Expected:** All 13 tests PASS (previously 3 failed, 8 skipped)

```bash
cd /home/ubuntu/afewell-hh/hh-learn
npm run test:e2e -- tests/e2e/cognito-frontend-ux.spec.ts
```

**Expected Results:**
- ✅ Anonymous browsing (2 tests)
- ✅ Sign-in CTA (2 tests) - **Now should pass**
- ✅ Enrollment + Progress (3 tests) - **Now should pass**
- ✅ Logout flow (2 tests) - **Now should pass**
- ✅ Cookie handling (2 tests) - **Now should pass**
- ✅ API integration (2 tests) - **Now should pass**

### Test 2: API Smoke Tests

**Expected:** All 16 tests PASS (previously 14 failed)

```bash
npm run test:e2e -- tests/api/auth-me.spec.ts
```

### Test 3: Manual User Flow

**Steps:**
1. Open https://hedgehog.cloud/learn/courses/course-authoring-101
2. Verify "Sign in to enroll" CTA visible
3. Click CTA → redirects to Cognito
4. Login with test account:
   - Email: `afewell@gmail.com` (from .env)
   - Password: `Ar7far7!` (from .env)
5. Verify callback redirects to course page
6. Verify CTA changes to "Enroll" or "Enrolled"
7. Check browser cookies (DevTools → Application):
   - `hhl_access_token` present
   - Attributes: httpOnly, Secure, SameSite=Strict
8. Check Network tab:
   - `/auth/me` called
   - Status: 200 OK
   - Response: JSON with userId, email, displayName
9. Test logout
10. Verify cookies cleared

### Test 4: CRM Sync Verification

**Steps:**
1. Find test user in HubSpot CRM:
   ```bash
   curl -X POST https://api.hubapi.com/crm/v3/objects/contacts/search \
     -H "Authorization: Bearer $HUBSPOT_PRIVATE_APP_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "filterGroups": [{
         "filters": [{
           "propertyName": "email",
           "operator": "EQ",
           "value": "afewell@gmail.com"
         }]
       }],
       "properties": ["email", "first_enrollment_date", "total_enrollments"]
     }'
   ```

2. Enroll test user in a course via UI

3. Wait 5 minutes for async CRM sync

4. Re-query contact, verify:
   - `first_enrollment_date` is set
   - `total_enrollments` incremented
   - `last_activity_date` is recent

5. Check Lambda logs for CRM sync events:
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/hedgehog-learn-dev-api \
     --filter-pattern "CRM sync" \
     --region us-west-2
   ```

---

## ✅ SUCCESS CRITERIA

Issue #316 is COMPLETE when:

- ✅ All HubSpot serverless functions deployed
- ✅ Routes configured in HubSpot
- ✅ All templates published (not DRAFT)
- ✅ All 13 Playwright E2E tests PASS
- ✅ All 16 API smoke tests PASS
- ✅ Manual user flow works end-to-end
- ✅ CRM sync verified with test user
- ✅ No errors in CloudWatch logs
- ✅ All CloudWatch alarms still in OK state

---

## 📊 PROGRESS TRACKING

| Task | Status | Time Est. | Owner |
|------|--------|-----------|-------|
| Frontend files uploaded | ✅ DONE | - | Agent C |
| CORS verified | ✅ DONE | - | Agent C |
| Backend API verified | ✅ DONE | - | Agent C |
| Serverless functions created | ✅ DONE | - | Agent A |
| **Update HubSpot token scopes** | ⏭️ TODO | 15 min | User |
| **Deploy serverless functions** | ⏭️ TODO | 15 min | User/Agent |
| **Configure HubSpot routes** | ⏭️ TODO | 10 min | User |
| **Publish templates** | ⏭️ TODO | 10 min | User |
| **Test API proxy** | ⏭️ TODO | 5 min | Agent |
| **Run E2E tests** | ⏭️ TODO | 15 min | Agent |
| **Manual testing** | ⏭️ TODO | 15 min | User |
| **CRM sync verification** | ⏭️ TODO | 20 min | Agent |

**Total Remaining Time:** 30-60 minutes (excluding manual testing)

---

## 🚨 TROUBLESHOOTING

### If HubSpot Functions Don't Work

**Symptoms:**
- Functions deploy but routes return 404
- Set-Cookie headers not forwarded
- CORS errors

**Fallback Option:** API Gateway Custom Domain with Subdomain

See: `verification-output/issue-316/api-proxy-options.md` - Option 4

**Steps:**
1. Create ACM certificate for `api.hedgehog.cloud`
2. Create API Gateway custom domain
3. Update constants.json to use `api.hedgehog.cloud`
4. Update Lambda to set cookie domain to `.hedgehog.cloud`
5. Add CNAME: `api.hedgehog.cloud` → API Gateway

**Estimated Time:** 2-3 hours (requires DNS access)

---

## 📋 QUICK START CHECKLIST

**For User (HubSpot Portal Access):**
- [ ] Update HubSpot access token scopes
- [ ] Configure routes in HubSpot portal
- [ ] Publish all DRAFT templates

**For Agent (CLI Access):**
- [ ] Authenticate hs CLI with new token
- [ ] Deploy serverless functions
- [ ] Test API proxy routing
- [ ] Run Playwright E2E tests
- [ ] Verify CRM sync

---

## 📚 REFERENCE DOCUMENTS

| Document | Purpose | Location |
|----------|---------|----------|
| **DEPLOYMENT.md** | HubSpot Functions deployment guide | `hubspot-functions/auth-proxy/` |
| **api-proxy-options.md** | All proxy configuration options | `verification-output/issue-316/` |
| **Phase 6 Docs** | Frontend integration specs | `docs/issue-306-phase6-frontend-integration.md` |
| **Test Plan** | Testing strategy | `verification-output/issue-307/phase7-test-plan.md` |
| **Rollback Procedures** | Emergency recovery | `verification-output/issue-307/rollback-procedures.md` |

---

## 🎯 NEXT MILESTONES

### After Issue #316 Complete:

1. **Close Issues**
   - Close #316 (Phase 6.4)
   - Close #299 (Parent - External SSO)
   - Close #301-#306 (Phases 1-6)

2. **Announce Launch**
   - Email to team
   - Update documentation
   - Monitor CloudWatch for 24 hours

3. **Post-Launch Monitoring**
   - Review CloudWatch metrics daily
   - Analyze usage patterns
   - Optimize based on real data

---

**Completion Guide Version:** 1.0
**Last Updated:** 2026-01-19
**Next Update:** After HubSpot function deployment
