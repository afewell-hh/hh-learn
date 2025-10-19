# Issue #215: Hierarchical Progress Data Model Design

**Status:** Implementation Ready
**Created:** 2025-10-19
**Related Issues:** #215

## Executive Summary

This document defines the new hierarchical progress tracking model that supports the pathway → course → module relationship hierarchy. The new model handles:

- Pathways that contain courses (not just direct module references)
- Courses that contain modules
- Modules that can be reused across multiple courses
- Backward compatibility with existing flat pathway structures
- Zero data loss during migration from flat to hierarchical model

## 1. Current State Analysis

### Current Data Model Limitations

The existing progress model has a **flat structure** with two major issues:

```typescript
// CURRENT (FLAT) MODEL
{
  "pathway-slug": {
    "enrolled": true,
    "enrolled_at": "2025-10-19T14:00:00Z",
    "modules": {
      "module-a": { "started": true, "started_at": "..." },
      "module-b": { "completed": true, "completed_at": "..." }
    }
  },
  "courses": {
    "course-slug": {
      "enrolled": true,
      "enrolled_at": "2025-10-19T15:00:00Z",
      "modules": {
        "module-a": { "started": true, "started_at": "..." }
      }
    }
  }
}
```

**Problems:**
1. **No pathway → course linkage:** Pathways reference modules directly, not courses
2. **Module duplication:** If `module-a` appears in both a pathway and a course, progress is tracked separately
3. **Lost context:** Cannot determine which course a module belongs to within a pathway
4. **Impossible queries:** Cannot answer "How many courses completed in pathway X?"

### Current Content Structure

**Pathways support TWO patterns:**
- **Legacy:** Direct module references via `"modules": ["module-1", "module-2"]`
- **New:** Course references via `"courses": ["course-1", "course-2"]`

Example from `content/pathways/authoring-foundations.json`:
```json
{
  "slug": "authoring-foundations",
  "title": "Authoring Foundations",
  "courses": ["course-authoring-101", "pathway-assembly-and-layouts"]
}
```

**The problem:** Progress tracking doesn't reflect this hierarchy!

## 2. New Hierarchical Model Design

### 2.1 Type Definitions

```typescript
// Module-level progress (unchanged)
export type ModuleProgressState = {
  started?: boolean;
  started_at?: string;
  completed?: boolean;
  completed_at?: string;
};

// Course-level progress (NEW: hierarchical)
export type CourseProgressState = {
  enrolled?: boolean;
  enrolled_at?: string;
  enrollment_source?: string;
  started?: boolean;           // NEW: at least one module started
  started_at?: string;         // NEW: timestamp of first module start
  completed?: boolean;         // NEW: all modules completed
  completed_at?: string;       // NEW: timestamp of last module completion
  modules?: Record<string, ModuleProgressState>;
};

// Pathway-level progress (NEW: hierarchical with courses)
export type PathwayProgressState = {
  enrolled?: boolean;
  enrolled_at?: string;
  enrollment_source?: string;
  started?: boolean;           // NEW: at least one course/module started
  started_at?: string;         // NEW: timestamp of first activity
  completed?: boolean;         // NEW: all courses/modules completed
  completed_at?: string;       // NEW: timestamp of final completion

  // For pathways with courses (hierarchical model)
  courses?: Record<string, CourseProgressState>;

  // For legacy pathways with direct modules (backward compatibility)
  modules?: Record<string, ModuleProgressState>;
};

// Top-level progress state (unchanged structure)
export type ProgressState = {
  courses?: Record<string, CourseProgressState>;  // Standalone courses
  [pathwaySlug: string]: PathwayProgressState | Record<string, CourseProgressState> | undefined;
};
```

### 2.2 JSON Example: Hierarchical Progress

