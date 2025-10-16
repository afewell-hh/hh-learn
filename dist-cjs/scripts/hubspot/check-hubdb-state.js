#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_client_1 = require("@hubspot/api-client");
const get_hubspot_token_js_1 = require("./get-hubspot-token.js");
const TOKEN = (0, get_hubspot_token_js_1.getHubSpotToken)();
const client = new api_client_1.Client({ accessToken: TOKEN });
const tableIds = {
    modules: 135621904,
    courses: 135381433,
    pathways: 135381504
};
async function checkTableState(name, id) {
    try {
        const table = await client.cms.hubdb.tablesApi.getTableDetails(String(id));
        console.log(`\n=== ${name.toUpperCase()} (ID: ${id}) ===`);
        console.log(`Name: ${table.name}`);
        console.log(`Published: ${table.publishedAt || 'Not published'}`);
        console.log(`Row Count: ${table.rowCount || 0}`);
        console.log(`Updated: ${table.updatedAt}`);
    }
    catch (err) {
        console.error(`Error fetching ${name}:`, err.message);
    }
}
async function main() {
    console.log('🔍 Checking HubDB table publish states...\n');
    for (const [name, id] of Object.entries(tableIds)) {
        await checkTableState(name, id);
    }
    console.log('\n✅ Done!');
}
main().catch(console.error);
