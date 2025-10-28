# CSRF Failure Analysis

## What We Know

1. **Form has CSRF token**: ✅ Present in hidden field
2. **Form has all required fields**: ✅ email, password, csrf_token, redirect_url, hubspotutk
3. **Credentials are correct**: ✅ (confirmed by user)
4. **Form submission fails**: ❌ Returns `CSRF_FAILURE`

## Investigation Results

### Attempt 1: Basic Form Submission
- Filled email and password
- Clicked submit button
- Result: CSRF_FAILURE

### Attempt 2: With CSRF Token Check
- Verified CSRF token exists
- Confirmed token value present
- Result: CSRF_FAILURE

### Attempt 3: Fixed redirect_url
- Corrected hidden redirect_url field to match URL parameter
- Result: CSRF_FAILURE

## Hypothesis

The CSRF failure is likely due to one of:

1. **Session-bound token**: The CSRF token may be tied to a server-side session that gets invalidated when Playwright navigates/fills the form
2. **Additional validation**: HubSpot may validate more than just the CSRF token (e.g., timing, referrer headers, browser fingerprint)
3. **Cookie manipulation**: The `hubspotutk` cookie value may need to match what the server expects

## Next Approach

Try using Playwright's storage state to preserve all cookies and session data properly.
