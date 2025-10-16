#!/usr/bin/env ts-node
"use strict";
/**
 * Detailed comparison of legacy and new module tables
 * to understand the current state
 *
 * Issue #112
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const api_client_1 = require("@hubspot/api-client");
const TOKEN = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
if (!TOKEN) {
    console.error('❌ HUBSPOT_PRIVATE_APP_TOKEN environment variable not set');
    process.exit(1);
}
const client = new api_client_1.Client({ accessToken: TOKEN });
const LEGACY_TABLE_ID = '135163996'; // learning_modules
const MODULES_TABLE_ID = '135621904'; // Modules
async function main() {
    console.log('🔍 Detailed Module Tables Comparison');
    console.log('='.repeat(70));
    // Fetch legacy table
    console.log(`\n📊 LEGACY TABLE: learning_modules (${LEGACY_TABLE_ID})`);
    console.log('-'.repeat(70));
    try {
        const legacyResponse = await client.cms.hubdb.rowsApi.getTableRows(LEGACY_TABLE_ID, undefined, undefined, 250);
        const legacyRows = legacyResponse.results;
        console.log(`Found ${legacyRows.length} rows:\n`);
        legacyRows.forEach((row, idx) => {
            const title = row.values.title || row.name || 'Untitled';
            const path = row.values.path || row.path || 'N/A';
            const hasContent = row.values.full_content || row.values.full_content_html;
            console.log(`${idx + 1}. "${title}"`);
            console.log(`   Path: ${path}`);
            console.log(`   ID: ${row.id}`);
            console.log(`   Has content: ${hasContent ? '✅' : '❌'}`);
            console.log('');
        });
    }
    catch (err) {
        console.error('❌ Error fetching legacy table:', err.message);
    }
    // Fetch new table
    console.log(`\n📊 NEW TABLE: Modules (${MODULES_TABLE_ID})`);
    console.log('-'.repeat(70));
    try {
        const newResponse = await client.cms.hubdb.rowsApi.getTableRows(MODULES_TABLE_ID, undefined, undefined, 250);
        const newRows = newResponse.results;
        console.log(`Found ${newRows.length} rows:\n`);
        newRows.forEach((row, idx) => {
            const title = row.values.title || row.name || 'Untitled';
            const path = row.values.path || row.path || 'N/A';
            const hasContent = row.values.full_content || row.values.full_content_html;
            console.log(`${idx + 1}. "${title}"`);
            console.log(`   Path: ${path}`);
            console.log(`   ID: ${row.id}`);
            console.log(`   Has content: ${hasContent ? '✅' : '❌'}`);
            console.log('');
        });
    }
    catch (err) {
        console.error('❌ Error fetching new table:', err.message);
    }
    console.log('='.repeat(70));
}
main().catch(err => {
    console.error('❌ Comparison failed:', err);
    process.exit(1);
});
