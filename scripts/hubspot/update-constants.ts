#!/usr/bin/env ts-node
/**
 * Update theme constants.json with HubDB table IDs
 *
 * This script:
 * 1. Reads current theme file at "CLEAN x HEDGEHOG/templates/config/constants.json" using CMS Source Code API
 * 2. Updates HUBDB_MODULES_TABLE_ID (if missing), HUBDB_COURSES_TABLE_ID, HUBDB_PATHWAYS_TABLE_ID
 * 3. Writes back to draft version
 * 4. Optionally publishes with --publish flag
 *
 * Usage: npm run provision:constants [-- --dry-run] [-- --publish]
 */

import 'dotenv/config';
import { Client } from '@hubspot/api-client';

const hubspot = new Client({
  accessToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN
});

const CONSTANTS_PATH = 'CLEAN x HEDGEHOG/templates/config/constants.json';

interface ConstantsUpdate {
  field: string;
  envVar: string;
  value?: string;
}

// Helper: Sleep for specified milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Check if error is Cloudflare rate limiting
function isCloudflareBlock(err: any): boolean {
  if (err.code === 403 && typeof err.body === 'string') {
    return err.body.includes('Cloudflare') || err.body.includes('cf-ray');
  }
  return false;
}

// Helper: Check if error is rate limiting
function isRateLimitError(err: any): boolean {
  if (err.code === 429) return true;
  if (isCloudflareBlock(err)) return true;
  if (err.message && err.message.includes('rate limit')) return true;
  return false;
}

