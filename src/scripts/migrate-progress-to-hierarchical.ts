#!/usr/bin/env node
/**
 * Migration Script: Flat Progress → Hierarchical Progress Model
 *
 * Purpose: Transform existing contact progress data from flat pathway→module
 * structure to hierarchical pathway→course→module structure.
 *
 * Usage:
 *   npm run build
 *   node dist/scripts/migrate-progress-to-hierarchical.js [--dry-run] [--verify] [--contact-id=123]
 *
 * Flags:
 *   --dry-run: Preview changes without persisting to CRM
 *   --verify: Run validation only (no writes)
 *   --contact-id=ID: Migrate single contact (for testing)
 *   --batch-size=N: Process N contacts at a time (default: 50)
 *
 * Evidence:
 *   Snapshots saved to: verification-output/issue-215/snapshots/
 *   Migration summary: verification-output/issue-215/migration-summary.json
 *   Validation report: verification-output/issue-215/validation-report.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { getHubSpotClient } from '../shared/hubspot.js';
import type { PathwayProgressState, CourseProgressState, ModuleProgressState } from '../shared/types.js';

const OUTPUT_DIR = 'verification-output/issue-215';
const SNAPSHOTS_DIR = `${OUTPUT_DIR}/snapshots`;

// Parse command-line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verifyOnly = args.includes('--verify');
const contactIdArg = args.find((arg) => arg.startsWith('--contact-id='));
const batchSizeArg = args.find((arg) => arg.startsWith('--batch-size='));

const singleContactId = contactIdArg ? contactIdArg.split('=')[1] : null;
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 50;

interface MigrationMetrics {
  total_contacts: number;
  migrated: number;
  skipped: number;
  failed: number;
  validation_errors: number;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
}

interface ValidationResult {
  success: boolean;
  errors: string[];
  contact_id: string;
  before_modules: number;
  after_modules: number;
  before_enrollments: number;
  after_enrollments: number;
}

const metrics: MigrationMetrics = {
  total_contacts: 0,
  migrated: 0,
  skipped: 0,
  failed: 0,
  validation_errors: 0,
  start_time: new Date().toISOString(),
};

const validationResults: ValidationResult[] = [];

/**
 * Setup output directories
 */
function setupOutputDirectories() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }
}

/**
 * Save snapshot to disk
 */
function saveSnapshot(contactId: string, stage: 'before' | 'after', data: string) {
  const filename = `${SNAPSHOTS_DIR}/contact-${contactId}-${stage}.json`;
  fs.writeFileSync(filename, data, 'utf-8');
}

/**
 * Load pathway content from disk
 */
function loadPathwayContent(pathwaySlug: string): any {
  try {
    const pathwayPath = path.join(process.cwd(), `content/pathways/${pathwaySlug}.json`);
    if (!fs.existsSync(pathwayPath)) {
      console.warn(`Pathway content not found: ${pathwaySlug}`);
      return null;
    }
    const content = fs.readFileSync(pathwayPath, 'utf-8');
    return JSON.parse(content);
  } catch (err: any) {
    console.error(`Error loading pathway ${pathwaySlug}:`, err.message);
    return null;
  }
}

/**
 * Load course content from disk
 */
function loadCourseContent(courseSlug: string): any {
  try {
    const coursePath = path.join(process.cwd(), `content/courses/${courseSlug}.json`);
    if (!fs.existsSync(coursePath)) {
      console.warn(`Course content not found: ${courseSlug}`);
      return null;
    }
    const content = fs.readFileSync(coursePath, 'utf-8');
    return JSON.parse(content);
  } catch (err: any) {
    console.error(`Error loading course ${courseSlug}:`, err.message);
    return null;
  }
}

/**
 * Update course-level aggregates based on module progress
 */