```json
{
  "authoring-foundations": {
    "enrolled": true,
    "enrolled_at": "2025-10-19T14:00:00Z",
    "enrollment_source": "pathway_page",
    "started": true,
    "started_at": "2025-10-19T14:15:00Z",
    "completed": false,
    "courses": {
      "course-authoring-101": {
        "enrolled": true,
        "enrolled_at": "2025-10-19T14:00:00Z",
        "started": true,
        "started_at": "2025-10-19T14:15:00Z",
        "completed": true,
        "completed_at": "2025-10-19T16:30:00Z",
        "modules": {
          "authoring-basics": {
            "started": true,
            "started_at": "2025-10-19T14:15:00Z",
            "completed": true,
            "completed_at": "2025-10-19T15:00:00Z"
          },
          "authoring-media-and-metadata": {
            "started": true,
            "started_at": "2025-10-19T15:05:00Z",
            "completed": true,
            "completed_at": "2025-10-19T16:30:00Z"
          }
        }
      },
      "pathway-assembly-and-layouts": {
        "enrolled": false,
        "started": false,
        "completed": false,
        "modules": {}
      }
    }
  },
  "courses": {
    "standalone-course": {
      "enrolled": true,
      "enrolled_at": "2025-10-19T17:00:00Z",
      "started": true,
      "started_at": "2025-10-19T17:15:00Z",
      "modules": {
        "module-x": {
          "started": true,
          "started_at": "2025-10-19T17:15:00Z"
        }
      }
    }
  }
}
```

### 2.3 Backward Compatibility: Legacy Pathways

For pathways that directly reference modules (no courses):

```json
{
  "getting-started": {
    "enrolled": true,
    "enrolled_at": "2025-10-19T10:00:00Z",
    "started": true,
    "started_at": "2025-10-19T10:15:00Z",
    "modules": {
      "accessing-the-hedgehog-virtual-lab-with-google-cloud": {
        "started": true,
        "started_at": "2025-10-19T10:15:00Z",
        "completed": true,
        "completed_at": "2025-10-19T11:00:00Z"
      }
    }
  }
}
```

**Backward compatibility rules:**
- If pathway has `courses` array in content JSON → use hierarchical model
- If pathway has `modules` array in content JSON → use flat model
- Frontend/Lambda must support both structures

## 3. Lambda Persistence Logic Changes

### 3.1 Event Handling Flow

**NEW: Pathway with courses enrolled:**
```typescript
// Event: learning_pathway_enrolled
// pathway_slug: "authoring-foundations"
// enrollment_source: "pathway_page"

// 1. Initialize pathway with courses structure
progressState["authoring-foundations"] = {
  enrolled: true,
  enrolled_at: timestamp,
  enrollment_source: "pathway_page",
  courses: {}  // Empty courses object
};

// 2. Optionally auto-enroll all courses in pathway
// (Business rule TBD - discuss with product)
```

**NEW: Module started within pathway course:**
```typescript
// Event: learning_module_started
// pathway_slug: "authoring-foundations"
// course_slug: "course-authoring-101"
// module_slug: "authoring-basics"

// 1. Initialize pathway if needed
if (!progressState["authoring-foundations"]) {
  progressState["authoring-foundations"] = { courses: {} };
}

// 2. Initialize course within pathway
if (!progressState["authoring-foundations"].courses["course-authoring-101"]) {
  progressState["authoring-foundations"].courses["course-authoring-101"] = { modules: {} };
}

// 3. Update module progress
progressState["authoring-foundations"].courses["course-authoring-101"].modules["authoring-basics"] = {
  started: true,
  started_at: timestamp
};

// 4. Update course aggregates
updateCourseAggregates(progressState["authoring-foundations"].courses["course-authoring-101"]);

// 5. Update pathway aggregates
updatePathwayAggregates(progressState["authoring-foundations"]);
```

### 3.2 Aggregate Computation Functions

```typescript
/**
 * Update course-level started/completed flags based on module progress
 */
function updateCourseAggregates(course: CourseProgressState) {
  const modules = Object.values(course.modules || {});

  // Started: any module started
  const anyStarted = modules.some(m => m.started);
  if (anyStarted && !course.started) {
    course.started = true;
    course.started_at = modules
      .filter(m => m.started_at)
      .map(m => m.started_at!)
      .sort()[0]; // Earliest started_at
  }

  // Completed: all modules completed
  const allCompleted = modules.length > 0 && modules.every(m => m.completed);
  if (allCompleted && !course.completed) {
    course.completed = true;
    course.completed_at = modules
      .filter(m => m.completed_at)
      .map(m => m.completed_at!)
      .sort()
      .reverse()[0]; // Latest completed_at
  }
}

/**
 * Update pathway-level started/completed flags based on course progress
 */
function updatePathwayAggregates(pathway: PathwayProgressState) {
  const courses = Object.values(pathway.courses || {});

  // Started: any course started
  const anyStarted = courses.some(c => c.started);
  if (anyStarted && !pathway.started) {
    pathway.started = true;
    pathway.started_at = courses
      .filter(c => c.started_at)
      .map(c => c.started_at!)
      .sort()[0]; // Earliest started_at
  }

  // Completed: all courses completed
  const allCompleted = courses.length > 0 && courses.every(c => c.completed);
  if (allCompleted && !pathway.completed) {
    pathway.completed = true;
    pathway.completed_at = courses
      .filter(c => c.completed_at)
      .map(c => c.completed_at!)
      .sort()
      .reverse()[0]; // Latest completed_at
  }
}
```

