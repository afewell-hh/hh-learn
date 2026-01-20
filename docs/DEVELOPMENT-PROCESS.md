# HH-Learn Development Process

**Effective Date:** 2026-01-19
**Audience:** All development agents and contributors
**Authority:** Project Lead

---

## Purpose

This document defines the **required development process** for all non-trivial changes to the hh-learn project. Following this process ensures:

- Thorough research before implementation
- Architectural decisions are documented and reviewed
- Technical specifications are clear and complete
- Tests are written before code
- Changes can be reviewed, understood, and maintained

**Violations of this process create technical debt, undocumented decisions, and risk of repeated mistakes.**

---

## When This Process Applies

### ✅ Use This Process For:

- **New features** (e.g., adding course export functionality)
- **Architectural changes** (e.g., switching auth systems, changing data models)
- **Integration work** (e.g., connecting to new external APIs)
- **Refactoring** that affects multiple files or changes interfaces
- **Bug fixes** that require understanding system architecture
- **Infrastructure changes** (e.g., adding new AWS services)
- **Any change that affects user-facing behavior**
- **Any deviation from an approved plan**

### ❌ Skip This Process For:

- **Trivial bug fixes** (typos, obvious one-line fixes)
- **Documentation updates** (unless changing architecture docs)
- **Dependency updates** (standard npm/pip updates)
- **Configuration tweaks** (changing timeout values, etc.)
- **Test data updates** (adding test fixtures)

**When in doubt, use this process. It's better to over-document than under-document.**

---

## The Five-Phase Process

```
1. Research → 2. Architecture → 3. Specification → 4. Test Plan → 5. TDD Implementation
     ↓              ↓                 ↓                 ↓               ↓
   Review        Review            Review            Review          Review
```

**Each phase must be completed and reviewed before proceeding to the next.**

---

## Phase 1: Research

### Goal
Understand the problem space thoroughly before proposing solutions.

### Deliverables

**Document:** `docs/issue-{N}-research.md`

**Must Include:**

1. **Problem Statement**
   - What are we trying to solve?
   - Why does this problem exist?
   - What's the impact if we don't solve it?

2. **Current State Analysis**
   - How does the system currently work?
   - What code/components are involved?
   - What constraints exist?

3. **Requirements**
   - Functional requirements (what must it do?)
   - Non-functional requirements (performance, security, etc.)
   - User experience requirements
   - Integration requirements

4. **Constraints & Dependencies**
   - Platform limitations (HubSpot, AWS, etc.)
   - Existing architecture that can't change
   - Budget/time constraints
   - Third-party service limitations

5. **Unknowns & Risks**
   - What don't we know yet?
   - What could go wrong?
   - What assumptions are we making?

6. **Related Work**
   - Have we solved similar problems before?
   - What do industry best practices suggest?
   - What do platform docs recommend?

### Review Criteria

- [ ] Problem clearly stated and understood
- [ ] Current state accurately documented
- [ ] Requirements complete and testable
- [ ] Constraints identified
- [ ] Risks assessed
- [ ] No major unknowns remaining

### Example: Issue #317 Research (What Should Have Happened)

```markdown
# Issue #317 Research: Auth Integration Unexpected Behavior

## Problem Statement
After deploying Cognito auth backend, `/auth/me` returns 200 with valid user data,
but frontend UI doesn't update to reflect authenticated state. Enrollment CTA stays
as "Sign in" instead of "Enroll".

## Current State Analysis
- Legacy `auth-context.js` is loaded on all /learn pages
- New `cognito-auth-integration.js` also loaded
- Both define `window.hhIdentity` API
- Templates check `window.hhIdentity.get()` to determine auth state
- Script load order: auth-context.js → cognito-auth-integration.js

## Requirements
- Authenticated users must see "Enroll" CTA, not "Sign in"
- Identity state must persist across page navigations
- Must work with HubSpot CMS template engine
- Must not break existing features that depend on auth

## Constraints
- Cannot change HubSpot script loading behavior (sequential, blocking)
- Must maintain backward compatibility with existing /learn pages
- Cannot add build step to HubSpot templates

## Unknowns & Risks
- UNKNOWN: What other features depend on legacy auth-context.js?
- UNKNOWN: Can we safely override window.hhIdentity?
- RISK: Removing legacy auth might break other pages
- RISK: CSP violations if we dynamically create scripts

## Related Work
- Phase 6 specs for frontend integration (review for gaps)
- HubSpot CMS best practices for async state management
```