function updateCourseAggregates(course: CourseProgressState) {
  const modules = Object.values(course.modules || {}) as ModuleProgressState[];
  if (modules.length === 0) return;

  // Started: any module started
  const anyStarted = modules.some((m) => m.started);
  if (anyStarted && !course.started) {
    course.started = true;
    const startedModules = modules.filter((m) => m.started_at).map((m) => m.started_at!);
    course.started_at = startedModules.sort()[0]; // Earliest
  }

  // Completed: all modules completed
  const allCompleted = modules.length > 0 && modules.every((m) => m.completed);
  if (allCompleted && !course.completed) {
    course.completed = true;
    const completedModules = modules.filter((m) => m.completed_at).map((m) => m.completed_at!);
    course.completed_at = completedModules.sort().reverse()[0]; // Latest
  }
}

/**
 * Update pathway-level aggregates based on course progress
 */
function updatePathwayAggregates(pathway: PathwayProgressState) {
  if (pathway.courses) {
    const courses = Object.values(pathway.courses || {}) as CourseProgressState[];
    if (courses.length === 0) return;

    const anyStarted = courses.some((c) => c.started);
    if (anyStarted && !pathway.started) {
      pathway.started = true;
      const startedCourses = courses.filter((c) => c.started_at).map((c) => c.started_at!);
      pathway.started_at = startedCourses.sort()[0];
    }

    const allCompleted = courses.length > 0 && courses.every((c) => c.completed);
    if (allCompleted && !pathway.completed) {
      pathway.completed = true;
      const completedCourses = courses.filter((c) => c.completed_at).map((c) => c.completed_at!);
      pathway.completed_at = completedCourses.sort().reverse()[0];
    }
  }
}

/**
 * Transform a flat pathway to hierarchical structure
 */