## 4. Migration Strategy

### 4.1 Migration Script Overview

**Goal:** Convert existing flat progress data to hierarchical model without data loss.

**Input:** All contacts with `hhl_progress_state` property
**Output:** Updated `hhl_progress_state` with hierarchical structure

**Location:** `src/scripts/migrate-progress-to-hierarchical.ts`

### 4.2 Migration Algorithm

```typescript
async function migrateContact(contactId: string) {
  // 1. Read current progress state
  const contact = await hubspot.crm.contacts.basicApi.getById(contactId, ['hhl_progress_state']);
  const currentState = JSON.parse(contact.properties.hhl_progress_state || '{}');

  // 2. Create backup snapshot
  const backup = JSON.stringify(currentState);
  await saveSnapshot(contactId, 'before', backup);

  // 3. Transform progress data
  const newState = await transformProgressState(currentState);

  // 4. Validate no data loss
  const validation = validateMigration(currentState, newState);
  if (!validation.success) {
    throw new Error(`Migration validation failed for contact ${contactId}: ${validation.errors}`);
  }

  // 5. Write new state
  await hubspot.crm.contacts.basicApi.update(contactId, {
    properties: {
      hhl_progress_state: JSON.stringify(newState),
      hhl_progress_summary: generateProgressSummary(newState)
    }
  });

  // 6. Save after snapshot
  await saveSnapshot(contactId, 'after', JSON.stringify(newState));
}

async function transformProgressState(currentState: any): Promise<any> {
  const newState: any = {};

  // Preserve standalone courses as-is
  if (currentState.courses) {
    newState.courses = currentState.courses;
  }

  // Transform each pathway
  for (const [pathwaySlug, pathwayData] of Object.entries(currentState)) {
    if (pathwaySlug === 'courses') continue;

    // Load pathway content to check if it uses courses or modules
    const pathwayContent = await loadPathwayContent(pathwaySlug);

    if (pathwayContent.courses && pathwayContent.courses.length > 0) {
      // HIERARCHICAL: Pathway uses courses
      newState[pathwaySlug] = await transformToHierarchical(
        pathwaySlug,
        pathwayData,
        pathwayContent.courses
      );
    } else {
      // FLAT: Pathway uses direct modules (keep as-is)
      newState[pathwaySlug] = pathwayData;
    }
  }

  return newState;
}

async function transformToHierarchical(
  pathwaySlug: string,
  currentPathwayData: any,
  courseSlugs: string[]
): Promise<PathwayProgressState> {
  const newPathway: PathwayProgressState = {
    enrolled: currentPathwayData.enrolled,
    enrolled_at: currentPathwayData.enrolled_at,
    enrollment_source: currentPathwayData.enrollment_source,
    courses: {}
  };

  // For each course in the pathway content definition
  for (const courseSlug of courseSlugs) {
    const courseContent = await loadCourseContent(courseSlug);
    const courseModules = courseContent.modules || [];

    const courseProgress: CourseProgressState = {
      modules: {}
    };

    // Migrate module progress from flat pathway to course
    const currentModules = currentPathwayData.modules || {};
    for (const moduleSlug of courseModules) {
      if (currentModules[moduleSlug]) {
        // Module progress exists - migrate it
        courseProgress.modules![moduleSlug] = currentModules[moduleSlug];
      }
    }

    // Compute course aggregates
    updateCourseAggregates(courseProgress);

    newPathway.courses![courseSlug] = courseProgress;
  }

  // Compute pathway aggregates
  updatePathwayAggregates(newPathway);

  return newPathway;
}
```

### 4.3 Validation Rules

