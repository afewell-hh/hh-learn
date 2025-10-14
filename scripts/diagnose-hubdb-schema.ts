#!/usr/bin/env ts-node
/**
 * Diagnose HubDB schema drift
 *
 * This script checks what columns actually exist in HubDB tables
 * and compares them with what the schemas define.
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Client } from '@hubspot/api-client';

const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

if (!TOKEN) {
  console.error('❌ HUBSPOT_PRIVATE_APP_TOKEN environment variable not set');
  process.exit(1);
}

const client = new Client({ accessToken: TOKEN });

const tableIds = {
  modules: process.env.HUBDB_MODULES_TABLE_ID,
  courses: process.env.HUBDB_COURSES_TABLE_ID,
  pathways: process.env.HUBDB_PATHWAYS_TABLE_ID
};

interface SchemaColumn {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
}

interface TableSchema {
  name: string;
  columns: SchemaColumn[];
}

async function loadSchema(schemaName: string): Promise<TableSchema> {
  const schemaPath = join(process.cwd(), 'hubdb-schemas', `${schemaName}.schema.json`);
  const content = await readFile(schemaPath, 'utf-8');
  return JSON.parse(content) as TableSchema;
}

async function checkTable(name: string, id: string | undefined) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Table: ${name.toUpperCase()} (ID: ${id})`);
  console.log('='.repeat(60));

  if (!id) {
    console.log('⚠️  No table ID found in .env file');
    return;
  }

  try {
    // Fetch table details including columns
    const table = await client.cms.hubdb.tablesApi.getTableDetails(id);

    console.log(`\nTable Name: ${table.name}`);
    console.log(`Published: ${table.publishedAt ? new Date(table.publishedAt).toISOString() : 'Not published'}`);
    console.log(`Row Count: ${table.rowCount || 0}`);
    console.log(`Updated: ${new Date(table.updatedAt || 0).toISOString()}`);

    // Load expected schema
    const schema = await loadSchema(name);

    console.log(`\n📋 Columns in HubDB (${table.columns?.length || 0} columns):`);
    const actualColumns = table.columns || [];
    actualColumns.forEach((col: any) => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    console.log(`\n📋 Expected Columns from Schema (${schema.columns.length} columns):`);
    schema.columns.forEach((col: SchemaColumn) => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    // Compare schemas
    console.log(`\n🔍 Schema Comparison:`);
    const actualColumnNames = actualColumns.map((c: any) => c.name);
    const expectedColumnNames = schema.columns.map(c => c.name);

    const missing = expectedColumnNames.filter(name => !actualColumnNames.includes(name));
    const extra = actualColumnNames.filter(name => !expectedColumnNames.includes(name));

    if (missing.length > 0) {
      console.log(`\n⚠️  MISSING COLUMNS (in schema but not in HubDB):`);
      missing.forEach(name => {
        const col = schema.columns.find(c => c.name === name);
        console.log(`  ❌ ${name} (${col?.type})`);
      });
    }

    if (extra.length > 0) {
      console.log(`\n⚠️  EXTRA COLUMNS (in HubDB but not in schema):`);
      extra.forEach(name => {
        const col = actualColumns.find((c: any) => c.name === name);
        console.log(`  ➕ ${name} (${col?.type})`);
      });
    }

    if (missing.length === 0 && extra.length === 0) {
      console.log(`\n✅ Schema matches! All columns present.`);
    }

  } catch (err: any) {
    console.error(`\n❌ Error fetching table ${name}:`, err.message);
    if (err.body) {
      console.error('Error details:', err.body);
    }
  }
}

async function main() {
  console.log('🔍 Diagnosing HubDB Schema Drift...\n');

  for (const [name, id] of Object.entries(tableIds)) {
    await checkTable(name, id);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Diagnosis complete!');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('❌ Diagnosis failed:', err);
  process.exit(1);
});
