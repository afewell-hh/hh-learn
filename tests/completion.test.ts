/**
 * Unit tests for completion tracking engine (Issue #221)
 *
 * Tests cover the six key scenarios from the design document:
 * 1. Reused modules across courses/pathways
 * 2. Partial progress tracking
 * 3. Completion timestamp validation
 * 4. Mixed hierarchical and flat progress structures
 * 5. Edge cases (empty courses, missing metadata)
 * 6. Explicit completion event validation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  loadMetadataCache,
  getCourseMetadata,
  getPathwayMetadata,
  calculateCourseCompletion,
  calculatePathwayCompletion,
  validateExplicitCompletion,
  validateCompletionTimestamp,
} from '../src/api/lambda/completion.js';

// ============================================================================
// Setup
// ============================================================================

describe('Completion Engine - Issue #221', () => {
  beforeAll(() => {
    // Ensure metadata is loaded before running tests
    loadMetadataCache();
  });

  // ==========================================================================
  // Scenario 1: Reused modules across courses
  // ==========================================================================
  describe('Scenario 1: Reused modules across courses', () => {
    it('should correctly calculate completion for courses sharing modules', () => {
      // hedgehog-lab-foundations has 4 modules
      const courseMeta = getCourseMetadata('hedgehog-lab-foundations');
      expect(courseMeta).toBeDefined();
      expect(courseMeta!.modules.length).toBeGreaterThan(0);

      // Module completed in one context
      const moduleProgress = {
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
      };

      const result = calculateCourseCompletion('hedgehog-lab-foundations', moduleProgress);

      expect(result.completed).toBe(true);
      expect(result.progress.completed).toBe(4);
      expect(result.progress.total).toBe(4);
    });

    it('should handle modules that appear in multiple courses independently', () => {
      // getting-started pathway has shared modules
      const pathwayMeta = getPathwayMetadata('getting-started');
      expect(pathwayMeta).toBeDefined();

      // Modules tracked independently per course context
      const moduleProgress = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          completed: true,
          completed_at: '2025-10-19T10:30:00Z',
        },
      };

      // Same module can contribute to multiple courses
      const result1 = calculateCourseCompletion('hedgehog-lab-foundations', moduleProgress);
      expect(result1.progress.completed).toBeGreaterThan(0);

      // Module completion is reusable across courses
      const result2 = calculateCourseCompletion('hedgehog-lab-foundations', moduleProgress);
      expect(result2.progress.completed).toBe(result1.progress.completed);
    });
  });

  // ==========================================================================
  // Scenario 2: Partial progress tracking
  // ==========================================================================
  describe('Scenario 2: Partial progress tracking', () => {
    it('should calculate correct progress ratio for partially completed course', () => {
      const moduleProgress = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          started: true,
          started_at: '2025-10-19T10:00:00Z',
          completed: true,
          completed_at: '2025-10-19T10:30:00Z',
        },
        'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': {
          started: true,
          started_at: '2025-10-19T11:00:00Z',
          // Not completed yet
        },
        // Other modules not started
      };

      const result = calculateCourseCompletion('hedgehog-lab-foundations', moduleProgress);

      expect(result.completed).toBe(false);
      expect(result.progress.completed).toBe(1); // Only one module completed
      expect(result.progress.total).toBe(4); // Total required modules
    });

    it('should handle pathway with mix of completed and incomplete courses', () => {
      const coursesProgress = {
        'hedgehog-lab-foundations': {
          modules: {},
          started: true,
          started_at: '2025-10-19T09:00:00Z',
          completed: true,
          completed_at: '2025-10-19T15:00:00Z',
        },
        'course-authoring-101': {
          modules: {},
          started: true,
          started_at: '2025-10-19T16:00:00Z',
          // Not completed yet
        },
      };

      // Assuming a pathway exists with these courses
      const pathwayMeta = getPathwayMetadata('course-authoring-expert');
      if (pathwayMeta) {
        const result = calculatePathwayCompletion('course-authoring-expert', coursesProgress);

        expect(result.completed).toBe(false); // Not all courses complete
        expect(result.progress.completed).toBeGreaterThanOrEqual(0);
        expect(result.progress.total).toBeGreaterThan(0);
      }
    });

    it('should return zero progress for course with no completed modules', () => {
      const moduleProgress = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          started: true,
          started_at: '2025-10-19T10:00:00Z',
          // Not completed
        },
      };

      const result = calculateCourseCompletion('hedgehog-lab-foundations', moduleProgress);

      expect(result.completed).toBe(false);
      expect(result.progress.completed).toBe(0);
      expect(result.progress.total).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Scenario 3: Completion timestamp validation
  // ==========================================================================
  describe('Scenario 3: Completion timestamp validation', () => {
    it('should accept timestamps within 5-minute tolerance', () => {
      const baseTime = new Date('2025-10-19T14:00:00Z');
      const withinTolerance = new Date(baseTime.getTime() + 4 * 60 * 1000); // +4 minutes

      const isValid = validateCompletionTimestamp(
        withinTolerance.toISOString(),
        baseTime.toISOString()
      );

      expect(isValid).toBe(true);
    });

    it('should accept timestamps exactly 5 minutes apart', () => {
      const baseTime = new Date('2025-10-19T14:00:00Z');
      const exactlyFiveMinutes = new Date(baseTime.getTime() + 5 * 60 * 1000);

      const isValid = validateCompletionTimestamp(
        exactlyFiveMinutes.toISOString(),
        baseTime.toISOString()
      );

      expect(isValid).toBe(true);
    });

    it('should reject timestamps outside 5-minute tolerance', () => {
      const baseTime = new Date('2025-10-19T14:00:00Z');
      const outsideTolerance = new Date(baseTime.getTime() + 6 * 60 * 1000); // +6 minutes

      const isValid = validateCompletionTimestamp(
        outsideTolerance.toISOString(),
        baseTime.toISOString()
      );

      expect(isValid).toBe(false);
    });

    it('should handle timestamps before the base time (within tolerance)', () => {
      const baseTime = new Date('2025-10-19T14:00:00Z');
      const earlierTime = new Date(baseTime.getTime() - 3 * 60 * 1000); // -3 minutes

      const isValid = validateCompletionTimestamp(
        earlierTime.toISOString(),
        baseTime.toISOString()
      );

      expect(isValid).toBe(true);
    });

    it('should handle timestamps in different formats but same time', () => {
      const time1 = '2025-10-19T14:00:00.000Z';
      const time2 = '2025-10-19T14:00:00Z';

      const isValid = validateCompletionTimestamp(time1, time2);

      expect(isValid).toBe(true);
    });
  });

  // ==========================================================================
  // Scenario 4: Mixed hierarchical and flat progress structures
  // ==========================================================================
  describe('Scenario 4: Mixed hierarchical and flat structures', () => {
    it('should handle flat course progress (no pathway)', () => {
      const moduleProgress = {
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
      };

      const result = calculateCourseCompletion('hedgehog-lab-foundations', moduleProgress);

      expect(result.completed).toBe(true);
      expect(result.progress.total).toBe(4);
    });

    it('should handle hierarchical pathway progress', () => {
      const coursesProgress = {
        'hedgehog-lab-foundations': {
          modules: {},
          completed: true,
          completed_at: '2025-10-19T15:00:00Z',
        },
      };

      const pathwayMeta = getPathwayMetadata('getting-started');
      if (pathwayMeta) {
        const result = calculatePathwayCompletion('getting-started', coursesProgress);

        expect(result.progress.total).toBeGreaterThan(0);
        // Should not be complete unless all courses are marked complete
      }
    });

    it('should handle empty module progress gracefully', () => {
      const result = calculateCourseCompletion('hedgehog-lab-foundations', {});

      expect(result.completed).toBe(false);
      expect(result.progress.completed).toBe(0);
      expect(result.progress.total).toBeGreaterThan(0);
    });

    it('should handle empty course progress gracefully', () => {
      const pathwayMeta = getPathwayMetadata('getting-started');
      if (pathwayMeta) {
        const result = calculatePathwayCompletion('getting-started', {});

        expect(result.completed).toBe(false);
        expect(result.progress.completed).toBe(0);
        expect(result.progress.total).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // Scenario 5: Edge cases (empty courses, missing metadata)
  // ==========================================================================
  describe('Scenario 5: Edge cases and missing metadata', () => {
    it('should return not-complete for unknown course', () => {
      const result = calculateCourseCompletion('nonexistent-course', {
        'some-module': { completed: true },
      });

      expect(result.completed).toBe(false);
      expect(result.progress.completed).toBe(0);
      expect(result.progress.total).toBe(0);
    });

    it('should return not-complete for unknown pathway', () => {
      const result = calculatePathwayCompletion('nonexistent-pathway', {
        'some-course': { completed: true },
      });

      expect(result.completed).toBe(false);
      expect(result.progress.completed).toBe(0);
      expect(result.progress.total).toBe(0);
    });

    it('should handle null/undefined module flags gracefully', () => {
      const moduleProgress = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          started: true,
          // completed flag is undefined
        },
        'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': {
          // No flags at all
        } as any,
      };

      const result = calculateCourseCompletion('hedgehog-lab-foundations', moduleProgress);

      expect(result.completed).toBe(false);
      expect(result.progress.completed).toBe(0);
    });

    it('should require explicit true for completion (not truthy)', () => {
      const moduleProgress = {
        'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
          completed: 'true' as any, // String instead of boolean
        },
      };

      const result = calculateCourseCompletion('hedgehog-lab-foundations', moduleProgress);

      // Should only count boolean true
      expect(result.progress.completed).toBe(0);
    });

    it('should handle metadata cache loading idempotently', () => {
      // Load multiple times - should not error or duplicate
      loadMetadataCache();
      loadMetadataCache();
      loadMetadataCache();

      const courseMeta = getCourseMetadata('hedgehog-lab-foundations');
      expect(courseMeta).toBeDefined();
    });
  });

  // ==========================================================================
  // Scenario 6: Explicit completion event validation
  // ==========================================================================
  describe('Scenario 6: Explicit completion validation', () => {
    it('should validate course completion when all modules are complete', () => {
      const progressData = {
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
      };

      const result = validateExplicitCompletion(
        'course',
        'hedgehog-lab-foundations',
        progressData
      );

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject course completion when modules are incomplete', () => {
      const progressData = {
        modules: {
          'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
            completed: true,
            completed_at: '2025-10-19T10:30:00Z',
          },
          // Other modules missing or incomplete
        },
      };

      const result = validateExplicitCompletion(
        'course',
        'hedgehog-lab-foundations',
        progressData
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('modules completed');
    });

    it('should validate pathway completion when all courses are complete', () => {
      const pathwayMeta = getPathwayMetadata('getting-started');
      if (!pathwayMeta) {
        // Skip if pathway doesn't exist
        return;
      }

      // Build complete courses object based on actual pathway
      const courses: Record<string, any> = {};
      pathwayMeta.courses.forEach((courseSlug) => {
        courses[courseSlug] = {
          completed: true,
          completed_at: '2025-10-19T15:00:00Z',
        };
      });

      const progressData = { courses };

      const result = validateExplicitCompletion('pathway', 'getting-started', progressData);

      expect(result.valid).toBe(true);
    });

    it('should reject pathway completion when courses are incomplete', () => {
      const progressData = {
        courses: {
          'hedgehog-lab-foundations': {
            completed: true,
          },
          // Other courses missing
        },
      };

      const result = validateExplicitCompletion('pathway', 'getting-started', progressData);

      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('courses completed');
    });

    it('should reject validation for nonexistent course', () => {
      const progressData = {
        modules: {
          'some-module': { completed: true },
        },
      };

      const result = validateExplicitCompletion('course', 'nonexistent-course', progressData);

      expect(result.valid).toBe(false);
    });

    it('should handle missing modules object in course validation', () => {
      const progressData = {
        // modules field missing
        started: true,
      };

      const result = validateExplicitCompletion(
        'course',
        'hedgehog-lab-foundations',
        progressData
      );

      expect(result.valid).toBe(false);
    });

    it('should handle missing courses object in pathway validation', () => {
      const progressData = {
        // courses field missing
        started: true,
      };

      const result = validateExplicitCompletion('pathway', 'getting-started', progressData);

      expect(result.valid).toBe(false);
    });
  });

  // ==========================================================================
  // Additional: Metadata cache functionality
  // ==========================================================================
  describe('Metadata cache functionality', () => {
    it('should successfully load course metadata', () => {
      const courseMeta = getCourseMetadata('hedgehog-lab-foundations');

      expect(courseMeta).toBeDefined();
      expect(courseMeta!.slug).toBe('hedgehog-lab-foundations');
      expect(Array.isArray(courseMeta!.modules)).toBe(true);
      expect(courseMeta!.modules.length).toBeGreaterThan(0);
    });

    it('should successfully load pathway metadata', () => {
      const pathwayMeta = getPathwayMetadata('getting-started');

      expect(pathwayMeta).toBeDefined();
      expect(pathwayMeta!.slug).toBe('getting-started');
      expect(Array.isArray(pathwayMeta!.courses)).toBe(true);
    });

    it('should return undefined for missing course', () => {
      const courseMeta = getCourseMetadata('this-course-does-not-exist');

      expect(courseMeta).toBeUndefined();
    });

    it('should return undefined for missing pathway', () => {
      const pathwayMeta = getPathwayMetadata('this-pathway-does-not-exist');

      expect(pathwayMeta).toBeUndefined();
    });
  });
});
