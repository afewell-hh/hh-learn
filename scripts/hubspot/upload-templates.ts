#!/usr/bin/env ts-node
/**
 * Upload templates and config files to HubSpot Design Manager
 *
 * This script uploads the local template files to HubSpot using the CMS Source Code API.
 * It handles creating directories if needed and uploading files.
 *
 * Usage: npm run upload:templates [-- --dry-run]
 */

import 'dotenv/config';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getHubSpotToken, allowlistOverrideEnabled, maskToken } from './get-hubspot-token.js';

const HUBSPOT_TOKEN = getHubSpotToken();
const LOCAL_BASE = 'clean-x-hedgehog-templates';
const REMOTE_BASE = 'CLEAN x HEDGEHOG/templates';
const ALLOWED_REMOTE_PREFIXES = [
  'CLEAN x HEDGEHOG/templates/learn/',
  'CLEAN x HEDGEHOG/templates/assets/',
];
const ALLOWED_SINGLE_FILE = 'CLEAN x HEDGEHOG/templates/config/constants.json';

interface FileToUpload {
  localPath: string;
  remotePath: string;
  content: string;
}

// Helper: Sleep for specified milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

      const isRateLimit = err.code === 429 ||
                          err.code === 403 ||
                          (err.message && err.message.includes('rate limit'));

      // Don't retry if not a rate limit issue
      if (!isRateLimit && err.code !== 404) {
        throw err;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw err;
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.log(`  ⏳ Rate limit hit, waiting ${delayMs/1000}s before retry ${attempt + 1}/${maxRetries}...`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

// Recursively collect all files to upload
function collectFiles(localDir: string, remoteDir: string): FileToUpload[] {
  const files: FileToUpload[] = [];
  const entries = readdirSync(localDir);

  for (const entry of entries) {
    const localPath = join(localDir, entry);
    const remotePath = `${remoteDir}/${entry}`;
    const stat = statSync(localPath);

    if (stat.isDirectory()) {
      files.push(...collectFiles(localPath, remotePath));
    } else if (stat.isFile()) {
      const content = readFileSync(localPath, 'utf-8');
      files.push({ localPath, remotePath, content });
    }
  }

  return files;
}

// Upload a single file via Source Code API
async function uploadFile(file: FileToUpload, dryRun: boolean = false): Promise<boolean> {
  if (dryRun) {
    console.log(`📤 [DRY RUN] Would upload: ${file.remotePath}`);
    console.log(`   Local: ${file.localPath}`);
    console.log(`   Size: ${file.content.length} bytes`);
    return true;
  }

  console.log(`📤 Uploading: ${file.remotePath}`);

  try {
    // Use v3 Source Code API with multipart/form-data
    // PUT /cms/v3/source-code/{environment}/content/{path}
    const response = await retryWithBackoff(async () => {
      // Create form data with file content
      const formData = new FormData();
      const blob = new Blob([file.content], { type: 'text/plain' });
      formData.append('file', blob, file.remotePath.split('/').pop() || 'file');

      const res = await fetch(
        `https://api.hubapi.com/cms/v3/source-code/draft/content/${encodeURIComponent(file.remotePath)}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${HUBSPOT_TOKEN}`
            // Don't set Content-Type - let fetch set it automatically for FormData
          },
          body: formData
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

    console.log(`   ✓ Uploaded successfully`);
    return true;
  } catch (err: any) {
    console.error(`   ✗ Failed to upload: ${err.message}`);
    if (err.body) {
      console.error(`   Error details:`, err.body.substring(0, 200));
    }
    return false;
  }
}

async function uploadTemplates(dryRun: boolean = false) {
  console.log('🔄 Starting template upload...\n');

  if (dryRun) {
    console.log('📝 DRY RUN MODE - no changes will be made\n');
  }

  // Token is already validated by getHubSpotToken() at module load

  // Collect all files to upload
  console.log(`📁 Scanning local directory: ${LOCAL_BASE}`);
  const files = collectFiles(LOCAL_BASE, REMOTE_BASE);
  console.log(`   Found ${files.length} file(s) to upload\n`);

  // Guardrails: filter to allow‑listed remote paths unless override is enabled
  const override = allowlistOverrideEnabled();
  const filtered = files.filter((f) =>
    override || ALLOWED_REMOTE_PREFIXES.some((p) => f.remotePath.startsWith(p)) || f.remotePath === ALLOWED_SINGLE_FILE
  );
  const blocked = files.length - filtered.length;
  if (!override && blocked > 0) {
    console.log(`⚠️  Guardrails: ${blocked} file(s) outside allowlist skipped. Use --unsafe-allow-outside-allowlist (or ALLOWLIST_OVERRIDE=true) to override.`);
  }

  console.log(`🔐 Using HubSpot token: ${maskToken(HUBSPOT_TOKEN)}`);

  // Upload each file
  let successCount = 0;
  let failCount = 0;

  for (const file of filtered) {
    const success = await uploadFile(file, dryRun);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }

    // Small delay between uploads
    if (!dryRun && files.length > 1) {
      await sleep(1000);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Upload Summary');
  console.log('='.repeat(60));
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Failed: ${failCount}`);
  console.log('');

  if (!dryRun && successCount > 0) {
    console.log('✅ Upload complete!\n');
    console.log('💡 Files uploaded to DRAFT. Publish in Design Manager when ready.\n');
  } else if (dryRun) {
    console.log('✅ Dry run complete!\n');
  }

  if (failCount > 0) {
    throw new Error(`${failCount} file(s) failed to upload`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run upload
uploadTemplates(dryRun).catch(err => {
  console.error('❌ Upload failed:', err.message);
  process.exit(1);
});
