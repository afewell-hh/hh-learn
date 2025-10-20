#!/usr/bin/env node
/**
 * Backfill Tool: Recompute Course and Pathway Completion Flags (Issue #221)
 *
 * Purpose: Standalone script to recalculate completion flags using the new
 * metadata-driven engine, ensuring all contacts have accurate completion state.
 *
 * Usage:
 *   npm run build
 *   node dist/scripts/backfill-completion-flags.js [options]
 *
 * Options:
 *   --dry-run           Preview changes without writing to CRM
 *   --batch-size=N      Process N contacts at a time (default: 50)
 *   --contact-id=ID     Process single contact (for testing)
 *   --skip-synced       Skip contacts already in sync (idempotent mode)
 *   --verbose           Enable detailed logging
 *
 * Output:
 *   - Progress metrics logged to console
 *   - Summary saved to: verification-output/issue-221/backfill-summary.json
 *   - Validation failures: verification-output/issue-221/backfill-failures.json
 *   - Change details: verification-output/issue-221/backfill-changes.json
 *
 * Rollback:
 *   See docs/issue-221-completion-tracking.md for rollback procedures
 */

import * as fs from 'fs';
import * as path from 'path';
import { getHubSpotClient } from '../shared/hubspot.js';
import {
  loadMetadataCache,
  calculateCourseCompletion,
  calculatePathwayCompletion,
} from '../api/lambda/completion.js';

// ============================================================================
// Configuration
// ============================================================================

const OUTPUT_DIR = 'verification-output/issue-221';
const SUMMARY_FILE = `${OUTPUT_DIR}/backfill-summary.json`;
const FAILURES_FILE = `${OUTPUT_DIR}/backfill-failures.json`;
const CHANGES_FILE = `${OUTPUT_DIR}/backfill-changes.json`;

// Parse command-line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipSynced = args.includes('--skip-synced');
const verbose = args.includes('--verbose');

const contactIdArg = args.find((arg) => arg.startsWith('--contact-id='));
const batchSizeArg = args.find((arg) => arg.startsWith('--batch-size='));

const singleContactId = contactIdArg ? contactIdArg.split('=')[1] : null;
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 50;

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

interface PathwayProgressState {
  courses?: Record<string, CourseProgressState>;
  modules?: Record<string, ModuleProgressState>;
  started?: boolean;
  started_at?: string;
  completed?: boolean;
  completed_at?: string;
  enrolled?: boolean;
  enrolled_at?: string;
  enrollment_source?: string;
}

interface BackfillMetrics {
  total_contacts: number;
  processed: number;
  updated: number;
  skipped_synced: number;
  failed: number;
  validation_errors: number;
  courses_updated: number;
  pathways_updated: number;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
}

interface ContactChange {
  contact_id: string;
  changes: {
    type: 'course' | 'pathway';
    slug: string;
    before: boolean;
    after: boolean;
    progress: { completed: number; total: number };
  }[];
}

interface ValidationFailure {
  contact_id: string;
  error: string;
  details?: any;
}

// ============================================================================
// State
// ============================================================================

const metrics: BackfillMetrics = {
  total_contacts: 0,
  processed: 0,
  updated: 0,
  skipped_synced: 0,
  failed: 0,
  validation_errors: 0,
  courses_updated: 0,
  pathways_updated: 0,
  start_time: new Date().toISOString(),
};

const allChanges: ContactChange[] = [];
const validationFailures: ValidationFailure[] = [];

// ============================================================================
// Setup
// ============================================================================

function setupOutputDirectory() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  console.log(`${prefix} ${message}`);
}

function verboseLog(message: string) {
  if (verbose) {
    log(message, 'info');
  }
}

// ============================================================================
// Core Backfill Logic
// ============================================================================

/**
 * Recalculate completion flags for a contact's progress state
 */
