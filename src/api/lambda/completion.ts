/**
 * Completion Tracking Engine - Issue #221
 *
 * Provides metadata-driven completion calculation for courses and pathways.
 * Addresses the false-positive issues from PR #219 by comparing against
 * full course/pathway definitions instead of partial progress snapshots.
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

interface ModuleProgressState {
  started?: boolean;
  started_at?: string;
  completed?: boolean;
  completed_at?: string;
}

interface CourseProgressState {
  modules?: Record<string, ModuleProgressState>;
  started?: boolean;
  started_at?: string;
  completed?: boolean;
  completed_at?: string;
  enrolled?: boolean;
  enrolled_at?: string;
  enrollment_source?: string;
}

interface CourseMetadata {
  slug: string;
  modules: string[];
  // Future: optional: boolean[] for optional modules
}

interface PathwayMetadata {
  slug: string;
  courses: string[];
  // Future: optional: boolean[] for optional courses
}

interface CompletionResult {
  completed: boolean;
  progress: {
    completed: number;
    total: number;
  };
}

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// ============================================================================
// Metadata Cache
// ============================================================================

/**
 * Global metadata cache - loaded once at Lambda cold start,
 * persists across warm invocations for optimal performance.
 */
const METADATA_CACHE: {
  courses: Map<string, CourseMetadata>;
  pathways: Map<string, PathwayMetadata>;
  loaded: boolean;
} = {
  courses: new Map(),
  pathways: new Map(),
  loaded: false
};

/**
 * Load course and pathway metadata from content definitions.
 * Called once at module initialization (Lambda cold start).
 *
 * Performance: <10ms for ~50-100 courses/pathways
 */
export function loadMetadataCache(): void {
  if (METADATA_CACHE.loaded) {
    return;
  }

  const contentDir = path.join(__dirname, '../../../content');

  try {
    // Load all course definitions
    const coursesDir = path.join(contentDir, 'courses');
    if (fs.existsSync(coursesDir)) {
      const courseFiles = fs.readdirSync(coursesDir).filter(f => f.endsWith('.json'));

      for (const file of courseFiles) {
        try {
          const filePath = path.join(coursesDir, file);
          const course = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          if (course.slug && Array.isArray(course.modules)) {
            METADATA_CACHE.courses.set(course.slug, {
              slug: course.slug,
              modules: course.modules
            });
          }
        } catch (err) {
          console.warn(`Failed to load course metadata from ${file}:`, err);
        }
      }
    }

    // Load all pathway definitions
    const pathwaysDir = path.join(contentDir, 'pathways');
    if (fs.existsSync(pathwaysDir)) {
      const pathwayFiles = fs.readdirSync(pathwaysDir).filter(f => f.endsWith('.json'));

      for (const file of pathwayFiles) {
        try {
          const filePath = path.join(pathwaysDir, file);
          const pathway = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

          if (pathway.slug && Array.isArray(pathway.courses)) {
            METADATA_CACHE.pathways.set(pathway.slug, {
              slug: pathway.slug,
              courses: pathway.courses
            });
          }
        } catch (err) {
          console.warn(`Failed to load pathway metadata from ${file}:`, err);
        }
      }
    }

    METADATA_CACHE.loaded = true;
    console.log(`[Completion] Metadata loaded: ${METADATA_CACHE.courses.size} courses, ${METADATA_CACHE.pathways.size} pathways`);
  } catch (err) {
    console.error('[Completion] Failed to load metadata cache:', err);
    // Mark as loaded even on failure to avoid retry loops
    METADATA_CACHE.loaded = true;
  }
}

/**
 * Get course metadata from cache.
 * Returns undefined if course not found.
 */
export function getCourseMetadata(courseSlug: string): CourseMetadata | undefined {
  return METADATA_CACHE.courses.get(courseSlug);
}

/**
 * Get pathway metadata from cache.
 * Returns undefined if pathway not found.
 */
export function getPathwayMetadata(pathwaySlug: string): PathwayMetadata | undefined {
  return METADATA_CACHE.pathways.get(pathwaySlug);
}

// ============================================================================
// Completion Calculation
// ============================================================================

