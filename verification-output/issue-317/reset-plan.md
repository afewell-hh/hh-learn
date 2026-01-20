# Issue #317 - Reset Plan

**Date:** 2026-01-19
**Created By:** Agent A (Project Lead)
**Purpose:** Define concrete steps to reset Issue #317 following proper development process
**Reference:** `docs/DEVELOPMENT-PROCESS.md`

---

## Executive Summary

This plan resets Issue #317 to follow the five-phase development process:
1. Research → 2. Architecture → 3. Specification → 4. Test Plan → 5. TDD Implementation

**Current State:** ~15 files changed through iterative debugging without formal research/architecture/spec review.

**Goal:** Understand the legacy auth integration problem, design a proper solution, and implement it following TDD principles.

**Estimated Timeline:** 2-3 days (vs. continued debugging without clear end)

---

## Step 0: State Assessment & Rollback Decision

### Option A: Keep Current Changes (Recommended)

**Keep:**
- ✅ API Gateway custom domain (`api.hedgehog.cloud`) - Infrastructure is correct
- ✅ ACM certificate and DNS configuration - Working as intended
- ✅ Cognito callback URL updates - Necessary configuration
- ✅ Bug fixes (JWK→PEM conversion, API Gateway v2 cookie parsing) - Real bugs fixed
- ✅ `serverless deploy` for dev stage - Backend deployed correctly

**Rollback:**
- ❌ Template changes (courses-page, pathways-page, my-learning, etc.) - Revert to before debugging
- ❌ Compatibility patches in cognito-auth-integration.js - Remove override attempts
- ❌ Playwright auth.setup.ts and config changes - Revert to original test structure

**Rationale:**
- Infrastructure and bug fixes are solid and should be kept
- Frontend integration changes were exploratory and should be redone properly
- Keeps working backend while we properly design frontend integration

### Option B: Full Rollback (If Option A Too Complex)