async function transformToHierarchical(
  pathwaySlug: string,
  currentPathwayData: any,
  courseSlugs: string[]
): Promise<PathwayProgressState> {
  const newPathway: PathwayProgressState = {
    enrolled: currentPathwayData.enrolled,
    enrolled_at: currentPathwayData.enrolled_at,
    enrollment_source: currentPathwayData.enrollment_source,
    courses: {},
  };

  // For each course in the pathway content definition
  for (const courseSlug of courseSlugs) {
    const courseContent = loadCourseContent(courseSlug);
    if (!courseContent) {
      console.warn(`Skipping course ${courseSlug} (content not found)`);
      continue;
    }

    const courseModules = courseContent.modules || [];

    const courseProgress: CourseProgressState = {
      modules: {},
    };

    // Migrate module progress from flat pathway to course
    const currentModules = currentPathwayData.modules || {};
    for (const moduleSlug of courseModules) {
      if (currentModules[moduleSlug]) {
        // Module progress exists - migrate it
        courseProgress.modules![moduleSlug] = { ...currentModules[moduleSlug] };
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

/**
 * Transform entire progress state
 */
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
    const pathwayContent = loadPathwayContent(pathwaySlug);

    if (!pathwayContent) {
      console.warn(`Pathway content not found for ${pathwaySlug}, keeping as-is`);
      newState[pathwaySlug] = pathwayData;
      continue;
    }

    if (pathwayContent.courses && pathwayContent.courses.length > 0) {
      // HIERARCHICAL: Pathway uses courses
      console.log(`Transforming pathway ${pathwaySlug} to hierarchical model (${pathwayContent.courses.length} courses)`);
      newState[pathwaySlug] = await transformToHierarchical(pathwaySlug, pathwayData, pathwayContent.courses);
    } else {
      // FLAT: Pathway uses direct modules (keep as-is for backward compatibility)
      console.log(`Keeping pathway ${pathwaySlug} as flat model (backward compatibility)`);
      newState[pathwaySlug] = pathwayData;
    }
  }

  return newState;
}

/**
 * Extract all module progress entries from progress state
 */
function extractAllModuleProgress(progressState: any): Record<string, any> {
  const moduleProgress: Record<string, any> = {};

  for (const [key, data] of Object.entries(progressState)) {
    if (key === 'courses') {
      // Standalone courses
      const courses = data as any;
      for (const [courseSlug, courseData] of Object.entries(courses)) {
        const course = courseData as any;
        for (const [moduleSlug, moduleData] of Object.entries(course.modules || {})) {
          moduleProgress[`courses.${courseSlug}.${moduleSlug}`] = moduleData;
        }
      }
    } else {
      // Pathway
      const pathway = data as any;
      if (pathway.courses) {
        // Hierarchical
        for (const [courseSlug, courseData] of Object.entries(pathway.courses)) {
          const course = courseData as any;
          for (const [moduleSlug, moduleData] of Object.entries(course.modules || {})) {
            moduleProgress[`${key}.${courseSlug}.${moduleSlug}`] = moduleData;
          }
        }
      } else if (pathway.modules) {
        // Flat
        for (const [moduleSlug, moduleData] of Object.entries(pathway.modules)) {
          moduleProgress[`${key}.${moduleSlug}`] = moduleData;
        }
      }
    }
  }

  return moduleProgress;
}

/**
 * Extract all enrollments from progress state
 */
function extractAllEnrollments(progressState: any): string[] {
  const enrollments: string[] = [];

  for (const [key, data] of Object.entries(progressState)) {
    if (key === 'courses') {
      const courses = data as any;
      for (const courseSlug in courses) {
        if (courses[courseSlug].enrolled) {
          enrollments.push(`course:${courseSlug}`);
        }
      }
    } else {
      const pathway = data as any;
      if (pathway.enrolled) {
        enrollments.push(`pathway:${key}`);
      }
      if (pathway.courses) {
        for (const courseSlug in pathway.courses) {
          if (pathway.courses[courseSlug].enrolled) {
            enrollments.push(`course:${courseSlug}`);
          }
        }
      }
    }
  }

  return enrollments;
}

/**
 * Extract all timestamps from progress state
 */
function extractAllTimestamps(progressState: any): string[] {
  const timestamps: string[] = [];

  const extract = (obj: any) => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        timestamps.push(value);
      } else if (typeof value === 'object' && value !== null) {
        extract(value);
      }
    }
  };

  extract(progressState);
  return timestamps;
}

/**
 * Validate migration
 */
