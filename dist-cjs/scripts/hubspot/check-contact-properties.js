#!/usr/bin/env ts-node
"use strict";
/**
 * Check and create required Contact Properties for progress tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const api_client_1 = require("@hubspot/api-client");
const get_hubspot_token_js_1 = require("./get-hubspot-token.js");
const hubspot = new api_client_1.Client({
    accessToken: (0, get_hubspot_token_js_1.getHubSpotToken)()
});
const REQUIRED_PROPERTIES = [
    {
        name: 'hhl_progress_state',
        label: 'HHL Progress State',
        type: 'string',
        fieldType: 'textarea',
        groupName: 'learning_program_properties',
        description: 'JSON storage for Hedgehog Learn progress (managed by API)'
    },
    {
        name: 'hhl_progress_updated_at',
        label: 'HHL Progress Updated At',
        type: 'date',
        fieldType: 'date',
        groupName: 'learning_program_properties',
        description: 'Last update timestamp for learning progress'
    },
    {
        name: 'hhl_progress_summary',
        label: 'HHL Progress Summary',
        type: 'string',
        fieldType: 'text',
        groupName: 'learning_program_properties',
        description: 'Human-readable progress summary'
    }
];
async function checkAndCreateProperties() {
    console.log('🔍 Checking for required Contact Properties...\n');
    for (const propConfig of REQUIRED_PROPERTIES) {
        try {
            // Check if property exists
            const existing = await hubspot.crm.properties.coreApi.getByName('contacts', propConfig.name);
            console.log(`✓ Property "${propConfig.name}" exists`);
            console.log(`  Label: ${existing.label}`);
            console.log(`  Type: ${existing.type} (${existing.fieldType})`);
            console.log(`  Group: ${existing.groupName || 'N/A'}\n`);
        }
        catch (err) {
            if (err.code === 404) {
                console.log(`✗ Property "${propConfig.name}" does not exist. Creating...`);
                try {
                    const created = await hubspot.crm.properties.coreApi.create('contacts', propConfig);
                    console.log(`  ✓ Created property "${propConfig.name}"`);
                    console.log(`  ID: ${created.name}\n`);
                }
                catch (createErr) {
                    console.error(`  ✗ Failed to create property: ${createErr.message}`);
                    if (createErr.body) {
                        console.error(`  Details: ${JSON.stringify(createErr.body, null, 2)}\n`);
                    }
                }
            }
            else {
                console.error(`⚠ Error checking property "${propConfig.name}": ${err.message}\n`);
            }
        }
    }
    console.log('✅ Contact Properties check complete!\n');
}
checkAndCreateProperties().catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
});
