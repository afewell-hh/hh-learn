#!/usr/bin/env ts-node
/**
 * Provision HubDB tables for Courses and Pathways
 *
 * This script:
 * 1. Reads table schemas from hubdb-schemas/*.schema.json
 * 2. Creates or updates tables via HubDB API v3
 * 3. Sets useForPages=true, publishes tables
 * 4. Outputs table names and IDs for use in other scripts
 *
 * Usage: npm run provision:tables [-- --dry-run]
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Client } from '@hubspot/api-client';
import { getHubSpotToken } from './get-hubspot-token.js';

const hubspot = new Client({
  accessToken: getHubSpotToken()
});

interface ColumnOption {
  id: string;
  name: string;
  type: string;
}

interface ColumnSchema {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  options?: ColumnOption[];
}

interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

interface TableResult {
  name: string;
  id: string;
  published: boolean;
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

async function loadSchema(schemaName: string): Promise<TableSchema> {
  const schemaPath = join(process.cwd(), 'hubdb-schemas', `${schemaName}.schema.json`);
  const content = await readFile(schemaPath, 'utf-8');
  return JSON.parse(content) as TableSchema;
}

async function findTableByName(tableName: string): Promise<any | null> {
  try {
    const response = await retryWithBackoff(() =>
      hubspot.cms.hubdb.tablesApi.getAllTables(undefined, undefined, undefined)
    );

    // Handle both array and object responses from the API
    const tables = Array.isArray(response) ? response : (response.results || []);
    return tables.find((t: any) => t.name === tableName) || null;
  } catch (err: any) {
    console.error(`Error finding table "${tableName}":`, err.message || err);
    return null;
  }
}

async function createOrUpdateTable(
  schema: TableSchema,
  dryRun: boolean = false
): Promise<TableResult | null> {
  const existingTable = await findTableByName(schema.name);

  // Map schema columns to HubDB column format
  const columns = schema.columns.map((col) => {
    const column: any = {
      name: col.name,
      label: col.name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      type: col.type
    };

    // Include options for SELECT type columns
    if (col.type === 'SELECT' && col.options && col.options.length > 0) {
      column.options = col.options;
    }

    return column;
  });

  const tablePayload = {
    name: schema.name,
    label: schema.name.charAt(0).toUpperCase() + schema.name.slice(1),
    useForPages: true,
    allowChildTables: false,
    enableChildTablePages: false,
    columns,
    allowPublicApiAccess: false
  };

  if (dryRun) {
    console.log(`\n📄 Table: ${schema.name}`);
    console.log(existingTable ? '   Action: UPDATE (table exists)' : '   Action: CREATE (new table)');
    console.log('   Payload:');
    console.log(JSON.stringify(tablePayload, null, 2));
    return {
      name: schema.name,
      id: existingTable?.id || '<would-be-created>',
      published: false
    };
  }

  try {
    let table: any;
    const token = getHubSpotToken();

    if (existingTable) {
      // Update existing table via raw HTTP API
      console.log(`📝 Updating table: ${schema.name} (ID: ${existingTable.id})`);
      const response = await retryWithBackoff(async () => {
        const res = await fetch(`https://api.hubapi.com/cms/v3/hubdb/tables/${existingTable.id}/draft`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(tablePayload)
        });

        if (!res.ok) {
          const errorText = await res.text();
          const error: any = new Error(`HTTP ${res.status}: ${errorText}`);
          error.code = res.status;
          error.body = errorText;
          throw error;
        }

        return await res.json();
      });
      table = response;
      console.log(`   ✓ Table updated`);
    } else {
      // Create new table via raw HTTP API
      console.log(`📝 Creating table: ${schema.name}`);
      const response = await retryWithBackoff(async () => {
        const res = await fetch('https://api.hubapi.com/cms/v3/hubdb/tables', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(tablePayload)
        });

        if (!res.ok) {
          const errorText = await res.text();
          const error: any = new Error(`HTTP ${res.status}: ${errorText}`);
          error.code = res.status;
          error.body = errorText;
          throw error;
        }

        return await res.json();
      });
      table = response;
      console.log(`   ✓ Table created with ID: ${table.id}`);
    }

    // Publish the table via raw HTTP API
    console.log(`📤 Publishing table: ${schema.name}`);
    await retryWithBackoff(async () => {
      const res = await fetch(`https://api.hubapi.com/cms/v3/hubdb/tables/${table.id}/draft/push-live`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errorText = await res.text();
        const error: any = new Error(`HTTP ${res.status}: ${errorText}`);
        error.code = res.status;
        error.body = errorText;
        throw error;
      }

      return await res.json();
    });
    console.log(`   ✓ Table published`);

    return {
      name: schema.name,
      id: String(table.id),
      published: true
    };
  } catch (err: any) {
    console.error(`✗ Failed to provision table "${schema.name}":`, err.message);
    if (err.body) {
      console.error('   Error details:', err.body);
    }
    return null;
  }
}

async function provisionTables(dryRun: boolean = false) {
  console.log('🔄 Starting HubDB table provisioning...\n');

  if (dryRun) {
    console.log('📝 DRY RUN MODE - no changes will be made\n');
  }

  if (!dryRun) {
    try {
      getHubSpotToken(); // This will throw if no token is available
    } catch (err: any) {
      throw new Error(err.message);
    }
  }

  const tableSchemas = ['courses', 'pathways', 'modules', 'catalog'];
  const results: TableResult[] = [];

  for (const schemaName of tableSchemas) {
    try {
      const schema = await loadSchema(schemaName);
      const result = await createOrUpdateTable(schema, dryRun);

      if (result) {
        results.push(result);
      }

      // Small delay between tables
      if (!dryRun) {
        await sleep(1000);
      }
    } catch (err: any) {
      console.error(`✗ Failed to process schema "${schemaName}":`, err.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Provisioning Summary');
  console.log('='.repeat(60));

  results.forEach((result) => {
    console.log(`\nTable: ${result.name}`);
    console.log(`  ID: ${result.id}`);
    console.log(`  Published: ${result.published ? 'Yes' : 'No (dry-run)'}`);
  });

  console.log('\n✅ Table provisioning complete!\n');

  // Output environment variable format for easy copy-paste
  if (results.length > 0 && !dryRun) {
    console.log('📋 Add these to your .env file:\n');
    results.forEach((result) => {
      const envVarName = `HUBDB_${result.name.toUpperCase()}_TABLE_ID`;
      console.log(`${envVarName}=${result.id}`);
    });
    console.log('');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run provisioning
provisionTables(dryRun).catch(err => {
  console.error('❌ Provisioning failed:', err);
  process.exit(1);
});
