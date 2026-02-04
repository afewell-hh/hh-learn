#!/usr/bin/env ts-node
/**
 * Export HubDB tables to CSV for backup before tagging changes
 *
 * Usage: npm run export:hubdb
 */

import 'dotenv/config';
import { getHubSpotClient } from '../src/shared/hubspot.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const hubspot = getHubSpotClient();

const PATHWAYS_TABLE_ID = process.env.HUBDB_PATHWAYS_TABLE_ID;
const COURSES_TABLE_ID = process.env.HUBDB_COURSES_TABLE_ID;
const MODULES_TABLE_ID = process.env.HUBDB_MODULES_TABLE_ID;

// Helper: Convert object to CSV row
function objectToCSV(headers: string[], obj: any): string {
  return headers.map(header => {
    const value = obj[header];
    if (value === null || value === undefined) return '';
    const strValue = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
  }).join(',');
}

async function exportTable(tableId: string, tableName: string) {
  console.log(`\n📥 Exporting ${tableName} table (ID: ${tableId})...`);

  try {
    const response = await hubspot.cms.hubdb.rowsApi.getTableRows(tableId, undefined, undefined, undefined);
    const rows = response.results || [];

    console.log(`   Found ${rows.length} rows`);

    if (rows.length === 0) {
      console.log(`   ⚠️  No data to export`);
      return;
    }

    // Extract headers from first row
    const firstRow = rows[0];
    const stdHeaders = ['id', 'name', 'path'];
    const valueHeaders = firstRow.values ? Object.keys(firstRow.values) : [];
    const headers = [...stdHeaders, ...valueHeaders];

    // Build CSV
    const csvLines: string[] = [];
    csvLines.push(headers.join(','));

    for (const row of rows) {
      const flatRow: any = {
        id: row.id,
        name: row.name,
        path: row.path,
        ...row.values
      };
      csvLines.push(objectToCSV(headers, flatRow));
    }

    const csv = csvLines.join('\n');

    // Write to file
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `hubdb-backup-${tableName}-${timestamp}.csv`;
    const filepath = join(process.cwd(), 'docs', filename);

    await writeFile(filepath, csv, 'utf-8');
    console.log(`   ✅ Exported to: docs/${filename}`);

  } catch (err: any) {
    console.error(`   ❌ Export failed: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('🔄 Starting HubDB export for backup...\n');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  if (!PATHWAYS_TABLE_ID || !COURSES_TABLE_ID || !MODULES_TABLE_ID) {
    throw new Error('Missing HubDB table IDs in environment variables');
  }

  // Export all tables
  await exportTable(PATHWAYS_TABLE_ID, 'pathways');
  await exportTable(COURSES_TABLE_ID, 'courses');
  await exportTable(MODULES_TABLE_ID, 'modules');

  console.log('\n✅ All exports complete!\n');
  console.log('📋 Next steps:');
  console.log('   1. Review exported CSV files in docs/');
  console.log('   2. Commit backups to git before making HubDB changes');
  console.log('   3. Update content JSON files with new tags');
  console.log('   4. Run sync scripts to apply changes\n');
}

main().catch(err => {
  console.error('❌ Export failed:', err);
  process.exit(1);
});
