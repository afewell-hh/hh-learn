#!/usr/bin/env ts-node
/**
 * Sync learning modules from Git (markdown) to HubDB
 *
 * This script:
 * 1. Reads all modules from content/modules/
 * 2. Parses markdown + frontmatter
 * 3. Converts to HTML
 * 4. Upserts to HubDB table
 * 5. Publishes table
 *
 * Usage: npm run sync:content
 */

import 'dotenv/config'; // Load .env file
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import matter from 'gray-matter';
import { Client } from '@hubspot/api-client';

// ES module compatibility: get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure marked for better code block handling
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: false,
});

const hubspot = new Client({
  accessToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN
});

const TABLE_ID = process.env.HUBDB_MODULES_TABLE_ID;

interface ModuleFrontmatter {
  title: string;
  slug: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_minutes: number;
  version?: string;
  validated_on?: string;
  tags: string[];
  description: string;
  order?: number;
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

async function syncModules() {
  console.log('🔄 Starting module sync to HubDB...\n');

  if (!TABLE_ID) {
    throw new Error('HUBDB_MODULES_TABLE_ID environment variable not set');
  }

  const modulesDir = join(__dirname, '../../content/modules');
  const moduleDirs = await readdir(modulesDir, { withFileTypes: true });
  const modules = moduleDirs.filter(d => d.isDirectory()).map(d => d.name);

  console.log(`Found ${modules.length} modules to sync:\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < modules.length; i++) {
    const moduleSlug = modules[i];

    try {
      // Read README.md
      const readmePath = join(modulesDir, moduleSlug, 'README.md');
      const fileContent = await readFile(readmePath, 'utf-8');

      // Parse frontmatter + markdown content
      const { data: frontmatter, content: markdown } = matter(fileContent);
      const fm = frontmatter as ModuleFrontmatter;

      // Convert markdown to HTML
      const html = await marked(markdown);

      // Map difficulty to HubDB SELECT option IDs
      const difficultyMap: Record<string, string> = {
        'beginner': '1',
        'intermediate': '2',
        'advanced': '3'
      };
      const difficultyId = difficultyMap[fm.difficulty || 'beginner'] || '1';

      // Prepare HubDB row
      const row = {
        path: fm.slug || moduleSlug, // Use slug as row ID for easy updates
        values: {
          title: fm.title,
          slug: fm.slug || moduleSlug,
          description: fm.description || '',
          difficulty: difficultyId, // Use option ID for SELECT field
          estimated_minutes: fm.estimated_minutes || 30,
          tags: Array.isArray(fm.tags) ? fm.tags.join(',') : '',
          full_content: html,
          display_order: fm.order || 999
        }
      };

      // Try to update existing row, create if doesn't exist (with retry)
      await retryWithBackoff(async () => {
        try {
          await hubspot.cms.hubdb.rowsApi.updateDraftTableRow(
            TABLE_ID,
            row.path,
            row as any
          );
          console.log(`  ✓ Updated: ${fm.title}`);
        } catch (updateErr: any) {
          if (updateErr.code === 404) {
            // Row doesn't exist, create it
            await hubspot.cms.hubdb.rowsApi.createTableRow(
              TABLE_ID,
              row as any
            );
            console.log(`  ✓ Created: ${fm.title}`);
          } else {
            throw updateErr;
          }
        }
      });

      successCount++;

      // Add delay between modules to avoid rate limits (except after last module)
      if (i < modules.length - 1) {
        await sleep(1500); // 1.5 second delay between modules
      }

    } catch (err: any) {
      failCount++;

      if (isCloudflareBlock(err)) {
        console.error(`  ✗ Failed to sync ${moduleSlug}: Cloudflare block (will retry on next run)`);
      } else {
        console.error(`  ✗ Failed to sync ${moduleSlug}:`, err.message || err);
      }
    }
  }

  // Publish table (with retry)
  console.log('\n📤 Publishing HubDB table...');
  await retryWithBackoff(async () => {
    await hubspot.cms.hubdb.tablesApi.publishDraftTable(TABLE_ID);
  });

  console.log('✅ Sync complete! Table published.\n');
  console.log(`Summary: ${successCount} succeeded, ${failCount} failed\n`);
}

// Run sync
syncModules().catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