```typescript
function validateMigration(before: any, after: any): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  // Rule 1: No module progress lost
  const beforeModules = extractAllModuleProgress(before);
  const afterModules = extractAllModuleProgress(after);

  for (const [key, progress] of Object.entries(beforeModules)) {
    if (!afterModules[key]) {
      errors.push(`Module progress lost: ${key}`);
    } else if (JSON.stringify(beforeModules[key]) !== JSON.stringify(afterModules[key])) {
      errors.push(`Module progress changed: ${key}`);
    }
  }

  // Rule 2: No enrollment data lost
  const beforeEnrollments = extractAllEnrollments(before);
  const afterEnrollments = extractAllEnrollments(after);

  if (beforeEnrollments.length !== afterEnrollments.length) {
    errors.push(`Enrollment count mismatch: ${beforeEnrollments.length} → ${afterEnrollments.length}`);
  }

  // Rule 3: Timestamps preserved
  const beforeTimestamps = extractAllTimestamps(before);
  const afterTimestamps = extractAllTimestamps(after);

  for (const ts of beforeTimestamps) {
    if (!afterTimestamps.includes(ts)) {
      errors.push(`Timestamp lost: ${ts}`);
    }
  }

  return { success: errors.length === 0, errors };
}
```

### 4.4 Rollback Plan

**If migration fails or causes issues:**

1. **Immediate Rollback:**
   ```bash
   # Restore from before snapshots
   node dist/scripts/rollback-progress-migration.js --verify
   ```

2. **Snapshot Format:**
   ```
   verification-output/issue-215/
   ├── migration-summary.json          # Overall stats
   ├── snapshots/
   │   ├── contact-123-before.json
   │   ├── contact-123-after.json
   │   ├── contact-456-before.json
   │   └── contact-456-after.json
   └── validation-report.json          # Per-contact validation
   ```

3. **Rollback Script:**
   ```typescript
   async function rollbackContact(contactId: string) {
     const beforeSnapshot = await loadSnapshot(contactId, 'before');

     await hubspot.crm.contacts.basicApi.update(contactId, {
       properties: {
         hhl_progress_state: beforeSnapshot
       }
     });
   }
   ```

## 5. Frontend Consumer Updates

### 5.1 Affected Endpoints

**`GET /progress/aggregate`**
- Must compute aggregates for hierarchical pathways
- Handle both `pathway.courses[X].modules` AND `pathway.modules` (backward compat)

**`GET /progress/read`**
- Return full hierarchical structure
- Frontend must handle both flat and hierarchical models

**`GET /enrollments/list`**
- Extract courses from `pathway.courses` in addition to `state.courses`
- Return enrollment source per course

### 5.2 Example Frontend Logic

```typescript
// Pathway detail page: compute progress
function getPathwayProgress(pathwaySlug: string, progressState: any) {
  const pathway = progressState[pathwaySlug];
  if (!pathway) return { started: 0, completed: 0, total: 0 };

  if (pathway.courses) {
    // HIERARCHICAL MODEL
    const courses = Object.values(pathway.courses);
    return {
      started: courses.filter(c => c.started).length,
      completed: courses.filter(c => c.completed).length,
      total: courses.length
    };
  } else if (pathway.modules) {
    // FLAT MODEL (legacy)
    const modules = Object.values(pathway.modules);
    return {
      started: modules.filter(m => m.started).length,
      completed: modules.filter(m => m.completed).length,
      total: modules.length
    };
  }

  return { started: 0, completed: 0, total: 0 };
}
```

## 6. Testing Strategy

### 6.1 Test Cases

**Edge Case 1: Module reused across courses**
- Module `authoring-basics` appears in both `course-authoring-101` and `advanced-authoring`
- Expected: Separate progress tracked for each course context
- Validation: No cross-contamination between course contexts

**Edge Case 2: Pathway with no enrollments**
- Pathway exists in content but user never enrolled
- Expected: Migration skips (no data to migrate)
- Validation: No errors, no empty objects created

**Edge Case 3: Partial course completion**
- User completed 2/5 modules in a course
- Expected: `course.started = true`, `course.completed = false`
- Validation: Aggregate flags match module counts

**Edge Case 4: Mixed flat/hierarchical pathways**
- User has progress in both legacy (flat) and new (hierarchical) pathways
- Expected: Both models coexist in same progress state
- Validation: No interference between models

**Edge Case 5: Malformed JSON**
- Existing progress state has invalid JSON or missing fields
- Expected: Migration script handles gracefully, logs warning
- Validation: Default values applied, no crash

### 6.2 Unit Tests

