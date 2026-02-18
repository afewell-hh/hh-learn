# Issue #319 - Agent A Coordination Document

**Date**: 2026-02-10
**From**: Agent C (Lead)
**To**: Agent A (Test Implementation)
**Status**: Ready for Test Plan Review

---

## Overview

Issue #319 documentation has been approved by the user after 2 rounds of corrections. We're now ready to coordinate on test implementation before proceeding with TDD approach.

---

## What We're Building

**3 Bug Fixes**:
1. **Bug #1 (CRITICAL)**: Action-runner allows enrollment without Cognito auth
2. **Bug #2 (MEDIUM)**: Catalog page left nav doesn't show correct auth state
3. **Bug #3 (MEDIUM)**: Sign-in links use wrong URLs and can 404

**Root Cause**: Mixing server-side HubL (HubSpot Membership) with client-side Cognito authentication.

**Solution**: Use client-side Cognito as single source of truth via `window.hhIdentity` API.

---

## Documentation Available

All documentation is complete and approved:

1. **docs/issue-319-architecture-analysis.md** (15K)
   - Explains the architectural challenge
   - Details the client-side auth pattern
   - Includes window.hhIdentity API reference (Appendix A)

2. **docs/issue-319-spec.md** (24K)
   - Exact code changes for all 3 bugs
   - 5 files to be modified
   - Publishing checklist
   - Implementation order

3. **docs/issue-319-test-plan.md** (23K) ⭐ **PRIMARY DOCUMENT FOR YOUR REVIEW**
   - 16 Playwright tests
   - Conditional skip patterns
   - Correct window.hhIdentity API usage
   - Test structure and organization

4. **docs/issue-319-corrections-summary.md** (7.6K)
   - Summary of Round 1 corrections

5. **docs/issue-319-final-corrections.md** (6K)
   - Summary of Round 2 corrections

---

## Test Plan Overview

**File**: `docs/issue-319-test-plan.md`

### Test Structure

```
describe('Issue #319 - SSO UX Regressions', () => {
  describe('Bug #1: Enrollment Without Login', () => {
    - 3 tests (anonymous blocked, CTA redirects, authenticated allowed)
  });

  describe('Bug #2: Left Nav Auth State on Catalog', () => {
    - 3 tests (anonymous shows sign-in, authenticated shows sign-out, script loads)
  });

  describe('Bug #3: Sign In Link URLs', () => {
    - 3 tests (absolute URLs, no 404, sign-out URLs)
  });

  describe('End-to-End Auth Flow', () => {
    - 2 tests (authenticated enrollment, anonymous state after logout)
  });

  describe('Regression Tests', () => {
    - 6+ tests (verify other pages still work)
  });
});
```

**Total Tests**: ~16

### Key Patterns Used

