#!/usr/bin/env node
/**
 * HubSpot Preflight Check
 *
 * Verifies HubSpot API token has required scopes before attempting writes.
 * Tests a safe read-only endpoint to validate connectivity and permissions.
 *
 * Usage:
 *   node scripts/hubspot/preflight.js
 *
 * Requires:
 *   HUBSPOT_PRIVATE_APP_TOKEN or HUBSPOT_PROJECT_ACCESS_TOKEN env var
 */

const https = require('https');

// Determine which token to use (prefer Project Access Token)
const token = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN || process.env.HUBSPOT_PRIVATE_APP_TOKEN;

if (!token) {
  console.error('❌ FAIL: No HubSpot token found');
  console.error('');
  console.error('Set one of the following environment variables:');
  console.error('  - HUBSPOT_PROJECT_ACCESS_TOKEN (preferred)');
  console.error('  - HUBSPOT_PRIVATE_APP_TOKEN (fallback)');
  process.exit(1);
}

const tokenType = process.env.HUBSPOT_PROJECT_ACCESS_TOKEN ? 'Project Access Token' : 'Private App Token';
console.log(`🔍 Testing HubSpot API connectivity with ${tokenType}...`);
console.log('');

// Test a safe read-only endpoint that requires minimal scopes
// Using HubDB tables list endpoint with limit=1 for minimal data transfer
const options = {
  hostname: 'api.hubapi.com',
  port: 443,
  path: '/cms/v3/hubdb/tables?limit=1',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ OK: HubSpot API connectivity verified');
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Endpoint: ${options.path}`);
      console.log('');
      console.log('Token has required scopes for CMS operations.');
      process.exit(0);
    } else if (res.statusCode === 401) {
      console.error('❌ FAIL: Authentication failed');
      console.error(`   Status: ${res.statusCode}`);
      console.error('');
      console.error('The HubSpot token is invalid or expired.');
      console.error('Generate a new token and update your environment variables.');
      process.exit(1);
    } else if (res.statusCode === 403) {
      console.error('❌ FAIL: Insufficient permissions');
      console.error(`   Status: ${res.statusCode}`);
      console.error('');
      try {
        const errorData = JSON.parse(data);
        console.error('Error details:', errorData.message || data);
      } catch (e) {
        console.error('Response:', data);
      }
      console.error('');
      console.error('The token lacks required HubSpot scopes.');
      console.error('Required scopes for this project:');
      console.error('  - cms.source_code.read');
      console.error('  - hubdb (read/write)');
      console.error('  - cms.performance.read (for page operations)');
      console.error('');
      console.error('Update scopes in HubSpot Private Apps settings or regenerate the token.');
      process.exit(1);
    } else {
      console.error(`❌ FAIL: Unexpected response`);
      console.error(`   Status: ${res.statusCode}`);
      console.error(`   Response: ${data}`);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ FAIL: Network error');
  console.error(`   ${error.message}`);
  console.error('');
  console.error('Unable to reach HubSpot API. Check your network connection.');
  process.exit(1);
});

req.setTimeout(10000, () => {
  req.destroy();
  console.error('❌ FAIL: Request timeout');
  console.error('');
  console.error('HubSpot API did not respond within 10 seconds.');
  process.exit(1);
});

req.end();
