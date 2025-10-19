#!/usr/bin/env node
/**
 * Rollback Script: Hierarchical Progress → Original Flat Structure
 *
 * Purpose: Restore contacts to their pre-migration state using saved snapshots.
 *
 * Usage:
 *   npm run build
 *   node dist/scripts/rollback-progress-migration.js [--verify] [--contact-id=123]
 *
 * Flags:
 *   --verify: Dry-run mode (preview changes without writing to CRM)
 *   --contact-id=ID: Rollback single contact (for testing)
 *
 * Prerequisites:
 *   - Snapshots must exist in verification-output/issue-215/snapshots/
 *   - Each contact must have a contact-{id}-before.json file
 */

import * as fs from 'fs';
import * as path from 'path';
import { getHubSpotClient } from '../shared/hubspot.js';

const SNAPSHOTS_DIR = 'verification-output/issue-215/snapshots';
const OUTPUT_DIR = 'verification-output/issue-215';

// Parse command-line arguments
const args = process.argv.slice(2);
const verifyOnly = args.includes('--verify');
const contactIdArg = args.find((arg) => arg.startsWith('--contact-id='));
const singleContactId = contactIdArg ? contactIdArg.split('=')[1] : null;

interface RollbackMetrics {
  total_contacts: number;
  rolled_back: number;
  failed: number;
  no_snapshot: number;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
}

const metrics: RollbackMetrics = {
  total_contacts: 0,
  rolled_back: 0,
  failed: 0,
  no_snapshot: 0,
  start_time: new Date().toISOString(),
};

/**
 * Load snapshot from disk
 */
function loadSnapshot(contactId: string): string | null {
  const filename = `${SNAPSHOTS_DIR}/contact-${contactId}-before.json`;
  if (!fs.existsSync(filename)) {
    return null;
  }
  return fs.readFileSync(filename, 'utf-8');
}

/**
 * Rollback a single contact
 */
async function rollbackContact(hubspot: any, contactId: string): Promise<boolean> {
  try {
    console.log(`\n[${contactId}] Starting rollback...`);

    // Load before snapshot
    const beforeSnapshot = loadSnapshot(contactId);
    if (!beforeSnapshot) {
      console.warn(`[${contactId}] ⚠️  No snapshot found, skipping`);
      metrics.no_snapshot++;
      return false;
    }

    const originalState = JSON.parse(beforeSnapshot);

    // Verify snapshot is valid JSON
    if (!originalState || typeof originalState !== 'object') {
      console.error(`[${contactId}] ❌ Invalid snapshot format`);
      metrics.failed++;
      return false;
    }

    console.log(`[${contactId}] Loaded snapshot with ${Object.keys(originalState).length} keys`);

    if (!verifyOnly) {
      // Write original state back to CRM
      console.log(`[${contactId}] Restoring original progress state...`);
      await hubspot.crm.contacts.basicApi.update(contactId, {
        properties: {
          hhl_progress_state: JSON.stringify(originalState),
        },
      });
      console.log(`[${contactId}] ✅ Rollback complete`);
      metrics.rolled_back++;
    } else {
      console.log(`[${contactId}] ✅ Verify complete (no changes persisted)`);
      metrics.rolled_back++;
    }

    return true;
  } catch (err: any) {
    console.error(`[${contactId}] ❌ Rollback error:`, err.message);
    metrics.failed++;
    return false;
  }
}

/**
 * Main rollback function
 */
async function main() {
  console.log('=== HubSpot Progress Rollback ===');
  console.log(`Mode: ${verifyOnly ? 'VERIFY-ONLY' : 'LIVE'}`);
  console.log(`Single contact: ${singleContactId || 'No (rolling back all with snapshots)'}`);
  console.log('');

  // Check if snapshots directory exists
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    console.error(`❌ Snapshots directory not found: ${SNAPSHOTS_DIR}`);
    console.error('Run the migration script first to create snapshots.');
    process.exit(1);
  }

  const hubspot = getHubSpotClient();

  if (singleContactId) {
    // Rollback single contact
    metrics.total_contacts = 1;
    await rollbackContact(hubspot, singleContactId);
  } else {
    // Rollback all contacts with snapshots
    console.log('Finding all contacts with snapshots...');

    const snapshotFiles = fs.readdirSync(SNAPSHOTS_DIR).filter((file) => file.endsWith('-before.json'));

    console.log(`Found ${snapshotFiles.length} snapshots`);

    for (const file of snapshotFiles) {
      // Extract contact ID from filename: contact-{id}-before.json
      const match = file.match(/^contact-(\d+)-before\.json$/);
      if (match) {
        const contactId = match[1];
        metrics.total_contacts++;
        await rollbackContact(hubspot, contactId);
      }
    }
  }

  // Finalize metrics
  metrics.end_time = new Date().toISOString();
  const startTime = new Date(metrics.start_time);
  const endTime = new Date(metrics.end_time);
  metrics.duration_seconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

  // Save summary
  const summaryPath = `${OUTPUT_DIR}/rollback-summary.json`;
  fs.writeFileSync(summaryPath, JSON.stringify(metrics, null, 2), 'utf-8');

  // Print summary
  console.log('\n=== Rollback Summary ===');
  console.log(`Total contacts: ${metrics.total_contacts}`);
  console.log(`Rolled back: ${metrics.rolled_back}`);
  console.log(`No snapshot: ${metrics.no_snapshot}`);
  console.log(`Failed: ${metrics.failed}`);
  console.log(`Duration: ${metrics.duration_seconds}s`);
  console.log(`\nSummary saved to: ${summaryPath}`);

  if (metrics.failed > 0) {
    console.error('\n⚠️  WARNING: Some contacts failed to rollback. Review logs above.');
    process.exit(1);
  }

  if (verifyOnly) {
    console.log('\n✅ Verify complete. No changes persisted to CRM.');
  } else {
    console.log('\n✅ Rollback complete!');
  }
}

// Run rollback
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
