# Hedgehog Learn - Testing Guide

This directory contains automated tests for the Hedgehog Learn platform, including API tests, E2E (end-to-end) browser tests, and test helpers.

## Table of Contents

- [Test Structure](#test-structure)
- [Environment Setup](#environment-setup)
- [Authentication Helpers](#authentication-helpers)
- [Running Tests](#running-tests)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)

## Test Structure

```
tests/
├── api/                    # API-level tests using Playwright's request fixture
│   ├── membership-smoke.spec.ts
│   └── helpers/
│       └── hubspot-cleanup.ts
├── e2e/                    # End-to-end browser tests
│   ├── enrollment-flow.spec.ts
│   ├── auth.spec.ts
│   └── auth-redirect.spec.ts
└── helpers/                # Shared test utilities
    └── auth.ts             # Authentication helpers (native + JWT)
```

## Environment Setup

### Required Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Test user credentials
HUBSPOT_TEST_USERNAME=your-test-email@example.com    # Email of test contact in HubSpot CRM
HUBSPOT_TEST_EMAIL=your-test-email@example.com       # Alternative name for same variable
HUBSPOT_TEST_CONTACT_ID=123456                       # HubSpot contact ID for test user

# API endpoints
API_BASE_URL=https://hvoog2lnha.execute-api.us-west-2.amazonaws.com

# E2E test base URL
E2E_BASE_URL=https://hedgehog.cloud

# JWT authentication
JWT_SECRET=your-jwt-secret                           # Required for token generation (CI only)

# Course for testing
COURSE_SLUG=course-authoring-101                     # Course slug for enrollment tests
COURSE_URL=https://hedgehog.cloud/learn/courses/course-authoring-101
```

### GitHub Actions Secrets

For CI/CD, ensure these secrets are configured in GitHub repository settings:

- `HUBSPOT_TEST_USERNAME`
- `HUBSPOT_TEST_CONTACT_ID`
- `JWT_SECRET`

## Authentication Helpers

The `tests/helpers/auth.ts` module now supports **two** authentication paths:

1. **Native HubSpot membership login** – mirrors the production user experience
2. **JWT automation login** – reserved for headless automation against the Lambda test endpoint

Use membership login wherever possible so tests exercise the real flow; fall back to JWT only when a headless token is required (e.g., API smoke tests).

### Native Membership Login (Issue #272)

```typescript
import { loginViaMembership } from '../helpers/auth';

test('should log in like a learner', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('https://hedgehog.cloud/learn/courses/course-authoring-101');

  // Click CTA -> redirects to /_hcms/mem/login
  await page.getByRole('button', { name: /sign in/i }).click();

  await loginViaMembership(page, {
    email: process.env.HUBSPOT_TEST_EMAIL!,
    password: process.env.HUBSPOT_TEST_PASSWORD!,
    redirectPath: '/learn/courses/course-authoring-101?hs_no_cache=1'
  });

  // User is back on the course page with membership cookies
  await page.waitForFunction(() => (window as any).hhIdentity?.isAuthenticated?.() === true);
});
```

**Environment variables required**

- `HUBSPOT_TEST_EMAIL` (or `HUBSPOT_TEST_USERNAME`)
- `HUBSPOT_TEST_PASSWORD`
- `E2E_BASE_URL` (defaults to `https://hedgehog.cloud`)

### JWT Automation Helper (Issue #269)

The JWT helper is still available for automated scenarios that cannot drive the HubSpot login form (e.g., rapid API smoke tests, CI environments without credentials).

#### Quick Start

```typescript
import { authenticateViaJWT } from '../helpers/auth';

test('should access protected content', async ({ page }) => {
  // Authenticate user
  await authenticateViaJWT(page, {
    email: process.env.HUBSPOT_TEST_USERNAME!
  });

  // Navigate to protected page - user is now authenticated
  await page.goto('https://hedgehog.cloud/learn/my-learning');

  // Assertions...
});
```

#### Available Functions

##### `loginViaMembership(page, options)`

- Automates the HubSpot membership form (email + password)
- Returns once the browser is redirected back to the requested page
- Throws if credentials are missing

##### `authenticateViaJWT(page, options)`

Authenticates a user via the `/auth/login` JWT endpoint and sets up browser session.

**Parameters:**
- `page` (Page): Playwright page instance
- `options` (JWTAuthOptions):
  - `email` (string): Email address of user to authenticate
  - `apiBaseUrl` (string, optional): API base URL (defaults to `process.env.API_BASE_URL`)
  - `verifySession` (boolean, optional): Whether to verify session after login (default: false)

**Returns:** Promise<JWTAuthResult>

**Example:**
```typescript
const result = await authenticateViaJWT(page, {
  email: 'test@example.com',
  verifySession: true
});

console.log('Authenticated:', result.email, result.contactId);
```

#### `clearAuth(page)`

Clears authentication state from browser (removes JWT token and identity from localStorage).

**Example:**
```typescript
await clearAuth(page);
await page.reload();
// User is now anonymous
```

#### `isAuthenticated(page)`

Checks if a valid JWT token exists in localStorage.

**Returns:** Promise<boolean>

**Example:**
```typescript
const authed = await isAuthenticated(page);
expect(authed).toBe(true);
```

### How It Works

1. **Calls `/auth/login`**: Sends POST request with email to JWT authentication endpoint
2. **Stores JWT token**: Saves token in `localStorage` with 24-hour expiry
3. **Stores identity**: Caches user info for immediate use by `window.hhIdentity` API
4. **No page navigation**: All setup happens via API calls and localStorage injection

### Benefits

- ✅ **No CSRF issues**: Bypasses HubSpot membership form security
- ✅ **Fast**: No page navigation or form submission required
- ✅ **Reliable**: Direct API integration without UI dependencies
- ✅ **CI-friendly**: Works seamlessly in automated environments

## Running Tests

### Install Dependencies

```bash
npm install
npx playwright install
```

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# E2E tests only
npm run test:e2e

# API tests only
npm run test:api

# Specific test file
npx playwright test tests/e2e/enrollment-flow.spec.ts

# With UI mode (debug)
npx playwright test --ui

# In headed mode (see browser)
npx playwright test --headed
```

### Run Tests with Debug Output

```bash
# Enable debug logging
DEBUG=pw:api npm test

# With trace (for debugging failures)
npx playwright test --trace on
```

### Generate Test Report

```bash
npx playwright show-report
```

## Writing Tests

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';
import { authenticateViaJWT } from '../helpers/auth';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Setup: Authenticate if needed
    await authenticateViaJWT(page, {
      email: process.env.HUBSPOT_TEST_USERNAME!
    });

    // Navigate to page
    await page.goto('https://hedgehog.cloud/learn/...');

    // Interact with page
    const button = page.locator('#my-button');
    await button.click();

    // Assert results
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
```

### API Test Template

```typescript
import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL;

// Helper for JWT token
async function getJWTToken(request, email: string): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email }
  });
  const data = await response.json();
  return data.token;
}

test.describe('API Endpoint', () => {
  test('should handle authenticated request', async ({ request }) => {
    const token = await getJWTToken(request, process.env.HUBSPOT_TEST_USERNAME!);

    const response = await request.get(`${API_BASE_URL}/some/endpoint`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toBeDefined();
  });
});
```

### Best Practices

1. **Use environment variables**: Never hardcode emails, URLs, or secrets
2. **Clean up test data**: Use cleanup helpers from `tests/api/helpers/hubspot-cleanup.ts`
3. **Take screenshots**: Capture visual state for verification (store in `verification-output/`)
4. **Test both states**: Verify anonymous and authenticated flows
5. **Skip when missing env**: Use `test.skip()` when required env vars aren't set

```typescript
test('needs credentials', async ({ page }) => {
  const email = process.env.HUBSPOT_TEST_USERNAME;
  test.skip(!email, 'HUBSPOT_TEST_USERNAME not provided');

  // Test implementation...
});
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to `main` branch
- Manual workflow dispatch

### GitHub Actions Workflow

Tests are configured in `.github/workflows/test.yml` (or similar). The workflow:

1. Sets up Node.js and Playwright
2. Installs dependencies
3. Runs tests with environment variables from secrets
4. Uploads test reports and screenshots as artifacts
5. Comments results on pull requests

### Viewing Results

- **GitHub Actions**: Check the "Actions" tab in the repository
- **Test Reports**: Download artifacts from workflow runs
- **Screenshots**: Available in `verification-output/` directories within artifacts

## Troubleshooting

### Test Fails with "Authentication failed"

**Cause**: Invalid test user email or contact doesn't exist in HubSpot CRM

**Solution**:
1. Verify `HUBSPOT_TEST_USERNAME` is set correctly
2. Ensure contact exists in HubSpot CRM
3. Check JWT_SECRET is configured (CI only)

### Test Fails with "Token not found"

**Cause**: `authenticateViaJWT` not called before accessing protected pages

**Solution**: Add authentication helper before navigating:

```typescript
await authenticateViaJWT(page, { email: testEmail });
await page.goto('https://hedgehog.cloud/learn/my-learning');
```

### Tests Pass Locally but Fail in CI

**Cause**: Missing environment variables or secrets in GitHub Actions

**Solution**:
1. Check repository secrets in Settings > Secrets and variables > Actions
2. Verify secret names match environment variable names in workflow
3. Check workflow logs for missing variable warnings

### Browser Tests Timeout

**Cause**: Page taking too long to load or element not appearing

**Solution**:
1. Increase timeout: `await element.waitFor({ timeout: 30000 })`
2. Check network conditions in CI
3. Add explicit waits: `await page.waitForLoadState('networkidle')`

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [JWT Auth Implementation](../JWT-AUTH-ANALYSIS.md)
- [Auth and Progress Guide](../docs/auth-and-progress.md)
- [GitHub Issue #269 - Playwright JWT Login Helper](https://github.com/afewell/hh-learn/issues/269)
- [GitHub Issue #268 - Replace CTA Login Flow](https://github.com/afewell/hh-learn/issues/268)

## Questions or Issues?

If you encounter problems or have questions about testing:

1. Check existing test files for examples
2. Review documentation in `docs/` directory
3. Open a GitHub issue with test output and steps to reproduce
