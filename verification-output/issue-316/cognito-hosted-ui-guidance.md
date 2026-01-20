# Cognito Hosted UI Configuration & Playwright Test Guidance

**Date:** 2026-01-19
**For:** Agent C - Fixing E2E Test Authentication
**Issue:** Playwright can't interact with Cognito login inputs (reports "not visible")

---

## Cognito Configuration Summary

I've checked the Cognito User Pool configuration. Here's what's configured:

### Identity Providers Enabled

The app client supports **3 identity providers:**

1. **COGNITO** - Email/password authentication (built-in)
2. **GitHub** - OAuth via GitHub
3. **Google** - OAuth via Google

### User Pool Settings

- **MFA:** OFF (no multi-factor authentication)
- **Username:** Email-based (users log in with email)
- **Auto-verified:** Email must be verified
- **Password Policy:**
  - Minimum 8 characters
  - Requires: uppercase, lowercase, numbers
  - Does NOT require symbols

### OAuth Configuration

- **Flow:** Authorization code with PKCE
- **Scopes:** openid, email, profile
- **Callback:** https://hedgehog.cloud/auth/callback
- **Logout URLs:** https://hedgehog.cloud/, https://hedgehog.cloud/learn

---

## Why Playwright Can't See the Inputs

**Root Cause:** The Cognito Hosted UI shows **multiple sign-in options** (Google, GitHub, Email/Password).

**Likely UI Structure:**
```
┌─────────────────────────────────────┐
│   Hedgehog Learn                    │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  Sign in with Google          │  │ ← Button
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  Sign in with GitHub          │  │ ← Button
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │  Sign in with your email      │  │ ← Button (may need to click this!)
│  └───────────────────────────────┘  │
│                                      │
│  [After clicking "email" button]    │
│  ┌───────────────────────────────┐  │
│  │  Email: [____________]         │  │ ← NOW visible
│  │  Password: [____________]      │  │ ← NOW visible
│  │  [Sign in]                     │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

The email/password inputs are **initially hidden** until the user clicks on the "Sign in with your email and password" option.

---

## Solution: Update Playwright Test Flow

### Option 1: Click to Expand Email/Password Form (RECOMMENDED)

Update the test to:
1. Wait for Cognito Hosted UI to load
2. **Click the "Sign in with your email" button/link** to expand the form
3. THEN fill in email/password inputs
4. Click submit

**Example Playwright Code:**

```typescript
// tests/e2e/cognito-frontend-ux.spec.ts

