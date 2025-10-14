#!/usr/bin/env ts-node
/**
 * Fix the 2 modules in new Modules table that are missing full_content
 * by copying it from the legacy learning_modules table
 *
 * Issue #112
 */

import 'dotenv/config';
import { Client } from '@hubspot/api-client';

const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

if (!TOKEN) {
  console.error('❌ HUBSPOT_PRIVATE_APP_TOKEN environment variable not set');
  process.exit(1);
}

const client = new Client({ accessToken: TOKEN });

const LEGACY_TABLE_ID = '135163996'; // learning_modules
const MODULES_TABLE_ID = '135621904'; // Modules

interface HubDBRow {
  id: string;
  name?: string;
  path?: string;
  values: Record<string, any>;
}

// Normalize slug for comparison
function normalizeSlug(slug: string | undefined): string {
  if (!slug) return '';
  return slug.toLowerCase().trim().replace(/^\/+|\/+$/g, '');
}

async function main() {
  console.log('🔄 Fixing modules with missing full_content...');
  console.log('='.repeat(70));

  // Fetch both tables
  console.log('\n📋 Fetching data from both tables...');
  const legacyResponse = await client.cms.hubdb.rowsApi.getTableRows(LEGACY_TABLE_ID, undefined, undefined, 250);
  const legacyRows = legacyResponse.results as HubDBRow[];

  const newResponse = await client.cms.hubdb.rowsApi.getTableRows(MODULES_TABLE_ID, undefined, undefined, 250);
  const newRows = newResponse.results as HubDBRow[];

  console.log(`   Legacy table: ${legacyRows.length} rows`);
  console.log(`   New table: ${newRows.length} rows`);

  // Create a map of legacy content by normalized path
  const legacyContentMap = new Map<string, HubDBRow>();
  legacyRows.forEach(row => {
    const path = normalizeSlug(row.values.path || row.path);
    legacyContentMap.set(path, row);
  });

  // Find modules in new table that match legacy paths but are missing content
  console.log('\n🔍 Finding modules missing full_content...');

  const modulesToFix: Array<{newRow: HubDBRow, legacyRow: HubDBRow}> = [];

  for (const newRow of newRows) {
    const newPath = normalizeSlug(newRow.values.path || newRow.path);
    const legacyRow = legacyContentMap.get(newPath);

    if (legacyRow) {
      const newHasContent = newRow.values.full_content || newRow.values.full_content_html;
      const legacyHasContent = legacyRow.values.full_content || legacyRow.values.full_content_html;

      if (!newHasContent && legacyHasContent) {
        modulesToFix.push({ newRow, legacyRow });
      }
    }
  }

  console.log(`\n📊 Found ${modulesToFix.length} module(s) to fix:\n`);

  if (modulesToFix.length === 0) {
    console.log('✅ All modules already have content!');
    return;
  }

  modulesToFix.forEach((item, idx) => {
    const title = item.newRow.values.title || item.newRow.name;
    const path = item.newRow.values.path || item.newRow.path;
    console.log(`${idx + 1}. "${title}"`);
    console.log(`   Path: ${path}`);
    console.log(`   New Row ID: ${item.newRow.id}`);
    console.log('');
  });

  // Fix each module
  console.log('🔄 Updating modules with content from legacy table...\n');

  for (const item of modulesToFix) {
    const title = item.newRow.values.title || item.newRow.name;
    const legacyContent = item.legacyRow.values.full_content || item.legacyRow.values.full_content_html;

    console.log(`✏️  Updating: "${title}"`);
    console.log(`   Row ID: ${item.newRow.id}`);
    console.log(`   Content length: ${legacyContent?.length || 0} characters`);

    try {
      // Update the row with the content from legacy table
      const updatePayload = {
        values: {
          ...item.newRow.values,
          full_content: legacyContent
        }
      };

      await client.cms.hubdb.rowsApi.updateDraftTableRow(
        MODULES_TABLE_ID,
        item.newRow.id,
        updatePayload
      );

      console.log('   ✅ Updated successfully\n');
    } catch (err: any) {
      console.error(`   ❌ Error updating row:`, err.message);
      if (err.body) {
        console.error('   Error details:', JSON.stringify(err.body, null, 2));
      }
    }
  }

  // Publish the table
  console.log('📢 Publishing Modules table...');
  try {
    await client.cms.hubdb.tablesApi.publishDraftTable(MODULES_TABLE_ID);
    console.log('   ✅ Table published successfully');
  } catch (err: any) {
    console.error('   ❌ Error publishing table:', err.message);
    throw err;
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Migration complete!');
  console.log('='.repeat(70));
  console.log(`\nUpdated ${modulesToFix.length} module(s) with full_content:`);
  modulesToFix.forEach((item, idx) => {
    const path = item.newRow.values.path || item.newRow.path;
    console.log(`   ${idx + 1}. ${path}`);
  });

  console.log('\n📝 Next steps:');
  console.log('   1. Verify pages render correctly with ?debug=1');
  console.log('   2. Check that full_content is present in debug output');
  console.log('   3. Report results back to issue #112');
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