function validateMigration(contactId: string, before: any, after: any): ValidationResult {
  const errors: string[] = [];

  // Rule 1: No module progress lost
  const beforeModules = extractAllModuleProgress(before);
  const afterModules = extractAllModuleProgress(after);

  for (const [beforeKey, progress] of Object.entries(beforeModules)) {
    // Match by full path to handle reused modules correctly
    // For flat pathways transforming to hierarchical, map flat paths to hierarchical paths
    let matchingAfterKey: string | undefined;

    // Try exact match first (for unchanged pathways and standalone courses)
    if (afterModules[beforeKey]) {
      matchingAfterKey = beforeKey;
    } else {
      // For transformed pathways, match by logical equivalence
      // Example: "pathway.module-a" -> "pathway.course-x.module-a"
      // Strategy: Find the after key where the module slug matches AND is in the same pathway context
      const beforeParts = beforeKey.split('.');
      const beforeModule = beforeParts[beforeParts.length - 1]; // Last part is always module slug
      const beforeContext = beforeParts.slice(0, -1).join('.'); // Everything before module slug

      // Find all after keys with same module slug
      const candidateKeys = Object.keys(afterModules).filter((k) => {
        const afterParts = k.split('.');
        const afterModule = afterParts[afterParts.length - 1];
        const afterContext = afterParts.slice(0, -1).join('.');

        // Module slug must match
        if (beforeModule !== afterModule) return false;

        // Context must match (pathway or course scope)
        // For flat→hierarchical: "pathway" should match "pathway.course"
        // For unchanged: "pathway" should match "pathway" or "courses.course" should match "courses.course"
        return (
          afterContext === beforeContext || // Exact match (no transformation)
          afterContext.startsWith(beforeContext + '.') // Hierarchical transformation (flat→nested)
        );
      });

      if (candidateKeys.length === 1) {
        matchingAfterKey = candidateKeys[0];
      } else if (candidateKeys.length > 1) {
        // Multiple matches - this is expected for modules reused across courses in the SAME pathway
        // All should have identical progress data, so pick the first one
        matchingAfterKey = candidateKeys[0];

        // Verify all candidates have identical progress
        const firstProgress = afterModules[candidateKeys[0]];
        for (let i = 1; i < candidateKeys.length; i++) {
          if (JSON.stringify(afterModules[candidateKeys[i]]) !== JSON.stringify(firstProgress)) {
            errors.push(
              `Module progress inconsistent for reused module: ${beforeModule} (${candidateKeys.join(', ')})`
            );
          }
        }
      }
    }

    if (!matchingAfterKey) {
      errors.push(`Module progress lost: ${beforeKey}`);
    } else {
      // Check if progress data matches
      const afterProgress = afterModules[matchingAfterKey];
      if (JSON.stringify(progress) !== JSON.stringify(afterProgress)) {
        errors.push(`Module progress changed: ${beforeKey} -> ${matchingAfterKey}`);
      }
    }
  }

  // Rule 2: No enrollment data lost
  const beforeEnrollments = extractAllEnrollments(before);
  const afterEnrollments = extractAllEnrollments(after);

  for (const enrollment of beforeEnrollments) {
    if (!afterEnrollments.includes(enrollment)) {
      errors.push(`Enrollment lost: ${enrollment}`);
    }
  }

  // Rule 3: Timestamps preserved
  const beforeTimestamps = extractAllTimestamps(before);
  const afterTimestamps = extractAllTimestamps(after);

  for (const ts of beforeTimestamps) {
    if (!afterTimestamps.includes(ts)) {
      errors.push(`Timestamp lost: ${ts}`);
    }
  }

  return {
    success: errors.length === 0,
    errors,
    contact_id: contactId,
    before_modules: Object.keys(beforeModules).length,
    after_modules: Object.keys(afterModules).length,
    before_enrollments: beforeEnrollments.length,
    after_enrollments: afterEnrollments.length,
  };
}

/**
 * Migrate a single contact
 */
