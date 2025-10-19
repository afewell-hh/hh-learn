#!/usr/bin/env ts-node
/**
 * Sync courses from JSON to HubDB
 *
 * This script:
 * 1. Reads course JSON files from content/courses/
 * 2. Validates course fields
 * 3. Computes estimated_minutes from included modules
 * 4. Converts summary_markdown to HTML
 * 5. Serializes module_slugs_json and content_blocks_json
 * 6. Upserts to HubDB courses table
 *
 * Usage: npm run sync:courses [-- --dry-run]
 */

import 'dotenv/config'; // Load .env file
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import matter from 'gray-matter';
import { getHubSpotClient } from '../shared/hubspot.js';
import {
  getAvailableModuleSlugs,
  validateCourseReferences,
  formatValidationErrors,
  type ValidationError
} from './validation.js';

// ES module compatibility: get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure marked for better code block handling
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: false,
});

const hubspot = getHubSpotClient();

const TABLE_ID = process.env.HUBDB_COURSES_TABLE_ID;

interface ContentBlock {
  id: string;
  type: 'text' | 'callout' | 'module_ref';
  title?: string;
  body_markdown?: string;
  module_slug?: string;
}

interface CourseData {
  slug: string;
  title: string;
  meta_description?: string;
  summary_markdown: string;
  modules: string[]; // ordered array of module slugs
  badge_image_url?: string;
  display_order?: number;
  tags?: string;
  content_blocks?: ContentBlock[];
  social_image?: string;
}

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

// Helper: Read module front matter to get estimated_minutes
async function getModuleEstimatedMinutes(moduleSlug: string): Promise<number> {
  try {
    const modulePath = join(process.cwd(), 'content/modules', moduleSlug, 'README.md');
    const fileContent = await readFile(modulePath, 'utf-8');
    const { data: frontmatter } = matter(fileContent);
    const fm = frontmatter as ModuleFrontmatter;
    return fm.estimated_minutes || 0;
  } catch (err) {
    console.warn(`  ⚠️  Could not read estimated_minutes for module ${moduleSlug}, defaulting to 0`);
    return 0;
  }
}

