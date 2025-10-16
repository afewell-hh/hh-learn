#!/usr/bin/env ts-node
"use strict";
/**
 * Check and publish pages
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const api_client_1 = require("@hubspot/api-client");
const get_hubspot_token_js_1 = require("./get-hubspot-token.js");
const TOKEN = (0, get_hubspot_token_js_1.getHubSpotToken)();
const hubspot = new api_client_1.Client({
    accessToken: TOKEN
});
const pageIds = [
    { id: '197280289288', name: 'Courses' },
    { id: '197280289546', name: 'Pathways' }
];
async function main() {
    console.log('Checking page status and publishing...\n');
    for (const pageInfo of pageIds) {
        try {
            // Get page details
            const page = await hubspot.cms.pages.sitePagesApi.getById(pageInfo.id);
            console.log(`Page: ${pageInfo.name} (ID: ${pageInfo.id})`);
            console.log(`  State: ${page.state}`);
            console.log(`  Template: ${page.templatePath}`);
            console.log(`  Published: ${page.publishDate || 'Not published'}`);
            // If in draft, schedule immediate publish
            if (page.state !== 'PUBLISHED') {
                console.log(`  Publishing...`);
                try {
                    // Use direct API call to publish
                    const response = await fetch(`https://api.hubapi.com/cms/v3/pages/site-pages/${pageInfo.id}/schedule`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({})
                    });
                    if (response.ok) {
                        console.log(`  ✓ Published successfully`);
                    }
                    else {
                        const errorText = await response.text();
                        console.log(`  ⚠️  Publish failed: ${response.status} - ${errorText}`);
                    }
                }
                catch (err) {
                    console.log(`  ⚠️  Publish error: ${err.message}`);
                }
            }
            else {
                console.log(`  ✓ Already published`);
            }
            console.log('');
        }
        catch (err) {
            console.error(`Error checking page ${pageInfo.name}:`, err.message);
        }
    }
}
main();