function recalculateCompletionFlags(progressState: any): {
  updated: boolean;
  changes: ContactChange['changes'];
} {
  const changes: ContactChange['changes'] = [];
  let updated = false;

  // Process pathways (hierarchical structure)
  for (const pathwaySlug in progressState) {
    if (pathwaySlug === 'courses') continue; // Skip flat courses

    const pathwayData = progressState[pathwaySlug] as PathwayProgressState;

    // If pathway has courses, recalculate pathway completion
    if (pathwayData.courses) {
      const result = calculatePathwayCompletion(pathwaySlug, pathwayData.courses);
      const before = pathwayData.completed || false;
      const after = result.completed;

      if (before !== after) {
        changes.push({
          type: 'pathway',
          slug: pathwaySlug,
          before,
          after,
          progress: result.progress,
        });
        pathwayData.completed = after;

        // Update completion timestamp if now complete
        if (after && pathwayData.courses) {
          const completedCourses = Object.values(pathwayData.courses).filter(
            (c) => c.completed && c.completed_at
          );
          if (completedCourses.length > 0) {
            const latestTimestamp = completedCourses
              .map((c) => new Date(c.completed_at!).getTime())
              .reduce((max, time) => Math.max(max, time), 0);
            pathwayData.completed_at = new Date(latestTimestamp).toISOString();
          }
        }

        updated = true;
        metrics.pathways_updated++;
      }

      // Recalculate course completion within pathway
      if (pathwayData.courses) {
        for (const courseSlug in pathwayData.courses) {
          const courseData = pathwayData.courses[courseSlug];
          const result = calculateCourseCompletion(courseSlug, courseData.modules || {});
          const before = courseData.completed || false;
          const after = result.completed;

          if (before !== after) {
            changes.push({
              type: 'course',
              slug: `${pathwaySlug}/${courseSlug}`,
              before,
              after,
              progress: result.progress,
            });
            courseData.completed = after;

            // Update completion timestamp if now complete
            if (after && courseData.modules) {
              const completedModules = Object.values(courseData.modules).filter(
                (m) => m.completed && m.completed_at
              );
              if (completedModules.length > 0) {
                const latestTimestamp = completedModules
                  .map((m) => new Date(m.completed_at!).getTime())
                  .reduce((max, time) => Math.max(max, time), 0);
                courseData.completed_at = new Date(latestTimestamp).toISOString();
              }
            }

            updated = true;
            metrics.courses_updated++;
          }
        }
      }
    }
  }

  // Process flat courses (outside pathways)
  if (progressState.courses) {
    for (const courseSlug in progressState.courses) {
      const courseData = progressState.courses[courseSlug] as CourseProgressState;
      const result = calculateCourseCompletion(courseSlug, courseData.modules || {});
      const before = courseData.completed || false;
      const after = result.completed;

      if (before !== after) {
        changes.push({
          type: 'course',
          slug: courseSlug,
          before,
          after,
          progress: result.progress,
        });
        courseData.completed = after;

        // Update completion timestamp if now complete
        if (after && courseData.modules) {
          const completedModules = Object.values(courseData.modules).filter(
            (m) => m.completed && m.completed_at
          );
          if (completedModules.length > 0) {
            const latestTimestamp = completedModules
              .map((m) => new Date(m.completed_at!).getTime())
              .reduce((max, time) => Math.max(max, time), 0);
            courseData.completed_at = new Date(latestTimestamp).toISOString();
          }
        }

        updated = true;
        metrics.courses_updated++;
      }
    }
  }

  return { updated, changes };
}

/**
 * Process a single contact
 */
async function processContact(hubspot: any, contactId: string): Promise<boolean> {
  try {
    verboseLog(`Processing contact ${contactId}...`);

    // Fetch contact progress state
    const contact = await hubspot.crm.contacts.basicApi.getById(contactId, [
      'hhl_progress_state',
    ]);

    const rawProgressState = contact.properties?.hhl_progress_state;

    if (!rawProgressState) {
      verboseLog(`Contact ${contactId} has no progress state, skipping`);
      metrics.processed++;
      return true;
    }

    let progressState: any;
    try {
      progressState = JSON.parse(rawProgressState);
    } catch (err) {
      log(`Contact ${contactId} has invalid JSON in progress state`, 'error');
      validationFailures.push({
        contact_id: contactId,
        error: 'Invalid JSON',
        details: String(err),
      });
      metrics.validation_errors++;
      metrics.failed++;
      return false;
    }

    // Recalculate completion flags
    const { updated, changes } = recalculateCompletionFlags(progressState);

    if (!updated) {
      if (skipSynced) {
        verboseLog(`Contact ${contactId} already in sync, skipping`);
        metrics.skipped_synced++;
      } else {
        verboseLog(`Contact ${contactId} no changes needed`);
      }
      metrics.processed++;
      return true;
    }

    // Record changes
    allChanges.push({
      contact_id: contactId,
      changes,
    });

    log(
      `Contact ${contactId}: ${changes.length} changes (${changes.filter((c) => c.type === 'course').length} courses, ${changes.filter((c) => c.type === 'pathway').length} pathways)`
    );

    // Persist changes unless dry-run
    if (!dryRun) {
      await hubspot.crm.contacts.basicApi.update(contactId, {
        properties: {
          hhl_progress_state: JSON.stringify(progressState),
        },
      });
      verboseLog(`Contact ${contactId} updated in CRM`);
    } else {
      verboseLog(`Contact ${contactId} changes preview (dry-run, not persisted)`);
    }

    metrics.processed++;
    metrics.updated++;
    return true;
  } catch (err: any) {
    log(`Failed to process contact ${contactId}: ${err.message}`, 'error');
    validationFailures.push({
      contact_id: contactId,
      error: err.message,
      details: err.response?.body || String(err),
    });
    metrics.failed++;
    return false;
  }
}

