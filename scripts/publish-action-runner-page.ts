#!/usr/bin/env ts-node
/**
 * Find and publish the action-runner page
 */

import 'dotenv/config';
import { getHubSpotToken, maskToken } from './hubspot/get-hubspot-token.js';

const TOKEN = getHubSpotToken();
const SLUG = 'learn/action-runner';

async function findPage(slug: string): Promise<any | null> {
  const listUrl = `https://api.hubapi.com/cms/v3/pages/site-pages?limit=100&slug=${encodeURIComponent(slug)}`;
  const response = await fetch(listUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`List failed: HTTP ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  // Filter by exact slug match
  const pages = result.results || [];
  return pages.find((p: any) => p.slug === slug) || null;
}

async function republishPage(pageId: string): Promise<any> {
  // Update the page with publishAction to force a republish
  const updateUrl = `https://api.hubapi.com/cms/v3/pages/site-pages/${pageId}/draft/push-buffer-live`;
  const response = await fetch(updateUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Republish failed: HTTP ${response.status} - ${errorText}`);
  }

  return response.status === 204 ? {} : await response.json();
}

async function main() {
  console.log(`🔍 Searching for page with slug: ${SLUG}`);
  console.log(`🔐 Using token: ${maskToken(TOKEN)}\n`);

  try {
    const page = await findPage(SLUG);

    if (!page) {
      console.log('❌ No page found with slug:', SLUG);
      console.log('   The page may need to be created manually in HubSpot Design Manager.');
      return;
    }

    console.log('✅ Found page:');
    console.log('   ID:', page.id);
    console.log('   Name:', page.name);
    console.log('   Slug:', page.slug);
    console.log('   State:', page.state);
    console.log('   Template:', page.templatePath);
    console.log('');

    if (page.state === 'PUBLISHED') {
      console.log('⚠️  Page is already PUBLISHED. Republishing will update it with latest template...\n');
    }

    console.log('📤 Republishing page...');
    await republishPage(page.id);

    console.log('✅ Page republished successfully!');
    console.log('');
    console.log('💡 The page will now use the latest published template.');
    console.log('   HubSpot may take a few moments to process the publish.');
    console.log('   Visit:', `https://hedgehog.cloud/${SLUG}`);
    console.log('');

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    throw err;
  }
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
