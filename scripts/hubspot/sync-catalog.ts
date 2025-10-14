#!/usr/bin/env ts-node
/**
 * Sync Learning Catalog from source HubDB tables
 *
 * This script:
 * 1. Reads rows from modules, courses, and pathways tables
 * 2. Normalizes data into a unified catalog schema
 * 3. Syncs to the catalog HubDB table
 * 4. Publishes the catalog table
 *
 * Usage: npm run sync:catalog [-- --dry-run]
 */

import 'dotenv/config';
import { Client } from '@hubspot/api-client';
import { getHubSpotToken } from './get-hubspot-token.js';

const hubspot = new Client({
  accessToken: getHubSpotToken()
});

interface CatalogEntry {
  type: 'module' | 'course' | 'pathway';
  hs_path: string;
  title: string;
  summary: string;
  image_url: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  duration?: number;
  tags?: string;
  published: 'true' | 'false';
  sort_order?: number;
  source_table: string;
  source_row_id: number;
}

// Helper: Sleep for specified milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Check if error is rate limiting
function isRateLimitError(err: any): boolean {
  if (err.code === 429) return true;
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

      if (!isRateLimitError(err) && err.code !== 404) {
        throw err;
      }

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

// Find table by name
async function findTableByName(tableName: string): Promise<any | null> {
  try {
    const response = await retryWithBackoff(() =>
      hubspot.cms.hubdb.tablesApi.getAllTables(undefined, undefined, undefined)
    );

    const tables = Array.isArray(response) ? response : (response.results || []);
    return tables.find((t: any) => t.name === tableName) || null;
  } catch (err: any) {
    console.error(`Error finding table "${tableName}":`, err.message || err);
    return null;
  }
}

// Fetch all rows from a HubDB table
async function fetchTableRows(tableId: string): Promise<any[]> {
  try {
    const response = await retryWithBackoff(() =>
      hubspot.cms.hubdb.rowsApi.readDraftTableRows(tableId)
    );
    return response.results || [];
  } catch (err: any) {
    console.error(`Error fetching rows from table ${tableId}:`, err.message);
    return [];
  }
}

// Normalize module row to catalog entry
function normalizeModule(row: any): CatalogEntry {
  return {
    type: 'module',
    hs_path: row.path || row.hs_path || '',
    title: row.name || row.hs_name || 'Untitled Module',
    summary: row.values?.meta_description || row.values?.full_content || '',
    image_url: row.values?.social_image_url || '',
    level: row.values?.difficulty || undefined,
    duration: row.values?.estimated_minutes || undefined,
    tags: row.values?.tags || '',
    published: 'true',
    sort_order: row.values?.display_order || 999,
    source_table: 'modules',
    source_row_id: row.id
  };
}

// Normalize course row to catalog entry
function normalizeCourse(row: any): CatalogEntry {
  return {
    type: 'course',
    hs_path: row.path || row.hs_path || '',
    title: row.name || row.hs_name || 'Untitled Course',
    summary: row.values?.meta_description || row.values?.summary_markdown || '',
    image_url: row.values?.badge_image_url || row.values?.social_image_url || '',
    level: undefined, // Courses don't have explicit levels
    duration: row.values?.estimated_minutes || undefined,
    tags: row.values?.tags || '',
    published: 'true',
    sort_order: row.values?.display_order || 999,
    source_table: 'courses',
    source_row_id: row.id
  };
}

// Normalize pathway row to catalog entry
function normalizePathway(row: any): CatalogEntry {
  return {
    type: 'pathway',
    hs_path: row.path || row.hs_path || '',
    title: row.name || row.hs_name || 'Untitled Pathway',
    summary: row.values?.meta_description || row.values?.summary_markdown || '',
    image_url: row.values?.badge_image_url || row.values?.social_image_url || '',
    level: undefined, // Pathways don't have explicit levels
    duration: row.values?.estimated_minutes || row.values?.total_estimated_minutes || undefined,
    tags: row.values?.tags || '',
    published: 'true',
    sort_order: row.values?.display_order || 999,
    source_table: 'pathways',
    source_row_id: row.id
  };
}

// Clear all rows from catalog table
async function clearCatalogTable(tableId: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    console.log('   [DRY RUN] Would clear catalog table');
    return;
  }

  console.log('🗑️  Clearing existing catalog entries...');

  const existingRows = await fetchTableRows(tableId);

  for (const row of existingRows) {
    try {
      await retryWithBackoff(() =>
        hubspot.cms.hubdb.rowsApi.purgeDraftTableRow(tableId, row.id.toString())
      );
      await sleep(200); // Small delay between deletions
    } catch (err: any) {
      console.error(`   ⚠️  Failed to delete row ${row.id}:`, err.message);
    }
  }

  console.log(`   ✓ Cleared ${existingRows.length} existing entries`);
}

