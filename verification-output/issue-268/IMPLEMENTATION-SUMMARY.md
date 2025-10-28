# Issue #268 - Replace CTA Login Flow with JWT Helper

## Implementation Summary

**Status**: ✅ COMPLETE
**Date**: 2025-10-27
**Related Issues**: #251 (JWT Auth), #253 (JWT Rollout), #269 (Playwright Helper)

## Overview

Replaced the legacy membership handshake redirect in course/pathway CTA buttons with the new `window.hhIdentity.login()` JWT authentication API. Users now get an email prompt when clicking "Sign in to start course" instead of being redirected to the HubSpot membership form.

## Changes Made

### 1. enrollment.js - New JWT Login Handler

**File**: `clean-x-hedgehog-templates/assets/js/enrollment.js`

**Added** `handleJWTLogin()` function (lines 77-137):
- Prompts user for email with browser prompt
- Validates email format client-side
- Calls `window.hhIdentity.login(email)` for JWT authentication
- Shows loading state during login
- Reinitializes enrollment UI after successful login
- Falls back to legacy redirect if `window.hhIdentity.login` unavailable
- Displays error messages via toast or alert

**Modified** `renderSignInState()` function (lines 153-188):
- Replaced `buildLoginRedirect()` with `handleJWTLogin()`
- Updated button click handler to call JWT login
- Updated helper text link to trigger JWT login
- Added `slug` parameter for reinitializing enrollment UI after login

**Deprecated** `buildLoginRedirect()` (lines 65-75):
- Marked as `@deprecated` - now fallback only
- Retained for backward compatibility if JWT not available

### 2. Unified Flow for Courses and Pathways

- Both course and pathway CTAs use the same `handleJWTLogin()` function
- No separate pathway-specific login handling needed
- Pathways.js relies on enrollment.js module for enrollment UI

## Implementation Details

### User Flow

**Before (Legacy)**:
1. User clicks "Sign in to start course"
2. Browser redirects to `/_hcms/mem/login?redirect_url=...`
3. User fills out HubSpot membership form
4. User redirected to `/learn/auth-handshake?redirect_url=...`
5. Handshake page captures identity and redirects back to course
6. Course page reloads and checks enrollment state

**After (JWT)**:
1. User clicks "Sign in to start course"
2. Browser shows email prompt: "Please enter your email address to sign in:"
3. User enters email (validated client-side)
4. JavaScript calls `window.hhIdentity.login(email)`
5. JWT token stored in localStorage
6. Enrollment UI reinitializes immediately to check enrollment state
7. CTA updates to "Start Course" or "✓ Enrolled" without page reload

### Benefits

✅ **No page reload**: Enrollment state updates immediately after login
✅ **Better UX**: Single email prompt instead of full form
✅ **Faster**: Direct API call vs multi-step redirect chain
✅ **Consistent**: Same flow for courses and pathways
✅ **Fallback**: Gracefully degrades to legacy redirect if JWT unavailable

### Error Handling

- **Invalid email format**: Shows toast/alert with error message
- **Login failure**: Shows error and resets button state
- **Missing JWT API**: Falls back to legacy redirect automatically
- **User cancels prompt**: No action taken, button remains in sign-in state

## Testing

### Manual Testing Checklist

- [ ] Anonymous user sees "Sign in to start course" button
- [ ] Clicking button shows email prompt
- [ ] Entering valid email authenticates successfully
- [ ] CTA updates to "Start Course" after login
- [ ] Helper text hides after authentication
- [ ] Invalid email shows error message
- [ ] Cancelling prompt keeps button in sign-in state
- [ ] Same flow works for pathway CTAs
- [ ] Fallback works if `window.hhIdentity.login` missing

### Automated Testing

E2E test in `tests/e2e/enrollment-flow.spec.ts` uses the new JWT helper from Issue #269 to verify the authenticated flow.

## Files Changed

| File | Lines | Description |
|------|-------|-------------|
| `clean-x-hedgehog-templates/assets/js/enrollment.js` | 77-137, 153-188 | Added JWT login handler, updated sign-in state renderer |

## Dependencies

### Required
- ✅ Issue #251: JWT authentication endpoints (`/auth/login`)
- ✅ Issue #253: `window.hhIdentity.login()` API in auth-context.js
- ✅ JWT token support in enrollment API calls

### Optional
- Issue #269: Playwright JWT login helper (for automated testing)
- window.hhToast API (for error messages; falls back to alert)

## Backward Compatibility

✅ **Legacy redirect retained**: `buildLoginRedirect()` still available as fallback
✅ **Graceful degradation**: Falls back to legacy flow if JWT unavailable
✅ **No breaking changes**: Existing auth flows continue to work

## Deployment Notes

### Prerequisites

1. Ensure JWT auth endpoints are deployed (Issue #251)
2. Ensure auth-context.js with `window.hhIdentity.login()` is deployed (Issue #253)
3. Verify `constants.json` has `AUTH_LOGIN_URL` configured

### Deployment Steps

1. Deploy updated `enrollment.js` to HubSpot CMS
2. Clear browser cache or use `?hs_no_cache=1` for testing
3. Verify CTA shows email prompt instead of redirecting
4. Monitor for any console errors related to JWT

### Rollback Plan

If issues occur:
1. Revert `enrollment.js` to previous version
2. CTAs will use legacy handshake redirect automatically
3. No database or API changes needed

## Known Limitations

1. **Email prompt UX**: Uses browser `prompt()` dialog (not customizable styling)
2. **No "Remember me"**: Token expires after 24 hours
3. **No password**: Email-only authentication (by design)
4. **Browser compatibility**: Requires localStorage support

## Future Improvements

- [ ] Custom modal for email input instead of browser prompt
- [ ] Remember last-used email in localStorage
- [ ] Add "Sign in with HubSpot" option alongside email prompt
- [ ] Support magic link authentication
- [ ] Add loading spinner during JWT login instead of button text change

## Verification

### How to Verify

1. Navigate to any course page as anonymous user
2. Observe CTA button says "Sign in to start course"
3. Click the button
4. Email prompt should appear
5. Enter valid email from HubSpot CRM
6. After login, CTA should update to "Start Course" or "✓ Enrolled"
7. Helper text should hide after authentication

### Expected Console Output (with `HHL_DEBUG=true`)

```
[hhl-enroll] enrollment.js loaded
[hhl-enroll] Auth context: { hasEmail: false, hasContactId: false, enableCrm: true, source: 'fallback' }
[user clicks sign-in]
[hhl-enroll] JWT login successful, reinitializing enrollment UI
[hhl-enroll] Auth context: { hasEmail: true, hasContactId: true, enableCrm: true, source: 'hhIdentity' }
[hhl-enroll] Initialized (CRM) { contentType: 'course', slug: 'course-authoring-101' }
```

## References

- [GitHub Issue #268](https://github.com/afewell/hh-learn/issues/268)
- [JWT Auth Analysis](../../JWT-AUTH-ANALYSIS.md)
- [Auth and Progress Documentation](../../docs/auth-and-progress.md)
- [window.hhIdentity API](../../clean-x-hedgehog-templates/assets/js/auth-context.js)

## Sign-off

Implementation complete and ready for deployment.

**Implemented by**: Claude Code
**Date**: 2025-10-27
**Next Steps**: Deploy to production and monitor for issues