**Rollback Everything Except:**
- ACM certificate (can't hurt to keep)
- DNS CNAME record (harmless)
- Bug fixes in Lambda (genuinely needed)

**Rollback:**
- All template changes
- All JS changes
- All test changes
- API Gateway custom domain mapping (temporarily)
- Cognito callback URL (revert to original)

**Rationale:**
- Clean slate approach
- Ensures we're not building on unstable foundation

### Decision Required

**User/Team to decide:** Option A or Option B?

**Default Recommendation:** Option A (keep infrastructure, rollback frontend)

---

## Step 1: Rollback (If Option A)

### Files to Revert

```bash
cd /home/ubuntu/afewell-hh/hh-learn

# Revert template changes
git checkout HEAD~{N} clean-x-hedgehog-templates/learn/courses-page.html
git checkout HEAD~{N} clean-x-hedgehog-templates/learn/pathways-page.html
git checkout HEAD~{N} clean-x-hedgehog-templates/learn/my-learning.html
git checkout HEAD~{N} clean-x-hedgehog-templates/learn/register.html
git checkout HEAD~{N} clean-x-hedgehog-templates/learn/action-runner.html
git checkout HEAD~{N} clean-x-hedgehog-templates/learn/macros/left-nav.html

# Revert JS compatibility patches
git checkout HEAD~{N} clean-x-hedgehog-templates/assets/js/cognito-auth-integration.js
git checkout HEAD~{N} clean-x-hedgehog-templates/learn/assets/js/cognito-auth-integration.js

# Revert Playwright changes
git checkout HEAD~{N} tests/e2e/auth.setup.ts
git checkout HEAD~{N} playwright.config.ts
git checkout HEAD~{N} tests/e2e/cognito-frontend-ux.spec.ts

# Commit rollback
git add -A
git commit -m "chore: rollback exploratory frontend changes for Issue #317

Keeping infrastructure (API Gateway, DNS, Cognito config) and bug fixes.
Reverting template/JS/test changes to restart with proper process.

Refs: #317"
```

**Note:** Replace `HEAD~{N}` with actual commit hash before the debugging cycle started.

### Files to Keep (No Revert)

- `dist-lambda/src/api/lambda/cognito-auth.js` - Bug fixes stay
- `.env` - COGNITO_REDIRECT_URI stays as `https://api.hedgehog.cloud/auth/callback`
- `serverless.yml` - No changes needed
- Infrastructure (ACM, API Gateway custom domain, DNS) - Stays deployed

### Verification After Rollback

```bash
# Verify we're at clean state for frontend
git status  # Should show rollback commit

# Verify backend still works
curl -i https://api.hedgehog.cloud/auth/me
# Expected: 401 (or 200 if still have valid cookies)

# Verify infrastructure
aws acm list-certificates --region us-west-2 | grep api.hedgehog.cloud
# Expected: Certificate listed

aws apigatewayv2 get-domain-names --region us-west-2 | grep api.hedgehog.cloud
# Expected: Domain name listed
```

---

## Phase 1: Research

### Deliverable

**Document:** `docs/issue-317-research.md`

**Time Estimate:** 4-6 hours

### Research Tasks

#### Task 1.1: Legacy Auth System Audit

**Owner:** Agent A or designated researcher

**Questions to Answer:**
1. Where is `auth-context.js` loaded?
   ```bash
   cd /home/ubuntu/afewell-hh/hh-learn
   grep -r "auth-context.js" clean-x-hedgehog-templates/
   ```

2. What does `auth-context.js` do?
   - Read the file
   - Document the API it exposes
   - Identify what state it manages

3. What features depend on it?
   - Search for `window.hhIdentity` usage in templates
   - Search for `hhIdentity.get()` calls
   - Document every usage

4. Can it be safely removed?
   - If removed, what breaks?
   - Are there other pages outside /learn that use it?

**Output:** Section in research doc listing all dependencies

#### Task 1.2: Cognito Integration Current State

**Questions to Answer:**
1. What does `cognito-auth-integration.js` currently do?
   - Read the file (pre-rollback version if needed)
   - Document the API it exposes
   - What state does it manage?

2. How does it interact with backend?
   - Calls to `/auth/me`
   - Cookie handling
   - Token refresh logic

3. What's the initialization flow?
   - When does it run?
   - What events does it listen for?
   - What events does it emit?

**Output:** Section in research doc documenting Cognito integration

#### Task 1.3: Template Requirements Analysis

**Questions to Answer:**
1. What do templates need from identity system?
   - Just email and contactId?
   - Anything else?

2. When do templates check auth state?
   - On page load?
   - After user actions?
   - Continuously?

3. What UI states exist?
   - Anonymous (not logged in)
   - Authenticated but not enrolled
   - Authenticated and enrolled
   - Authenticated and completed

**Output:** Section in research doc defining template requirements

#### Task 1.4: HubSpot CMS Constraints

**Questions to Answer:**
1. Script loading behavior
   - Are scripts loaded sequentially or parallel?
   - Can we control load order?
   - Are there async/defer implications?

2. Template rendering
   - Is it server-side or client-side?
   - Can templates access async state?
   - What's available at render time?

3. CSP and security
   - Content Security Policy restrictions?
   - Can we dynamically create scripts?
   - Can we use eval/Function?

**Research Methods:**
- Read HubSpot CMS documentation
- Test in browser DevTools
- Check existing templates for patterns

**Output:** Section in research doc documenting constraints

#### Task 1.5: Root Cause Analysis

**Questions to Answer:**
1. Why does `/auth/me` return 200 but UI doesn't update?
   - Timeline of events (script load → API call → identity state → UI render)
   - Where does the disconnect happen?
   - Is it timing, API contract, or state management?

2. Why does `window.hhCognitoAuth.refresh()` work but `window.hhIdentity.get()` returns empty?
   - Are they looking at different state?
   - Is there a write that's not happening?
   - Is there a read from wrong location?

**Output:** Root cause statement in research doc

### Research Document Structure

```markdown
# Issue #317 Research: Auth Integration Problem

**Date:** 2026-01-19
**Author:** {Agent Name}
**Status:** Draft

## Problem Statement
{Clear statement of the issue}

## Current State Analysis

### Legacy Auth System (auth-context.js)
- **Location:** {Where loaded}
- **API:** {What it exposes}
- **Dependencies:** {What uses it}
- **Can be removed?** {Yes/No and why}

### Cognito Auth Integration (cognito-auth-integration.js)
- **Location:** {Where loaded}
- **API:** {What it exposes}
- **Backend Integration:** {How it calls /auth/me}
- **Initialization:** {When and how}

### Template Requirements
- **Identity Data Needed:** {email, contactId, etc.}
- **Check Points:** {When auth state is checked}
- **UI States:** {All possible states}

### HubSpot CMS Constraints
- **Script Loading:** {Sequential/parallel, order guarantees}
- **Template Rendering:** {Server/client, async state access}
- **Security:** {CSP, eval restrictions}

## Root Cause Analysis
{Why does backend work but UI doesn't update?}

## Requirements
{What must the solution do?}

## Constraints
{What limits our options?}

## Unknowns & Risks
{What we still don't know}

## Recommendation
{Should we proceed to architecture phase?}
```

### Review & Approval

**Reviewers:** Project Lead + Architect

**Approval Criteria:**
- [ ] All research questions answered
- [ ] Root cause clearly identified
- [ ] Requirements complete
- [ ] No major unknowns remaining

**Action:** Submit research doc, await approval before proceeding to Phase 2.

---

## Phase 2: Architecture

### Deliverable

**Document:** `docs/issue-317-architecture.md`

**Time Estimate:** 3-4 hours

**Dependencies:** Phase 1 research approved

### Architecture Tasks

#### Task 2.1: Generate Options

Based on research findings, create 3-5 architectural options.

**Template for Each Option:**

```markdown
## Option {N}: {Name}

### Approach
{Brief description}

### Architecture Diagram
{Component diagram showing data flow}

### Implementation Steps
1. {Step 1}
2. {Step 2}
...

### Pros
- {Benefit 1}
- {Benefit 2}

### Cons
- {Drawback 1}
- {Drawback 2}

### Effort Estimate
{Time to implement}

### Risk Assessment
{High/Medium/Low and why}

### Rollback Plan
{How to revert if this fails}
```

#### Task 2.2: Comparison Matrix

Create table comparing all options:

| Criteria | Option 1 | Option 2 | Option 3 | Option 4 |
|----------|----------|----------|----------|----------|
| Effort | 3 days | 2 days | 1 day | 5 days |
| Risk | Low | Medium | High | Low |
| Maintainability | High | Medium | Low | High |
| Backward Compat | Yes | Yes | No | Yes |
| Technical Debt | None | Some | None | None |

#### Task 2.3: Recommendation

Based on comparison, recommend one option with clear justification:

```markdown
## Recommended Approach: Option {N}

### Rationale
{Why this option is best}

### Trade-offs Accepted
{What we're giving up}

### Why Alternatives Rejected
- **Option {X}:** {Why not}
- **Option {Y}:** {Why not}

### Success Criteria
{How we'll know it worked}
```

### Review & Approval

**Reviewers:** Project Lead + Architect + (Optional: User)

**Approval Criteria:**
- [ ] At least 3 options presented
- [ ] Each option has diagram
- [ ] Recommendation clearly justified
- [ ] Team consensus achieved

**Action:** Submit architecture doc, await approval before proceeding to Phase 3.

---

## Phase 3: Technical Specification

### Deliverable

**Document:** `docs/issue-317-spec.md`

**Time Estimate:** 2-3 hours

**Dependencies:** Phase 2 architecture approved

### Specification Tasks

#### Task 3.1: File Inventory

List every file that will be created, modified, or deleted:

```markdown
## Files to Create
- `clean-x-hedgehog-templates/assets/js/auth-adapter.js` - {Purpose}

## Files to Modify
- `clean-x-hedgehog-templates/learn/courses-page.html` - {What changes}
- `clean-x-hedgehog-templates/config/constants.json` - {What changes}

## Files to Delete
- (If any)
```

#### Task 3.2: Implementation Details

For each file, provide:
- Complete code or detailed pseudocode
- Before/after for modifications
- API contracts for new modules
- Configuration values

#### Task 3.3: Implementation Order

Define critical path:

```markdown
## Implementation Order

### Phase 1: Core Adapter (Blocking)
1. Create auth-adapter.js
2. Unit tests for adapter
3. Verify in isolation

### Phase 2: Template Integration (Depends on Phase 1)
1. Update courses-page.html
2. Update pathways-page.html
3. Update my-learning.html

### Phase 3: End-to-End Testing (Depends on Phase 2)
1. Deploy to staging
2. Run E2E tests
3. Manual validation
```

#### Task 3.4: Rollback Procedure

Specific steps to revert:

```markdown
## Rollback Plan

### If Problem Detected in Staging
1. Remove script tags for auth-adapter.js
2. Clear HubSpot cache
3. Verify legacy auth still works

### If Problem Detected in Production
1. Same as staging
2. Monitor CloudWatch for errors
3. Notify users if needed
```

### Review & Approval

**Reviewers:** Project Lead + (Optional: Peer Developer)

**Approval Criteria:**
- [ ] Every file change documented
- [ ] Code examples complete and correct
- [ ] Implementation order clear
- [ ] Rollback plan tested (mentally)

**Action:** Submit spec doc, await approval before proceeding to Phase 4.

---

## Phase 4: Test Plan

### Deliverable

**Document:** `tests/issue-317-test-plan.md`

**Time Estimate:** 2-3 hours

**Dependencies:** Phase 3 specification approved

### Test Plan Tasks

#### Task 4.1: Unit Test Specification

For each new module:

```markdown
## Unit Tests: auth-adapter.js

**File:** `tests/unit/auth-adapter.test.js`

### Test Cases

#### Test: syncIdentity() syncs Cognito email to hhIdentity
**Setup:**
- Mock window.hhCognitoAuth.getCurrentUser() to return { email: 'test@example.com', contactId: '123' }
- Mock window.hhIdentity.cache = {}

**Action:**
- Call syncIdentity()

**Assert:**
- window.hhIdentity.cache.email === 'test@example.com'
- window.hhIdentity.cache.contactId === '123'

#### Test: syncIdentity() handles missing hhCognitoAuth
{Similar structure}

#### Test: syncIdentity() dispatches hhIdentityReady event
{Similar structure}
```

#### Task 4.2: Integration Test Specification

For interfaces between modules:

```markdown
## Integration Tests: Cognito → Adapter → Legacy

**File:** `tests/integration/auth-integration.test.js`

### Test Cases

#### Test: Full auth flow updates legacy identity cache
**Setup:**
- Load all scripts in order
- Simulate successful Cognito auth

**Action:**
- Wait for initialization

**Assert:**
- window.hhIdentity.get() returns Cognito user data
- hhIdentityReady event fired
```

#### Task 4.3: E2E Test Specification

For user-facing flows:

```markdown
## E2E Tests: Auth UX

**File:** `tests/e2e/cognito-frontend-ux.spec.ts`

### Test Cases

#### Test: Authenticated user sees enrollment CTA
**Given:**
- User has valid auth cookies from previous login

**When:**
- Visit /learn/courses/course-authoring-101

**Then:**
- Page loads with "Enroll in Course" CTA visible
- "Sign in to enroll" CTA not present
- window.hhIdentity.get() returns user email

#### Test: Auth state persists across navigation
{Similar structure}

#### Test: Logout clears identity and shows sign-in CTA
{Similar structure}
```

#### Task 4.4: Acceptance Criteria

```markdown
## Acceptance Criteria

### Functional
- [ ] All 13 E2E tests pass
- [ ] All unit tests pass
- [ ] All integration tests pass

### Manual
- [ ] Can log in and see enrollment CTA
- [ ] Can log out and see sign-in CTA
- [ ] Identity persists across page navigation
- [ ] No console errors on any /learn page

### Performance
- [ ] Page load time < 2 seconds
- [ ] Identity check completes < 500ms

### Compatibility
- [ ] Works in Chrome, Firefox, Safari
- [ ] Works on mobile devices
```

### Review & Approval

**Reviewers:** Project Lead + QA

**Approval Criteria:**
- [ ] All functional requirements have tests
- [ ] Edge cases covered
- [ ] Acceptance criteria measurable
- [ ] Tests can be written before implementation

**Action:** Submit test plan, await approval before proceeding to Phase 5.

---

## Phase 5: TDD Implementation

### Deliverable

**Code:** Implementation following specification

**Time Estimate:** 1-2 days

**Dependencies:** Phase 4 test plan approved

### Implementation Tasks

#### Task 5.1: Unit Test Implementation

```bash
# Write unit tests (should fail)
# File: tests/unit/auth-adapter.test.js

npm run test:unit -- tests/unit/auth-adapter.test.js
# Expected: FAIL (not implemented yet)
```

#### Task 5.2: Module Implementation

```bash
# Implement auth-adapter.js per spec
# File: clean-x-hedgehog-templates/assets/js/auth-adapter.js

npm run test:unit -- tests/unit/auth-adapter.test.js
# Expected: PASS
```

#### Task 5.3: Integration Test Implementation

```bash
# Write integration tests
npm run test:integration -- tests/integration/auth-integration.test.js
# Expected: FAIL (templates not updated yet)
```

#### Task 5.4: Template Updates

```bash
# Update templates per spec
# Files: courses-page.html, pathways-page.html, etc.

npm run test:integration
# Expected: PASS
```

#### Task 5.5: E2E Test Updates

```bash
# Update E2E tests per test plan
npm run test:e2e:local
# Expected: PASS
```

#### Task 5.6: Code Review

**PR Format:**

```markdown
# Fix auth integration - adapter pattern for legacy/Cognito sync

## Summary
Implements adapter layer to synchronize Cognito authentication with legacy
hhIdentity cache, resolving Issue #317.

## Approach
- Created auth-adapter.js that bridges Cognito and legacy systems
- Updated templates to load adapter after both auth systems
- Updated E2E tests to validate complete flow

## Implementation
**Research:** docs/issue-317-research.md
**Architecture:** docs/issue-317-architecture.md (Option 2: Adapter Layer)
**Specification:** docs/issue-317-spec.md
**Test Plan:** tests/issue-317-test-plan.md

## Testing
- [x] Unit tests pass (12/12)
- [x] Integration tests pass (5/5)
- [x] E2E tests pass (13/13)
- [x] Manual testing complete
- [x] Staging deployment validated

## Rollback Plan
See docs/issue-317-spec.md#rollback-plan

Closes #317
```

#### Task 5.7: Deployment

**Staging First:**

```bash
# Deploy to staging
npm run publish:template -- clean-x-hedgehog-templates/learn/courses-page.html
# ... (all modified templates)

npm run publish:asset -- clean-x-hedgehog-templates/assets/js/auth-adapter.js

# Run E2E against staging
npm run test:e2e:staging

# Manual validation checklist
- [ ] Visit staging.hedgehog.cloud/learn/courses/course-authoring-101
- [ ] Not logged in: See "Sign in to enroll"
- [ ] Log in via Cognito
- [ ] After login: See "Enroll in Course"
- [ ] Navigate to another course
- [ ] Identity persists
- [ ] Log out
- [ ] See "Sign in to enroll" again
```

**Production After Staging Validated:**

```bash
# Publish to production
npm run publish:template:production
npm run publish:asset:production

# Smoke tests
curl -i https://hedgehog.cloud/learn/courses/course-authoring-101
# Check response time, no errors

# Monitor
# Check CloudWatch for errors in first 30 minutes
# Check browser console for errors
# Test login flow manually
```

#### Task 5.8: Post-Deployment

**Documentation:**

```bash
# Update CHANGELOG.md
# Update docs with any learnings
# Close Issue #317 with summary
```

**Monitoring:**

```markdown
## Post-Deployment Checklist

### First 1 Hour
- [ ] No CloudWatch errors
- [ ] Manual login test passes
- [ ] Page load metrics normal

### First 24 Hours
- [ ] No support tickets about login
- [ ] Analytics show normal enrollment rate
- [ ] Error rate < 0.1%

### First Week
- [ ] Performance metrics stable
- [ ] No regression reports
```

---

## Timeline

### Optimistic (Everything Goes Smoothly)

| Phase | Time | Cumulative |
|-------|------|------------|
| Rollback | 1 hour | 1 hour |
| Research | 4 hours | 5 hours |
| Architecture | 3 hours | 8 hours (1 day) |
| Specification | 2 hours | 10 hours |
| Test Plan | 2 hours | 12 hours (1.5 days) |
| Implementation | 8 hours | 20 hours (2.5 days) |
| Review + Deploy | 4 hours | 24 hours (3 days) |

**Total: 3 days**

### Realistic (Includes Review Cycles)

| Phase | Time | Review | Cumulative |
|-------|------|--------|------------|
| Rollback | 1 hour | - | 1 hour |
| Research | 6 hours | 2 hours | 9 hours |
| Architecture | 4 hours | 2 hours | 15 hours (2 days) |
| Specification | 3 hours | 1 hour | 19 hours |
| Test Plan | 3 hours | 1 hour | 23 hours (3 days) |
| Implementation | 12 hours | 4 hours | 39 hours (5 days) |
| Deploy + Monitor | 4 hours | - | 43 hours (5.5 days) |

**Total: 5-6 days (1 week)**

---

## Success Metrics

### Process Success

- [ ] All 5 phases completed with documented reviews
- [ ] No "ad-hoc debugging" cycles
- [ ] All changes traced to approved spec
- [ ] Team learned from process

### Technical Success

- [ ] All E2E tests pass
- [ ] Auth UX works in production
- [ ] No regression in existing features
- [ ] Performance within acceptable range

### Long-Term Success

- [ ] Solution is maintainable
- [ ] Architecture is documented
- [ ] Can be extended for future auth needs
- [ ] Team confident in approach

---

## Appendix: Questions for Team

Before starting, resolve these questions:

1. **Rollback Decision:** Option A (keep infrastructure) or Option B (full rollback)?

2. **Resource Assignment:** Who will execute each phase?
   - Research: {Agent Name}
   - Architecture: {Agent Name}
   - Specification: {Agent Name}
   - Test Plan: {Agent Name}
   - Implementation: {Agent Name}

3. **Review Process:** Who reviews and approves each phase?
   - Research: {Reviewer}
   - Architecture: {Reviewer}
   - Specification: {Reviewer}
   - Test Plan: {Reviewer}
   - Code Review: {Reviewer}

4. **Timeline:** Is 5-6 day timeline acceptable? Or expedite with parallel work?

5. **Scope:** Are there any additional requirements not captured in Issue #317?

---

**Reset Plan Version:** 1.0
**Created:** 2026-01-19
**Status:** Awaiting team approval to proceed
**Next Action:** Get answers to Appendix questions, then begin Phase 1 (Research)