1. **Conditional Skip Pattern** (from Issue #318)
   ```typescript
   const isAuthenticated = await page.evaluate(() => {
     return (window as any).hhIdentity && (window as any).hhIdentity.isAuthenticated();
   });

   if (isAuthenticated) {
     console.warn('⚠ Skipping: Server-side personalization persists auth state');
     test.skip();
     return;
   }
   ```

2. **window.hhIdentity API Usage**
   ```typescript
   // Wait for auth to be ready
   await page.waitForFunction(
     () => (window as any).hhIdentity && (window as any).hhIdentity.isReady(),
     { timeout: 10000 }
   );

   // Check authentication
   const isAuth = await page.evaluate(() => {
     return (window as any).hhIdentity.isAuthenticated();
   });

   // Get identity data
   const identity = await page.evaluate(() => {
     return (window as any).hhIdentity.get();
   });
   ```

3. **StorageState for Authenticated Tests**
   - Use existing `.auth/user.json` from auth.setup.ts
   - No manual cookie injection needed
   - Playwright handles authentication automatically

---

## Review Focus Areas

Please review the test plan and provide feedback on:

### 1. Test Coverage
- [ ] Are all 3 bugs adequately covered?
- [ ] Are there missing edge cases?
- [ ] Should we add more regression tests?

### 2. Test Structure
- [ ] Does the describe block organization make sense?
- [ ] Are tests properly isolated?
- [ ] Should any tests be combined or split?

### 3. Conditional Skip Pattern
- [ ] Is the skip pattern implemented correctly?
- [ ] Are skip conditions appropriate?
- [ ] Should we add more skip scenarios?

### 4. API Usage
- [ ] Is window.hhIdentity usage correct throughout?
- [ ] Are timeouts appropriate?
- [ ] Should we use different wait strategies?

### 5. E2E Flow
- [ ] Is the simplified E2E flow adequate?
- [ ] Should we test the full OAuth flow?
- [ ] Are the two separate tests better than one complex test?

### 6. Test Data
- [ ] Test URLs correct? (catalog, pathways, action-runner)
- [ ] Test user credentials from .env sufficient?
- [ ] Need additional test pathways/courses?

---

## Implementation Approach

After your review and approval:

### Phase 1: Test Implementation (Agent A)
1. Create test file or add to existing `tests/e2e/cognito-frontend-ux.spec.ts`
2. Implement all 16 tests following the spec
3. Run tests to verify they FAIL (red) - expected since fixes not implemented yet
4. Commit test code to feature branch

### Phase 2: Fix Implementation (Agent C)
1. Implement fixes in 4-step order (per spec):
   - Bug #3 Part 1: Add applyAuthState() to cognito-auth-integration.js
   - Bug #3 Part 2: Update left-nav.html
   - Bug #2: Add cognito script to catalog.html
   - Bug #1: Update action-runner (html + js)
2. Run tests after each step to verify progress
3. Final test run should show all tests PASS (green)

### Phase 3: Publishing & Verification (Agent C)
1. Publish 5 files to HubSpot using npm run publish:template
2. Run tests against production
3. Manual verification of each bug fix
4. Update Issue #319 with results

---

## Questions for Agent A

1. **Test file location**: Add to existing `cognito-frontend-ux.spec.ts` or create new `issue-319.spec.ts`?

2. **Test execution order**: Any specific order needed, or can tests run in parallel?

3. **Flakiness concerns**: Any tests that might be flaky? How to handle?

4. **Additional tools**: Need any additional test helpers or utilities?

5. **Coverage reporting**: Should we generate coverage reports for these tests?

6. **Time estimate**: How long to implement all 16 tests?

---

## Known Challenges

### Challenge 1: Server-Side Personalization
**Problem**: HubSpot server can render authenticated state even after clearing cookies
**Solution**: Conditional skips with clear warning messages
**Pattern**: From Issue #318 (lines 417-437 in cognito-frontend-ux.spec.ts)

### Challenge 2: Async Auth Resolution
**Problem**: window.hhIdentity.ready is a Promise, must wait
**Solution**: Use `waitForFunction` to wait for `isReady()` before checking auth
**Example**: See Test 1.1 in test plan

### Challenge 3: OAuth Flow
**Problem**: Cannot fully automate OAuth login in tests
**Solution**: Use storageState for authenticated tests, test anonymous flow separately
**Example**: See E2E tests (split into 2 tests)

### Challenge 4: Action Runner Timing
**Problem**: Action runner processes enrollment asynchronously
**Solution**: Wait for status message to appear, check for success/error text
**Example**: See Test 1.3 in test plan

---

## Success Criteria

After implementation and testing:

- [ ] All 16 tests implemented and passing
- [ ] Tests use correct window.hhIdentity API
- [ ] Conditional skips work correctly
- [ ] No flaky tests
- [ ] Clear test names and descriptions
- [ ] Proper error messages on failure
- [ ] Tests run in reasonable time (< 5 minutes total)

---

## Timeline Estimate

**Test Implementation (Agent A)**: 3-4 hours
- 16 tests × 15 minutes average = 4 hours
- Some tests simpler (5 min), some complex (30 min)

**Fix Implementation (Agent C)**: 3-4 hours
- 5 files to modify
- Testing after each change
- Publishing to HubSpot

**Total**: 6-8 hours for complete Issue #319 resolution

---

## Next Steps

1. **Agent A**: Review this document and test plan
2. **Agent A**: Provide feedback/questions
3. **Coordinate**: Discuss any concerns or changes
4. **Agent A**: Implement tests (Phase 1)
5. **Agent C**: Implement fixes (Phase 2)
6. **Agent C**: Publish and verify (Phase 3)
7. **Both**: Update Issue #319 and close

---

## Resources

**Test Plan**: `docs/issue-319-test-plan.md`
**Spec**: `docs/issue-319-spec.md`
**Architecture**: `docs/issue-319-architecture-analysis.md`
**Existing Tests**: `tests/e2e/cognito-frontend-ux.spec.ts`
**Issue**: https://github.com/afewell-hh/hh-learn/issues/319

---

**Document Status**: Ready for Agent A Review
**Waiting On**: Agent A feedback and approval
**Next Action**: Implement tests (Agent A) → Implement fixes (Agent C) → Verify and close
