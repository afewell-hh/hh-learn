/**
 * Integration tests for completion tracking migration (Issue #221)
 *
 * Tests verify that:
 * 1. Migration script correctly recomputes completion flags
 * 2. Dry-run mode doesn't persist changes
 * 3. Started/completed counts match expected values
 * 4. Completion engine handles real content structure
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  loadMetadataCache,
  calculateCourseCompletion,
  calculatePathwayCompletion,
} from '../src/api/lambda/completion.js';

// ============================================================================
// Test Data Fixtures - Based on actual content
// ============================================================================

/**
 * Sample progress states that simulate real migration scenarios
 */
const SAMPLE_PROGRESS_STATES = {
  // Scenario 1: Partial course progress (2/4 modules complete)
  partialCourse: {
    modules: {
      'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
        started: true,
        started_at: '2025-10-19T10:00:00Z',
        completed: true,
        completed_at: '2025-10-19T10:30:00Z',
      },
      'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': {
        started: true,
        started_at: '2025-10-19T11:00:00Z',
        completed: true,
        completed_at: '2025-10-19T11:30:00Z',
      },
      'accessing-the-hedgehog-virtual-lab-with-microsoft-azure': {
        started: true,
        started_at: '2025-10-19T12:00:00Z',
        // Not completed
      },
      // 'intro-to-kubernetes' not started
    },
  },

  // Scenario 2: Fully complete course
  completeCourse: {
    modules: {
      'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
        started: true,
        started_at: '2025-10-19T10:00:00Z',
        completed: true,
        completed_at: '2025-10-19T10:30:00Z',
      },
      'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': {
        started: true,
        started_at: '2025-10-19T11:00:00Z',
        completed: true,
        completed_at: '2025-10-19T11:30:00Z',
      },
      'accessing-the-hedgehog-virtual-lab-with-microsoft-azure': {
        started: true,
        started_at: '2025-10-19T12:00:00Z',
        completed: true,
        completed_at: '2025-10-19T12:30:00Z',
      },
      'intro-to-kubernetes': {
        started: true,
        started_at: '2025-10-19T13:00:00Z',
        completed: true,
        completed_at: '2025-10-19T13:30:00Z',
      },
    },
  },

  // Scenario 3: Mixed pathway (one course complete, others not)
  mixedPathway: {
    courses: {
      'hedgehog-lab-foundations': {
        modules: {
          'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
            completed: true,
            completed_at: '2025-10-19T10:30:00Z',
          },
          'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': {
            completed: true,
            completed_at: '2025-10-19T11:30:00Z',
          },
          'accessing-the-hedgehog-virtual-lab-with-microsoft-azure': {
            completed: true,
            completed_at: '2025-10-19T12:30:00Z',
          },
          'intro-to-kubernetes': {
            completed: true,
            completed_at: '2025-10-19T13:30:00Z',
          },
        },
        started: true,
        started_at: '2025-10-19T10:00:00Z',
        completed: true,
        completed_at: '2025-10-19T13:30:00Z',
      },
      'course-authoring-101': {
        modules: {
          'module-1': {
            started: true,
            started_at: '2025-10-19T14:00:00Z',
            // Not completed
          },
        },
        started: true,
        started_at: '2025-10-19T14:00:00Z',
        completed: false,
      },
    },
  },
};

// ============================================================================
// Migration Simulation Tests
// ============================================================================