/**
 * Process all contacts in batches
 */
async function processAllContacts(hubspot: any) {
  log('Fetching contacts with progress state...');

  const limit = singleContactId ? 1 : batchSize;
  let after: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      let contactsResponse;

      if (singleContactId) {
        // Process single contact
        await processContact(hubspot, singleContactId);
        hasMore = false;
      } else {
        // Fetch batch of contacts
        contactsResponse = await hubspot.crm.contacts.basicApi.getPage(
          limit,
          after,
          ['hhl_progress_state'],
          undefined,
          undefined,
          false
        );

        const contacts = contactsResponse.results;
        metrics.total_contacts += contacts.length;

        log(`Processing batch of ${contacts.length} contacts...`);

        for (const contact of contacts) {
          await processContact(hubspot, contact.id);
        }

        // Check for more pages
        after = contactsResponse.paging?.next?.after;
        hasMore = !!after;

        if (hasMore) {
          log(`Fetching next batch (after=${after})...`);
        }
      }
    } catch (err: any) {
      log(`Batch processing error: ${err.message}`, 'error');
      hasMore = false;
    }
  }
}

// ============================================================================
// Reporting
// ============================================================================

function saveResults() {
  log('Saving results...');

  // Calculate duration
  metrics.end_time = new Date().toISOString();
  const startMs = new Date(metrics.start_time).getTime();
  const endMs = new Date(metrics.end_time).getTime();
  metrics.duration_seconds = Math.round((endMs - startMs) / 1000);

  // Save summary
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(metrics, null, 2));
  log(`Summary saved to ${SUMMARY_FILE}`);

  // Save changes
  if (allChanges.length > 0) {
    fs.writeFileSync(CHANGES_FILE, JSON.stringify(allChanges, null, 2));
    log(`Changes saved to ${CHANGES_FILE} (${allChanges.length} contacts)`);
  }

  // Save failures
  if (validationFailures.length > 0) {
    fs.writeFileSync(FAILURES_FILE, JSON.stringify(validationFailures, null, 2));
    log(`Failures saved to ${FAILURES_FILE} (${validationFailures.length} contacts)`);
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('BACKFILL SUMMARY');
  console.log('='.repeat(80));
  console.log(`Mode:                ${dryRun ? 'DRY RUN (no changes persisted)' : 'LIVE'}`);
  console.log(`Total contacts:      ${metrics.total_contacts}`);
  console.log(`Processed:           ${metrics.processed}`);
  console.log(`Updated:             ${metrics.updated}`);
  console.log(`Skipped (synced):    ${metrics.skipped_synced}`);
  console.log(`Failed:              ${metrics.failed}`);
  console.log(`Validation errors:   ${metrics.validation_errors}`);
  console.log(`Courses updated:     ${metrics.courses_updated}`);
  console.log(`Pathways updated:    ${metrics.pathways_updated}`);
  console.log(`Duration:            ${metrics.duration_seconds}s`);
  console.log('='.repeat(80) + '\n');

  if (dryRun) {
    console.log('ℹ️  This was a dry-run. No changes were persisted to CRM.');
    console.log('   Remove --dry-run flag to apply changes.\n');
  }

  if (validationFailures.length > 0) {
    console.log(`⚠️  ${validationFailures.length} validation failures occurred.`);
    console.log(`   Review ${FAILURES_FILE} for details.\n`);
  }

  if (allChanges.length > 0) {
    console.log(`✅ ${allChanges.length} contacts had completion flags updated.`);
    console.log(`   Review ${CHANGES_FILE} for details.\n`);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('Completion Flags Backfill Tool (Issue #221)');
  console.log('='.repeat(80));
  console.log(`Mode:        ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Batch size:  ${batchSize}`);
  console.log(`Skip synced: ${skipSynced ? 'Yes' : 'No'}`);
  console.log(`Verbose:     ${verbose ? 'Yes' : 'No'}`);
  if (singleContactId) {
    console.log(`Contact ID:  ${singleContactId} (single contact mode)`);
  }
  console.log('='.repeat(80) + '\n');

  setupOutputDirectory();

  log('Loading metadata cache...');
  loadMetadataCache();

  log('Initializing HubSpot client...');
  const hubspot = getHubSpotClient();

  try {
    await processAllContacts(hubspot);
  } catch (err: any) {
    log(`Fatal error: ${err.message}`, 'error');
    process.exit(1);
  } finally {
    saveResults();
  }

  // Exit with error code if failures occurred
  if (metrics.failed > 0 || metrics.validation_errors > 0) {
    process.exit(1);
  }
}

main();