**Action:** Submit for review. Once approved, proceed to Phase 2.

---

## Phase 2: Architecture

### Goal
Design the solution architecture and evaluate alternatives.

### Deliverables

**Document:** `docs/issue-{N}-architecture.md`

**Must Include:**

1. **High-Level Design**
   - System diagram showing components and data flow
   - Sequence diagrams for key interactions
   - State management approach

2. **Options Analysis**
   - Minimum 3 architectural options
   - Pros/cons for each option
   - Comparison matrix (effort, risk, maintainability)

3. **Recommended Approach**
   - Which option and why
   - Trade-offs being made
   - Why alternatives were rejected

4. **Integration Points**
   - What existing systems are affected
   - What new interfaces are created
   - What contracts must be maintained

5. **Rollback Strategy**
   - How to revert if this doesn't work
   - What's the fallback plan
   - How do we detect if we need to rollback

6. **Migration Path** (if applicable)
   - Incremental steps to reach end state
   - How to maintain service during migration
   - What gets deprecated and when

### Review Criteria

- [ ] At least 3 options presented
- [ ] Recommendation clearly justified
- [ ] Integration points identified
- [ ] Rollback plan defined
- [ ] Diagrams are clear and complete
- [ ] Team consensus on approach

### Example: Issue #317 Architecture Options

```markdown
# Issue #317 Architecture: Auth Integration Resolution

## Option 1: Full Replacement (Remove Legacy Auth)
**Approach:** Remove auth-context.js completely, use only Cognito

**Pros:**
- Clean, single source of truth
- No integration complexity
- Easier to maintain long-term

**Cons:**
- High risk if other features depend on legacy auth
- Requires audit of all /learn pages
- Bigger change, more testing needed

**Effort:** 3-5 days
**Risk:** High (unknown dependencies)

## Option 2: Adapter Layer (Bridge Both Systems)
**Approach:** Keep both, create integration layer that syncs identity

**Pros:**
- Backward compatible
- Can migrate incrementally
- Isolated change

**Cons:**
- Maintains technical debt
- Two auth systems to maintain
- Synchronization bugs possible

**Effort:** 2-3 days
**Risk:** Medium (complexity in sync logic)

## Option 3: Cognito Takes Precedence (Override Pattern)
**Approach:** Load both scripts, have Cognito override hhIdentity

**Pros:**
- Minimal change to templates
- Backward compatible
- Quick to implement

**Cons:**
- Relies on script load order
- Fragile, hard to test
- Hides underlying conflict

**Effort:** 1-2 days
**Risk:** Medium (timing issues)

## Recommended Approach: Option 2 (Adapter Layer)

**Rationale:**
- We don't know all dependencies on legacy auth (need research)
- Allows incremental migration
- Lower risk than full replacement
- Can switch to Option 1 later after audit

**Trade-offs:**
- Accepting temporary complexity for safety
- Paying maintenance cost for backward compatibility
```

**Action:** Submit for review. Once approved, proceed to Phase 3.

---

## Phase 3: Technical Specification

### Goal
Define exactly what will be implemented, file by file.

### Deliverables

**Document:** `docs/issue-{N}-spec.md`

**Must Include:**

1. **File Changes**
   ```markdown
   ## Files to Modify

   ### `src/frontend/auth-adapter.js` (NEW)
   **Purpose:** Bridge legacy and Cognito auth systems

   **Exports:**
   - `initAuthAdapter()` - Initialize adapter
   - `syncIdentity()` - Sync Cognito → legacy cache

   **Dependencies:**
   - Requires: window.hhCognitoAuth
   - Writes to: window.hhIdentity
   ```

2. **API Definitions**
   - Function signatures
   - Input/output types
   - Error handling
   - Examples of usage

