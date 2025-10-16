#!/usr/bin/env ts-node
"use strict";
/**
 * Migrate the 2 remaining modules from legacy learning_modules (135163996)
 * to the new Modules table (135621904)
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
// Normalize slug for comparison
function normalizeSlug(slug) {
    if (!slug)
        return '';
    return slug.toLowerCase().trim().replace(/^\/+|\/+$/g, '');
}
async function getLegacyRows() {
    console.log(`\n📋 Fetching rows from legacy table (${LEGACY_TABLE_ID})...`);
    try {
        const response = await client.cms.hubdb.rowsApi.getTableRows(LEGACY_TABLE_ID, undefined, undefined, 250);
        console.log(`   Found ${response.results.length} legacy rows`);
        return response.results;
    }
    catch (err) {
        console.error('❌ Error fetching legacy rows:', err.message);
        throw err;
    }
}
async function getNewTableRows() {
    console.log(`\n📋 Fetching rows from new Modules table (${MODULES_TABLE_ID})...`);
    try {
        const response = await client.cms.hubdb.rowsApi.getTableRows(MODULES_TABLE_ID, undefined, undefined, 250);
        console.log(`   Found ${response.results.length} rows in new table`);
        return response.results;
    }
    catch (err) {
        console.error('❌ Error fetching new table rows:', err.message);
        throw err;
    }
}
async function createModuleRow(moduleData) {
    console.log(`\n✏️  Creating row for: ${moduleData.title}`);
    const payload = {
        values: {
            title: moduleData.title,
            path: moduleData.path,
            full_content: moduleData.full_content || moduleData.full_content_html || '',
            estimated_minutes: moduleData.estimated_minutes || 25,
            difficulty: moduleData.difficulty || 'beginner',
            tags: moduleData.tags || ['authoring']
        }
    };
    console.log(`   Payload:`, JSON.stringify(payload, null, 2));
    try {
        const response = await client.cms.hubdb.rowsApi.createTableRow(MODULES_TABLE_ID, payload);
        console.log(`   ✅ Created row ID: ${response.id}`);
    }
    catch (err) {
        console.error(`   ❌ Error creating row:`, err.message);
        if (err.body) {
            console.error('   Error details:', JSON.stringify(err.body, null, 2));
        }
        throw err;
    }
}
async function publishTable() {
    console.log(`\n📢 Publishing Modules table (${MODULES_TABLE_ID})...`);
    try {
        await client.cms.hubdb.tablesApi.publishDraftTable(MODULES_TABLE_ID);
        console.log('   ✅ Table published successfully');
    }
    catch (err) {
        console.error('   ❌ Error publishing table:', err.message);
        throw err;
    }
}
async function main() {
    console.log('🔄 Starting module migration...');
    console.log('='.repeat(60));
    // Step 1: Fetch all rows from both tables
    const legacyRows = await getLegacyRows();
    const newRows = await getNewTableRows();
    // Step 2: Identify missing modules
    console.log('\n🔍 Comparing tables to find missing modules...');
    const legacyPaths = legacyRows.map(row => ({
        normalizedPath: normalizeSlug(row.values.path || row.path),
        originalPath: row.values.path || row.path,
        title: row.values.title || row.name,
        row: row
    }));
    const newPaths = new Set(newRows.map(row => normalizeSlug(row.values.path || row.path)));
    const missingModules = legacyPaths.filter(item => !newPaths.has(item.normalizedPath));
    console.log(`\n📊 Summary:`);
    console.log(`   Legacy table: ${legacyRows.length} modules`);
    console.log(`   New table: ${newRows.length} modules`);
    console.log(`   Missing: ${missingModules.length} modules`);
    if (missingModules.length === 0) {
        console.log('\n✅ No missing modules found! All modules have been migrated.');
        return;
    }
    console.log(`\n📋 Missing modules:`);
    missingModules.forEach((item, idx) => {
        console.log(`   ${idx + 1}. "${item.title}" (${item.originalPath})`);
    });
    // Step 3: Migrate missing modules
    console.log('\n🔄 Migrating missing modules...');
    for (const item of missingModules) {
        const legacyRow = item.row;
        const values = legacyRow.values;
        const moduleData = {
            title: values.title || legacyRow.name,
            path: values.path || legacyRow.path,
            full_content: values.full_content || values.full_content_html || '',
            estimated_minutes: values.estimated_minutes || 25,
            difficulty: values.difficulty || 'beginner',
            tags: values.tags || ['authoring']
        };
        await createModuleRow(moduleData);
    }
    // Step 4: Publish the table
    await publishTable();
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration complete!');
    console.log('='.repeat(60));
    console.log(`\nMigrated ${missingModules.length} module(s):`);
    missingModules.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.originalPath}`);
    });
    console.log('\n📝 Next steps:');
    console.log('   1. Verify pages render correctly with ?debug=1');
    console.log('   2. Check that full_content is present');
    console.log('   3. Report results back to issue #112');
}
main().catch(err => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
});