/**
 * Calculate course completion based on metadata.
 *
 * Decision: All modules in definition are required (no optional modules yet)
 *
 * @param courseSlug - Course identifier
 * @param modules - Module progress state (may be partial)
 * @returns Completion status and progress counts
 */
export function calculateCourseCompletion(
  courseSlug: string,
  modules: Record<string, ModuleProgressState>
): CompletionResult {

  const courseMeta = METADATA_CACHE.courses.get(courseSlug);

  if (!courseMeta) {
    console.warn(`[Completion] Course metadata not found: ${courseSlug}`);
    return {
      completed: false,
      progress: { completed: 0, total: 0 }
    };
  }

  // All modules in definition are required
  const requiredModules = courseMeta.modules;

  if (requiredModules.length === 0) {
    // Empty course - never complete
    return {
      completed: false,
      progress: { completed: 0, total: 0 }
    };
  }

  // Count completed modules
  const completedModules = requiredModules.filter(slug =>
    modules[slug]?.completed === true
  );

  const completed = completedModules.length === requiredModules.length;

  return {
    completed,
    progress: {
      completed: completedModules.length,
      total: requiredModules.length
    }
  };
}

/**
 * Calculate pathway completion based on metadata.
 *
 * Decision: All courses in definition are required (no optional courses yet)
 *
 * @param pathwaySlug - Pathway identifier
 * @param courses - Course progress state (may be partial)
 * @returns Completion status and progress counts
 */
export function calculatePathwayCompletion(
  pathwaySlug: string,
  courses: Record<string, CourseProgressState>
): CompletionResult {

  const pathwayMeta = METADATA_CACHE.pathways.get(pathwaySlug);

  if (!pathwayMeta) {
    console.warn(`[Completion] Pathway metadata not found: ${pathwaySlug}`);
    return {
      completed: false,
      progress: { completed: 0, total: 0 }
    };
  }

  // All courses in definition are required
  const requiredCourses = pathwayMeta.courses;

  if (requiredCourses.length === 0) {
    // Empty pathway - never complete
    return {
      completed: false,
      progress: { completed: 0, total: 0 }
    };
  }

  // Count completed courses
  const completedCourses = requiredCourses.filter(slug =>
    courses[slug]?.completed === true
  );

  const completed = completedCourses.length === requiredCourses.length;

  return {
    completed,
    progress: {
      completed: completedCourses.length,
      total: requiredCourses.length
    }
  };
}

// ============================================================================
// Explicit Completion Validation
// ============================================================================

/**
 * Validate explicit completion event against actual progress.
 *
 * Decision: Strict validation - reject events that don't match reality
 *
 * @param type - Type of completion (course or pathway)
 * @param slug - Course or pathway identifier
 * @param progressData - Current progress state
 * @returns Validation result with reason if invalid
 */
export function validateExplicitCompletion(
  type: 'course' | 'pathway',
  slug: string,
  progressData: any
): ValidationResult {

  if (type === 'course') {
    const result = calculateCourseCompletion(slug, progressData.modules || {});

    if (!result.completed) {
      return {
        valid: false,
        reason: `Course not actually complete: ${result.progress.completed}/${result.progress.total} modules completed`
      };
    }
  } else {
    const result = calculatePathwayCompletion(slug, progressData.courses || {});

    if (!result.completed) {
      return {
        valid: false,
        reason: `Pathway not actually complete: ${result.progress.completed}/${result.progress.total} courses completed`
      };
    }
  }

  return { valid: true };
}

/**
 * Validate explicit completion timestamp against inferred completion time.
 *
 * Decision: Accept if within ±5 minutes of last child completion
 *
 * @param explicitTimestamp - Timestamp from explicit completion event
 * @param inferredTimestamp - Latest child completion timestamp
 * @returns True if timestamps are close enough
 */
export function validateCompletionTimestamp(
  explicitTimestamp: string,
  inferredTimestamp: string
): boolean {
  const explicitTime = new Date(explicitTimestamp).getTime();
  const inferredTime = new Date(inferredTimestamp).getTime();

  const differenceMs = Math.abs(explicitTime - inferredTime);
  const fiveMinutesMs = 5 * 60 * 1000;

  return differenceMs <= fiveMinutesMs;
}

// ============================================================================
// Initialization
// ============================================================================

// Load metadata at module initialization (Lambda cold start)
loadMetadataCache();
