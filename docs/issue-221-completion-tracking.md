---
title: "Issue #221 - Completion Tracking Implementation"
date: 2025-10-20
status: "in-progress"
milestone: "Learn MVP"
priority: "P1"
---

# Issue #221: Completion Tracking for Hierarchical Progress

## Overview

This document describes the implementation of metadata-driven completion tracking for courses and pathways, addressing the false-positive completion issues identified in PR #219.

**Problem**: The original completion calculation compared partial progress snapshots against themselves, leading to premature "complete" flags when users had only started a pathway/course.

**Solution**: Compare actual progress against full course/pathway definitions from content metadata, ensuring completion requires ALL modules/courses in the definition.

## Implementation Phases

### Phase 1: Completion Calculation Engine ✅

**Files**: `src/api/lambda/completion.ts`

**Key Features**:
- Metadata cache loaded at Lambda cold start (~10ms for 50-100 courses/pathways)
- `calculateCourseCompletion()`: Checks if all modules in course definition are complete
- `calculatePathwayCompletion()`: Checks if all courses in pathway definition are complete
- Handles reused modules across courses (module completion is reusable)
- Returns both completion flag and progress ratio (e.g., 2/4 modules complete)

**Design Decisions**:
- All modules in a course are required (no optional modules yet)
- All courses in a pathway are required (no optional courses yet)
- Empty courses/pathways are never complete (defensive)
- Missing metadata returns `{completed: false, progress: {completed: 0, total: 0}}`

**Evidence**:
- Code: `src/api/lambda/completion.ts:163-264`
- Tests: `tests/completion.test.ts`
- Commit: `0d692ba`

---

### Phase 2: Explicit Completion Event Handlers ✅

**Files**: `src/api/lambda/index.ts` (lines 784-868)

**Key Features**:
- `learning_course_completed` event validation
- `learning_pathway_completed` event validation
- Timestamp validation (±5 minute tolerance)
- Strict validation: reject events that don't match actual progress

**Validation Policy**:
```typescript
if (validateExplicitCompletion(type, slug, progressData).valid) {
  // Accept completion, use explicit or inferred timestamp
} else {
  // Reject with 400 error, log structured failure
}
```

**Timestamp Handling**:
- Accept explicit timestamp if within ±5 minutes of inferred completion time
- Log warning if mismatch, but still accept completion
- Inferred time = latest child completion timestamp

**Evidence**:
- Code: `src/api/lambda/index.ts:784-868`
- Tests: `tests/completion-lambda.test.ts`
- Commit: `7749264`

---

### Phase 3: Anti-Regression Tests ✅

**Test Coverage**:

1. **Unit Tests** (`tests/completion.test.ts`):
   - ✅ Reused modules across courses
   - ✅ Partial progress tracking
   - ✅ Completion timestamp validation
   - ✅ Mixed hierarchical/flat structures
   - ✅ Edge cases (empty courses, missing metadata)
   - ✅ Explicit completion validation

2. **Integration Tests** (`tests/completion-migration.test.ts`):
   - ✅ Dry-run mode validation (no mutation)
   - ✅ Started/completed counts accuracy
   - ✅ Reused modules handling
   - ✅ Hierarchical progress structure
   - ✅ Migration correctness (false-positive detection)
   - ✅ Batch processing scenarios

3. **Lambda Handler Tests** (`tests/completion-lambda.test.ts`):
   - ✅ Valid `learning_course_completed` events accepted
   - ✅ Invalid completion claims rejected with structured errors
   - ✅ Valid `learning_pathway_completed` events accepted
   - ✅ Invalid pathway claims rejected
   - ✅ Timestamp validation (±5 min tolerance)
   - ✅ Edge cases (null data, missing fields, case sensitivity)

**CI Integration**:
- Tests run automatically via `.github/workflows/validation-tests.yml`
- Triggered on PRs and pushes to `main`
- Runs with `npx tsx tests/completion*.test.ts`

**Evidence**:
- Test files: `tests/completion*.test.ts`
- CI config: `.github/workflows/validation-tests.yml:49-56`

---

### Phase 4: Backfill Tool ✅

**File**: `src/scripts/backfill-completion-flags.ts`

**Purpose**: Standalone script to recalculate course and pathway completion flags for all contacts, ensuring data integrity after engine deployment.

