# Issue #269 - Add Playwright JWT Login Helper

## Implementation Summary

**Status**: ✅ COMPLETE
**Date**: 2025-10-27
**Related Issues**: #251 (JWT Auth), #268 (CTA Login Flow), #247 (JWT Automation Recommendation)

## Overview

Created a centralized Playwright authentication helper that uses the `/auth/login` JWT endpoint to set up authenticated browser sessions without navigating HubSpot's membership form. This enables reliable automated testing of signed-in flows without CSRF protection issues.

## Changes Made

### 1. New Test Helper Module

**File**: `tests/helpers/auth.ts` (184 lines)

**Exports**:
- `authenticateViaJWT(page, options)` - Main authentication function
- `clearAuth(page)` - Clear authentication state
- `isAuthenticated(page)` - Check if session is authenticated

**Features**:
- TypeScript interfaces for type safety (`JWTAuthOptions`, `JWTAuthResult`)
- Comprehensive JSDoc documentation with examples
- Optional session verification support (for future `/auth/session` endpoint)
- Error handling with descriptive messages
- Environment variable support for API base URL

### 2. Updated E2E Tests

**File**: `tests/e2e/enrollment-flow.spec.ts`

**Changes**:
- Replaced inline `authenticateViaJWT` implementation with centralized helper
- Updated import to use `import { authenticateViaJWT } from '../helpers/auth'`
- Updated function call to use options object: `authenticateViaJWT(page, { email: testEmail })`
- Removed duplicate helper code (saved ~40 lines)

### 3. Comprehensive Test Documentation

**File**: `tests/README.md` (350+ lines)

**Sections**:
- Test structure overview
- Environment setup guide
- Authentication helper documentation with examples
- Running tests instructions
- Writing tests templates and best practices
- CI/CD integration notes
- Troubleshooting guide

## Implementation Details

### Authentication Flow

1. **API Call**: Sends POST to `/auth/login` with email
2. **Token Storage**: Saves JWT token in localStorage with 24h expiry
3. **Identity Caching**: Stores user info for immediate use by client-side code
4. **No Navigation**: All setup via API calls and localStorage injection

### Helper API

#### `authenticateViaJWT(page, options)`

**Parameters**:
```typescript
{
  email: string;           // Required: User email
  apiBaseUrl?: string;     // Optional: Defaults to process.env.API_BASE_URL
  verifySession?: boolean; // Optional: Verify session after login
}
```

**Returns**:
```typescript
{
  token: string;
  email: string;
  contactId: string;
  firstname?: string;
  lastname?: string;
}
```

**Example**:
```typescript
await authenticateViaJWT(page, {
  email: process.env.HUBSPOT_TEST_USERNAME!
});
await page.goto('https://hedgehog.cloud/learn/my-learning');
// User is now authenticated
```

#### `clearAuth(page)`

Removes JWT token and identity from localStorage.

**Example**:
```typescript
await clearAuth(page);
await page.reload();
// User is now anonymous
```

#### `isAuthenticated(page)`

Checks if valid JWT token exists (client-side check only).

**Returns**: `Promise<boolean>`

**Example**:
```typescript
const authed = await isAuthenticated(page);
expect(authed).toBe(true);
```

## Testing

### Manual Testing Checklist

- [x] Helper module exports all functions
- [x] TypeScript types are correct
- [x] JSDoc examples are accurate
- [x] E2E test imports helper successfully
- [x] Test runs without import errors
- [x] Authentication sets localStorage correctly
- [x] clearAuth removes all auth data
- [x] isAuthenticated returns correct status

### Automated Testing

The helper itself is tested by using it in `tests/e2e/enrollment-flow.spec.ts`:

```typescript
await authenticateViaJWT(page, { email: testEmail });
const storedToken = await page.evaluate(() =>
  localStorage.getItem('hhl_auth_token')
);
expect(storedToken).toBeTruthy();
```

## Files Changed

| File | Type | Description |
|------|------|-------------|
| `tests/helpers/auth.ts` | New | Centralized JWT authentication helper (184 lines) |
| `tests/e2e/enrollment-flow.spec.ts` | Modified | Updated to use centralized helper |
| `tests/README.md` | New | Comprehensive testing documentation (350+ lines) |

## Benefits

✅ **No CSRF issues**: Bypasses HubSpot membership form security
✅ **Fast**: No page navigation or form submission required
✅ **Reliable**: Direct API integration without UI dependencies
✅ **CI-friendly**: Works seamlessly in automated environments
✅ **Reusable**: Single helper for all E2E tests
✅ **Type-safe**: Full TypeScript support with interfaces
✅ **Well-documented**: JSDoc examples and comprehensive README

## Environment Variables

### Required

```bash
HUBSPOT_TEST_USERNAME=test-email@example.com  # Email of test contact
API_BASE_URL=https://hvoog2lnha.execute-api.us-west-2.amazonaws.com
```

### Optional

```bash
HUBSPOT_TEST_EMAIL=test-email@example.com     # Alternative to HUBSPOT_TEST_USERNAME
HUBSPOT_TEST_CONTACT_ID=123456               # HubSpot contact ID
JWT_SECRET=your-secret                       # For CI/CD token generation
```

## Usage Examples

### Basic Authentication

```typescript
import { authenticateViaJWT } from '../helpers/auth';

test('should access protected content', async ({ page }) => {
  await authenticateViaJWT(page, {
    email: process.env.HUBSPOT_TEST_USERNAME!
  });
  await page.goto('https://hedgehog.cloud/learn/my-learning');
  // Assertions...
});
```

