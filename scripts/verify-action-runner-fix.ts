#!/usr/bin/env ts-node
/**
 * Verify that action-runner.html template is correctly published with constants.json integration
 */

import 'dotenv/config';
import { getHubSpotToken } from './hubspot/get-hubspot-token.js';

const HUBSPOT_TOKEN = getHubSpotToken();
const TEMPLATE_PATH = 'CLEAN x HEDGEHOG/templates/learn/action-runner.html';

async function verifyPublishedTemplate() {
  console.log('🔍 Verifying action-runner.html template...\n');

  try {
    const url = `https://api.hubapi.com/cms/v3/source-code/published/content/${encodeURIComponent(TEMPLATE_PATH)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Accept': 'application/octet-stream'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch template: HTTP ${response.status}`);
    }

    const content = await response.text();

    // Check for critical HubL code
    const checks = {
      'Constants variable set': content.includes('{% set constants = get_asset_url'),
      'request_json filter used': content.includes('|request_json'),
      'data-track-url attribute': content.includes('data-track-url="{{ constants.TRACK_EVENTS_URL'),
      'data-actions JSON structure': content.includes('data-actions="{{') && content.includes('|tojson|escapehtml'),
      'enroll_pathway action': content.includes("'enroll_pathway':"),
      'enroll_course action': content.includes("'enroll_course':"),
      'record_progress action': content.includes("'record_progress':")
    };

    console.log('Verification Results:');
    console.log('─'.repeat(60));

    let allPassed = true;
    for (const [check, passed] of Object.entries(checks)) {
      const icon = passed ? '✅' : '❌';
      console.log(`${icon} ${check}`);
      if (!passed) allPassed = false;
    }

    console.log('─'.repeat(60));

    if (allPassed) {
      console.log('\n✅ All checks passed! Template is correctly configured.\n');
      return true;
    } else {
      console.log('\n❌ Some checks failed. Template may need republishing.\n');
      return false;
    }
  } catch (err: any) {
    console.error('❌ Verification failed:', err.message);
    throw err;
  }
}

verifyPublishedTemplate().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
