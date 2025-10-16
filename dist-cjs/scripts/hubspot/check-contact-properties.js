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
    },
    {
        name: 'hhl_last_viewed_type',
        label: 'HHL Last Viewed Type',
        type: 'enumeration',
        fieldType: 'select',
        groupName: 'learning_program_properties',
        description: 'Last viewed content type (course or module)',
        options: [
            { label: 'Course', value: 'course' },
            { label: 'Module', value: 'module' }
        ]
    },
    {
        name: 'hhl_last_viewed_slug',
        label: 'HHL Last Viewed Slug',
        type: 'string',
        fieldType: 'text',
        groupName: 'learning_program_properties',
        description: 'Slug of the last viewed course/module'
    },
    {
        name: 'hhl_last_viewed_at',
        label: 'HHL Last Viewed At',
        type: 'datetime',
        fieldType: 'datetime',
        groupName: 'learning_program_properties',
        description: 'Datetime of last viewed page'
    }
];
async function checkAndCreateProperties() {
    console.log('🔍 Checking for required Contact Properties...\n');
    const DRY_RUN = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
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
                if (DRY_RUN) {
                    console.log(`  (dry-run) Would create ${propConfig.name}`);
                }
                else {
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
