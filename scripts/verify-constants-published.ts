#!/usr/bin/env ts-node
/**
 * Verify that constants.json is correctly published and accessible
 */

import 'dotenv/config';
import { getHubSpotToken } from './hubspot/get-hubspot-token.js';

const HUBSPOT_TOKEN = getHubSpotToken();
const CONSTANTS_PATH = 'CLEAN x HEDGEHOG/templates/config/constants.json';

async function verifyPublishedConstants() {
  console.log('🔍 Verifying constants.json...\n');

  try {
    const url = `https://api.hubapi.com/cms/v3/source-code/published/content/${encodeURIComponent(CONSTANTS_PATH)}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
        'Accept': 'application/octet-stream'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch constants: HTTP ${response.status}`);
    }

    const content = await response.text();
    const constants = JSON.parse(content);

    // Check for required constants
    const checks = {
      'TRACK_EVENTS_URL present': !!constants.TRACK_EVENTS_URL,
      'TRACK_EVENTS_URL correct': constants.TRACK_EVENTS_URL?.includes('execute-api.us-west-2.amazonaws.com/events/track'),
      'AUTH_LOGIN_URL present': !!constants.AUTH_LOGIN_URL,
      'AUTH_LOGIN_URL correct': constants.AUTH_LOGIN_URL?.includes('execute-api.us-west-2.amazonaws.com/auth/login'),
      'ENABLE_CRM_PROGRESS set': constants.ENABLE_CRM_PROGRESS === true,
      'HUBDB_MODULES_TABLE_ID present': !!constants.HUBDB_MODULES_TABLE_ID,
      'HUBDB_PATHWAYS_TABLE_ID present': !!constants.HUBDB_PATHWAYS_TABLE_ID,
      'HUBDB_COURSES_TABLE_ID present': !!constants.HUBDB_COURSES_TABLE_ID
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
    console.log('\nConstants values:');
    console.log('  TRACK_EVENTS_URL:', constants.TRACK_EVENTS_URL || '(missing)');
    console.log('  AUTH_LOGIN_URL:', constants.AUTH_LOGIN_URL || '(missing)');
    console.log('');

    if (allPassed) {
      console.log('✅ All checks passed! Constants are correctly configured.\n');
      return true;
    } else {
      console.log('❌ Some checks failed. Constants may need republishing.\n');
      return false;
    }
  } catch (err: any) {
    console.error('❌ Verification failed:', err.message);
    throw err;
  }
}

verifyPublishedConstants().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
