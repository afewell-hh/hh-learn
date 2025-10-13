#!/usr/bin/env ts-node
/**
 * Publish constants.json from DRAFT to PUBLISHED in HubSpot Design Manager
 *
 * Uses the CMS Source Code v3 API to publish design manager assets
 *
 * Usage: npm run build && node dist/scripts/hubspot/publish-constants.js
 */

import 'dotenv/config';
import { getHubSpotToken, maskToken } from './get-hubspot-token.js';

const HUBSPOT_TOKEN = getHubSpotToken();
const CONSTANTS_PATH = 'CLEAN x HEDGEHOG/templates/config/constants.json';

async function publishConstants() {
  console.log('🚀 Publishing constants.json to HubSpot...\n');
  console.log(`🔐 Using HubSpot token: ${maskToken(HUBSPOT_TOKEN)}`);
  console.log(`📄 File path: ${CONSTANTS_PATH}\n`);

  try {
    // Publish via Source Code API v3
    // POST /cms/v3/source-code/{environment}/validate-and-publish/{path}
    const response = await fetch(
      `https://api.hubapi.com/cms/v3/source-code/draft/validate-and-publish/${encodeURIComponent(CONSTANTS_PATH)}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    console.log('✅ Successfully published constants.json!');
    console.log(`   Published at: ${result.updatedAt || new Date().toISOString()}`);
    console.log(`   Path: ${result.path || CONSTANTS_PATH}\n`);

    return result;
  } catch (err: any) {
    console.error('❌ Failed to publish constants.json:', err.message);
    if (err.body) {
      console.error('   Error details:', err.body);
    }
    throw err;
  }
}

publishConstants().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