**Usage**:
```bash
npm run build

# Dry-run (preview changes)
node dist/scripts/backfill-completion-flags.js --dry-run

# Live run (persist changes)
node dist/scripts/backfill-completion-flags.js

# Single contact (testing)
node dist/scripts/backfill-completion-flags.js --contact-id=123 --dry-run

# Batch processing
node dist/scripts/backfill-completion-flags.js --batch-size=100

# Skip already-synced contacts (idempotent)
node dist/scripts/backfill-completion-flags.js --skip-synced
```

**Features**:
- ✅ Dry-run mode (`--dry-run`)
- ✅ Batch processing (`--batch-size`, default 50)
- ✅ Single contact mode (`--contact-id`)
- ✅ Idempotent (`--skip-synced`)
- ✅ Progress metrics logged to console
- ✅ Outputs saved to `verification-output/issue-221/`
  - `backfill-summary.json` - Overall metrics
  - `backfill-changes.json` - Contact-level change details
  - `backfill-failures.json` - Validation/processing errors
- ✅ Safe to rerun (won't duplicate changes)

**Output Format**:
```json
{
  "total_contacts": 1000,
  "processed": 1000,
  "updated": 250,
  "skipped_synced": 700,
  "failed": 50,
  "validation_errors": 10,
  "courses_updated": 150,
  "pathways_updated": 100,
  "start_time": "2025-10-20T12:00:00Z",
  "end_time": "2025-10-20T12:15:00Z",
  "duration_seconds": 900
}
```

**Evidence**:
- Code: `src/scripts/backfill-completion-flags.ts`

---

## Rollback Procedures

### Pre-Requisites
- Always run backfill tool in `--dry-run` mode first
- Review change counts in `backfill-summary.json` before live run
- Keep backup of `backfill-changes.json` for rollback reference

### Rollback Steps

#### Option 1: Using Migration Snapshots (if migration ran)
If you ran the hierarchical progress migration (Issue #215), snapshots exist:

```bash
# Restore from snapshots (verify mode)
node dist/scripts/rollback-progress-migration.js --verify

# Restore from snapshots (live)
node dist/scripts/rollback-progress-migration.js
```

**Snapshot Location**: `verification-output/issue-215/snapshots/contact-{id}-before.json`

#### Option 2: Revert Specific Contacts
Use `backfill-changes.json` to identify affected contacts and manually revert:

```bash
# Example: Read changes file
cat verification-output/issue-221/backfill-changes.json | jq '.[] | select(.contact_id == "12345")'

# Manually update contact via HubSpot API or CRM UI
# Set course/pathway completed flags to previous values
```

#### Option 3: Re-run Backfill with Different Metadata
If metadata was incorrect, fix metadata files and re-run:

```bash
# 1. Fix course/pathway JSON files in content/
# 2. Rebuild
npm run build

# 3. Re-run backfill (dry-run first)
node dist/scripts/backfill-completion-flags.js --dry-run

# 4. Review changes, then run live
node dist/scripts/backfill-completion-flags.js
```

### Validation After Rollback
```bash
# Check specific contact
node dist/scripts/backfill-completion-flags.js --contact-id=12345 --dry-run

# Should show 0 changes if rollback successful
```

---

## Testing Approach

### Six Key Scenarios Covered

1. **Reused Modules**:
   - Module appears in multiple courses (e.g., "accessing-vlab-with-gcp")
   - Module completion counts toward all courses that include it
   - Test: `tests/completion.test.ts:54-107`

2. **Partial Progress**:
   - Course 2/4 modules complete → not complete (0.5 progress)
   - Pathway 1/3 courses complete → not complete (0.33 progress)
   - Test: `tests/completion.test.ts:113-167`

3. **Completion Timestamp Validation**:
   - Accept timestamps within ±5 minutes
   - Reject timestamps outside tolerance
   - Test: `tests/completion.test.ts:173-227`

4. **Mixed Hierarchical/Flat Structures**:
   - Pathway → Course → Module (hierarchical)
   - Course → Module (flat, no pathway)
   - Test: `tests/completion.test.ts:233-282`

5. **Edge Cases**:
   - Missing metadata → return not-complete
   - Empty courses/pathways → never complete
   - Null/undefined flags → treat as false
   - Test: `tests/completion.test.ts:288-368`

6. **Explicit Completion Validation**:
   - Valid claims accepted (all modules/courses complete)
   - Invalid claims rejected with reason
   - Test: `tests/completion.test.ts:374-519`

---

## Verification Artifacts

All verification outputs are saved to `verification-output/issue-221/`:

```
verification-output/issue-221/
├── backfill-summary.json       # Overall metrics
├── backfill-changes.json       # Contact-level changes
├── backfill-failures.json      # Validation errors
└── test-output/                # Test run results (created during npm run build)
    ├── completion-tests.txt
    ├── migration-tests.txt
    └── lambda-tests.txt
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All Phase 1-4 code merged to branch
- [ ] All tests passing (`npm run build`, `npx tsx tests/completion*.test.ts`)
- [ ] CI passing on PR
- [ ] Code review approved
- [ ] Verification artifacts committed

### Deployment

- [ ] Merge PR to `main`
- [ ] Deploy Lambda update (existing AWS deployment workflow)
- [ ] Run backfill tool in dry-run mode
- [ ] Review backfill summary and change counts
- [ ] Run backfill tool live (if dry-run looks good)
- [ ] Monitor CloudWatch logs for validation errors
- [ ] Spot-check 10-20 contacts in HubSpot CRM

### Post-Deployment Verification

- [ ] Check backfill summary metrics
- [ ] Verify no unexpected failures in `backfill-failures.json`
- [ ] Test explicit completion events via Lambda
  - Send `learning_course_completed` for test contact
  - Send `learning_pathway_completed` for test contact
  - Verify both accept valid claims, reject invalid
- [ ] Coordinate with Issue #216 (analytics) to validate completion flags

### Rollback Criteria

If any of the following occur, execute rollback:
- Backfill failure rate >5%
- Validation errors >1%
- Reports of incorrect completion flags from users
- Analytics team reports bad data (Issue #216)

---

## Dependencies

### Upstream (Completed)
- ✅ Issue #215: Hierarchical progress storage (Phase 1)
- ✅ Issue #214: Payload validation
- ✅ Issue #181: Runbook standards

### Downstream (Blocked on #221)
- ⏳ Issue #216: Analytics integration (needs completion flags)
- ⏳ Template updates (display completion badges/progress)

---

## Known Limitations

1. **No Optional Modules/Courses Yet**:
   - All modules in a course are required
   - All courses in a pathway are required
   - Future: Add `optional: boolean[]` to metadata

2. **Metadata Cache Refresh**:
   - Cache loaded at Lambda cold start
   - New courses/pathways require Lambda redeploy or cold start
   - Future: Consider TTL-based refresh or S3-backed metadata

3. **Timestamp Precision**:
   - ±5 minute tolerance may allow some edge cases
   - Alternative: Use exact inferred timestamp always

4. **Backfill Performance**:
   - Default batch size: 50 contacts
   - Large portals (>10k contacts) may take 10-20 minutes
   - Consider running during off-peak hours

---

## References

- **Issue**: [#221 - Completion Tracking for Hierarchical Progress](https://github.com/org/repo/issues/221)
- **Related Issues**:
  - #215 - Hierarchical Progress Storage
  - #216 - Analytics Integration
  - #219 - False-Positive Completion Bug (fixed by this issue)
- **Commits**:
  - Phase 1: `0d692ba`
  - Phase 2: `7749264`
  - Phase 3 & 4: (this commit)

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-10-20 | Claude Code | Initial documentation (Phases 1-4) |

---

## Appendix: Test Scenarios Detail

### Scenario 1: Reused Modules (Tests)

```typescript
// Module "accessing-vlab-with-gcp" appears in both:
// - hedgehog-lab-foundations course
// - getting-started pathway

const moduleProgress = {
  'accessing-vlab-with-gcp': { completed: true }
};

// Should count toward both
calculateCourseCompletion('hedgehog-lab-foundations', moduleProgress);
// → progress: { completed: 1, total: 4 }

calculateCourseCompletion('getting-started', moduleProgress);
// → progress: { completed: 1, total: 3 }
```

### Scenario 2: Partial Progress (Tests)

```typescript
// Course: hedgehog-lab-foundations (4 modules)
// Progress: 2/4 complete

const result = calculateCourseCompletion('hedgehog-lab-foundations', {
  'module-1': { completed: true },
  'module-2': { completed: true },
  'module-3': { started: true }, // Not complete
  // module-4 not started
});

// Expected: completed = false, progress = { completed: 2, total: 4 }
```

### Scenario 3: Timestamp Validation (Tests)

```typescript
// Inferred: last module completed at 13:30:00
// Explicit: event sent at 13:32:00

validateCompletionTimestamp('13:32:00', '13:30:00');
// → true (within 5 min)

validateCompletionTimestamp('13:36:00', '13:30:00');
// → false (>5 min)
```

---

**End of Documentation**
