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
  archived?: boolean;
  social_image?: string;
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

  const modulesDir = join(process.cwd(), 'content/modules');
  const moduleDirs = await readdir(modulesDir, { withFileTypes: true });
  const modules = moduleDirs.filter(d => d.isDirectory()).map(d => d.name);

  // Discover archived modules directory (soft archive or delete per strategy)
  const archiveDirRel = process.env.SYNC_ARCHIVE_DIR || 'content/archive';
  const archiveStrategy = (process.env.SYNC_ARCHIVE_STRATEGY || 'tag').toLowerCase(); // 'tag' | 'delete'
  let archivedSlugs: string[] = [];
  try {
    const archiveDir = join(process.cwd(), archiveDirRel);
    const archiveDirs = await readdir(archiveDir, { withFileTypes: true });
    archivedSlugs = archiveDirs.filter(d => d.isDirectory()).map(d => d.name.toLowerCase());
    if (archivedSlugs.length) console.log(`Found ${archivedSlugs.length} archived module(s) in ${archiveDirRel}: ${archivedSlugs.join(', ')}`);
  } catch {
    // no archive directory
  }

  console.log(`Found ${modules.length} modules to sync:\n`);

  // Fetch all existing rows once at the start
  console.log('📥 Fetching existing HubDB rows...');
  const existingRowsResponse = await retryWithBackoff(() =>
    hubspot.cms.hubdb.rowsApi.getTableRows(TABLE_ID, undefined, undefined, undefined)
  );
  const existingRows = existingRowsResponse.results || [];
  console.log(`   Found ${existingRows.length} existing rows\n`);


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

      // Read optional meta.json for prerequisites and learning objectives
      let metaData: any = null;
      try {
        const metaPath = join(modulesDir, moduleSlug, 'meta.json');
        const metaContent = await readFile(metaPath, 'utf-8');
        metaData = JSON.parse(metaContent);
      } catch {
        // meta.json is optional
      }

      // Convert markdown to HTML
      let html = await marked(markdown);
      const stripH1 = (process.env.SYNC_STRIP_LEADING_H1 || 'true').toLowerCase() === 'true';
      if (stripH1) {
        html = html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, '');
      }

      // Map difficulty to HubDB SELECT option format
      const difficultyMap: Record<string, any> = {
        'beginner': { id: '1', name: 'beginner', type: 'option' },
        'intermediate': { id: '2', name: 'intermediate', type: 'option' },
        'advanced': { id: '3', name: 'advanced', type: 'option' }
      };
      const difficultyValue = difficultyMap[fm.difficulty || 'beginner'] || difficultyMap['beginner'];

      // Prepare HubDB row
      // Note: 'name' and 'path' are row-level fields for dynamic pages
      // 'path' maps to hs_path (URL slug), 'name' maps to hs_name (Name/display title)
      // Build tags, ensure 'archived' tag is present if front matter marks archived
      let tagsCsv = Array.isArray(fm.tags) ? fm.tags.join(',') : '';
      if (fm.archived) {
        const tagsSet = new Set(tagsCsv.split(',').map(t => t.trim()).filter(Boolean));
        tagsSet.add('archived');
        tagsCsv = Array.from(tagsSet).join(',');
      }

      // Prepare prerequisites JSON
      let prerequisitesJson = '';
      if (metaData && metaData.prerequisites && Array.isArray(metaData.prerequisites)) {
        prerequisitesJson = JSON.stringify(metaData.prerequisites);
      }

      const row = {
        name: fm.title, // Maps to hs_name (Name column) - this is the display title!
        path: (fm.slug || moduleSlug).toLowerCase(), // Maps to hs_path (Page Path) - must be lowercase
        childTableId: 0, // Required for API compatibility
        values: {
          // NO 'title' here - it's in 'name' at row level!
          meta_description: fm.description || '', // SEO meta description (for metadata mapping)
          difficulty: difficultyValue, // Use option object for SELECT field
          estimated_minutes: fm.estimated_minutes || 30,
          tags: tagsCsv,
          full_content: html,
          display_order: fm.order || 999,
          social_image_url: fm.social_image || '',
          prerequisites_json: prerequisitesJson
        }
      };

      // Find existing row by path (hs_path field)
      const existingRow = existingRows.find((r: any) => r.path === row.path);

      // Try to update existing row, create if doesn't exist (with retry)
      await retryWithBackoff(async () => {
        if (existingRow) {
          // Update existing row using its numeric ID
          await hubspot.cms.hubdb.rowsApi.updateDraftTableRow(
            TABLE_ID,
            String(existingRow.id), // numeric id -> string
            row as any
          );
          console.log(`  ✓ Updated: ${fm.title}`);
        } else {
          // Row doesn't exist, create it
          await hubspot.cms.hubdb.rowsApi.createTableRow(
            TABLE_ID,
            row as any
          );
          console.log(`  ✓ Created: ${fm.title}`);
        }
      });

      successCount++;

      // Add delay between modules to avoid rate limits (except after last module)
      if (i < modules.length - 1) {
        await sleep(1500); // 1.5 second delay between modules
      }

    } catch (err: any) {
      failCount++;

      console.error(`  ✗ Failed to sync ${moduleSlug}:`);
      console.error(`     Error code: ${err.code}`);
      console.error(`     Message: ${err.message}`);

      if (err.body) {
        if (typeof err.body === 'object') {
          console.error(`     Body:`, JSON.stringify(err.body, null, 2));
        } else if (typeof err.body === 'string') {
          // For Cloudflare HTML responses, just show first 500 chars
          const bodyPreview = err.body.substring(0, 500);
          if (err.body.includes('Cloudflare')) {
            console.error(`     Body: [Cloudflare block page - ${err.body.length} chars]`);
          } else {
            console.error(`     Body preview:`, bodyPreview);
          }
        }
      }
    }
  }

  // Optionally delete or archive HubDB rows that no longer exist in content/modules
  const deleteMissing = (process.env.SYNC_DELETE_MISSING || 'true').toLowerCase() === 'true';
  if (deleteMissing) {
    const contentSlugs = new Set(modules.map((m) => m.toLowerCase()));
    const toDelete = existingRows.filter((r: any) => !contentSlugs.has((r.path || '').toLowerCase()));
    if (toDelete.length) {
      // Partition into archived vs actual deletes, based on content/archive
      const wantsArchive = toDelete.filter((r: any) => archivedSlugs.includes(String(r.path || '').toLowerCase()));
      const realDeletes = toDelete.filter((r: any) => !archivedSlugs.includes(String(r.path || '').toLowerCase()));

      if (wantsArchive.length) {
        if (archiveStrategy === 'delete') {
          console.log(`\n🗑️  Deleting ${wantsArchive.length} archived row(s) (SYNC_ARCHIVE_STRATEGY=delete)...`);
          for (const r of wantsArchive) {
            try {
              await retryWithBackoff(async () => {
                await hubspot.cms.hubdb.rowsApi.purgeDraftTableRow(TABLE_ID, String(r.id));
              });
              console.log(`  • Deleted (archived dir): ${r.path}`);
            } catch (err: any) {
              console.error(`  ✗ Failed to delete ${r.path || r.id}: ${err.message}`);
            }
          }
        } else {
          console.log(`\n📦 Marking ${wantsArchive.length} row(s) as archived (soft-hide via tags)...`);
          for (const r of wantsArchive) {
            try {
              const currentTags = ((r.values && r.values.tags) || '').split(',').map((t: string) => t.trim()).filter(Boolean);
              if (!currentTags.map((t: string) => t.toLowerCase()).includes('archived')) currentTags.push('archived');
              const update = {
                name: r.name,
                path: r.path,
                childTableId: 0,
                values: { ...(r.values || {}), tags: currentTags.join(',') }
              } as any;
              await retryWithBackoff(async () => {
                await hubspot.cms.hubdb.rowsApi.updateDraftTableRow(TABLE_ID, String(r.id), update);
              });
              console.log(`  • Archived (tagged): ${r.path}`);
            } catch (err: any) {
              console.error(`  ✗ Failed to tag archived ${r.path || r.id}: ${err.message}`);
            }
          }
        }
      }

      if (realDeletes.length) {
        console.log(`\n🗑️  Deleting ${realDeletes.length} HubDB row(s) not present in content/modules or archive...`);
        for (const r of realDeletes) {
          try {
            await retryWithBackoff(async () => {
              await hubspot.cms.hubdb.rowsApi.purgeDraftTableRow(TABLE_ID, String(r.id));
            });
            console.log(`  • Deleted: ${r.path || r.id}`);
          } catch (err: any) {
            console.error(`  ✗ Failed to delete ${r.path || r.id}: ${err.message}`);
          }
        }
      }

      // Publish after updates/deletions
      console.log('📤 Publishing HubDB table after updates...');
      await retryWithBackoff(async () => {
        await hubspot.cms.hubdb.tablesApi.publishDraftTable(TABLE_ID);
      });
    }
  } else {
    console.log('\nℹ️  SYNC_DELETE_MISSING=false – skipped deleting removed modules from HubDB.');
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