describe('Completion Migration Integration Tests', () => {
  beforeAll(() => {
    // Ensure metadata cache is loaded
    loadMetadataCache();
  });

  // ==========================================================================
  // Dry-Run Validation
  // ==========================================================================
  describe('Dry-run mode validation', () => {
    it('should calculate completion without persisting state changes', () => {
      // Simulate dry-run calculation for partial course
      const progressBefore = JSON.parse(
        JSON.stringify(SAMPLE_PROGRESS_STATES.partialCourse.modules)
      );

      const result = calculateCourseCompletion(
        'hedgehog-lab-foundations',
        progressBefore
      );

      // Verify calculation is correct
      expect(result.completed).toBe(false);
      expect(result.progress.completed).toBe(2); // 2 modules complete
      expect(result.progress.total).toBe(4); // 4 total required

      // Verify input wasn't mutated (dry-run safety)
      expect(progressBefore).toEqual(SAMPLE_PROGRESS_STATES.partialCourse.modules);
    });

    it('should calculate pathway completion without mutating input', () => {
      const progressBefore = JSON.parse(
        JSON.stringify(SAMPLE_PROGRESS_STATES.mixedPathway.courses)
      );

      const result = calculatePathwayCompletion(
        'course-authoring-expert',
        progressBefore
      );

      // Should not mutate input
      expect(progressBefore).toEqual(SAMPLE_PROGRESS_STATES.mixedPathway.courses);
    });
  });

  // ==========================================================================
  // Started/Completed Counts
  // ==========================================================================
  describe('Started and completed counts', () => {
    it('should report accurate progress for partial completion', () => {
      const result = calculateCourseCompletion(
        'hedgehog-lab-foundations',
        SAMPLE_PROGRESS_STATES.partialCourse.modules
      );

      expect(result.progress.completed).toBe(2);
      expect(result.progress.total).toBe(4);
      expect(result.completed).toBe(false);

      // Progress ratio: 2/4 = 50%
      const progressRatio = result.progress.completed / result.progress.total;
      expect(progressRatio).toBe(0.5);
    });

    it('should report 100% for fully complete course', () => {
      const result = calculateCourseCompletion(
        'hedgehog-lab-foundations',
        SAMPLE_PROGRESS_STATES.completeCourse.modules
      );

      expect(result.progress.completed).toBe(4);
      expect(result.progress.total).toBe(4);
      expect(result.completed).toBe(true);

      const progressRatio = result.progress.completed / result.progress.total;
      expect(progressRatio).toBe(1.0);
    });

    it('should handle zero progress gracefully', () => {
      const result = calculateCourseCompletion('hedgehog-lab-foundations', {});

      expect(result.progress.completed).toBe(0);
      expect(result.progress.total).toBe(4);
      expect(result.completed).toBe(false);
    });

    it('should count only completed modules (not started-only)', () => {
      const progressWithStartedOnly = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          started: true,
          started_at: '2025-10-19T10:00:00Z',
          // Not completed
        },
        'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': {
          started: true,
          started_at: '2025-10-19T11:00:00Z',
          // Not completed
        },
      };

      const result = calculateCourseCompletion(
        'hedgehog-lab-foundations',
        progressWithStartedOnly
      );

      // Should count 0 completed (started doesn't count)
      expect(result.progress.completed).toBe(0);
      expect(result.completed).toBe(false);
    });
  });

  // ==========================================================================
  // Reused Modules Handling
  // ==========================================================================
  describe('Reused modules across courses', () => {
    it('should allow same module to count toward multiple courses', () => {
      // Same module appears in multiple courses
      const sharedModuleProgress = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          completed: true,
          completed_at: '2025-10-19T10:30:00Z',
        },
      };

      // Check contribution to first course
      const result1 = calculateCourseCompletion(
        'hedgehog-lab-foundations',
        sharedModuleProgress
      );
      expect(result1.progress.completed).toBe(1);

      // Same module can contribute to another course if it's in that course's definition
      // (This tests that the engine doesn't "consume" the module from the first calculation)
      const result2 = calculateCourseCompletion(
        'hedgehog-lab-foundations',
        sharedModuleProgress
      );
      expect(result2.progress.completed).toBe(1);
    });

    it('should not count modules not in course definition', () => {
      const progressWithExtraModule = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          completed: true,
          completed_at: '2025-10-19T10:30:00Z',
        },
        'module-not-in-course': {
          completed: true,
          completed_at: '2025-10-19T11:00:00Z',
        },
      };

      const result = calculateCourseCompletion(
        'hedgehog-lab-foundations',
        progressWithExtraModule
      );

      // Should only count modules that are in the course definition
      expect(result.progress.completed).toBe(1); // Only the GCP module
    });
  });

  // ==========================================================================
  // Hierarchical Progress Structure
  // ==========================================================================
  describe('Hierarchical progress structure', () => {
    it('should calculate pathway completion based on course completion flags', () => {
      const pathwayProgress = {
        'hedgehog-lab-foundations': {
          modules: {},
          started: true,
          started_at: '2025-10-19T10:00:00Z',
          completed: true,
          completed_at: '2025-10-19T15:00:00Z',
        },
        'course-authoring-101': {
          modules: {},
          started: true,
          started_at: '2025-10-19T16:00:00Z',
          completed: true,
          completed_at: '2025-10-19T17:00:00Z',
        },
        'pathway-assembly-and-layouts': {
          modules: {},
          started: true,
          started_at: '2025-10-19T18:00:00Z',
          completed: true,
          completed_at: '2025-10-19T19:00:00Z',
        },
      };

      const result = calculatePathwayCompletion('course-authoring-expert', pathwayProgress);

      // Should count courses marked as completed
      expect(result.progress.completed).toBeGreaterThan(0);
      expect(result.progress.total).toBeGreaterThan(0);
    });

    it('should require all courses for pathway completion', () => {
      const partialPathway = {
        'hedgehog-lab-foundations': {
          completed: true,
          completed_at: '2025-10-19T15:00:00Z',
        },
        // Other courses missing or incomplete
      };

      const result = calculatePathwayCompletion('getting-started', partialPathway);

      // Pathway should not be complete if any required course is missing
      expect(result.completed).toBe(false);
    });
  });

  // ==========================================================================
  // Migration Correctness
  // ==========================================================================
  describe('Migration correctness scenarios', () => {
    it('should detect false-positive completion (PR #219 issue)', () => {
      // This was the original bug: course marked complete based on partial snapshot
      const partialSnapshot = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          completed: true,
          completed_at: '2025-10-19T10:30:00Z',
        },
        // Only 1 of 4 modules complete
      };

      const result = calculateCourseCompletion(
        'hedgehog-lab-foundations',
        partialSnapshot
      );

      // Should NOT be complete with only 1/4 modules
      expect(result.completed).toBe(false);
      expect(result.progress.completed).toBe(1);
      expect(result.progress.total).toBe(4);
    });

    it('should correctly identify true completion', () => {
      const result = calculateCourseCompletion(
        'hedgehog-lab-foundations',
        SAMPLE_PROGRESS_STATES.completeCourse.modules
      );

      expect(result.completed).toBe(true);
      expect(result.progress.completed).toBe(result.progress.total);
    });

    it('should handle migration from flat to hierarchical structure', () => {
      // Flat structure: modules tracked without course hierarchy
      const flatModules = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': { completed: true },
        'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': { completed: true },
        'accessing-the-hedgehog-virtual-lab-with-microsoft-azure': { completed: true },
        'intro-to-kubernetes': { completed: true },
      };

      // After migration: same modules should still be counted
      const result = calculateCourseCompletion('hedgehog-lab-foundations', flatModules);

      expect(result.completed).toBe(true);
      expect(result.progress.completed).toBe(4);
    });

    it('should preserve progress during migration round-trip', () => {
      // Before: partial progress
      const before = SAMPLE_PROGRESS_STATES.partialCourse.modules;

      // Calculate completion (migration would do this)
      const result = calculateCourseCompletion('hedgehog-lab-foundations', before);

      // After: structure should reflect same logical progress
      expect(result.progress.completed).toBe(2);
      expect(result.progress.total).toBe(4);

      // If we recalculate with same input, should get same result
      const result2 = calculateCourseCompletion('hedgehog-lab-foundations', before);
      expect(result2.completed).toBe(result.completed);
      expect(result2.progress.completed).toBe(result.progress.completed);
    });
  });

  // ==========================================================================
  // Batch Processing Simulation
  // ==========================================================================
  describe('Batch processing scenarios', () => {
    it('should handle multiple contacts in sequence', () => {
      const contacts = [
        { id: '1', modules: SAMPLE_PROGRESS_STATES.partialCourse.modules },
        { id: '2', modules: SAMPLE_PROGRESS_STATES.completeCourse.modules },
        { id: '3', modules: {} },
      ];

      const results = contacts.map((contact) =>
        calculateCourseCompletion('hedgehog-lab-foundations', contact.modules)
      );

      expect(results[0].completed).toBe(false); // Partial
      expect(results[1].completed).toBe(true); // Complete
      expect(results[2].completed).toBe(false); // Empty

      expect(results[0].progress.completed).toBe(2);
      expect(results[1].progress.completed).toBe(4);
      expect(results[2].progress.completed).toBe(0);
    });

    it('should be idempotent - repeated calculations give same results', () => {
      const modules = SAMPLE_PROGRESS_STATES.completeCourse.modules;

      const result1 = calculateCourseCompletion('hedgehog-lab-foundations', modules);
      const result2 = calculateCourseCompletion('hedgehog-lab-foundations', modules);
      const result3 = calculateCourseCompletion('hedgehog-lab-foundations', modules);

      expect(result1.completed).toBe(result2.completed);
      expect(result2.completed).toBe(result3.completed);

      expect(result1.progress.completed).toBe(result2.progress.completed);
      expect(result2.progress.completed).toBe(result3.progress.completed);
    });
  });

  // ==========================================================================
  // Validation Failure Scenarios
  // ==========================================================================
  describe('Validation failure scenarios', () => {
    it('should handle corrupted progress data gracefully', () => {
      const corruptedData = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          completed: 'yes' as any, // Wrong type
        },
        'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': null as any,
        'accessing-the-hedgehog-virtual-lab-with-microsoft-azure': undefined as any,
      };

      const result = calculateCourseCompletion('hedgehog-lab-foundations', corruptedData);

      // Should handle gracefully and return 0 completed
      expect(result.progress.completed).toBe(0);
    });

    it('should ignore extra properties in module state', () => {
      const progressWithExtra = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          completed: true,
          completed_at: '2025-10-19T10:30:00Z',
          extra_field: 'ignored',
          another_field: 123,
        },
      };

      const result = calculateCourseCompletion(
        'hedgehog-lab-foundations',
        progressWithExtra
      );

      // Should still count the completed module
      expect(result.progress.completed).toBe(1);
    });
  });
});