async function migrateContact(hubspot: any, contactId: string): Promise<boolean> {
  try {
    console.log(`\n[${contactId}] Starting migration...`);

    // Read current progress state
    const contact = await hubspot.crm.contacts.basicApi.getById(contactId, ['hhl_progress_state', 'email']);
    const currentStateRaw = contact.properties.hhl_progress_state;

    if (!currentStateRaw || currentStateRaw.trim() === '' || currentStateRaw === '{}') {
      console.log(`[${contactId}] No progress data, skipping`);
      metrics.skipped++;
      return true;
    }

    const currentState = JSON.parse(currentStateRaw);

    // Save before snapshot
    const beforeSnapshot = JSON.stringify(currentState, null, 2);
    saveSnapshot(contactId, 'before', beforeSnapshot);

    // Transform progress data
    console.log(`[${contactId}] Transforming progress state...`);
    const newState = await transformProgressState(currentState);

    // Validate migration
    const validation = validateMigration(contactId, currentState, newState);
    validationResults.push(validation);

    if (!validation.success) {
      console.error(`[${contactId}] ❌ Validation FAILED:`);
      validation.errors.forEach((err) => console.error(`  - ${err}`));
      metrics.validation_errors++;

      if (!dryRun && !verifyOnly) {
        console.error(`[${contactId}] Aborting migration due to validation failure`);
        metrics.failed++;
        return false;
      }
    } else {
      console.log(`[${contactId}] ✅ Validation passed`);
    }

    // Save after snapshot
    const afterSnapshot = JSON.stringify(newState, null, 2);
    saveSnapshot(contactId, 'after', afterSnapshot);

    // Write new state (unless dry-run or verify-only)
    if (!dryRun && !verifyOnly) {
      console.log(`[${contactId}] Writing updated progress state to CRM...`);
      await hubspot.crm.contacts.basicApi.update(contactId, {
        properties: {
          hhl_progress_state: JSON.stringify(newState),
        },
      });
      console.log(`[${contactId}] ✅ Migration complete`);
      metrics.migrated++;
    } else {
      console.log(`[${contactId}] ✅ Dry-run complete (no changes persisted)`);
      metrics.migrated++;
    }

    return true;
  } catch (err: any) {
    console.error(`[${contactId}] ❌ Migration error:`, err.message);
    metrics.failed++;
    return false;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('=== HubSpot Progress Migration: Flat → Hierarchical ===');
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : verifyOnly ? 'VERIFY-ONLY' : 'LIVE'}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Single contact: ${singleContactId || 'No (migrating all)'}`);
  console.log('');

  setupOutputDirectories();

  const hubspot = getHubSpotClient();

  if (singleContactId) {
    // Migrate single contact
    metrics.total_contacts = 1;
    await migrateContact(hubspot, singleContactId);
  } else {
    // Migrate all contacts with progress data
    console.log('Fetching all contacts with progress data...');

    let after: string | undefined = undefined;
    let page = 0;

    do {
      // Fetch contacts in batches
      const searchRequest: any = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'hhl_progress_state',
                operator: 'HAS_PROPERTY' as any,
              },
            ],
          },
        ],
        properties: ['hhl_progress_state', 'email'],
        limit: batchSize,
      };

      if (after) {
        searchRequest.after = after;
      }

      const searchResponse = await hubspot.crm.contacts.searchApi.doSearch(searchRequest);

      const contacts = searchResponse.results || [];
      page++;
      console.log(`\nProcessing batch ${page} (${contacts.length} contacts)...`);

      for (const contact of contacts) {
        metrics.total_contacts++;
        await migrateContact(hubspot, contact.id);
      }

      // Check for next page
      after = searchResponse.paging?.next?.after;
    } while (after);
  }

  // Finalize metrics
  metrics.end_time = new Date().toISOString();
  const startTime = new Date(metrics.start_time);
  const endTime = new Date(metrics.end_time);
  metrics.duration_seconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

  // Save summary
  const summaryPath = `${OUTPUT_DIR}/migration-summary.json`;
  fs.writeFileSync(summaryPath, JSON.stringify(metrics, null, 2), 'utf-8');

  // Save validation report
  const validationPath = `${OUTPUT_DIR}/validation-report.json`;
  fs.writeFileSync(validationPath, JSON.stringify(validationResults, null, 2), 'utf-8');

  // Print summary
  console.log('\n=== Migration Summary ===');
  console.log(`Total contacts: ${metrics.total_contacts}`);
  console.log(`Migrated: ${metrics.migrated}`);
  console.log(`Skipped: ${metrics.skipped}`);
  console.log(`Failed: ${metrics.failed}`);
  console.log(`Validation errors: ${metrics.validation_errors}`);
  console.log(`Duration: ${metrics.duration_seconds}s`);
  console.log(`\nSummary saved to: ${summaryPath}`);
  console.log(`Validation report: ${validationPath}`);
  console.log(`Snapshots: ${SNAPSHOTS_DIR}/`);

  if (metrics.validation_errors > 0) {
    console.error('\n⚠️  WARNING: Some contacts had validation errors. Review validation-report.json');
    process.exit(1);
  }

  if (dryRun || verifyOnly) {
    console.log('\n✅ Dry-run/verify complete. No changes persisted to CRM.');
  } else {
    console.log('\n✅ Migration complete!');
  }
}

// Run migration
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