async function loginWithCognito(page: Page, email: string, password: string) {
  // Wait for Cognito Hosted UI to load
  await page.waitForURL(/cognito-idp.*amazonaws\.com/, { timeout: 10000 });

  // Click the "Sign in with email" button to expand the form
  // Try multiple possible selectors (Cognito UI varies)
  const emailSignInButton = page.locator(
    'a:has-text("Sign in with your email"), ' +
    'button:has-text("Sign in with your email"), ' +
    'a:has-text("Email and password"), ' +
    'button:has-text("Email and password"), ' +
    '[data-provider="COGNITO"]'
  ).first();

  if (await emailSignInButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Clicking "Sign in with email" button...');
    await emailSignInButton.click();

    // Wait for form to expand
    await page.waitForTimeout(1000);
  }

  // Now fill in the email/password inputs (should be visible)
  await page.fill('input[name="username"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);

  // Click sign in button
  await page.click('button[type="submit"], input[type="submit"], button:has-text("Sign in")');

  // Wait for redirect back to hedgehog.cloud
  await page.waitForURL(/hedgehog\.cloud/, { timeout: 15000 });
}
```

### Option 2: Use Playwright Storage State (FASTER, RECOMMENDED FOR CI)

**Approach:** Log in once manually, save the session, reuse for all tests.

**Benefits:**
- Tests run faster (no repeated logins)
- More stable (avoids Cognito UI flakiness)
- Works even if Cognito UI changes

**Implementation:**

**Step 1: Create a setup script**

```typescript
// tests/e2e/auth-setup.ts
import { chromium, Page } from '@playwright/test';

async function setupAuth() {
  const browser = await chromium.launch({ headless: false }); // Run headless for CI
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to login page
  await page.goto('https://hedgehog.cloud/learn/courses/course-authoring-101');

  // Click "Sign in to enroll"
  await page.click('#hhl-enroll-button, button:has-text("Sign in")');

  // Manual step: Complete login in the browser
  // (You can automate this if you figure out the exact Cognito UI selectors)

  console.log('Please log in manually in the browser...');
  console.log('Email:', process.env.HUBSPOT_TEST_EMAIL);
  console.log('Password:', process.env.HUBSPOT_TEST_PASSWORD);

  // Wait for user to complete login and return to hedgehog.cloud
  await page.waitForURL(/hedgehog\.cloud/, { timeout: 120000 });

  // Save authenticated state
  await context.storageState({ path: 'tests/e2e/.auth/user.json' });

  await browser.close();
  console.log('✅ Auth state saved to tests/e2e/.auth/user.json');
}

setupAuth();
```

**Step 2: Update Playwright config to use storage state**

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 120000,
  expect: { timeout: 30000 },
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Use saved auth state for all tests
    storageState: 'tests/e2e/.auth/user.json',
  },
  // ... rest of config
});
```

**Step 3: Run setup once, then run tests**

```bash
# One-time: Generate auth state (can run headless after initial setup)
npx ts-node tests/e2e/auth-setup.ts

# Run tests (will use saved auth state)
npm run test:e2e -- tests/e2e/cognito-frontend-ux.spec.ts
```

---

## My Recommendation

**Use Option 2 (Storage State) for the following reasons:**

1. ✅ **Faster tests** - No repeated logins
2. ✅ **More reliable** - Doesn't depend on Cognito UI structure
3. ✅ **Better for CI/CD** - Can regenerate auth state as needed
4. ✅ **Common Playwright pattern** - Well-documented approach
5. ✅ **Future-proof** - Works even if Cognito UI changes

**Fallback:** If you need to test the full OAuth flow end-to-end, use Option 1 with the click-to-expand approach.

---

## Testing the Test User

**Test Credentials (from .env):**
- Email: `afewell@gmail.com`
- Password: `Ar7far7!`

**Verify the user exists in Cognito:**

```bash
aws cognito-idp admin-get-user \
  --user-pool-id us-west-2_XWB9UclRK \
  --username afewell@gmail.com \
  --region us-west-2
```

If the user doesn't exist, create them:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id us-west-2_XWB9UclRK \
  --username afewell@gmail.com \
  --user-attributes Name=email,Value=afewell@gmail.com Name=email_verified,Value=true \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS \
  --region us-west-2

# Then set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-west-2_XWB9UclRK \
  --username afewell@gmail.com \
  --password "Ar7far7!" \
  --permanent \
  --region us-west-2
```

---

## Alternative: Use Google OAuth for Tests

Since Google OAuth is configured, you could also:
1. Click "Sign in with Google" button
2. Use Google test credentials
3. Skip the Cognito email/password form entirely

**However:** This requires Google OAuth app credentials and may have additional verification steps.

---

## Summary of Guidance for Agent C

**Pick one to proceed:**

### ✅ Option 2: Playwright Storage State (RECOMMENDED)
- **Action:** Create `auth-setup.ts` script
- **Action:** Log in once manually or automated (with click-to-expand)
- **Action:** Save storage state to `tests/e2e/.auth/user.json`
- **Action:** Update `playwright.config.ts` to use storage state
- **Action:** Re-run tests (should all pass!)

### Option 1: Update Test with Click-to-Expand
- **Action:** Update `loginWithCognito()` helper to:
  1. Click "Sign in with your email" button
  2. Wait for form to expand
  3. Fill email/password
  4. Submit
- **Action:** Re-run tests

---

## For the HubSpot Publish Workflow Documentation

**Suggested location:** `docs/cli-provisioning-guide.md`

**Topics to cover:**
1. ✅ Use `hs project upload` for project-based deploys (not manual Design Manager uploads)
2. ✅ Use repo scripts for publishing templates/constants (`npm run publish:template`, `npm run provision:constants`)
3. ✅ Avoid mixing legacy app constructs with modern project structure
4. ❌ Don't use `hs upload` for individual files (use project commands)
5. ✅ Keep paths consistent (use standard `/assets/js/` not `/learn/assets/js/`)

---

**Prepared By:** Agent A
**Date:** 2026-01-19
**Next:** Agent C to implement Option 2 (storage state) or Option 1 (click-to-expand)
