## Phase 6.4: Frontend CMS Deployment + API Proxy Configuration

### Objective
Complete the frontend integration for External SSO by deploying authentication JavaScript to HubSpot CMS and configuring API routing. This unblocks full E2E testing and enables production launch.

### Context
- **Parent Issue:** #299 - External SSO + Progress Store
- **Prerequisite:** Phase 7 (#307) - Backend validated and production-ready
- **Blocks:** Full production launch of authentication features
- **Reference:** `docs/issue-306-phase6-frontend-integration.md` (lines 259-273)

### Backend Status ✅
- Lambda API deployed and tested
- DynamoDB tables configured
- Cognito OAuth configured
- CloudWatch monitoring operational
- API Gateway endpoint: `https://hvoog2lnha.execute-api.us-west-2.amazonaws.com`

### Tasks

#### 1. Upload Cognito Auth Integration Script to HubSpot CMS

**File:** `clean-x-hedgehog-templates/assets/js/cognito-auth-integration.js`

**Actions:**
- [ ] Verify script exists at path above
- [ ] Test script locally (if possible)
- [ ] Upload to HubSpot CMS path: `/learn/assets/js/cognito-auth-integration.js`
- [ ] Verify file is accessible via URL: `https://hedgehog.cloud/learn/assets/js/cognito-auth-integration.js`

**Command:**
```bash
hs upload clean-x-hedgehog-templates/assets/js/cognito-auth-integration.js \
  /learn/assets/js/cognito-auth-integration.js
```

**Estimated Time:** 15 minutes

---

#### 2. Update HubSpot Templates

**Actions:**
- [ ] Identify templates that need auth script (course pages, pathway pages, catalog)
- [ ] Add script tag to templates:
  ```html
  <script src="/learn/assets/js/cognito-auth-integration.js"></script>
  ```
- [ ] Ensure script loads **before** enrollment/progress scripts
- [ ] Test template rendering in HubSpot preview

**Command:**
```bash
npm run publish:template
```

**Estimated Time:** 30 minutes

---

#### 3. Update constants.json with Auth Endpoint URLs

**File:** `clean-x-hedgehog-templates/config/constants.json`

**Required Updates:**
```json
{
  "AUTH_ME_URL": "https://hedgehog.cloud/auth/me",
  "AUTH_LOGIN_URL": "https://hedgehog.cloud/auth/login",
  "AUTH_LOGOUT_URL": "https://hedgehog.cloud/auth/logout",
  "AUTH_CALLBACK_URL": "https://hedgehog.cloud/auth/callback"
}
```

**Actions:**
- [ ] Update local `constants.json`
- [ ] Upload to HubSpot CMS
- [ ] Verify constants accessible

**Command:**
```bash
npm run provision:constants
```

**Estimated Time:** 15 minutes

---

#### 4. Configure API Proxy (Critical)

**Objective:** Route `hedgehog.cloud/auth/*` requests to API Gateway

**Option A: CloudFront Distribution (Recommended)**

- [ ] Create CloudFront distribution
  - **Origin:** `hvoog2lnha.execute-api.us-west-2.amazonaws.com`
  - **Alternate Domain:** `api.hedgehog.cloud` (or use main domain with path routing)
  - **SSL Certificate:** `*.hedgehog.cloud` (via AWS ACM)
  - **Cache Policy:** Disabled for `/auth/*` paths

- [ ] Configure origin request policy
  - Forward all headers: ✅ YES
  - Forward cookies: ✅ YES (required for auth)
  - Forward query strings: ✅ YES

- [ ] Update DNS (Route 53)
  ```
  hedgehog.cloud A → CloudFront distribution
  OR
  api.hedgehog.cloud CNAME → CloudFront distribution
  ```

- [ ] Test proxy routing
  ```bash
  curl -i https://hedgehog.cloud/auth/login
  # Expected: 302 redirect to Cognito
  ```

**Option B: HubSpot Proxy (If Available)**

- [ ] Configure HubSpot proxy rules in HubSpot settings
  - **Rule:** `/auth/*` → `https://hvoog2lnha.execute-api.us-west-2.amazonaws.com/auth/*`
  - **Forward cookies:** ✅ YES
  - **HTTPS only:** ✅ YES

- [ ] Test proxy with curl

**Estimated Time:** 45-60 minutes (CloudFront), 20-30 minutes (HubSpot)

---

#### 5. CORS Configuration Verification

**Actions:**
- [ ] Verify `serverless.yml` allows `hedgehog.cloud` origin
  ```yaml
  httpApi:
    cors:
      allowedOrigins:
        - 'https://hedgehog.cloud'
        - 'https://www.hedgehog.cloud'
  ```

- [ ] Verify `allowCredentials: true` (required for cookies)

- [ ] Test CORS headers
  ```bash
  curl -i https://hedgehog.cloud/auth/me \
    -H "Origin: https://hedgehog.cloud"

  # Check for:
  # access-control-allow-origin: https://hedgehog.cloud
  # access-control-allow-credentials: true
  ```

**Estimated Time:** 15 minutes

---

#### 6. End-to-End Testing

**Actions:**
- [ ] Run Playwright E2E suite
  ```bash
  npm run test:e2e -- tests/e2e/cognito-frontend-ux.spec.ts
  ```
  - **Expected:** All 13 tests PASS

- [ ] Run API smoke tests
  ```bash
  npm run test:e2e -- tests/api/auth-me.spec.ts
  ```
  - **Expected:** All 16 tests PASS

- [ ] Manual testing checklist:
  - [ ] Open course page as anonymous user
  - [ ] Verify "Sign in to enroll" CTA visible
  - [ ] Click CTA → redirects to Cognito
  - [ ] Complete login with test account
  - [ ] Verify redirect back to course page
  - [ ] Verify CTA changes to "Enroll" or "Enrolled"
  - [ ] Check cookies in DevTools (httpOnly, Secure, SameSite=Strict)
  - [ ] Verify `/auth/me` call in Network tab (200 OK)
  - [ ] Test logout → cookies cleared

**Estimated Time:** 45-60 minutes

---

#### 7. CRM Sync Verification

**Actions:**
- [ ] Find test user contact in HubSpot CRM by email
- [ ] Enroll test user in a course via UI
- [ ] Wait 5 minutes for async CRM sync
- [ ] Verify CRM properties updated:
  - `first_enrollment_date` set
  - `total_enrollments` incremented
  - `last_activity_date` recent

- [ ] Check Lambda logs for CRM sync events
  ```bash
  aws logs filter-log-events \
    --log-group-name /aws/lambda/hedgehog-learn-dev-api \
    --filter-pattern "CRM sync" \
    --region us-west-2
  ```

**Estimated Time:** 20 minutes

---

### Acceptance Criteria

- ✅ `cognito-auth-integration.js` deployed to HubSpot CMS
- ✅ Templates updated to load auth script
- ✅ `constants.json` updated with auth endpoint URLs
- ✅ API proxy configured and routing correctly
- ✅ CORS headers verified
- ✅ All Playwright E2E tests passing (13/13)
- ✅ All API smoke tests passing (16/16)
- ✅ Manual testing checklist complete
- ✅ CRM sync verified with test user

### Estimated Total Effort

**Optimistic:** 3-4 hours
**Realistic:** 5-6 hours
**Pessimistic:** 8-10 hours (if proxy configuration has issues)

### Blockers & Risks

**Potential Blockers:**
- CloudFront distribution setup requires DNS changes (propagation time)
- HubSpot proxy may not support cookie forwarding
- CORS issues with production domain

**Mitigation:**
- Test proxy locally with ngrok or similar before DNS changes
- Have rollback plan ready (see `rollback-procedures.md`)
- Monitor CloudWatch alarms during testing

### Definition of Done

- All tasks completed and verified
- All tests passing
- Documentation updated
- Issue #307 marked as complete
- Ready for production rollout

### Next Steps After Completion

1. Re-run Phase 7 verification with frontend integrated
2. Execute production rollout checklist
3. Monitor CloudWatch alarms for 24 hours
4. Close all related issues (#299, #301-#307)
5. Celebrate! 🎉

---

### References

- **Phase 6 Documentation:** `docs/issue-306-phase6-frontend-integration.md`
- **Test Plan:** `verification-output/issue-307/phase7-test-plan.md`
- **Rollout Checklist:** `verification-output/issue-307/rollout-checklist.md`
- **Rollback Procedures:** `verification-output/issue-307/rollback-procedures.md`

---

### Labels

- `phase-6`
- `frontend`
- `deployment`
- `external-sso`
- `high-priority`

### Assignee

(Assign to frontend developer or Agent C if pairing)
