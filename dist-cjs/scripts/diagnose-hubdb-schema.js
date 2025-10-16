#!/usr/bin/env ts-node
"use strict";
/**
 * Diagnose HubDB schema drift
 *
 * This script checks what columns actually exist in HubDB tables
 * and compares them with what the schemas define.
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const api_client_1 = require("@hubspot/api-client");
const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!TOKEN) {
    console.error('❌ HUBSPOT_PRIVATE_APP_TOKEN environment variable not set');
    process.exit(1);
}
const client = new api_client_1.Client({ accessToken: TOKEN });
const tableIds = {
    modules: process.env.HUBDB_MODULES_TABLE_ID,
    courses: process.env.HUBDB_COURSES_TABLE_ID,
    pathways: process.env.HUBDB_PATHWAYS_TABLE_ID
};
async function loadSchema(schemaName) {
    const schemaPath = (0, path_1.join)(process.cwd(), 'hubdb-schemas', `${schemaName}.schema.json`);
    const content = await (0, promises_1.readFile)(schemaPath, 'utf-8');
    return JSON.parse(content);
}
async function checkTable(name, id) {
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
        actualColumns.forEach((col) => {
            console.log(`  - ${col.name} (${col.type})`);
        });
        console.log(`\n📋 Expected Columns from Schema (${schema.columns.length} columns):`);
        schema.columns.forEach((col) => {
            console.log(`  - ${col.name} (${col.type})`);
        });
        // Compare schemas
        console.log(`\n🔍 Schema Comparison:`);
        const actualColumnNames = actualColumns.map((c) => c.name);
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
                const col = actualColumns.find((c) => c.name === name);
                console.log(`  ➕ ${name} (${col?.type})`);
            });
        }
        if (missing.length === 0 && extra.length === 0) {
            console.log(`\n✅ Schema matches! All columns present.`);
        }
    }
    catch (err) {
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