// Insert catalog entry into table
async function insertCatalogEntry(
  tableId: string,
  entry: CatalogEntry,
  dryRun: boolean
): Promise<boolean> {
  if (dryRun) {
    console.log(`   [DRY RUN] Would insert: ${entry.type} - ${entry.title}`);
    return true;
  }

  try {
    await retryWithBackoff(() =>
      hubspot.cms.hubdb.rowsApi.createTableRow(tableId, {
        path: entry.hs_path,
        name: entry.title,
        values: {
          type: entry.type,
          hs_path: entry.hs_path,
          title: entry.title,
          summary: entry.summary,
          image_url: entry.image_url,
          level: entry.level,
          duration: entry.duration,
          tags: entry.tags,
          published: entry.published,
          sort_order: entry.sort_order,
          source_table: entry.source_table,
          source_row_id: entry.source_row_id
        }
      })
    );
    await sleep(200); // Small delay between insertions
    return true;
  } catch (err: any) {
    console.error(`   ✗ Failed to insert ${entry.type} "${entry.title}":`, err.message);
    return false;
  }
}

// Publish catalog table
async function publishCatalogTable(tableId: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    console.log('   [DRY RUN] Would publish catalog table');
    return;
  }

  console.log('📤 Publishing catalog table...');

  try {
    await retryWithBackoff(() =>
      hubspot.cms.hubdb.tablesApi.publishDraftTable(tableId)
    );
    console.log('   ✓ Catalog published');
  } catch (err: any) {
    console.error('   ✗ Failed to publish catalog:', err.message);
    throw err;
  }
}

async function syncCatalog(dryRun: boolean = false) {
  console.log('🔄 Starting catalog sync...\n');

  if (dryRun) {
    console.log('📝 DRY RUN MODE - no changes will be made\n');
  }

  // Find all required tables
  console.log('🔍 Finding HubDB tables...');

  const [catalogTable, modulesTable, coursesTable, pathwaysTable] = await Promise.all([
    findTableByName('catalog'),
    findTableByName('modules'),
    findTableByName('courses'),
    findTableByName('pathways')
  ]);

  if (!catalogTable) {
    throw new Error('Catalog table not found. Run "npm run provision:tables" first.');
  }
  if (!modulesTable) {
    throw new Error('Modules table not found.');
  }
  if (!coursesTable) {
    throw new Error('Courses table not found.');
  }
  if (!pathwaysTable) {
    throw new Error('Pathways table not found.');
  }

  console.log(`   ✓ Catalog table: ${catalogTable.id}`);
  console.log(`   ✓ Modules table: ${modulesTable.id}`);
  console.log(`   ✓ Courses table: ${coursesTable.id}`);
  console.log(`   ✓ Pathways table: ${pathwaysTable.id}\n`);

  // Fetch source data
  console.log('📥 Fetching source data...');

  const [moduleRows, courseRows, pathwayRows] = await Promise.all([
    fetchTableRows(modulesTable.id),
    fetchTableRows(coursesTable.id),
    fetchTableRows(pathwaysTable.id)
  ]);

  console.log(`   ✓ Modules: ${moduleRows.length} rows`);
  console.log(`   ✓ Courses: ${courseRows.length} rows`);
  console.log(`   ✓ Pathways: ${pathwayRows.length} rows\n`);

  // Normalize entries
  const catalogEntries: CatalogEntry[] = [
    ...moduleRows.map(normalizeModule),
    ...courseRows.map(normalizeCourse),
    ...pathwayRows.map(normalizePathway)
  ];

  // Sort by type and sort_order
  catalogEntries.sort((a, b) => {
    const typeOrder = { module: 1, course: 2, pathway: 3 };
    if (typeOrder[a.type] !== typeOrder[b.type]) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return (a.sort_order || 999) - (b.sort_order || 999);
  });

  console.log(`📦 Normalized ${catalogEntries.length} catalog entries\n`);

  // Clear and populate catalog
  await clearCatalogTable(catalogTable.id, dryRun);

  console.log('📝 Inserting catalog entries...');
  let successCount = 0;
  let failCount = 0;

  for (const entry of catalogEntries) {
    const success = await insertCatalogEntry(catalogTable.id, entry, dryRun);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`   ✓ Inserted: ${successCount}`);
  if (failCount > 0) {
    console.log(`   ✗ Failed: ${failCount}`);
  }
  console.log('');

  // Publish catalog
  await publishCatalogTable(catalogTable.id, dryRun);

  console.log('\n' + '='.repeat(60));
  console.log('📊 Sync Summary');
  console.log('='.repeat(60));
  console.log(`\nModules: ${moduleRows.length}`);
  console.log(`Courses: ${courseRows.length}`);
  console.log(`Pathways: ${pathwayRows.length}`);
  console.log(`Total catalog entries: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('\n✅ Catalog sync complete!\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run sync
syncCatalog(dryRun).catch(err => {
  console.error('❌ Sync failed:', err);
  process.exit(1);
});