### With Session Verification

```typescript
await authenticateViaJWT(page, {
  email: 'test@example.com',
  verifySession: true  // Future: verify via /auth/session
});
```

### Testing Logout Flow

```typescript
import { authenticateViaJWT, clearAuth } from '../helpers/auth';

test('should handle logout', async ({ page }) => {
  await authenticateViaJWT(page, { email: 'test@example.com' });
  // ... perform actions ...
  await clearAuth(page);
  await page.reload();
  // User is now anonymous
});
```

### Checking Auth Status

```typescript
import { isAuthenticated } from '../helpers/auth';

test('should maintain session', async ({ page }) => {
  await authenticateViaJWT(page, { email: 'test@example.com' });
  const authed = await isAuthenticated(page);
  expect(authed).toBe(true);
});
```

## Comparison with API Tests

### E2E Helper (Browser Context)

```typescript
// tests/helpers/auth.ts
await authenticateViaJWT(page, { email: 'test@example.com' });
// Sets up browser localStorage for client-side code
```

### API Helper (Request Context)

```typescript
// tests/api/membership-smoke.spec.ts
const token = await getJWTToken(request, email);
// Returns token for API Authorization headers
```

**Both are valid**: E2E helper for browser tests, API helper for request-level tests.

## CI/CD Integration

### GitHub Actions Usage

```yaml
- name: Run E2E Tests
  env:
    HUBSPOT_TEST_USERNAME: ${{ secrets.HUBSPOT_TEST_USERNAME }}
    HUBSPOT_TEST_CONTACT_ID: ${{ secrets.HUBSPOT_TEST_CONTACT_ID }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    API_BASE_URL: https://hvoog2lnha.execute-api.us-west-2.amazonaws.com
  run: npm run test:e2e
```

### Required Secrets

Configure in GitHub repository settings:
- `HUBSPOT_TEST_USERNAME`
- `HUBSPOT_TEST_CONTACT_ID`
- `JWT_SECRET`

## Backward Compatibility

✅ **No breaking changes**: Existing tests continue to work
✅ **Optional migration**: Tests can adopt helper incrementally
✅ **Fallback support**: Tests can still use direct API calls if needed

## Known Limitations

1. **Client-side only**: Sets localStorage, not HTTP-only cookies
2. **No server-side session**: Future `/auth/session` endpoint would enable verification
3. **24-hour tokens**: Tokens expire after 24 hours (by design)
4. **Requires localStorage**: Browser must support localStorage API

## Future Enhancements

- [ ] Add `refreshToken()` helper for token renewal
- [ ] Support for HTTP-only cookie-based sessions
- [ ] Add `loginAs(role)` helper for role-based testing
- [ ] Integration with `/auth/session` endpoint when implemented
- [ ] Support for custom token expiry times
- [ ] Add helper for testing expired token scenarios

## Migration Guide

### Before (Inline Helper)

```typescript
async function authenticateViaJWT(page: Page, email: string): Promise<void> {
  const response = await page.request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email }
  });
  const data = await response.json();
  await page.evaluate((token) => {
    localStorage.setItem('hhl_auth_token', token);
    // ...
  }, data.token);
}
```

### After (Centralized Helper)

```typescript
import { authenticateViaJWT } from '../helpers/auth';

// Usage stays the same, just updated signature:
await authenticateViaJWT(page, { email: testEmail });
```

## Verification

### How to Verify

1. **Import works**:
   ```bash
   npx playwright test tests/e2e/enrollment-flow.spec.ts
   ```
   Should compile without import errors

2. **Authentication succeeds**:
   Check test output for "JWT token stored successfully"

3. **Token persists**:
   Verify localStorage contains `hhl_auth_token` after login

4. **Helper functions work**:
   Test `clearAuth()` and `isAuthenticated()` in isolation

### Expected Test Output

```
Running 1 test using 1 worker

Initial CTA text (anonymous): Sign in to start course
Authenticating via JWT with email: test@example.com
JWT token stored successfully
✅ Token exists in localStorage
✅ Identity cached for immediate use
```

## Documentation

### Where to Find

- **Helper API**: `tests/helpers/auth.ts` (JSDoc)
- **Usage Guide**: `tests/README.md` (comprehensive)
- **Examples**: `tests/e2e/enrollment-flow.spec.ts` (working implementation)

### Quick Reference

| Function | Purpose | Returns |
|----------|---------|---------|
| `authenticateViaJWT()` | Set up authenticated session | User data with token |
| `clearAuth()` | Remove authentication | void |
| `isAuthenticated()` | Check if authenticated | boolean |

## References

- [GitHub Issue #269](https://github.com/afewell/hh-learn/issues/269)
- [GitHub Issue #247](https://github.com/afewell/hh-learn/issues/247) - Original automation recommendation
- [JWT Auth Analysis](../../JWT-AUTH-ANALYSIS.md)
- [Playwright Documentation](https://playwright.dev/)
- [Auth Context Implementation](../../clean-x-hedgehog-templates/assets/js/auth-context.js)

## Sign-off

Implementation complete and ready for use in all E2E tests.

**Implemented by**: Claude Code
**Date**: 2025-10-27
**Next Steps**:
1. Update remaining E2E tests to use centralized helper
2. Add helper examples to test documentation
3. Configure GitHub Actions secrets for CI