3. **Configuration Changes**
   - Environment variables
   - Constants
   - HubSpot settings
   - AWS resource updates

4. **Data Model Changes** (if applicable)
   - Schema updates
   - Migration scripts
   - Backward compatibility

5. **Dependencies**
   - New packages to install
   - Version upgrades needed
   - Platform requirements

6. **Implementation Order**
   - What must be built first
   - What can be built in parallel
   - Critical path

7. **Rollback Plan**
   - How to revert each change
   - What order to revert
   - How to verify rollback succeeded

### Review Criteria

- [ ] Every file change documented with purpose
- [ ] APIs completely specified
- [ ] Configuration changes listed
- [ ] Dependencies identified
- [ ] Implementation order clear
- [ ] Rollback plan tested (mentally)
- [ ] No ambiguity remaining

### Example: Issue #317 Specification Excerpt

```markdown
# Issue #317 Technical Specification

## Files to Create

### `clean-x-hedgehog-templates/assets/js/auth-adapter.js`

**Purpose:** Synchronize Cognito identity to legacy hhIdentity cache

**Implementation:**
```javascript
// Adapter that bridges Cognito auth to legacy hhIdentity
(function() {
  'use strict';

  function syncIdentity() {
    // Wait for both systems to initialize
    if (!window.hhCognitoAuth || !window.hhIdentity) {
      setTimeout(syncIdentity, 100);
      return;
    }

    // Get Cognito identity
    const cognitoIdentity = window.hhCognitoAuth.getCurrentUser();

    // Write to legacy cache
    window.hhIdentity.cache = {
      email: cognitoIdentity?.email || '',
      contactId: cognitoIdentity?.contactId || ''
    };

    // Trigger legacy ready event
    window.dispatchEvent(new Event('hhIdentityReady'));
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncIdentity);
  } else {
    syncIdentity();
  }
})();
```

**Load Order:**
1. auth-context.js (legacy)
2. cognito-auth-integration.js
3. auth-adapter.js (new)

## Files to Modify

### `clean-x-hedgehog-templates/learn/courses-page.html`

**Change:** Add auth-adapter.js script tag after cognito-auth-integration.js

**Before:**
```html
<script src="/assets/js/cognito-auth-integration.js"></script>
</head>
```

**After:**
```html
<script src="/assets/js/cognito-auth-integration.js"></script>
<script src="/assets/js/auth-adapter.js"></script>
</head>
```

**Reason:** Adapter must load after both auth systems

## Rollback Plan

1. Remove script tag for auth-adapter.js from all templates
2. Clear HubSpot CMS cache
3. Verify legacy auth-context.js still works standalone
4. Monitor for errors in browser console
```

**Action:** Submit for review. Once approved, proceed to Phase 4.

---

## Phase 4: Test Plan

### Goal
Define how we'll verify the implementation works correctly.

### Deliverables

**Document:** `tests/issue-{N}-test-plan.md`

**Must Include:**

1. **Test Scenarios**
   - User stories with expected behavior
   - Edge cases
   - Error conditions
   - Performance requirements

