# Issue #317 - Process Violation Analysis

**Date:** 2026-01-19
**Analyzed By:** Agent A (Project Lead)
**Purpose:** Document what went wrong and how to prevent similar issues

---

## Executive Summary

Agent C successfully deployed critical infrastructure (API Gateway custom domain, DNS, Cognito updates) but then violated the required development process by making ~15+ code changes through iterative debugging when tests failed, rather than stopping to follow the research → architecture → spec → test → implementation cycle.

**Root Cause of Process Violation:** When `/auth/me` returned 200 but the UI didn't update, Agent C attempted multiple code fixes without understanding the architectural problem: legacy `auth-context.js` and new `cognito-auth-integration.js` both define `window.hhIdentity` but don't properly integrate.

---

## What Went Right

### Infrastructure Deployment (Appropriate)

Agent C correctly executed the infrastructure setup that was part of the approved plan:

✅ **API Gateway Custom Domain**
- Created ACM certificate for `api.hedgehog.cloud`
- Validated via Cloudflare CNAME
- Created API Gateway custom domain mapping to `hvoog2lnha` (dev)
- Verified `https://api.hedgehog.cloud/auth/me` returns 401 when anonymous, 200 when authenticated

✅ **Cognito Configuration**
- Updated Cognito app client callback URLs to include `https://api.hedgehog.cloud/auth/callback`
- Set environment variable `COGNITO_REDIRECT_URI=https://api.hedgehog.cloud/auth/callback`
- Deployed Lambda with `serverless deploy`

✅ **HubSpot CMS Publishing**
- Published templates and constants via repo scripts (`publish:constants`, `publish:template`)
- Confirmed live templates include new `cognito-auth-integration` bundle and constants JSON

✅ **Critical Bug Fixes**
- Fixed JWK→PEM conversion in `cognito-auth.js` (this was a real bug preventing JWT verification)
- Fixed API Gateway v2 cookie parsing by reading `event.cookies`

**These changes were appropriate and necessary to complete the approved infrastructure setup.**

---

## What Went Wrong

### Iterative Debugging Without Research (Process Violation)

When Playwright tests failed at the authenticated enrollment CTA step, Agent C entered an **iterative debugging cycle** making changes without following the required process:

#### Files Changed During Debugging (Not Pre-Planned):

1. **Constants Configuration**
   - `clean-x-hedgehog-templates/config/constants.json` - Updated AUTH_* URLs

2. **Template Updates** (6 files)
   - `clean-x-hedgehog-templates/learn/courses-page.html`
   - `clean-x-hedgehog-templates/learn/pathways-page.html`
   - `clean-x-hedgehog-templates/learn/my-learning.html`
   - `clean-x-hedgehog-templates/learn/register.html`
   - `clean-x-hedgehog-templates/learn/action-runner.html`
   - `clean-x-hedgehog-templates/learn/macros/left-nav.html`
   - Changes: Avoid false "logged in" state, use constants/fallbacks, remove server-side redirects

3. **Test Configuration Updates** (3 files)
   - `tests/e2e/auth.setup.ts` - New Playwright storage state setup
   - `playwright.config.ts` - Added setup + e2e projects
   - `tests/e2e/cognito-frontend-ux.spec.ts` - Updated selectors, cache-buster, default slug

4. **Compatibility Patches** (2 files)
   - `clean-x-hedgehog-templates/assets/js/cognito-auth-integration.js`
   - `clean-x-hedgehog-templates/learn/assets/js/cognito-auth-integration.js`
   - **Purpose:** Override `window.hhIdentity` API to work around legacy `auth-context.js`

**Total:** ~15+ file changes attempting to fix test failures through trial and error.

---

## The Real Problem (Discovered Through Debugging)

### Legacy Integration Conflict

The root cause is an **architectural integration problem**, not a code bug:

**Current State:**
```html
<!-- Live page loads both legacy and new auth systems -->
<script src="auth-context.js"></script>           <!-- Legacy auth system -->
<script src="cognito-auth-integration.js"></script> <!-- New Cognito auth -->
```

**Problem:**
- Both scripts define `window.hhIdentity` API
- Legacy `auth-context.js` exposes: `{ get, isAuthenticated, ready }`
- New `cognito-auth-integration.js` can call Cognito APIs successfully
- **BUT:** `window.hhCognitoAuth.refresh()` returns correct identity, while `window.hhIdentity.get()` remains `{ email: '', contactId: '' }`
- Templates check `window.hhIdentity.get()` to determine if user is logged in
- Result: Backend returns 200 with valid auth, but frontend UI stays in "logged out" state

### Observable Symptoms:

✅ **Backend Working:**
- `/auth/me` returns 200 with valid user data when cookies present
- Cognito OAuth flow completes successfully
- Lambda correctly validates JWT tokens

❌ **Frontend Not Reflecting Auth:**
- Enrollment CTA stays as "Sign in to enroll" instead of "Enroll" or "Enrolled"
- Playwright tests fail at: `expect(page.locator('#hhl-enroll-button')).toBeVisible()`
- Browser diagnostics show `window.hhIdentity.get()` returns empty object

---

## Open Architectural Questions (From Issue #317)

These questions should have been asked BEFORE making code changes:

1. **Should legacy `auth-context.js` be removed from Learn pages entirely?**
   - What other dependencies exist on this legacy system?
   - What's the migration path?

2. **Should `hhIdentity` be fully replaced or should Cognito flow write into the legacy cache?**
   - Do we create an adapter layer?
   - Do we deprecate and replace?

3. **Which identity source is authoritative for enrollment UI?**
   - Cognito backend?
   - Legacy frontend cache?
   - How do we reconcile conflicts?

4. **Do we want a short-term test-only fix vs. a production change?**
   - Can we mock `hhIdentity` for tests?
   - Or do we need to fix the integration for real users?

**These questions require research and architectural review BEFORE implementation.**

---

## Required Process (Not Followed)

Per project requirements, when encountering unexpected behavior, the process should have been:

### 1. **Research Phase**
**What should have happened:**
- Document exact behavior: script load order, API calls, identity state
- Review all templates to find where `hhIdentity` is used
- Check if other pages/features depend on `auth-context.js`
- Research HubSpot constraints on script loading and initialization
- Investigate whether this was covered in original Phase 6 specs

**What actually happened:**
- Some observation documented in Issue #317
- But research done AFTER multiple code changes, not before

### 2. **Architecture Review**
**What should have happened:**
- Map complete auth flow: Cognito → API Gateway → Lambda → CMS JS → UI
- Diagram legacy vs. new identity systems
- Identify integration points and conflicts
- Present architectural options (adapter, replacement, parallel, etc.)
- Get team review and approval

**What actually happened:**
- Architecture discovered through trial and error
- No formal architectural options presented for review

### 3. **Technical Specification**
**What should have happened:**
- Write detailed spec for chosen approach
- Define exactly which files change and how
- Specify new APIs or interfaces
- Define rollback plan
- Get spec reviewed and approved

**What actually happened:**
- Code changes made without written spec
- Changes documented in Issue #317 AFTER the fact

### 4. **Test Plan**
**What should have happened:**
- Define expected behavior for each scenario
- Write test cases before implementation
- Review test plan
- Update E2E tests to match new architecture

**What actually happened:**
- Test changes mixed with implementation
- Tests updated iteratively as debugging proceeded

### 5. **TDD Implementation**
**What should have happened:**
- Implement only after Steps 1-4 approved
- Write failing tests first
- Implement to make tests pass
- One commit per logical change with clear purpose

**What actually happened:**
- Implementation, testing, and spec merged into debugging cycle
- ~15+ files changed in exploratory manner

---

## Consequences of Process Violation

### Technical Debt Created:

1. **Unclear System State**
   - Hard to know which changes are necessary vs. experimental
   - Difficult to roll back to a known good state
   - Compatibility patches may mask root architectural issues

2. **Undocumented Decisions**
   - Why was `window.hhIdentity` override chosen over removing `auth-context.js`?
   - What alternatives were considered?
   - What are the long-term implications?

3. **Test Instability**
   - Tests updated to pass current behavior, but is that the desired behavior?
   - May need to rewrite tests if architecture changes

### Process Debt Created:

1. **No Reusable Knowledge**
   - If this happens again, we can't reference "the spec we used last time"
   - Can't point to "approved architectural decision"

2. **Risk of Repeated Mistakes**
   - Without documenting what DIDN'T work and why, we might try same approaches again
   - No formal record of lessons learned

3. **Difficult Code Review**
   - Reviewers would need to understand 15+ file changes across multiple concerns
   - Hard to validate correctness without understanding the exploration path

---

## Recommended Reset Process

As proposed in Issue #317, we should:

### Phase 1: Rollback to Known Good State (Optional)

**Option A:** Keep current changes if they work
- API infrastructure changes: KEEP (these are correct)
- Bug fixes (JWK, cookies): KEEP (these are real bugs)
- Template/test changes: REVIEW (may need to revert some)

**Option B:** Full rollback to before debugging cycle
- Revert all code changes except infrastructure and bug fixes
- Start fresh with proper process

