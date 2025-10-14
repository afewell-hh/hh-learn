#!/usr/bin/env ts-node
/**
 * Get HubDB row counts for all tables
 */

import 'dotenv/config';
import { getHubSpotClient } from '../src/shared/hubspot.js';

const hubspot = getHubSpotClient();

const MODULES_TABLE_ID = process.env.HUBDB_MODULES_TABLE_ID;
const COURSES_TABLE_ID = process.env.HUBDB_COURSES_TABLE_ID;
const PATHWAYS_TABLE_ID = process.env.HUBDB_PATHWAYS_TABLE_ID;

async function getRowCounts() {
  console.log('📊 HubDB Row Counts\n');

  try {
    // Get modules count
    if (MODULES_TABLE_ID) {
      const modulesResponse = await hubspot.cms.hubdb.rowsApi.getTableRows(MODULES_TABLE_ID, undefined, undefined, undefined);
      console.log(`Modules Table (ID: ${MODULES_TABLE_ID}): ${modulesResponse.results.length} rows`);

      // List module titles
      console.log('  Modules:');
      modulesResponse.results.forEach((row: any) => {
        console.log(`    - ${row.name} (${row.path})`);
      });
      console.log('');
    }

    // Get courses count
    if (COURSES_TABLE_ID) {
      const coursesResponse = await hubspot.cms.hubdb.rowsApi.getTableRows(COURSES_TABLE_ID, undefined, undefined, undefined);
      console.log(`Courses Table (ID: ${COURSES_TABLE_ID}): ${coursesResponse.results.length} rows`);

      // List course titles
      console.log('  Courses:');
      coursesResponse.results.forEach((row: any) => {
        console.log(`    - ${row.name} (${row.path})`);
      });
      console.log('');
    }

    // Get pathways count
    if (PATHWAYS_TABLE_ID) {
      const pathwaysResponse = await hubspot.cms.hubdb.rowsApi.getTableRows(PATHWAYS_TABLE_ID, undefined, undefined, undefined);
      console.log(`Pathways Table (ID: ${PATHWAYS_TABLE_ID}): ${pathwaysResponse.results.length} rows`);

      // List pathway titles
      console.log('  Pathways:');
      pathwaysResponse.results.forEach((row: any) => {
        console.log(`    - ${row.name} (${row.path})`);
      });
      console.log('');
    }

    console.log('✅ Row counts retrieved successfully\n');

  } catch (err: any) {
    console.error('❌ Failed to get row counts:', err.message);
    process.exit(1);
  }
}

getRowCounts();
