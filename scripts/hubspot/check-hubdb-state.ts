#!/usr/bin/env node

import { Client } from '@hubspot/api-client';
import { getHubSpotToken } from './get-hubspot-token.js';

const TOKEN = getHubSpotToken();
const client = new Client({ accessToken: TOKEN });

const tableIds = {
  modules: 135621904,
  courses: 135381433,
  pathways: 135381504
};

async function checkTableState(name: string, id: number) {
  try {
    const table = await client.cms.hubdb.tablesApi.getTableDetails(String(id));
    console.log(`\n=== ${name.toUpperCase()} (ID: ${id}) ===`);
    console.log(`Name: ${table.name}`);
    console.log(`Published: ${table.publishedAt || 'Not published'}`);
    console.log(`Row Count: ${table.rowCount || 0}`);
    console.log(`Updated: ${table.updatedAt}`);
  } catch (err: any) {
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
