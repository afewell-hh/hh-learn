#!/usr/bin/env ts-node
/**
 * Publish pages using PATCH method
 */

import 'dotenv/config';
import { getHubSpotToken } from './get-hubspot-token.js';

const TOKEN = getHubSpotToken();

const pageIds = [
  { id: '197280289288', name: 'Courses' },
  { id: '197280289546', name: 'Pathways' }
];

async function publishPage(pageId: string, pageName: string) {
  try {
    const response = await fetch(
      `https://api.hubapi.com/cms/v3/pages/site-pages/${pageId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          state: 'PUBLISHED'
        })
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`✓ ${pageName} published successfully`);
      console.log(`  URL: https://hedgehog.cloud/${data.slug}`);
      return true;
    } else {
      const errorText = await response.text();
      console.log(`✗ ${pageName} publish failed: ${response.status}`);
      console.log(`  Error: ${errorText}`);
      return false;
    }
  } catch (err: any) {
    console.error(`✗ Error publishing ${pageName}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('Publishing pages...\n');

  for (const page of pageIds) {
    await publishPage(page.id, page.name);
    console.log('');
  }
}

main();