```typescript
// Test file: src/api/__tests__/hierarchical-progress.test.ts

describe('Hierarchical Progress Model', () => {
  describe('updateCourseAggregates', () => {
    it('sets course.started when first module starts', () => {
      const course = {
        modules: {
          'module-1': { started: true, started_at: '2025-10-19T10:00:00Z' }
        }
      };
      updateCourseAggregates(course);
      expect(course.started).toBe(true);
      expect(course.started_at).toBe('2025-10-19T10:00:00Z');
    });

    it('sets course.completed when all modules completed', () => {
      const course = {
        modules: {
          'module-1': { completed: true, completed_at: '2025-10-19T10:00:00Z' },
          'module-2': { completed: true, completed_at: '2025-10-19T11:00:00Z' }
        }
      };
      updateCourseAggregates(course);
      expect(course.completed).toBe(true);
      expect(course.completed_at).toBe('2025-10-19T11:00:00Z'); // Latest
    });
  });

  describe('Migration', () => {
    it('preserves all module progress during migration', async () => {
      const before = {
        'authoring-foundations': {
          enrolled: true,
          modules: {
            'authoring-basics': { started: true, completed: true }
          }
        }
      };

      const after = await transformProgressState(before);
      const validation = validateMigration(before, after);

      expect(validation.success).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});
```

## 7. Implementation Checklist

- [ ] Update `src/shared/types.ts` with new hierarchical types
- [ ] Update `src/api/lambda/index.ts`:
  - [ ] Add `updateCourseAggregates()` function
  - [ ] Add `updatePathwayAggregates()` function
  - [ ] Update `persistViaContactProperties()` to handle pathway courses
  - [ ] Update `getAggregatedProgress()` to support hierarchical pathways
  - [ ] Update `generateProgressSummary()` to reflect hierarchy
- [ ] Create `src/scripts/migrate-progress-to-hierarchical.ts`:
  - [ ] Implement `transformProgressState()`
  - [ ] Implement `validateMigration()`
  - [ ] Add snapshot saving/loading
  - [ ] Add progress logging and metrics
- [ ] Create `src/scripts/rollback-progress-migration.ts`
- [ ] Add unit tests in `src/api/__tests__/hierarchical-progress.test.ts`
- [ ] Create migration documentation in `docs/migration-guide-issue-215.md`
- [ ] Run migration in staging environment
- [ ] Collect before/after snapshots in `verification-output/issue-215/`
- [ ] Validate zero data loss
- [ ] Update this document with migration results

## 8. Success Metrics

**Migration must achieve:**
- ✅ **Zero data loss:** Every module progress entry preserved
- ✅ **Zero timestamp drift:** All timestamps match before/after
- ✅ **100% validation rate:** All contacts pass validation checks
- ✅ **Backward compatibility:** Legacy flat pathways still work
- ✅ **Performance:** Migration completes within 2 minutes per 1000 contacts

**Monitoring:**
- Total contacts migrated
- Average migration time per contact
- Validation failures (should be 0)
- Rollback count (should be 0)
- API response time before/after (should be similar)

## 9. Future Enhancements

**Out of scope for Issue #215, but enabled by this model:**

1. **Cross-course prerequisites:** Track which courses must be completed before others
2. **Pathway-level certificates:** Issue certificates when all courses completed
3. **Course-level analytics:** "Which course in this pathway has the lowest completion rate?"
4. **Smart recommendations:** "You completed Course A, try Course B next"
5. **Progress sync across contexts:** If user completes module in standalone course, reflect in pathway

---

## Appendix A: File Locations

- **Type definitions:** `/home/ubuntu/afewell-hh/hh-learn/src/shared/types.ts`
- **Lambda handler:** `/home/ubuntu/afewell-hh/hh-learn/src/api/lambda/index.ts`
- **Migration script:** `/home/ubuntu/afewell-hh/hh-learn/src/scripts/migrate-progress-to-hierarchical.ts` (to be created)
- **Rollback script:** `/home/ubuntu/afewell-hh/hh-learn/src/scripts/rollback-progress-migration.ts` (to be created)
- **Test file:** `/home/ubuntu/afewell-hh/hh-learn/src/api/__tests__/hierarchical-progress.test.ts` (to be created)
- **Verification output:** `/home/ubuntu/afewell-hh/hh-learn/verification-output/issue-215/`

## Appendix B: Related Documentation

- Issue #191: HubSpot Project Apps Agent Guide
- `docs/phase2-contact-properties.md`: CRM property schema
- `docs/hubspot-project-apps-agent-guide.md`: HubSpot API patterns
- `src/sync/pathways-to-hubdb.ts`: Pathway content structure
- `src/sync/courses-to-hubdb.ts`: Course content structure
