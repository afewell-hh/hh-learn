# Quick Start: JWT Authentication Testing

**Last Updated**: 2025-10-26
**Issue**: #253
**Status**: Ready for Testing

---

## Prerequisites

1. Valid HubSpot CRM contact email
2. JWT_SECRET from AWS SSM Parameter Store (matches Lambda environment)
3. Node.js and npm installed
4. Playwright installed (`npm install`)

---

## Setup (1 minute)

### Option 1: Environment Variables

```bash
export HUBSPOT_TEST_USERNAME="your-test-contact@example.com"
export JWT_SECRET="your-jwt-secret-from-ssm"
```

### Option 2: .env File

Create/update `.env` file in project root:

```bash
HUBSPOT_TEST_USERNAME=your-test-contact@example.com
JWT_SECRET=your-jwt-secret-from-ssm
API_BASE_URL=https://hvoog2lnha.execute-api.us-west-2.amazonaws.com
```

---

## Run Tests (30 seconds)

### Quick Test (API Only)

```bash
npx playwright test tests/api/membership-smoke.spec.ts -g "JWT Authentication"
```

**Expected**: 3/3 tests pass in ~5 seconds

### Full API Suite

```bash
npx playwright test tests/api/membership-smoke.spec.ts
```

**Expected**: 15/15 tests pass in ~30 seconds

### E2E Test (Browser)

```bash
npx playwright test tests/e2e/enrollment-flow.spec.ts
```

**Expected**: 1/1 test passes in ~15 seconds

### All Tests

```bash
npx playwright test tests/api/membership-smoke.spec.ts tests/e2e/enrollment-flow.spec.ts
```

**Expected**: 16/16 tests pass in ~45 seconds

---

## View Results

### Screenshots (E2E only)

```bash
ls -lh verification-output/issue-242/*.png
```

Files:
- `1-anonymous-state.png` - Before JWT login
- `2-authenticated-via-jwt.png` - After JWT login
- `3-post-enrollment.png` - After enrollment
- `4-my-learning.png` - My Learning page

### Test Reports

```bash
cat verification-output/issue-242/e2e-test-report.json | jq .
```

### Playwright HTML Report

```bash
npx playwright show-report
```

---

## Troubleshooting

### "TEST_EMAIL is required"

**Cause**: `HUBSPOT_TEST_USERNAME` not set

**Fix**:
```bash
export HUBSPOT_TEST_USERNAME="test@example.com"
```

### "JWT_SECRET environment variable not configured"

**Cause**: JWT_SECRET not set or doesn't match Lambda

**Fix**:
```bash
# Get from AWS SSM
aws ssm get-parameter --name /hhl/jwt-secret --with-decryption --query Parameter.Value --output text

# Set in environment
export JWT_SECRET="<value-from-ssm>"
```

### "Contact not found" (404)

**Cause**: Email doesn't exist in HubSpot CRM

**Fix**: Use a valid contact email from your CRM

### "Invalid token signature"

**Cause**: JWT_SECRET doesn't match Lambda environment

**Fix**: Verify JWT_SECRET matches exactly (no extra spaces/newlines)

---

## Test What?

### API Tests Verify

✅ `/auth/login` returns valid JWT token
✅ JWT token includes contactId and email
✅ Invalid emails are rejected (400)
✅ Non-existent emails are rejected (404)
✅ Course enrollment with JWT auth
✅ Module progress tracking with JWT auth
✅ Pathway enrollment with JWT auth
✅ Progress aggregation with JWT auth
✅ Anonymous events work without JWT
✅ Authenticated events require JWT or contactIdentifier
✅ Invalid event payloads return 400
✅ Missing JWT returns 400 for protected endpoints
✅ Invalid JWT falls back to anonymous

### E2E Test Verifies

✅ Anonymous user sees "Sign in to start course"
✅ JWT login succeeds via `/auth/login`
✅ JWT token stored in localStorage
✅ Identity resolved from JWT on page load
✅ CTA updates from "Sign in" to "Start Course"
✅ User can enroll in course
✅ Enrollment persists to CRM
✅ Enrolled course appears on My Learning page

---

## Success Criteria

All tests pass:
```
  ✓ 15 API tests passed
  ✓ 1 E2E test passed

  Total: 16 tests (16 passed, 0 failed, 0 skipped)
```

Artifacts generated:
```
verification-output/issue-242/
├── 1-anonymous-state.png
├── 2-authenticated-via-jwt.png
├── 3-post-enrollment.png
├── 4-my-learning.png
└── e2e-test-report.json
```

---

## Next Steps

1. ✅ Run tests locally
2. ✅ Verify all pass
3. ✅ Review screenshots/reports
4. ✅ Upload artifacts to Issue #253
5. ✅ Configure GitHub Actions with secrets
6. ✅ Run tests in CI/CD pipeline

---

## References

- Full Summary: `PHASE-3-TEST-UPDATES-SUMMARY.md`
- Implementation Plan: `docs/implementation-plan-issue-242.md`
- Auth Documentation: `docs/auth-and-progress.md`
- Issue #253: https://github.com/afewell-hh/hh-learn/issues/253