async function syncCourses(dryRun: boolean = false) {
  console.log('🔄 Starting courses sync to HubDB...\n');

  if (dryRun) {
    console.log('📝 DRY RUN MODE - no changes will be made to HubDB\n');
  }

  if (!dryRun && !TABLE_ID) {
    throw new Error('HUBDB_COURSES_TABLE_ID environment variable not set');
  }

  const coursesDir = join(process.cwd(), 'content/courses');
  let courseFiles: string[] = [];

  try {
    const files = await readdir(coursesDir, { withFileTypes: true });
    courseFiles = files
      .filter(f => f.isFile() && f.name.endsWith('.json'))
      .map(f => f.name);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.log('⚠️  No content/courses directory found. Skipping courses sync.\n');
      return;
    }
    throw err;
  }

  if (courseFiles.length === 0) {
    console.log('⚠️  No course JSON files found in content/courses/. Skipping sync.\n');
    return;
  }

  console.log(`Found ${courseFiles.length} course(s) to sync:\n`);

  // Build catalog of available modules for validation
  console.log('🔍 Building catalog of available modules for validation...');
  const availableModules = await getAvailableModuleSlugs();
  console.log(`   Found ${availableModules.size} available module(s)\n`);

  // Fetch existing rows if not in dry-run mode
  let existingRows: any[] = [];
  if (!dryRun && TABLE_ID) {
    console.log('📥 Fetching existing HubDB rows...');
    const existingRowsResponse = await retryWithBackoff(() =>
      hubspot.cms.hubdb.rowsApi.getTableRows(TABLE_ID as string, undefined, undefined, undefined)
    );
    existingRows = existingRowsResponse.results || [];
    console.log(`   Found ${existingRows.length} existing rows\n`);
  }

  let successCount = 0;
  let failCount = 0;
  const allValidationErrors: ValidationError[] = [];

  // Phase 1: Validate all courses for orphaned references
  console.log('📋 Phase 1: Validating course references...\n');

  for (const courseFile of courseFiles) {
    try {
      const coursePath = join(coursesDir, courseFile);
      const fileContent = await readFile(coursePath, 'utf-8');
      const course = JSON.parse(fileContent) as CourseData;

      // Validate required fields
      if (!course.slug) {
        console.error(`  ✗ ${courseFile}: Missing required field: slug`);
        continue;
      }
      if (!course.modules || !Array.isArray(course.modules)) {
        console.error(`  ✗ ${courseFile}: Missing or invalid required field: modules`);
        continue;
      }

      // Validate module references
      const errors = validateCourseReferences(
        course.slug,
        course.modules,
        course.content_blocks,
        availableModules
      );

      if (errors.length > 0) {
        allValidationErrors.push(...errors);
      } else {
        console.log(`  ✓ ${course.slug}: All references valid`);
      }
    } catch (err: any) {
      console.error(`  ✗ Failed to validate ${courseFile}: ${err.message}`);
    }
  }

  // Fail fast if validation errors found
  if (allValidationErrors.length > 0) {
    console.error(formatValidationErrors(allValidationErrors));
    throw new Error(`Validation failed: Found ${allValidationErrors.length} orphaned reference(s). Fix these issues before syncing.`);
  }

  console.log('✅ All course references validated successfully!\n');
  console.log('📤 Phase 2: Syncing courses to HubDB...\n');

  // Phase 2: Proceed with sync now that validation passed
  for (let i = 0; i < courseFiles.length; i++) {
    const courseFile = courseFiles[i];

    try {
      // Read course JSON
      const coursePath = join(coursesDir, courseFile);
      const fileContent = await readFile(coursePath, 'utf-8');
      const course = JSON.parse(fileContent) as CourseData;

      // Validate required fields
      if (!course.slug) {
        throw new Error('Missing required field: slug');
      }
      if (!course.title) {
        throw new Error('Missing required field: title');
      }
      if (!course.summary_markdown) {
        throw new Error('Missing required field: summary_markdown');
      }
      if (!course.modules || !Array.isArray(course.modules)) {
        throw new Error('Missing or invalid required field: modules (must be an array)');
      }

      // Compute estimated_minutes by summing module times
      let totalMinutes = 0;
      for (const moduleSlug of course.modules) {
        const minutes = await getModuleEstimatedMinutes(moduleSlug);
        totalMinutes += minutes;
      }

      // Convert summary_markdown to HTML
      const summaryHtml = await marked(course.summary_markdown);

      // Serialize content_blocks_json if present
      const contentBlocksJson = course.content_blocks
        ? JSON.stringify(course.content_blocks)
        : '';

      // Generate meta_description: use explicit value or extract from summary (strip HTML, max 160 chars)
      const metaDescription = course.meta_description
        || course.summary_markdown.replace(/<[^>]*>/g, '').substring(0, 160);

      // Prepare HubDB row
      const row = {
        path: course.slug.toLowerCase(), // Maps to hs_path (Page Path)
        name: course.title, // Maps to hs_name (Name/display title)
        childTableId: 0, // Required for API compatibility
        values: {
          // Removed slug column - use row.path (hs_path) instead
          meta_description: metaDescription,
          summary_markdown: summaryHtml, // Store as HTML for RICH_TEXT column
          module_slugs_json: JSON.stringify(course.modules),
          estimated_minutes: totalMinutes,
          badge_image_url: course.badge_image_url || '',
          display_order: course.display_order || 999,
          tags: course.tags || '',
          content_blocks_json: contentBlocksJson,
          social_image_url: course.social_image || ''
        }
      };

      if (dryRun) {
        console.log(`📄 Course: ${course.title} (${course.slug})`);
        console.log(`   Modules: ${course.modules.length}`);
        console.log(`   Estimated minutes: ${totalMinutes}`);
        console.log(`   Content blocks: ${course.content_blocks?.length || 0}`);
        console.log(`   Payload:`);
        console.log(JSON.stringify(row, null, 2));
        console.log('');
        successCount++;
      } else {
        // Find existing row by slug (using path field)
        const existingRow = existingRows.find((r: any) => r.path === row.path);

        // Try to update existing row, create if doesn't exist (with retry)
        await retryWithBackoff(async () => {
          if (existingRow) {
            // Update existing row using its numeric ID
            await hubspot.cms.hubdb.rowsApi.updateDraftTableRow(
              TABLE_ID as string,
              String(existingRow.id), // numeric id -> string
              row as any
            );
            console.log(`  ✓ Updated: ${course.title}`);
          } else {
            // Row doesn't exist, create it
            await hubspot.cms.hubdb.rowsApi.createTableRow(
              TABLE_ID as string,
              row as any
            );
            console.log(`  ✓ Created: ${course.title}`);
          }
        });

        successCount++;

        // Add delay between courses to avoid rate limits (except after last course)
        if (i < courseFiles.length - 1) {
          await sleep(1500); // 1.5 second delay
        }
      }

    } catch (err: any) {
      failCount++;

      console.error(`  ✗ Failed to sync ${courseFile}:`);
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

  // Publish table (skip in dry-run mode)
  if (!dryRun && TABLE_ID) {
    console.log('\n📤 Publishing HubDB table...');
    await retryWithBackoff(async () => {
      await hubspot.cms.hubdb.tablesApi.publishDraftTable(TABLE_ID as string);
    });
    console.log('✅ Sync complete! Table published.\n');
  } else {
    console.log('✅ Dry run complete!\n');
  }

  console.log(`Summary: ${successCount} succeeded, ${failCount} failed\n`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run sync
syncCourses(dryRun).catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