2. **Test Types**
   - Unit tests (what functions/modules)
   - Integration tests (what interfaces)
   - E2E tests (what user flows)
   - Manual tests (what can't be automated)

3. **Test Data**
   - Test accounts needed
   - Sample data requirements
   - Environment setup

4. **Acceptance Criteria**
   - What must pass for "done"
   - What's the definition of success
   - What metrics to monitor

5. **Test Implementation**
   - File locations for new tests
   - Test framework/tools to use
   - How to run tests locally
   - How tests run in CI/CD

### Review Criteria

- [ ] All functional requirements have tests
- [ ] Edge cases covered
- [ ] Acceptance criteria measurable
- [ ] Tests can be written before implementation (TDD)
- [ ] Clear pass/fail criteria

### Example: Issue #317 Test Plan Excerpt

```markdown
# Issue #317 Test Plan

## E2E Test Scenarios

### Scenario 1: Anonymous User Sees Sign-In CTA
**Given:** User not authenticated
**When:** Visit /learn/courses/course-authoring-101
**Then:**
- See "Sign in to enroll" CTA
- Click CTA redirects to Cognito
- window.hhIdentity.get() returns { email: '', contactId: '' }

**Test File:** `tests/e2e/cognito-frontend-ux.spec.ts`
**Test Name:** `should show sign-in CTA for anonymous user`

### Scenario 2: Authenticated User Sees Enrollment CTA
**Given:** User authenticated via Cognito
**When:** Visit /learn/courses/course-authoring-101
**Then:**
- See "Enroll in Course" CTA (NOT "Sign in")
- window.hhIdentity.get() returns { email: 'user@example.com', contactId: '123' }
- window.hhCognitoAuth.getCurrentUser() matches window.hhIdentity.get()

**Test File:** `tests/e2e/cognito-frontend-ux.spec.ts`
**Test Name:** `should show enrollment CTA for authenticated user`

## Unit Tests

### Test: auth-adapter.js syncIdentity()
**File:** `tests/unit/auth-adapter.test.js`

**Cases:**
- Syncs Cognito email to hhIdentity.cache.email
- Syncs Cognito contactId to hhIdentity.cache.contactId
- Handles missing hhCognitoAuth gracefully
- Handles missing hhIdentity gracefully
- Dispatches hhIdentityReady event after sync

## Acceptance Criteria

- [ ] All 13 E2E tests pass
- [ ] Manual test: Login and see enrollment CTA
- [ ] Manual test: Logout and see sign-in CTA
- [ ] Manual test: Navigate between courses, identity persists
- [ ] No console errors on any /learn page
- [ ] window.hhIdentity.get() matches Cognito identity
```

**Action:** Submit for review. Once approved, proceed to Phase 5.

---

## Phase 5: TDD Implementation

### Goal
Implement the specification using test-driven development.

### Process

1. **Write Failing Tests First**
   ```bash
   # Write test per test plan
   # Run test - should FAIL
   npm run test:unit -- tests/unit/auth-adapter.test.js
   # Expected: FAIL (not implemented yet)
   ```

2. **Implement Minimum Code to Pass**
   ```bash
   # Write implementation per spec
   # Run test - should PASS
   npm run test:unit -- tests/unit/auth-adapter.test.js
   # Expected: PASS
   ```

3. **Refactor If Needed**
   - Improve code quality
   - Keep tests passing
   - Don't add features not in spec

4. **Repeat for Each Component**
   - One test file at a time
   - One implementation file at a time
   - Commit after each passing test

5. **Integration Testing**
   ```bash
   # Run all tests together
   npm run test:all
   # Expected: All PASS
   ```

6. **Code Review**
   - Create PR with all changes
   - Reference issue and spec docs
   - Show test results in PR description

### Commit Message Format

```
type(scope): brief description

Detailed explanation of what changed and why.

Implements: #issue-number
Spec: docs/issue-{N}-spec.md
Tests: tests/issue-{N}-test-plan.md
```

**Types:** feat, fix, refactor, test, docs, chore

### Review Criteria

- [ ] All tests pass
- [ ] Code matches specification exactly
- [ ] No undocumented changes
- [ ] Commits are atomic and well-described
- [ ] PR references issue and docs
- [ ] Staging deployment succeeds
- [ ] Manual testing checklist complete

### Deployment

1. **Staging First**
   ```bash
   # Deploy to staging environment
   npm run deploy:staging

   # Run full test suite against staging
   npm run test:e2e:staging

   # Manual testing checklist
   ```

2. **Production Only After Staging Validated**
   ```bash
   # Deploy to production
   npm run deploy:production

   # Monitor for errors
   # Run smoke tests
   ```

3. **Post-Deployment Monitoring**
   - Check CloudWatch for errors
   - Verify user flows in production
   - Monitor performance metrics

---

## Deviation from Plan

### What If Things Don't Work As Expected?

**STOP. Do not continue debugging.**

#### Minor Deviation
**Definition:** Small, isolated issue not requiring architectural change

**Example:**
- Wrong CSS selector in test
- Typo in variable name
- Off-by-one error

**Action:**
- Fix in place
- Update spec doc to reflect fix
- Add comment explaining why deviated
- Continue implementation

#### Major Deviation
**Definition:** Core assumption was wrong, requires rethinking approach

**Example:**
- "We assumed HubSpot supports async script loading" → It doesn't
- "We thought legacy auth was unused" → Found 10 dependencies
- "We expected /auth/me to return 200" → Returns 401 for architectural reason

**Action:**
1. **STOP IMPLEMENTATION**
2. Document what was discovered in Issue #{N}
3. Return to Phase 1 (Research) with new information
4. Re-evaluate architecture (Phase 2)
5. Update spec (Phase 3) if architecture changes
6. Update tests (Phase 4) if requirements change
7. Only then continue implementation (Phase 5)

**Example:** Issue #317 was a major deviation that required stopping and restarting the process.

---

## Process Enforcement

### Agent Self-Check

Before proceeding to next phase, ask yourself:

- [ ] Have I completed all deliverables for current phase?
- [ ] Have I submitted docs for review?
- [ ] Have I received approval to proceed?
- [ ] Am I tempted to "just try something quick"? (RED FLAG)
- [ ] Do I fully understand what I'm implementing?

### Red Flags That Mean "Stop and Research"

- "Let me try this and see if it works" → STOP, research first
- "I'll debug this and document later" → STOP, document now
- "We can refactor after it works" → STOP, spec it first
- "Just a quick fix" that touches 5+ files → STOP, create spec
- "I don't know why this works but it does" → STOP, understand first

---

## Templates

### Research Document Template

```markdown
# Issue #{N} Research: {Title}

**Date:** YYYY-MM-DD
**Author:** {Agent Name}
**Status:** Draft | Under Review | Approved

## Problem Statement
{What problem are we solving?}

## Current State Analysis
{How does it work now?}

## Requirements
{What must the solution do?}

## Constraints & Dependencies
{What limits our options?}

## Unknowns & Risks
{What don't we know? What could go wrong?}

## Related Work
{Have we solved this before? Industry practices?}

## Recommendation
{Should we proceed? What's next?}
```

### Architecture Document Template

```markdown
# Issue #{N} Architecture: {Title}

**Date:** YYYY-MM-DD
**Author:** {Agent Name}
**Status:** Draft | Under Review | Approved

## High-Level Design
{Diagrams and narrative}

## Option 1: {Name}
**Approach:** {Brief description}
**Pros:** {Benefits}
**Cons:** {Drawbacks}
**Effort:** {Time estimate}
**Risk:** {Risk level and explanation}

## Option 2: {Name}
{Same structure}

## Option 3: {Name}
{Same structure}

## Recommended Approach
{Which option and why}

## Trade-offs
{What are we accepting/rejecting}

## Rollback Strategy
{How to revert}
```

### Specification Document Template

```markdown
# Issue #{N} Technical Specification: {Title}

**Date:** YYYY-MM-DD
**Author:** {Agent Name}
**Status:** Draft | Under Review | Approved

## Files to Create
{List each new file with purpose and implementation}

## Files to Modify
{List each changed file with before/after}

## API Definitions
{Function signatures, types, examples}

## Configuration Changes
{Env vars, constants, settings}

## Implementation Order
{What order to build in}

## Rollback Plan
{How to revert each change}
```

### Test Plan Template

```markdown
# Issue #{N} Test Plan: {Title}

**Date:** YYYY-MM-DD
**Author:** {Agent Name}
**Status:** Draft | Under Review | Approved

## Test Scenarios
{User stories with expected behavior}

## Unit Tests
{What functions to test}

## Integration Tests
{What interfaces to test}

## E2E Tests
{What user flows to test}

## Acceptance Criteria
{What must pass for "done"}
```

---

## Summary

**Remember:** This process exists to prevent problems like Issue #317, where iterative debugging without research created technical debt and undocumented decisions.

**The process is:**
1. Research thoroughly
2. Design with alternatives
3. Specify completely
4. Test before coding
5. Implement with discipline

**When in doubt, err on the side of more documentation, not less.**

---

**Process Version:** 1.0
**Last Updated:** 2026-01-19
**Next Review:** After 5 issues completed using this process
