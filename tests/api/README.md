# API-Level Membership Smoke Tests

**Issue:** [#248](https://github.com/afewell-hh/hh-learn/issues/248)
**Related:** [#247](https://github.com/afewell-hh/hh-learn/issues/247) (HubSpot membership automation research)

## Overview

This directory contains API-level smoke tests for membership-related flows. These tests exercise Lambda APIs directly without relying on HubSpot's membership UI login, which is blocked by CSRF protection in automated browsers.

### Why API Tests?

Based on comprehensive research (see Issue #247), HubSpot's membership login form has CSRF and anti-automation protection that blocks Playwright from successfully logging in. The research concluded:

- ❌ **HubSpot provides no official API** to bypass CSRF protection
- ❌ **No testing-specific membership APIs** exist
- ❌ **Cookie injection strategies** require initial login (blocked by CSRF)
- ✅ **API-level tests** work reliably without UI automation

This approach provides immediate automated regression coverage while UI login remains manual.

## Test Coverage

### `membership-smoke.spec.ts`

Comprehensive API smoke tests covering:

1. **Course Enrollment Flow**
   - Enroll in course via `/events/track`
   - Verify enrollment via `/enrollments/list`
   - Mark module as started
   - Mark module as completed
   - Verify progress via `/progress/read`

2. **Pathway Enrollment Flow**
   - Enroll in pathway
   - Verify pathway enrollment
   - Track pathway module progress

3. **Progress Aggregation**
   - Retrieve course completion statistics
   - Retrieve pathway completion statistics

4. **Anonymous vs Authenticated Behavior**
   - Anonymous events (no contactIdentifier)
   - Authenticated events (with email/contactId)

5. **Error Handling**
   - Invalid event payloads
   - Missing required fields
   - Invalid email formats

### Helper Utilities (`helpers/hubspot-cleanup.ts`)

Utilities for managing test data in HubSpot CRM:

- `resetContactProgress(email)` - Clear all progress for a contact
- `clearModuleProgress(email, moduleSlugs)` - Clear specific modules
- `deleteTestEnrollments(email, options)` - Remove test enrollments
- `getContactProgress(email)` - Inspect current progress state
- `ensureTestContact(email, properties)` - Create/update test contact

## Running Tests Locally

### Prerequisites

1. **Environment Variables** (create `.env` file):

```bash
# API Gateway URL (production)
API_BASE_URL=https://hvoog2lnha.execute-api.us-west-2.amazonaws.com

# Test contact credentials
HUBSPOT_TEST_EMAIL=your-test-contact@example.com
HUBSPOT_TEST_CONTACT_ID=12345  # Optional

# HubSpot API token (for cleanup helpers)
HUBSPOT_PROJECT_ACCESS_TOKEN=pat-na1-...  # Preferred
# OR
HUBSPOT_API_TOKEN=...
# OR
HUBSPOT_PRIVATE_APP_TOKEN=...
```

2. **Test Contact Setup**:
   - Ensure test contact exists in HubSpot CRM
   - Contact must have a valid email address
   - Contact should be part of the test environment

### Run All API Tests

```bash
npx playwright test tests/api/membership-smoke.spec.ts
```

### Run Specific Test Suite

```bash
# Course enrollment tests only
npx playwright test tests/api/membership-smoke.spec.ts -g "Course Enrollment"

# Pathway enrollment tests only
npx playwright test tests/api/membership-smoke.spec.ts -g "Pathway Enrollment"

# Error handling tests only
npx playwright test tests/api/membership-smoke.spec.ts -g "Error Handling"
```

### Run with Reporter Options

```bash
# List reporter (concise)
npx playwright test tests/api/membership-smoke.spec.ts --reporter=list

# HTML report (detailed, opens browser)
npx playwright test tests/api/membership-smoke.spec.ts --reporter=html

# JSON report (for CI/CD parsing)
npx playwright test tests/api/membership-smoke.spec.ts --reporter=json
```

### Debugging Failed Tests

```bash
# Run in headed mode
npx playwright test tests/api/membership-smoke.spec.ts --headed

# Run in debug mode (step through)
npx playwright test tests/api/membership-smoke.spec.ts --debug

# Run with trace (full network recording)
npx playwright test tests/api/membership-smoke.spec.ts --trace on
```

## CI/CD Integration

### GitHub Actions Workflow

The workflow `.github/workflows/api-smoke-tests.yml` runs:

- **On push to main**
- **On pull requests**
- **Nightly at 2 AM UTC**
- **Manual trigger** (workflow_dispatch)

### Required GitHub Secrets

Configure these secrets in **Settings → Secrets and variables → Actions**:

```bash
# Required
HUBSPOT_TEST_EMAIL         # Test contact email
HUBSPOT_PROJECT_ACCESS_TOKEN  # HubSpot API token

# Optional
HUBSPOT_TEST_CONTACT_ID    # Test contact ID (for faster lookups)
API_BASE_URL               # Override API Gateway URL (defaults to production)
HUBSPOT_API_TOKEN          # Alternative token
HUBSPOT_PRIVATE_APP_TOKEN  # Fallback token
```

### Workflow Jobs

1. **api-smoke-tests** - Runs full Playwright test suite
2. **verify-endpoints** - Quick health checks using curl

### Interpreting Results

**Success (✅):**
- All tests pass
- Green checkmark in GitHub UI
- No action required

**Failure (❌):**
- Check test results artifact
- Review GitHub Actions logs
- Common causes:
  - Lambda function not responding
  - HubSpot API token expired
  - Test contact not found
  - Required env vars not set

## Test Data Management

### Cleaning Up Test Data

Use the helper utilities to clean up test data between runs:

```typescript
import {
  resetContactProgress,
  clearModuleProgress,
  deleteTestEnrollments
} from './helpers/hubspot-cleanup';

// Reset all progress
await resetContactProgress('test@example.com');

// Clear specific modules
await clearModuleProgress('test@example.com', [
  'api-test-module-started',
  'api-test-module-completed'
]);

// Delete test enrollments
await deleteTestEnrollments('test@example.com', {
  courseSlugs: ['api-test-course'],
  pathwaySlugs: ['api-test-pathway']
});
```

### Best Practices

1. **Use unique slugs** - Prefix test slugs with `api-test-` to avoid conflicts
2. **Clean up after tests** - Use `test.afterAll()` to clean up test data
3. **Idempotent tests** - Tests should pass regardless of initial state
4. **Minimal side effects** - Avoid modifying non-test data

Example cleanup pattern:

```typescript
test.describe('My Test Suite', () => {
  const testEmail = process.env.HUBSPOT_TEST_EMAIL!;

  test.afterAll(async () => {
    // Clean up test data
    await deleteTestEnrollments(testEmail, {
      courseSlugs: ['my-test-course'],
    });
  });

  test('my test', async ({ request }) => {
    // Test implementation
  });
});
```

## Troubleshooting

### Test Contact Not Found

**Error:** `Contact not found for email: test@example.com`

**Solution:**
1. Verify contact exists in HubSpot CRM
2. Check `HUBSPOT_TEST_EMAIL` environment variable
3. Create contact if needed:
   ```typescript
   import { ensureTestContact } from './helpers/hubspot-cleanup';
   await ensureTestContact('test@example.com', {
     firstname: 'Test',
     lastname: 'User',
   });
   ```

### API Token Errors

**Error:** `No HubSpot access token available`

**Solution:**
1. Set one of the token environment variables
2. Verify token is valid (not expired)
3. Check token has required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `behavioral_events.send.write`

### Lambda Function Not Responding

**Error:** `fetch failed` or timeout errors

**Solution:**
1. Verify API Gateway URL is correct
2. Check Lambda function is deployed:
   ```bash
   aws lambda get-function --function-name hedgehog-learn-dev-api
   ```
3. Check Lambda logs:
   ```bash
   aws logs tail /aws/lambda/hedgehog-learn-dev-api --follow
   ```

### Validation Errors

**Error:** `SCHEMA_VALIDATION_FAILED`

**Solution:**
1. Check error `details` array in response
2. Verify event-specific required fields
3. Ensure email format is valid
4. Check payload size is under 10KB

Example debugging:

```typescript
const response = await request.post(`${API_BASE_URL}/events/track`, {
  data: invalidPayload,
});

const data = await response.json();
console.log('Validation errors:', data.details);
// ["payload.module_slug: Required"]
```

## Related Documentation

- [Issue #248](https://github.com/afewell-hh/hh-learn/issues/248) - Implementation task
- [Issue #247](https://github.com/afewell-hh/hh-learn/issues/247) - Research findings
- [Issue #242](https://github.com/afewell-hh/hh-learn/issues/242) - Future alternative auth
- [`docs/auth-and-progress.md`](../../docs/auth-and-progress.md) - Auth model overview
- [`docs/hubspot-project-apps-agent-guide.md`](../../docs/hubspot-project-apps-agent-guide.md) - HubSpot API patterns

## Future Enhancements

### Short-Term (Next Sprint)

- [ ] Add tests for `/progress/aggregate` edge cases
- [ ] Add tests for quiz grading flow
- [ ] Add performance benchmarks (response time assertions)
- [ ] Add retry logic for flaky network conditions

### Long-Term (v0.4+)

- [ ] Implement Issue #242 (alternative auth for testing)
- [ ] Migrate to alternative auth once available
- [ ] Add UI tests for authenticated flows
- [ ] Integrate with monitoring/alerting systems

## Contributing

When adding new API tests:

1. **Follow naming conventions** - Use descriptive test names
2. **Add cleanup logic** - Clean up test data in `afterAll()`
3. **Test both success and failure** - Cover happy path and errors
4. **Document edge cases** - Add comments for non-obvious behavior
5. **Update this README** - Document new test coverage

Example test structure:

```typescript
test.describe('My New Feature', () => {
  const testEmail = process.env.HUBSPOT_TEST_EMAIL!;

  test.afterAll(async () => {
    // Clean up test data
  });

  test('should handle happy path', async ({ request }) => {
    // Test implementation
  });

  test('should handle error case', async ({ request }) => {
    // Test implementation
  });
});
```

---

**Last Updated:** 2025-10-26
**Status:** Production-ready ✅