### Phase 2: Formal Research

**Deliverable:** Research document covering:

1. **Legacy Auth System Audit**
   - Complete inventory of where `auth-context.js` is used
   - What features/pages depend on it
   - Can it be safely removed or must it be maintained?

2. **Frontend Identity API Requirements**
   - What does enrollment UI actually need from identity system?
   - What do other features (progress, badges, My Learning) need?
   - Can we define a minimal identity interface?

3. **Integration Constraints**
   - HubSpot script loading order guarantees (or lack thereof)
   - Can we reliably override `window.hhIdentity`?
   - What are CSP/security implications?

4. **Review Original Phase 6 Specs**
   - Was this integration scenario anticipated?
   - If not, why did we miss it?
   - How can we improve specs going forward?

**Output:** `docs/issue-317-research.md` submitted for review

### Phase 3: Architectural Design

**Deliverable:** Architecture decision document with 3-5 options:

**Example Options:**
1. **Full Replacement:** Remove `auth-context.js`, use only Cognito auth
2. **Adapter Layer:** Keep both, create bridge to sync identity
3. **Parallel Systems:** Cognito for enrollment, legacy for other features
4. **Gradual Migration:** Feature-by-feature migration plan

**For Each Option:**
- Pros/cons
- Implementation effort estimate
- Risk assessment
- Rollback plan
- Dependencies and assumptions

**Output:** `docs/issue-317-architecture-options.md` submitted for review

### Phase 4: Technical Specification

Once architecture approved:

**Deliverable:** Detailed technical spec including:

1. **File Changes**
   - Exact list of files to modify/create/delete
   - Purpose of each change
   - Dependency order

2. **API Definitions**
   - If creating new APIs or interfaces, define signatures
   - If modifying existing, show before/after

3. **Migration Steps**
   - If removing legacy system, how?
   - Data migration required?

4. **Configuration Changes**
   - Constants to update
   - Environment variables
   - HubSpot settings

5. **Rollback Plan**
   - How to revert if production issues
   - What state do we roll back to?

**Output:** `docs/issue-317-implementation-spec.md` submitted for review

### Phase 5: Test Plan

**Deliverable:** Comprehensive test plan covering:

1. **E2E Test Scenarios**
   - Anonymous user browsing
   - Sign-in flow
   - Enrollment after auth
   - Progress tracking
   - Logout
   - Re-login

2. **Integration Tests**
   - Identity API contract
   - Legacy/new system integration (if keeping both)

3. **Acceptance Criteria**
   - What must work in production?
   - What's the definition of "done"?

**Output:** `tests/e2e/issue-317-test-plan.md` submitted for review

### Phase 6: TDD Implementation

Only after Phases 1-5 approved:

1. Write failing tests per test plan
2. Implement per technical spec
3. Make tests pass
4. Code review
5. Staging deployment
6. Final testing
7. Production deployment

---

## Lessons Learned

### For Future Work:

1. **Stop at Unexpected Behavior**
   - If tests fail in ways not anticipated by specs, STOP
   - Don't debug - research first

2. **Symptoms vs. Root Cause**
   - "UI doesn't update" is a symptom
   - "Legacy and new auth systems don't integrate" is root cause
   - Find root cause before implementing fixes

3. **Spec Completeness**
   - Phase 6 specs should have covered frontend integration in detail
   - Missing this led to discovery during testing (too late)
   - Improve spec thoroughness to catch these earlier

4. **One Change at a Time**
   - When debugging, change ONE thing and test
   - Don't make 15 changes and hope something works
   - This violates TDD principles

5. **Documentation is Not Optional**
   - "We can document after it works" leads to undocumented decisions
   - Document BEFORE implementation, not after

---

## Immediate Next Steps

1. **Team Decision Required:**
   - Approve reset process (Phases 1-6 above)
   - OR: Accept current state and document as-is
   - OR: Different approach

2. **If Reset Approved:**
   - Agent A (me) to begin Phase 2 Research
   - Document findings in `docs/issue-317-research.md`
   - Submit for review before proceeding to architecture

3. **Update Development Guidelines:**
   - Add process enforcement checklist
   - Define "when to stop and research" triggers
   - Create architectural decision record (ADR) template

---

## Acknowledgment

Agent C's work on infrastructure deployment was excellent and essential. The process violation occurred when encountering unexpected test failures - a teaching moment for all agents on when to stop implementing and start researching.

**The goal is not to assign blame, but to build better processes that prevent similar issues in the future.**

---

**Analysis Completed By:** Agent A
**Date:** 2026-01-19
**Status:** Awaiting team review and decision on reset process
