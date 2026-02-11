#!/usr/bin/env ts-node
/**
 * Force republish a page by updating its draft and publishing
 */

import 'dotenv/config';
import { getHubSpotToken, maskToken } from './hubspot/get-hubspot-token.js';

const TOKEN = getHubSpotToken();
const PAGE_ID = '197934199840'; // action-runner page ID

async function forceRepublish() {
  console.log(`🔄 Force republishing page ID: ${PAGE_ID}`);
  console.log(`🔐 Using token: ${maskToken(TOKEN)}\n`);

  try {
    // Step 1: Get current page details
    const getUrl = `https://api.hubapi.com/cms/v3/pages/site-pages/${PAGE_ID}`;
    const getResponse = await fetch(getUrl, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (!getResponse.ok) {
      throw new Error(`Failed to get page: HTTP ${getResponse.status}`);
    }

    const page = await getResponse.json();
    console.log('Current page state:', page.state);
    console.log('Template:', page.templatePath);
    console.log('');

    // Step 2: Update the page draft (force update with current template)
    console.log('📝 Updating page draft to force template refresh...');
    const updateUrl = `https://api.hubapi.com/cms/v3/pages/site-pages/${PAGE_ID}/draft`;
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        templatePath: page.templatePath, // Keep same template
        name: page.name // Keep same name
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update draft: HTTP ${updateResponse.status} - ${errorText}`);
    }

    console.log('✅ Draft updated');
    console.log('');

    // Step 3: Publish the page using the buffer endpoint
    console.log('📤 Publishing page...');
    const publishUrl = `https://api.hubapi.com/cms/v3/pages/site-pages/${PAGE_ID}`;
    const publishResponse = await fetch(publishUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        publishImmediately: true
      })
    });

    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      throw new Error(`Failed to publish: HTTP ${publishResponse.status} - ${errorText}`);
    }

    console.log('✅ Page republished successfully!');
    console.log('');
    console.log('💡 The page should now render with the latest template.');
    console.log('   Wait 30-60 seconds, then check: https://hedgehog.cloud/learn/action-runner');
    console.log('');

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    throw err;
  }
}

forceRepublish().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
