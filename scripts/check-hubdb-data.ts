#!/usr/bin/env ts-node
/**
 * Check HubDB data to see if key columns have values
 *
 * This script checks if the columns that templates depend on
 * actually have data populated.
 */

import 'dotenv/config';
import { Client } from '@hubspot/api-client';

const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

if (!TOKEN) {
  console.error('❌ HUBSPOT_PRIVATE_APP_TOKEN environment variable not set');
  process.exit(1);
}

const client = new Client({ accessToken: TOKEN });

async function checkCourses() {
  const tableId = process.env.HUBDB_COURSES_TABLE_ID;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 COURSES TABLE (ID: ${tableId})`);
  console.log('='.repeat(60));

  if (!tableId) {
    console.log('⚠️  No table ID found in .env file');
    return;
  }

  try {
    const response = await client.cms.hubdb.rowsApi.getTableRows(tableId);
    const rows = response.results || [];

    console.log(`\nFound ${rows.length} course(s):\n`);

    for (const row of rows) {
      const values = row.values || {};
      console.log(`Course: ${row.name || 'Untitled'}`);
      console.log(`  hs_path: ${row.path || 'N/A'}`);
      console.log(`  Module slugs JSON: ${values.module_slugs_json ? '✅ Present' : '❌ Empty'}`);
      if (values.module_slugs_json) {
        try {
          const modules = JSON.parse(values.module_slugs_json);
          console.log(`    → Contains ${modules.length} module(s): ${modules.slice(0, 3).join(', ')}${modules.length > 3 ? '...' : ''}`);
        } catch (e) {
          console.log(`    → Invalid JSON`);
        }
      }
      console.log(`  Content blocks JSON: ${values.content_blocks_json ? '✅ Present' : '❌ Empty'}`);
      if (values.content_blocks_json) {
        try {
          const blocks = JSON.parse(values.content_blocks_json);
          console.log(`    → Contains ${blocks.length} block(s)`);
        } catch (e) {
          console.log(`    → Invalid JSON`);
        }
      }
      console.log('');
    }
  } catch (err: any) {
    console.error(`\n❌ Error fetching courses:`, err.message);
  }
}

async function checkPathways() {
  const tableId = process.env.HUBDB_PATHWAYS_TABLE_ID;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 PATHWAYS TABLE (ID: ${tableId})`);
  console.log('='.repeat(60));

  if (!tableId) {
    console.log('⚠️  No table ID found in .env file');
    return;
  }

  try {
    const response = await client.cms.hubdb.rowsApi.getTableRows(tableId);
    const rows = response.results || [];

    console.log(`\nFound ${rows.length} pathway(s):\n`);

    for (const row of rows) {
      const values = row.values || {};
      console.log(`Pathway: ${row.name || 'Untitled'}`);
      console.log(`  hs_path: ${row.path || 'N/A'}`);
      console.log(`  Module slugs JSON: ${values.module_slugs_json ? '✅ Present' : '❌ Empty'}`);
      if (values.module_slugs_json) {
        try {
          const modules = JSON.parse(values.module_slugs_json);
          console.log(`    → Contains ${modules.length} module(s): ${modules.slice(0, 3).join(', ')}${modules.length > 3 ? '...' : ''}`);
        } catch (e) {
          console.log(`    → Invalid JSON`);
        }
      }
      console.log(`  Course slugs JSON: ${values.course_slugs_json ? '✅ Present' : '❌ Empty'}`);
      if (values.course_slugs_json) {
        try {
          const courses = JSON.parse(values.course_slugs_json);
          console.log(`    → Contains ${courses.length} course(s): ${courses.slice(0, 3).join(', ')}${courses.length > 3 ? '...' : ''}`);
        } catch (e) {
          console.log(`    → Invalid JSON`);
        }
      }
      console.log(`  Content blocks JSON: ${values.content_blocks_json ? '✅ Present' : '❌ Empty'}`);
      if (values.content_blocks_json) {
        try {
          const blocks = JSON.parse(values.content_blocks_json);
          console.log(`    → Contains ${blocks.length} block(s)`);
        } catch (e) {
          console.log(`    → Invalid JSON`);
        }
      }
      console.log('');
    }
  } catch (err: any) {
    console.error(`\n❌ Error fetching pathways:`, err.message);
  }
}

async function main() {
  console.log('🔍 Checking HubDB data in key columns...\n');

  await checkCourses();
  await checkPathways();

  console.log('\n' + '='.repeat(60));
  console.log('✅ Data check complete!');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌ Check failed:', err);
  process.exit(1);
});
