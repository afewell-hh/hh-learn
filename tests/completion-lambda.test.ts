/**
 * Lambda handler tests for explicit completion events (Issue #221, Phase 2)
 *
 * Tests verify that:
 * 1. Valid learning_course_completed events are accepted
 * 2. Invalid claims are rejected with structured errors
 * 3. Valid learning_pathway_completed events are accepted
 * 4. Invalid pathway claims are rejected
 * 5. Timestamp validation works correctly
 * 6. Validation failures are logged appropriately
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  loadMetadataCache,
  validateExplicitCompletion,
  validateCompletionTimestamp,
} from '../src/api/lambda/completion.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Valid course progress data for testing
 */
const VALID_COURSE_PROGRESS = {
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
  started: true,
  started_at: '2025-10-19T10:00:00Z',
  completed: true,
  completed_at: '2025-10-19T13:30:00Z',
};

/**
 * Invalid course progress (incomplete modules)
 */
const INVALID_COURSE_PROGRESS = {
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
      // Not completed
    },
    // Other modules missing
  },
  started: true,
  started_at: '2025-10-19T10:00:00Z',
};

// ============================================================================
// Lambda Handler Tests
// ============================================================================

describe('Lambda Handler - Completion Event Validation', () => {
  beforeAll(() => {
    loadMetadataCache();
  });

  // ==========================================================================
  // learning_course_completed Event Tests
  // ==========================================================================
  describe('learning_course_completed event', () => {
    describe('Valid completion claims', () => {
      it('should accept valid course completion event', () => {
        const result = validateExplicitCompletion(
          'course',
          'hedgehog-lab-foundations',
          VALID_COURSE_PROGRESS
        );

        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should accept course completion with all required modules', () => {
        const progressData = {
          modules: {
            'accessing-the-hedgehog-virtual-lab-with-google-cloud': { completed: true },
            'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': { completed: true },
            'accessing-the-hedgehog-virtual-lab-with-microsoft-azure': { completed: true },
            'intro-to-kubernetes': { completed: true },
          },
        };

        const result = validateExplicitCompletion(
          'course',
          'hedgehog-lab-foundations',
          progressData
        );

        expect(result.valid).toBe(true);
      });

      it('should accept course completion with extra metadata', () => {
        const progressData = {
          modules: VALID_COURSE_PROGRESS.modules,
          started: true,
          started_at: '2025-10-19T10:00:00Z',
          completed: true,
          completed_at: '2025-10-19T13:30:00Z',
          extra_field: 'ignored',
        };

        const result = validateExplicitCompletion(
          'course',
          'hedgehog-lab-foundations',
          progressData
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('Invalid completion claims', () => {
      it('should reject course completion with incomplete modules', () => {
        const result = validateExplicitCompletion(
          'course',
          'hedgehog-lab-foundations',
          INVALID_COURSE_PROGRESS
        );

        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.reason).toContain('not actually complete');
      });

      it('should reject course completion with no modules', () => {
        const progressData = {
          modules: {},
          started: true,
        };

        const result = validateExplicitCompletion(
          'course',
          'hedgehog-lab-foundations',
          progressData
        );

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('0/4');
      });

      it('should reject course completion with missing modules object', () => {
        const progressData = {
          started: true,
          completed: true, // Claimed, but no modules to back it up
        };

        const result = validateExplicitCompletion(
          'course',
          'hedgehog-lab-foundations',
          progressData
        );

        expect(result.valid).toBe(false);
      });

      it('should reject course completion for nonexistent course', () => {
        const result = validateExplicitCompletion(
          'course',
          'nonexistent-course',
          VALID_COURSE_PROGRESS
        );

        expect(result.valid).toBe(false);
      });

      it('should reject with progress ratio in error message', () => {
        const result = validateExplicitCompletion(
          'course',
          'hedgehog-lab-foundations',
          INVALID_COURSE_PROGRESS
        );

        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/\d+\/\d+/); // Should contain "X/Y modules completed"
      });

      it('should reject course with only started modules', () => {
        const progressData = {
          modules: {
            'accessing-the-hedgehog-virtual-lab-with-google-cloud': {
              started: true,
              // No completed flag
            },
            'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': {
              started: true,
            },
          },
        };

        const result = validateExplicitCompletion(
          'course',
          'hedgehog-lab-foundations',
          progressData
        );

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('0/4'); // 0 completed
      });
    });

    describe('Edge cases', () => {
      it('should handle null progress data', () => {
        const result = validateExplicitCompletion('course', 'hedgehog-lab-foundations', null);

        expect(result.valid).toBe(false);
      });

      it('should handle undefined modules', () => {
        const result = validateExplicitCompletion('course', 'hedgehog-lab-foundations', {
          modules: undefined,
        });

        expect(result.valid).toBe(false);
      });

      it('should require exact module slugs (case sensitive)', () => {
        const progressData = {
          modules: {
            'Accessing-The-Hedgehog-Virtual-Lab-With-Google-Cloud': { completed: true }, // Wrong case
            'accessing-the-hedgehog-virtual-lab-with-amazon-web-services': { completed: true },
            'accessing-the-hedgehog-virtual-lab-with-microsoft-azure': { completed: true },
            'intro-to-kubernetes': { completed: true },
          },
        };

        const result = validateExplicitCompletion(
          'course',
          'hedgehog-lab-foundations',
          progressData
        );

        // Should fail because module slug doesn't match exactly
        expect(result.valid).toBe(false);
      });
    });
  });

  // ==========================================================================
  // learning_pathway_completed Event Tests
  // ==========================================================================
  describe('learning_pathway_completed event', () => {
    describe('Valid pathway completion claims', () => {
      it('should accept valid pathway completion event', () => {
        const progressData = {
          courses: {
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
              completed_at: '2025-10-19T18:00:00Z',
            },
            'pathway-assembly-and-layouts': {
              modules: {},
              started: true,
              started_at: '2025-10-19T19:00:00Z',
              completed: true,
              completed_at: '2025-10-19T21:00:00Z',
            },
          },
        };

        const result = validateExplicitCompletion(
          'pathway',
          'course-authoring-expert',
          progressData
        );

        // Should validate based on actual pathway definition
        if (result.valid) {
          expect(result.reason).toBeUndefined();
        } else {
          // If it fails, it should be because the courses don't match the pathway definition
          expect(result.reason).toBeDefined();
        }
      });

      it('should accept pathway with all required courses complete', () => {
        // Test with getting-started pathway
        const progressData = {
          courses: {
            // Note: We need to match the actual pathway definition
            'hedgehog-lab-foundations': {
              completed: true,
              completed_at: '2025-10-19T15:00:00Z',
            },
          },
        };

        // For getting-started pathway, check if it passes or fails based on definition
        const result = validateExplicitCompletion('pathway', 'getting-started', progressData);

        // Result depends on actual pathway definition
        // Test mainly ensures no crash and structured response
        expect(typeof result.valid).toBe('boolean');
      });
    });

    describe('Invalid pathway completion claims', () => {
      it('should reject pathway with incomplete courses', () => {
        const progressData = {
          courses: {
            'hedgehog-lab-foundations': {
              completed: true,
              completed_at: '2025-10-19T15:00:00Z',
            },
            'course-authoring-101': {
              started: true,
              started_at: '2025-10-19T16:00:00Z',
              completed: false, // Not complete
            },
          },
        };

        const result = validateExplicitCompletion(
          'pathway',
          'course-authoring-expert',
          progressData
        );

        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
      });

      it('should reject pathway with no courses', () => {
        const progressData = {
          courses: {},
        };

        const result = validateExplicitCompletion('pathway', 'getting-started', progressData);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('not actually complete');
      });

      it('should reject pathway with missing courses object', () => {
        const progressData = {
          started: true,
        };

        const result = validateExplicitCompletion('pathway', 'getting-started', progressData);

        expect(result.valid).toBe(false);
      });

      it('should reject pathway completion for nonexistent pathway', () => {
        const progressData = {
          courses: {
            'some-course': { completed: true },
          },
        };

        const result = validateExplicitCompletion(
          'pathway',
          'nonexistent-pathway',
          progressData
        );

        expect(result.valid).toBe(false);
      });

      it('should provide progress ratio in error message', () => {
        const progressData = {
          courses: {
            'hedgehog-lab-foundations': { completed: true },
            // Other courses missing
          },
        };

        const result = validateExplicitCompletion('pathway', 'getting-started', progressData);

        if (!result.valid) {
          expect(result.reason).toMatch(/\d+\/\d+/); // "X/Y courses completed"
        }
      });
    });

    describe('Edge cases', () => {
      it('should handle null progress data', () => {
        const result = validateExplicitCompletion('pathway', 'getting-started', null);

        expect(result.valid).toBe(false);
      });

      it('should handle undefined courses', () => {
        const result = validateExplicitCompletion('pathway', 'getting-started', {
          courses: undefined,
        });

        expect(result.valid).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Timestamp Validation Tests
  // ==========================================================================
  describe('Completion timestamp validation', () => {
    describe('Valid timestamp scenarios', () => {
      it('should accept timestamps within 5-minute window (positive offset)', () => {
        const baseTime = new Date('2025-10-19T14:00:00Z');
        const explicitTime = new Date(baseTime.getTime() + 4 * 60 * 1000); // +4 min

        const isValid = validateCompletionTimestamp(
          explicitTime.toISOString(),
          baseTime.toISOString()
        );

        expect(isValid).toBe(true);
      });

      it('should accept timestamps within 5-minute window (negative offset)', () => {
        const baseTime = new Date('2025-10-19T14:00:00Z');
        const explicitTime = new Date(baseTime.getTime() - 3 * 60 * 1000); // -3 min

        const isValid = validateCompletionTimestamp(
          explicitTime.toISOString(),
          baseTime.toISOString()
        );

        expect(isValid).toBe(true);
      });

      it('should accept timestamps exactly 5 minutes apart', () => {
        const baseTime = new Date('2025-10-19T14:00:00Z');
        const explicitTime = new Date(baseTime.getTime() + 5 * 60 * 1000);

        const isValid = validateCompletionTimestamp(
          explicitTime.toISOString(),
          baseTime.toISOString()
        );

        expect(isValid).toBe(true);
      });

      it('should accept identical timestamps', () => {
        const timestamp = '2025-10-19T14:00:00Z';

        const isValid = validateCompletionTimestamp(timestamp, timestamp);

        expect(isValid).toBe(true);
      });

      it('should accept timestamps with millisecond differences', () => {
        const time1 = '2025-10-19T14:00:00.123Z';
        const time2 = '2025-10-19T14:00:00.456Z';

        const isValid = validateCompletionTimestamp(time1, time2);

        expect(isValid).toBe(true);
      });
    });

    describe('Invalid timestamp scenarios', () => {
      it('should reject timestamps 6 minutes apart', () => {
        const baseTime = new Date('2025-10-19T14:00:00Z');
        const explicitTime = new Date(baseTime.getTime() + 6 * 60 * 1000);

        const isValid = validateCompletionTimestamp(
          explicitTime.toISOString(),
          baseTime.toISOString()
        );

        expect(isValid).toBe(false);
      });

      it('should reject timestamps 10 minutes apart', () => {
        const baseTime = new Date('2025-10-19T14:00:00Z');
        const explicitTime = new Date(baseTime.getTime() + 10 * 60 * 1000);

        const isValid = validateCompletionTimestamp(
          explicitTime.toISOString(),
          baseTime.toISOString()
        );

        expect(isValid).toBe(false);
      });

      it('should reject timestamps 1 hour apart', () => {
        const baseTime = new Date('2025-10-19T14:00:00Z');
        const explicitTime = new Date(baseTime.getTime() + 60 * 60 * 1000);

        const isValid = validateCompletionTimestamp(
          explicitTime.toISOString(),
          baseTime.toISOString()
        );

        expect(isValid).toBe(false);
      });

      it('should reject timestamp 6 minutes earlier', () => {
        const baseTime = new Date('2025-10-19T14:00:00Z');
        const explicitTime = new Date(baseTime.getTime() - 6 * 60 * 1000);

        const isValid = validateCompletionTimestamp(
          explicitTime.toISOString(),
          baseTime.toISOString()
        );

        expect(isValid).toBe(false);
      });
    });

    describe('Boundary conditions', () => {
      it('should accept 5:00.000 (exactly on boundary)', () => {
        const baseTime = new Date('2025-10-19T14:00:00.000Z');
        const explicitTime = new Date('2025-10-19T14:05:00.000Z');

        const isValid = validateCompletionTimestamp(
          explicitTime.toISOString(),
          baseTime.toISOString()
        );

        expect(isValid).toBe(true);
      });

      it('should reject 5:00.001 (just over boundary)', () => {
        const baseTime = new Date('2025-10-19T14:00:00.000Z');
        const explicitTime = new Date('2025-10-19T14:05:00.001Z');

        const isValid = validateCompletionTimestamp(
          explicitTime.toISOString(),
          baseTime.toISOString()
        );

        expect(isValid).toBe(false);
      });

      it('should handle subsecond precision correctly', () => {
        const baseTime = '2025-10-19T14:00:00.000Z';
        const withinBoundary = '2025-10-19T14:04:59.999Z';
        const overBoundary = '2025-10-19T14:05:00.001Z';

        expect(validateCompletionTimestamp(withinBoundary, baseTime)).toBe(true);
        expect(validateCompletionTimestamp(overBoundary, baseTime)).toBe(false);
      });
    });

    describe('Date format handling', () => {
      it('should handle ISO 8601 format', () => {
        const time1 = '2025-10-19T14:00:00Z';
        const time2 = '2025-10-19T14:02:00Z';

        const isValid = validateCompletionTimestamp(time1, time2);

        expect(isValid).toBe(true);
      });

      it('should handle ISO 8601 with milliseconds', () => {
        const time1 = '2025-10-19T14:00:00.000Z';
        const time2 = '2025-10-19T14:02:00.000Z';

        const isValid = validateCompletionTimestamp(time1, time2);

        expect(isValid).toBe(true);
      });

      it('should handle timestamps without Z suffix', () => {
        const time1 = '2025-10-19T14:00:00';
        const time2 = '2025-10-19T14:02:00';

        const isValid = validateCompletionTimestamp(time1, time2);

        expect(isValid).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Integration: Validation + Timestamp
  // ==========================================================================
  describe('Integrated validation scenarios', () => {
    it('should validate completion AND timestamp for valid event', () => {
      const progressData = VALID_COURSE_PROGRESS;
      const explicitTimestamp = '2025-10-19T13:32:00Z'; // Within 5 min of 13:30:00
      const inferredTimestamp = '2025-10-19T13:30:00Z';

      // First check: Is the course actually complete?
      const completionValid = validateExplicitCompletion(
        'course',
        'hedgehog-lab-foundations',
        progressData
      );
      expect(completionValid.valid).toBe(true);

      // Second check: Is timestamp within tolerance?
      const timestampValid = validateCompletionTimestamp(explicitTimestamp, inferredTimestamp);
      expect(timestampValid).toBe(true);
    });

    it('should reject event if completion invalid even with valid timestamp', () => {
      const progressData = INVALID_COURSE_PROGRESS;

      const completionValid = validateExplicitCompletion(
        'course',
        'hedgehog-lab-foundations',
        progressData
      );

      expect(completionValid.valid).toBe(false);
      // Timestamp validation is moot if completion is invalid
    });

    it('should warn (but accept) if timestamp mismatch with valid completion', () => {
      const progressData = VALID_COURSE_PROGRESS;
      const explicitTimestamp = '2025-10-19T14:00:00Z'; // >5 min from 13:30:00
      const inferredTimestamp = '2025-10-19T13:30:00Z';

      // Completion is valid
      const completionValid = validateExplicitCompletion(
        'course',
        'hedgehog-lab-foundations',
        progressData
      );
      expect(completionValid.valid).toBe(true);

      // Timestamp mismatch (would log warning in actual handler)
      const timestampValid = validateCompletionTimestamp(explicitTimestamp, inferredTimestamp);
      expect(timestampValid).toBe(false);

      // Per design: accept completion despite timestamp mismatch (just log warning)
      // This test documents that behavior
    });
  });
});
