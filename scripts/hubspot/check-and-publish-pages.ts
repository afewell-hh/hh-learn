#!/usr/bin/env ts-node
/**
 * Check and publish pages
 */

import 'dotenv/config';
import { Client } from '@hubspot/api-client';

const hubspot = new Client({
  accessToken: process.env.HUBSPOT_PRIVATE_APP_TOKEN
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
      const page: any = await hubspot.cms.pages.sitePagesApi.getById(pageInfo.id);

      console.log(`Page: ${pageInfo.name} (ID: ${pageInfo.id})`);
      console.log(`  State: ${page.state}`);
      console.log(`  Template: ${page.templatePath}`);
      console.log(`  Published: ${page.publishDate || 'Not published'}`);

      // If in draft, schedule immediate publish
      if (page.state !== 'PUBLISHED') {
        console.log(`  Publishing...`);

        try {
          // Use direct API call to publish
          const response = await fetch(
            `https://api.hubapi.com/cms/v3/pages/site-pages/${pageInfo.id}/schedule`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_PRIVATE_APP_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({})
            }
          );

          if (response.ok) {
            console.log(`  ✓ Published successfully`);
          } else {
            const errorText = await response.text();
            console.log(`  ⚠️  Publish failed: ${response.status} - ${errorText}`);
          }
        } catch (err: any) {
          console.log(`  ⚠️  Publish error: ${err.message}`);
        }
      } else {
        console.log(`  ✓ Already published`);
      }

      console.log('');
    } catch (err: any) {
      console.error(`Error checking page ${pageInfo.name}:`, err.message);
    }
  }
}

main();