// Helper: Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 2000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      // Don't retry if not a rate limit issue
      if (!isRateLimitError(err) && err.code !== 404) {
        throw err;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw err;
      }

      // Calculate delay with exponential backoff: 2s, 4s, 8s, etc.
      const delayMs = initialDelayMs * Math.pow(2, attempt);

      if (isCloudflareBlock(err)) {
        console.log(`  ⏳ Cloudflare block detected, waiting ${delayMs/1000}s before retry ${attempt + 1}/${maxRetries}...`);
      } else {
        console.log(`  ⏳ Rate limit hit, waiting ${delayMs/1000}s before retry ${attempt + 1}/${maxRetries}...`);
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function readConstantsFile(): Promise<any> {
  try {
    console.log(`📥 Reading constants file: ${CONSTANTS_PATH}`);

    const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    const encodedPath = encodeURIComponent(CONSTANTS_PATH);

    // Use raw HTTP API for Source Code
    const response: any = await retryWithBackoff(async () => {
      const res = await fetch(
        `https://api.hubapi.com/content/api/v4/files/${encodedPath}?environment=draft`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        const error: any = new Error(`HTTP ${res.status}: ${errorText}`);
        error.code = res.status;
        error.body = errorText;
        throw error;
      }

      return await res.json();
    });

    // The response should contain the file content as a string
    const content = (response.source || response.content || '{}') as string;
    const constants = JSON.parse(content);
    console.log(`   ✓ Current constants loaded`);
    return constants;
  } catch (err: any) {
    console.error(`✗ Failed to read constants file:`, err.message);
    console.error(`   Note: Ensure Source Code API access is enabled for your private app.`);
    if (err.body) {
      console.error('   Error details:', err.body);
    }
    throw err;
  }
}

async function writeConstantsFile(constants: any, publish: boolean = false): Promise<void> {
  try {
    console.log(`📝 Writing updated constants to: ${CONSTANTS_PATH}`);

    // Format JSON with proper indentation
    const content = JSON.stringify(constants, null, 2);
    const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    const encodedPath = encodeURIComponent(CONSTANTS_PATH);

    // Update draft version using raw HTTP API
    await retryWithBackoff(async () => {
      const res = await fetch(
        `https://api.hubapi.com/content/api/v4/files/${encodedPath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            source: content,
            environment: 'draft'
          })
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        const error: any = new Error(`HTTP ${res.status}: ${errorText}`);
        error.code = res.status;
        error.body = errorText;
        throw error;
      }

      return await res.json();
    });
    console.log(`   ✓ Draft constants updated`);

    // Optionally publish
    if (publish) {
      console.log(`📤 Publishing constants file...`);
      // Note: Publishing individual files may require using the publish endpoint
      // or publishing the entire theme. Check API docs for exact method.
      // For now, we'll skip auto-publish and document manual publish step.
      console.log(`   ⚠️  Auto-publish not implemented. Publish theme manually in Design Manager.`);
    }
  } catch (err: any) {
    console.error(`✗ Failed to write constants file:`, err.message);
    console.error(`   Note: Ensure Source Code API access is enabled for your private app.`);
    if (err.body) {
      console.error('   Error details:', err.body);
    }
    throw err;
  }
}

function createDiff(original: any, updated: any, updates: ConstantsUpdate[]): string {
  const lines: string[] = [];

  updates.forEach((update) => {
    const oldValue = original[update.field] || '<not set>';
    const newValue = updated[update.field] || '<not set>';

    if (oldValue !== newValue) {
      lines.push(`  ${update.field}:`);
      lines.push(`    - ${oldValue}`);
      lines.push(`    + ${newValue}`);
    } else {
      lines.push(`  ${update.field}: ${newValue} (no change)`);
    }
  });

  return lines.join('\n');
}

async function updateConstants(dryRun: boolean = false, publish: boolean = false) {
  console.log('🔄 Starting constants.json update...\n');

  if (dryRun) {
    console.log('📝 DRY RUN MODE - no changes will be made\n');
  }

  if (publish && !dryRun) {
    console.log('🚀 PUBLISH MODE - constants will be published\n');
  }

  if (!dryRun && !process.env.HUBSPOT_PRIVATE_APP_TOKEN) {
    throw new Error('HUBSPOT_PRIVATE_APP_TOKEN environment variable not set');
  }

  // Define updates to make
  const updates: ConstantsUpdate[] = [
    {
      field: 'HUBDB_MODULES_TABLE_ID',
      envVar: 'HUBDB_MODULES_TABLE_ID',
      value: process.env.HUBDB_MODULES_TABLE_ID
    },
    {
      field: 'HUBDB_COURSES_TABLE_ID',
      envVar: 'HUBDB_COURSES_TABLE_ID',
      value: process.env.HUBDB_COURSES_TABLE_ID
    },
    {
      field: 'HUBDB_PATHWAYS_TABLE_ID',
      envVar: 'HUBDB_PATHWAYS_TABLE_ID',
      value: process.env.HUBDB_PATHWAYS_TABLE_ID
    }
  ];

  // Validate that all required env vars are present
  const missingVars = updates.filter((u) => !u.value);
  if (missingVars.length > 0 && !dryRun) {
    console.error('✗ Missing required environment variables:');
    missingVars.forEach((u) => console.error(`  - ${u.envVar}`));
    throw new Error('Missing required environment variables');
  }

  try {
    // Read current constants
    let currentConstants: any = {};

    if (!dryRun) {
      currentConstants = await readConstantsFile();
    } else {
      console.log(`📥 (Dry-run) Would read constants from: ${CONSTANTS_PATH}\n`);
      currentConstants = {
        HUBDB_MODULES_TABLE_ID: '12345678',
        // Assume courses/pathways don't exist yet
      };
    }

    // Create updated constants
    const updatedConstants = { ...currentConstants };

    updates.forEach((update) => {
      if (update.value) {
        updatedConstants[update.field] = update.value;
      } else if (!updatedConstants[update.field]) {
        // Only add if missing (for modules table which might already exist)
        updatedConstants[update.field] = '<missing>';
      }
    });

    // Show diff
    console.log('\n' + '='.repeat(60));
    console.log('📊 Constants Update Diff');
    console.log('='.repeat(60));
    console.log(createDiff(currentConstants, updatedConstants, updates));
    console.log('');

    // Write updated constants
    if (!dryRun) {
      await writeConstantsFile(updatedConstants, publish);
      console.log('\n✅ Constants update complete!\n');

      if (!publish) {
        console.log('💡 Constants updated in DRAFT. Publish the theme in Design Manager or run with --publish.\n');
      }
    } else {
      console.log('✅ Dry run complete!\n');
      console.log('Updated constants.json would be:');
      console.log(JSON.stringify(updatedConstants, null, 2));
      console.log('');
    }
  } catch (err: any) {
    console.error('❌ Update failed:', err.message);
    throw err;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const publish = args.includes('--publish');

// Run update
updateConstants(dryRun, publish).catch(err => {
  console.error('❌ Update failed:', err);
  process.exit(1);
});
